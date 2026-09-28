"""DeskFlow-VLA sandboxed trajectory-expression evaluator (TODO-20).

LLM-synthesized motion code is NEVER exec()'d directly. Models may return a
trajectory as a guarded expression string, e.g.::

    {"expr": "[ [0.1*t, -0.6+0.05*sin(t), 1.1, 0.0] for t in lin(0, 1, 24) ]"}

This module (1) validates the AST against a strict whitelist (math only: no
imports, attributes, loops-as-statements, I/O, or dunders) and (2) evaluates
it with ``__builtins__`` stripped and only whitelisted names visible.
Every result is still gated by ``cbf_safety.validate_trajectory`` afterwards
defense in depth: sandbox first, CBF second.
"""
from __future__ import annotations

import ast
import math

# math.* functions exposed to expressions (by bare name, no attribute access).
_ALLOWED_FUNCS = {
    name: getattr(math, name)
    for name in (
        "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
        "sqrt", "exp", "log", "fabs", "floor", "ceil", "pow",
    )
}
_ALLOWED_FUNCS.update({
    "abs": abs, "min": min, "max": max, "round": round,
    "pi": math.pi, "e": math.e, "tau": math.tau,
})


def lin(a: float, b: float, n: int) -> list[float]:
    """Inclusive linspace helper available inside expressions."""
    n = max(2, int(n))
    return [a + (b - a) * i / (n - 1) for i in range(n)]


_ALLOWED_FUNCS["lin"] = lin

# AST node types permitted anywhere in the expression.
_ALLOWED_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.IfExp, ast.Compare,
    ast.Call, ast.Name, ast.Load, ast.Constant,
    ast.List, ast.Tuple,
    ast.ListComp, ast.comprehension,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow, ast.USub, ast.UAdd,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.And, ast.Or,
)


class SandboxError(ValueError):
    """Raised when an expression violates the whitelist."""


def _collect_targets(target: ast.AST, bound: set[str]) -> None:
    """Collect comprehension loop variables (rejecting dunders)."""
    if isinstance(target, ast.Name):
        if target.id.startswith("_"):
            raise SandboxError(f"forbidden name: {target.id}")
        bound.add(target.id)
    elif isinstance(target, ast.Starred):
        _collect_targets(target.value, bound)
    elif isinstance(target, (ast.Tuple, ast.List)):
        for elt in target.elts:
            _collect_targets(elt, bound)
    else:
        raise SandboxError(f"forbidden assignment target: {type(target).__name__}")


def _check(node: ast.AST, params: set[str], bound: frozenset[str] = frozenset(), depth: int = 0) -> None:
    if depth > 64:
        raise SandboxError("expression too deeply nested")
    if not isinstance(node, _ALLOWED_NODES):
        raise SandboxError(f"forbidden syntax: {type(node).__name__}")
    if isinstance(node, ast.ListComp):
        scope = set(bound)
        for gen in node.generators:
            _check(gen.iter, params, scope, depth + 1)
            _collect_targets(gen.target, scope)
            for cond in gen.ifs:
                _check(cond, params, scope, depth + 1)
        _check(node.elt, params, scope, depth + 1)
        return
    if isinstance(node, ast.Name):
        if node.id.startswith("_") or (node.id not in _ALLOWED_FUNCS and node.id not in params and node.id not in bound):
            raise SandboxError(f"forbidden name: {node.id}")
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _ALLOWED_FUNCS:
            raise SandboxError("only whitelisted math calls allowed")
        if node.keywords:
            raise SandboxError("keyword arguments not allowed")
    for child in ast.iter_child_nodes(node):
        _check(child, params, bound, depth + 1)


def eval_trajectory_expr(expr: str, params: dict[str, float] | None = None) -> list[dict]:
    """Validate + evaluate ``expr`` into a CBF-ready trajectory.

    Returns ``[{"q": [4 floats], "dq": [0.0]*4}]``. Raises SandboxError on any
    whitelist violation or shape error. Velocities are zeroed here — the CBF
    planner (not the LLM) owns dynamics.
    """
    if not isinstance(expr, str) or len(expr) > 4096:
        raise SandboxError("expression must be a short string")
    params = dict(params or {})
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as exc:
        raise SandboxError(f"syntax error: {exc}") from exc
    _check(tree, set(params))
    env: dict = {"__builtins__": {}}
    env.update(_ALLOWED_FUNCS)
    env.update(params)
    try:
        result = eval(compile(tree, "<traj>", "eval"), env)  # noqa: S307 — AST-whitelisted above
    except Exception as exc:  # noqa: BLE001 — convert to SandboxError
        raise SandboxError(f"evaluation failed: {exc}") from exc
    if not isinstance(result, (list, tuple)) or not result:
        raise SandboxError("expression must produce a non-empty waypoint list")
    traj = []
    for i, wp in enumerate(result):
        if not isinstance(wp, (list, tuple)) or len(wp) != 4:
            raise SandboxError(f"waypoint {i}: expected 4 joint values")
        try:
            q = [float(v) for v in wp]
        except (TypeError, ValueError) as exc:
            raise SandboxError(f"waypoint {i}: non-numeric value") from exc
        if any(v != v or abs(v) == float("inf") for v in q):  # NaN / Inf
            raise SandboxError(f"waypoint {i}: NaN or Inf rejected")
        traj.append({"q": q, "dq": [0.0] * 4})
    return traj
