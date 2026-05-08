"""将 ``backend`` 目录加入 ``sys.path``，以便 ``import onemix``（包位于 ``backend/onemix``）。"""

from __future__ import annotations

import sys
from pathlib import Path

_done = False


def ensure() -> None:
    global _done
    if _done:
        return
    # backend/app/xxx.py → backend 目录
    backend_dir = Path(__file__).resolve().parent.parent
    if (backend_dir / "onemix").is_dir():
        s = str(backend_dir.resolve())
        if s not in sys.path:
            sys.path.insert(0, s)
    _done = True
