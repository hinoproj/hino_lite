# [MODULE] check | Serve the app locally and run the browser test pages in headless Chrome; also a plain dev server and screenshots
# [IFACE] layer: tooling | in: CLI (all | selftest | smoke | serve | shots) -> out: pass/fail report and exit code, or a running server, or PNGs | crosses: [filesystem, local HTTP server, Chrome process]
# [GRAPH] needs: [selftest-page, browser-smoke-page, scene] | feeds: [] | group: tooling
# [STATE] stateless | persists: shots write PNGs to the given folder | raises: SystemExit 1 on a failed check or a missing browser
# /// script
# requires-python = ">=3.11"
# ///
"""Hino Lite checks -- no Node, just Python and a Chromium browser.

    uv run tools/check.py              # rule selftest + UI smoke test, exit 1 on any failure
    uv run tools/check.py selftest     # rules only
    uv run tools/check.py smoke        # UI only
    uv run tools/check.py serve        # dev server on http://127.0.0.1:8000 (correct MIME types)
    uv run tools/check.py shots OUT    # screenshots of the main screens at phone and tablet sizes

The test pages report back by POSTing their text to /__report, so this script
knows when they are done. Chrome runs headless with a throwaway profile; set
CHROME to a browser binary if it is not found.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

APP_ROOT = Path(__file__).resolve().parent.parent
TYPES = {".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
         ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".css": "text/css",
         ".html": "text/html", ".png": "image/png"}
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]
# (name, hash or query, width, height) -- see tools/scene.html for the scenes.
SHOTS = [("words", "words", 390, 844), ("word-form", "word-form", 390, 844),
         ("review", "review", 390, 844), ("kanji", "kanji", 390, 844), ("card", "card", 390, 844),
         ("kana", "kana", 390, 844), ("words-tablet", "words", 1280, 800),
         ("kanji-tablet", "kanji", 1280, 800), ("card-tablet", "card", 1280, 800),
         ("review-tablet", "review", 1280, 800), ("sentences", "sentences", 390, 844),
         ("sentence-form", "sentence-form", 390, 844), ("sentence-words", "sentence-words", 390, 844),
         ("sentence-words-tablet", "sentence-words", 1280, 800)]


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **TYPES}
    reports: dict = {}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        # /__delay?ms=N answers after N ms: the scene page holds its load event on it, so a
        # screenshot waits for the app's real (asynchronous) work instead of virtual time.
        url = urlparse(self.path)
        if url.path == "/__delay":
            time.sleep(min(int(parse_qs(url.query).get("ms", ["0"])[0]), 30000) / 1000)
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/__report":
            self.send_error(404)
            return
        name = parse_qs(url.query).get("name", ["report"])[0]
        length = int(self.headers.get("Content-Length") or 0)
        Handler.reports[name] = self.rfile.read(length).decode("utf-8", "replace")
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        pass


def start_server(port: int = 0) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(APP_ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def find_chrome() -> str:
    candidates = [os.environ.get("CHROME")] + CHROME_PATHS + [
        shutil.which(n) for n in ("chrome", "google-chrome", "chromium", "chromium-browser", "msedge")]
    for c in candidates:
        if c and Path(c).is_file():
            return c
    print("[check.py][find_chrome] no Chrome/Edge found; set CHROME to its path", file=sys.stderr)
    raise SystemExit(1)


def chrome_args(chrome: str, profile: str, width: int, height: int) -> list:
    return [chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
            "--disable-extensions", f"--user-data-dir={profile}", f"--window-size={width},{height}"]


def run_page(chrome: str, base: str, page: str, name: str, timeout: float) -> bool:
    Handler.reports.pop(name, None)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        proc = subprocess.Popen(chrome_args(chrome, profile, 1000, 1400) + [f"{base}/{page}"],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.time() + timeout
        while name not in Handler.reports and time.time() < deadline:
            time.sleep(0.2)
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    report = Handler.reports.get(name)
    if report is None:
        print(f"{name}: no report within {timeout:.0f}s (page crashed or hung)")
        return False
    print(report)
    return report.rstrip().endswith("PASSED")


def take_shots(chrome: str, base: str, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for name, scene, width, height in SHOTS:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
            target = out / f"{name}.png"
            subprocess.run(chrome_args(chrome, profile, width, height) + [
                "--hide-scrollbars", f"--screenshot={target}",
                f"{base}/tools/scene.html?scene={scene}&w={width}&h={height}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=120)
            print(("ok   " if target.is_file() else "FAIL ") + str(target))


def main() -> None:
    # Reports hold kana and kanji; a Windows console defaults to a code page that has neither.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("command", nargs="?", default="all", choices=["all", "selftest", "smoke", "serve", "shots"])
    parser.add_argument("out", nargs="?", default="shots", help="folder for screenshots (shots only)")
    parser.add_argument("--port", type=int, default=8000, help="port for serve")
    args = parser.parse_args()

    if args.command == "serve":
        server = start_server(args.port)
        print(f"Serving {APP_ROOT} at http://127.0.0.1:{server.server_address[1]}/ -- Ctrl+C to stop")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            server.shutdown()
        return

    chrome = find_chrome()
    server = start_server()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        if args.command == "shots":
            take_shots(chrome, base, Path(args.out).resolve())
            return
        results = []
        if args.command in ("all", "selftest"):
            results.append(run_page(chrome, base, "tools/selftest.html", "selftest", 60))
        if args.command in ("all", "smoke"):
            results.append(run_page(chrome, base, "tools/browser-smoke.html", "smoke", 240))
        print("\nALL CHECKS PASSED" if all(results) else "\nCHECKS FAILED")
        if not all(results):
            raise SystemExit(1)
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
