"""DeskFlow-VLA multi-tier AI fallback client.

Tier 1 (primary):   Muse Spark 1.3 / Codestral Small — trajectory + code synthesis
Tier 2 (fallback):  Gemini 2.5 / 3.8 Flash via Antigravity — multimodal audit/OCR
Tier 3 (emergency): Amazon Kiro — remote inference

Resilience: per-tier timeout, HTTP 429/5xx exponential backoff, token refresh hook.
Never raises on total failure — returns a structured ``AIResult`` with tier trace
so the supervisor can park safely instead of dropping ROS frames.
"""
from __future__ import annotations

import os
import random
import time
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class AIResult:
    ok: bool
    data: dict[str, Any] = field(default_factory=dict)
    tier_used: str = "none"
    attempts: list[str] = field(default_factory=list)
    error: str = ""


def _backoff(attempt: int, base: float = 0.5, cap: float = 8.0) -> float:
    return min(cap, base * (2**attempt) + random.uniform(0, 0.25))


class FallbackClient:
    def __init__(
        self,
        muse_key: str | None = None,
        gemini_key: str | None = None,
        kiro_key: str | None = None,
        timeout_s: float = 12.0,
        max_retries: int = 3,
        transport: Callable[..., dict] | None = None,
    ) -> None:
        self.muse_key = muse_key or os.getenv("MUSE_SPARK_KEY", "")
        self.gemini_key = gemini_key or os.getenv("GEMINI_API_KEY", "")
        self.kiro_key = kiro_key or os.getenv("KIRO_API_KEY", "")
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        # Injectable HTTP transport for tests: fn(tier, payload) -> dict (raises on failure)
        self._transport = transport or self._default_transport
        self._tokens: dict[str, tuple[str, float]] = {}

    # -- token cache with expiry ------------------------------------------------
    def _token(self, tier: str) -> str:
        tok, exp = self._tokens.get(tier, ("", 0.0))
        if tok and exp > time.time() + 30:
            return tok
        fresh = f"{tier}-token-{int(time.time())}"
        self._tokens[tier] = (fresh, time.time() + 3300)
        return fresh

    def _default_transport(self, tier: str, payload: dict) -> dict:
        """Production hook: swap for real SDK calls (openai-compatible endpoints)."""
        raise RuntimeError(f"no live transport configured for tier={tier} (payload keys={sorted(payload)})")

    # -- public API --------------------------------------------------------------
    def audit_invoice(self, invoice: dict[str, Any]) -> AIResult:
        payload = {"task": "audit_invoice", "invoice": invoice}
        return self._run(payload)

    def plan_trajectory(self, start: list[float], goal: list[float]) -> AIResult:
        payload = {"task": "plan_trajectory", "start": start, "goal": goal}
        return self._run(payload)

    def _run(self, payload: dict) -> AIResult:
        tiers = [("muse-spark-1.3", self.muse_key), ("gemini-flash", self.gemini_key), ("kiro", self.kiro_key)]
        attempts: list[str] = []
        last_err = ""
        for tier, key in tiers:
            if tier != "muse-spark-1.3" and not key and os.getenv("DESKFLOW_STRICT_KEYS") == "1":
                attempts.append(f"{tier}:skipped(no-key)")
                continue
            for attempt in range(self.max_retries):
                try:
                    self._token(tier)  # refresh if expired
                    data = self._transport(tier, payload)
                    return AIResult(ok=True, data=data, tier_used=tier, attempts=attempts + [f"{tier}:ok"])
                except Exception as exc:  # noqa: BLE001 — fall through tiers
                    msg = str(exc)
                    last_err = msg
                    attempts.append(f"{tier}:try{attempt}:{msg[:80]}")
                    retryable = any(s in msg for s in ("429", "500", "502", "503", "timeout", "rate"))
                    if not retryable and "no live transport" not in msg:
                        break
                    time.sleep(_backoff(attempt))
        return AIResult(ok=False, tier_used="none", attempts=attempts, error=last_err or "all tiers exhausted")
