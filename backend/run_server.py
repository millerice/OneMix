"""开发启动：将 backend 目录加入 sys.path 后启动 uvicorn（onemix 位于 backend/onemix）。"""

from __future__ import annotations

import sys
from pathlib import Path

_backend = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend))

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8767,
        reload=True,
        reload_dirs=[str(_backend / "app"), str(_backend / "onemix")],
    )
