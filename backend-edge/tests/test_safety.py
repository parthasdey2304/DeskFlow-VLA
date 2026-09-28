"""CBF + fallback + supervisor unit tests (run: pytest -q)."""
from ai_fallback_client import FallbackClient
from cbf_safety import plan_cubic_bezier, validate_trajectory
from supervisor import INPUT_TRAY, extract_fields, Supervisor


def test_h_pos_rejects_out_of_range():
    traj = [{"q": [9.9, 0, 0, 0], "dq": [0, 0, 0, 0]}]
    r = validate_trajectory(traj)
    assert not r.safe and any("h_pos" in v for v in r.violations)


def test_h_vel_rejects_overspeed():
    traj = [{"q": [0, 0, 0, 0], "dq": [0, 0, 0, 99.0]}]
    r = validate_trajectory(traj)
    assert not r.safe and any("h_vel" in v for v in r.violations)


def test_empty_trajectory_unsafe():
    assert not validate_trajectory([]).safe


def test_planned_bezier_is_safe():
    traj = plan_cubic_bezier(INPUT_TRAY, [1.4, -0.3, 0.6, 0.9])
    r = validate_trajectory(traj)
    assert r.safe, r.violations


def test_math_check_flags_discrepancy():
    ok = extract_fields({"subtotal": 100, "tax": 18, "total": 118})
    bad = extract_fields({"subtotal": 100, "tax": 18, "total": 999})
    assert ok["valid_math"] and not bad["valid_math"]


def test_fallback_tier_chain():
    calls = []

    def flaky(tier, payload):
        calls.append(tier)
        if tier == "muse-spark-1.3":
            raise RuntimeError("503 overloaded")
        return {"vendor": "Acme", "invoice_no": "INV-9", "subtotal": 10, "tax": 1, "total": 11}

    client = FallbackClient(muse_key="k", gemini_key="k", kiro_key="k", transport=flaky)
    out = client.audit_invoice({"subtotal": 10, "tax": 1, "total": 11})
    assert out.ok and out.tier_used == "gemini-flash"


def test_supervisor_routes_and_gates():
    ai = FallbackClient(transport=lambda tier, p: dict(p.get("invoice", {"subtotal": 0, "tax": 0, "total": 1})))
    sup = Supervisor(ai=ai)
    good = sup.process_invoice({"vendor": "A", "invoice_no": "G1", "subtotal": 100, "tax": 18, "total": 118})
    bad = sup.process_invoice({"vendor": "B", "invoice_no": "B1", "subtotal": 100, "tax": 18, "total": 10})
    assert good.destination == "approved" and good.cbf.safe
    assert bad.destination == "audit_flagged"
