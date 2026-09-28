"""AST sandbox unit tests (TODO-20). Run: pytest -q."""
import pytest

from cbf_safety import validate_trajectory
from traj_sandbox import SandboxError, eval_trajectory_expr


def test_accepts_math_trajectory():
    traj = eval_trajectory_expr(
        "[ [0.1*t, -0.6+0.05*sin(t), 1.1, 0.0] for t in lin(0, 1, 24) ]"
    )
    assert len(traj) == 24 and all(len(w["q"]) == 4 for w in traj)
    assert validate_trajectory(traj).safe


def test_accepts_params_and_conditionals():
    traj = eval_trajectory_expr(
        "[ [a if t > 0.5 else -a, 0.0, 0.0, 0.0] for t in lin(0, 1, 4) ]",
        {"a": 0.3},
    )
    assert [w["q"][0] for w in traj] == [-0.3, -0.3, 0.3, 0.3]


@pytest.mark.parametrize("evil", [
    "__import__('os').system('x')",
    "(lambda: 1)()",
    "[x for x in ().__class__.__base__.__subclasses__()]",
    "open('/etc/passwd').read()",
    "exec('1')",
    "eval('1')",
    "import os",
    "q.__dict__",
    "[a.b for a in lin(0,1,2)]",
    "while True: pass",
    "{'a': 1}['a']",
])
def test_rejects_hostile_syntax(evil):
    with pytest.raises(SandboxError):
        eval_trajectory_expr(f"[ [0,0,0,{evil}] for t in lin(0,1,2) ]")


def test_rejects_bad_shapes():
    with pytest.raises(SandboxError):
        eval_trajectory_expr("[]")
    with pytest.raises(SandboxError):
        eval_trajectory_expr("[ [0, 0, 0] for t in lin(0,1,2) ]")
    with pytest.raises(SandboxError):
        eval_trajectory_expr("[ [float('nan'), 0, 0, 0] for t in lin(0,1,2) ]")


def test_rejects_unknown_names():
    with pytest.raises(SandboxError):
        eval_trajectory_expr("[ [zzz, 0, 0, 0] for t in lin(0,1,2) ]")
