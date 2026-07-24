import argparse
import threading
import time
import webbrowser
from contextlib import suppress
from pathlib import Path
from typing import TYPE_CHECKING

from codealmanac.app import CodeAlmanac

if TYPE_CHECKING:
    import uvicorn


def open_viewer_when_ready(server: "uvicorn.Server", url: str) -> None:
    while not server.started:
        if server.should_exit:
            return
        time.sleep(0.05)

    try:
        webbrowser.open_new_tab(url)
    except webbrowser.Error:
        # The URL remains visible in the terminal on headless systems.
        return


def run_serve(app: CodeAlmanac, args: argparse.Namespace) -> int:
    import uvicorn
    from uvicorn.main import STARTUP_FAILURE

    from codealmanac.server.app import create_server_app

    server_app = create_server_app(app, Path.cwd(), args.wiki, host=args.host)
    url = f"http://{args.host}:{args.port}"
    server = uvicorn.Server(
        uvicorn.Config(
            server_app,
            host=args.host,
            port=args.port,
            log_level="warning",
        )
    )
    print(f"codealmanac viewer: {url}")
    if not args.no_open:
        threading.Thread(
            target=open_viewer_when_ready,
            args=(server, url),
            name="codealmanac-viewer-browser",
            daemon=True,
        ).start()
    with suppress(KeyboardInterrupt):
        server.run()
    if not server.started:
        raise SystemExit(STARTUP_FAILURE)
    return 0
