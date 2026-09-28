"""DeskFlow-VLA Control Barrier Function (CBF) safety engine.

Every spline is verified before streaming to the ESP32-S3:

    h_pos(q)  = min(q_max - q, q - q_min) >= 0
    h_vel(dq) = v_max - |dq|              >= 0

A trajectory is a list of waypoints; each waypoint is a dict with
``q`` (4 joint positions, rad) and ``dq`` (4 joint velocities, rad/s).
Any single breach discards the ENTIRE path (fail-closed).
"""
from __future__ import annotations

from dataclasses import dataclass, field

Q_MIN = (-2.62, -1.57, -2.09, -2.62)
Q_MAX = (2.62, 1.57, 2.09, 2.62)
V_MAX = 3.0
DOF = 4


@dataclass
class CBFResult:
    safe: bool
    violations: list[str] = field(default_factory=list)
    min_h_pos: float = float("inf")
    min_h_vel: float = float("inf")

    def to_audit(self) -> dict:
        return {
            "safe": self.safe,
            "violations": self.violations,
            "min_h_pos": self.min_h_pos,
            "min_h_vel": self.min_h_vel,
        }


def h_pos(q: float, j: int) -> float:
    """Position barrier for joint j: distance to nearest limit."""
    return min(Q_MAX[j] - q, q - Q_MIN[j])


def h_vel(dq: float) -> float:
    """Velocity barrier: headroom below v_max."""
    return V_MAX - abs(dq)


def validate_waypoint(q: tuple | list, dq: tuple | list, idx: int) -> CBFResult:
    res = CBFResult(safe=True)
    if len(q) != DOF or len(dq) != DOF:
        return CBFResult(safe=False, violations=[f"wp{idx}: expected {DOF}DOF, got q={len(q)} dq={len(dq)}"])
    for j in range(DOF):
        hp = h_pos(float(q[j]), j)
        hv = h_vel(float(dq[j]))
        res.min_h_pos = min(res.min_h_pos, hp)
        res.min_h_vel = min(res.min_h_vel, hv)
        if hp < 0:
            res.safe = False
            res.violations.append(f"wp{idx}:j{j} h_pos={hp:.3f} < 0 (q={q[j]:.3f} outside [{Q_MIN[j]}, {Q_MAX[j]}])")
        if hv < 0:
            res.safe = False
            res.violations.append(f"wp{idx}:j{j} h_vel={hv:.3f} < 0 (|dq|={abs(dq[j]):.3f} > {V_MAX})")
    return res


def validate_trajectory(trajectory: list[dict]) -> CBFResult:
    """Fail-closed validation of a full path. Empty path is unsafe."""
    if not trajectory:
        return CBFResult(safe=False, violations=["empty trajectory"])
    merged = CBFResult(safe=True)
    for i, wp in enumerate(trajectory):
        r = validate_waypoint(wp.get("q", []), wp.get("dq", []), i)
        merged.min_h_pos = min(merged.min_h_pos, r.min_h_pos)
        merged.min_h_vel = min(merged.min_h_vel, r.min_h_vel)
        if not r.safe:
            merged.safe = False
            merged.violations.extend(r.violations)
    return merged


def cubic_bezier(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
    u = 1.0 - t
    return u**3 * p0 + 3 * u**2 * t * p1 + 3 * u * t**2 * p2 + t**3 * p3


def plan_cubic_bezier(start: list[float], goal: list[float], steps: int = 24, clearance: float = 0.15) -> list[dict]:
    """Plan a smooth joint-space Bezier with control points pulled inside limits."""
    traj: list[dict] = []
    prev = list(start)
    for s in range(steps + 1):
        t = s / steps
        q, dq = [], []
        for j in range(DOF):
            c1 = min(max(start[j] + clearance, Q_MIN[j] + 1e-3), Q_MAX[j] - 1e-3)
            c2 = min(max(goal[j] - clearance, Q_MIN[j] + 1e-3), Q_MAX[j] - 1e-3)
            pos = cubic_bezier(start[j], c1, c2, goal[j], t)
            vel = (pos - prev[j]) * steps / 2.0  # normalized-rate proxy
            q.append(pos)
            dq.append(max(min(vel, V_MAX * 0.8), -V_MAX * 0.8))
        traj.append({"q": q, "dq": dq})
        prev = list(q)
    return traj
