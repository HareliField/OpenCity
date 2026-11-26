"""Serve the real game with an opt-in, loopback-only camera for resident reviews."""

import argparse
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "asphalt-heat" / "tools"))
from serve import GameHandler


class ReviewHandler(GameHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path in ("/", "/index.html") and "agent=1" in urlsplit(self.path).query:
            doc = (
                (self.server.game_dir / "index.html")
                .read_bytes()
                .replace(
                    b"</body>", b'<script src="/__resident-camera.js"></script></body>'
                )
            )
            self.reply(doc, "text/html; charset=utf-8")
        elif path == "/__resident-camera.js":
            self.reply(
                Path(__file__).with_name("resident_camera.js").read_bytes(),
                "text/javascript",
            )
        else:
            super().do_GET()

    def reply(self, data, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        match = re.fullmatch(r"/__frames/(work|talk|detail|recovery)/(\d{4})", self.path)
        expected = "http://127.0.0.1:" + str(self.server.server_port)
        if (
            not match
            or self.headers.get("Origin") != expected
            or self.headers.get("Host") != urlsplit(expected).netloc
        ):
            return self.send_error(403)
        try:
            count = int(self.headers["Content-Length"])
        except (TypeError, ValueError):
            return self.send_error(400)
        if not 0 < count <= 2000000 or not 0 < int(match[2]) <= 240:
            return self.send_error(400)
        data = self.rfile.read(count)
        if not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
            return self.send_error(400)
        path = self.server.frames / match[1] / (match[2] + ".jpg")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        self.reply(b"OK", "text/plain")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--port", type=int, default=8797)
    p.add_argument("--frames", type=Path, required=True)
    p.add_argument("--game-dir", type=Path, default=ROOT / "asphalt-heat")
    args = p.parse_args()
    with ThreadingHTTPServer(
        ("127.0.0.1", args.port),
        partial(ReviewHandler, directory=str(args.game_dir.resolve())),
    ) as server:
        server.request_queue_size = 128
        server.frames = args.frames.resolve()
        server.game_dir = args.game_dir.resolve()
        server.serve_forever()
