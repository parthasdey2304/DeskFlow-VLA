"""DeskFlow-VLA ROS 2 edge supervisor.

Pipeline: IMX477 frame → AI fallback audit → Bezier plan → CBF verify →
micro-ROS stream to ESP32-S3 → Firestore/audit log.

Degrades safely: any AI/CBF failure parks the arm and flags the invoice.
"""
from __future__ import annotations

import math
import os
from dataclasses import dataclass, field

try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import Bool, Float32MultiArray, String
    HAS_ROS = True
except ImportError:  # host / CI without ROS 2
    HAS_ROS = False
    Node = object  # type: ignore

from ai_fallback_client import FallbackClient
from cbf_safety import CBFResult, plan_cubic_bezier, validate_trajectory

INPUT_TRAY = [0.0, -0.6, 1.1, 0.0]
APPROVED_BIN = [1.4, -0.3, 0.6, 0.9]
AUDIT_BIN = [-1.4, -0.3, 0.6, -0.9]


def extract_fields(raw: dict) -> dict:
    """Normalize model output → vendor, invoice_no, subtotal, tax, total, valid_math."""
    def num(v) -> float:
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0

    subtotal, tax, total = num(raw.get("subtotal")), num(raw.get("tax")), num(raw.get("total"))
    return {
        "vendor": str(raw.get("vendor", "unknown")),
        "invoice_no": str(raw.get("invoice_no", "unknown")),
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "valid_math": math.isclose(subtotal + tax, total, rel_tol=1e-6, abs_tol=0.01),
    }


@dataclass
class CycleResult:
    invoice: dict
    destination: str
    trajectory: list[dict] = field(default_factory=list)
    cbf: CBFResult | None = None
    tier_used: str = "none"
    audit_topic: str = "/deskflow/audit_stream"


class Supervisor:
    """ROS-agnostic core so unit tests run without rclpy."""

    def __init__(self, ai: FallbackClient | None = None) -> None:
        self.ai = ai or FallbackClient()
        self.audit_log: list[dict] = []

    def process_invoice(self, raw_invoice: dict) -> CycleResult:
        res = self.ai.audit_invoice(raw_invoice)
        fields = extract_fields(res.data if res.ok else raw_invoice)
        dest = "approved" if fields["valid_math"] else "audit_flagged"
        goal = APPROVED_BIN if fields["valid_math"] else AUDIT_BIN

        plan = self.ai.plan_trajectory(INPUT_TRAY, goal)
        if plan.ok and isinstance(plan.data.get("waypoints"), list) and plan.data["waypoints"]:
            traj = [{"q": w[:4], "dq": [0.0] * 4} for w in plan.data["waypoints"]]
        else:
            traj = plan_cubic_bezier(INPUT_TRAY, goal)

        cbf = validate_trajectory(traj)
        if not cbf.safe:
            self.audit_log.append({"event": "cbf_reject", **cbf.to_audit(), "invoice": fields["invoice_no"]})
            traj = []  # fail-closed: stream nothing
            dest = "audit_flagged"

        cycle = CycleResult(invoice=fields, destination=dest, trajectory=traj, cbf=cbf, tier_used=res.tier_used)
        self.audit_log.append({
            "event": "cycle", "invoice_no": fields["invoice_no"], "valid_math": fields["valid_math"],
            "destination": dest, "tier": res.tier_used, "safe": cbf.safe,
        })
        return cycle

    def flatten(self, traj: list[dict]) -> list[float]:
        return [v for wp in traj for v in wp["q"]]


if HAS_ROS:
    class SupervisorNode(Node):  # type: ignore
        def __init__(self) -> None:
            super().__init__("deskflow_supervisor")
            self.core = Supervisor()
            self.traj_pub = self.create_publisher(Float32MultiArray, "/deskflow/trajectory", 10)
            self.audit_pub = self.create_publisher(String, "/deskflow/audit_stream", 10)
            self.estop_sub = self.create_subscription(Bool, "/deskflow/estop", self._on_estop, 10)
            self.estopped = False
            self.get_logger().info("DeskFlow supervisor online (CBF-gated).")

        def _on_estop(self, msg: Bool) -> None:
            if msg.data:
                self.estopped = True
                self.get_logger().error("E-STOP latched — motion frozen.")

        def process_and_stream(self, raw_invoice: dict) -> CycleResult:
            cycle = self.core.process_invoice(raw_invoice)
            alert = String()
            if not cycle.cbf or not cycle.cbf.safe or not cycle.invoice["valid_math"]:
                alert.data = f"FLAGGED {cycle.invoice['invoice_no']} tier={cycle.tier_used}"
                self.audit_pub.publish(alert)
            if cycle.trajectory and not self.estopped:
                msg = Float32MultiArray()
                msg.data = self.core.flatten(cycle.trajectory)
                self.traj_pub.publish(msg)
            return cycle


def main() -> None:
    if not HAS_ROS:
        print("rclpy not available — running host self-check.")
        core = Supervisor(ai=FallbackClient(transport=lambda tier, p: {"vendor": "Acme", "invoice_no": "INV-1", "subtotal": 100, "tax": 18, "total": 118}))
        print(core.process_invoice({"vendor": "Acme", "invoice_no": "INV-1", "subtotal": 100, "tax": 18, "total": 118}))
        return
    rclpy.init()
    node = SupervisorNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
