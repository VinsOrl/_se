"""Tools the agent can call: plain functions + JSON schemas + one dispatcher."""
import ast
import operator
from pathlib import Path

ROOT = Path.cwd().resolve()  # sandbox: tools only see files under the start folder
MAX_CHARS = 4000             # cap on what read_file / list_dir hand back to the model

OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod, ast.Pow: operator.pow,
    ast.USub: operator.neg, ast.UAdd: operator.pos,
}


def _eval(node):
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in OPS:
        left, right = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and (abs(right) > 100 or abs(left) > 1e100):
            raise ValueError("power too large")  # stops 9**9**9 hanging the CPU
        return OPS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and type(node.op) in OPS:
        return OPS[type(node.op)](_eval(node.operand))
    raise ValueError(f"not allowed: {type(node).__name__}")


def calculator(expression):
    """Arithmetic only. Parsed with ast, never eval()."""
    if len(expression) > 200:
        raise ValueError("expression too long")
    result = _eval(ast.parse(expression, mode="eval").body)
    if isinstance(result, complex):  # e.g. (-8)**0.5
        raise ValueError("result is not a real number")
    return str(result)


def _safe(path):
    p = (ROOT / path).resolve()  # resolve() also follows symlinks
    if not p.is_relative_to(ROOT):
        raise PermissionError(f"{path} is outside the sandbox")
    if any(part.startswith(".") for part in p.relative_to(ROOT).parts):
        raise PermissionError(f"{path} is hidden (.env, .git, ... are off limits)")
    return p


def list_dir(path="."):
    names = sorted(c.name + ("/" if c.is_dir() else "") for c in _safe(path).iterdir()
                   if not c.name.startswith("."))
    return "\n".join(names)[:MAX_CHARS]


def read_file(path):
    p = _safe(path)
    if not p.is_file():  # no dirs, FIFOs or devices (a FIFO would hang the read)
        raise ValueError(f"{path} is not a regular file")
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read(MAX_CHARS)


TOOLS = {"calculator": calculator, "list_dir": list_dir, "read_file": read_file}

SCHEMAS = [
    {"name": "calculator", "description": "Evaluate an arithmetic expression like '2*(3+4)'.",
     "input_schema": {"type": "object", "properties": {"expression": {"type": "string"}},
                      "required": ["expression"]}},
    {"name": "list_dir", "description": "List files in a folder (relative to the project).",
     "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}}},
    {"name": "read_file", "description": "Read a text file (relative path, first 4000 chars).",
     "input_schema": {"type": "object", "properties": {"path": {"type": "string"}},
                      "required": ["path"]}},
]


def run_tool(name, args):
    """Never raises: errors go back to the model as text so it can recover."""
    if name not in TOOLS:
        return f"ERROR: unknown tool {name!r}"
    try:
        return str(TOOLS[name](**args))  # the API wants text; str() so an int result can't crash the loop
    except Exception as e:
        return f"ERROR: {type(e).__name__}: {e}"
