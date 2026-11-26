"""Serve Asphalt Heat on this computer with a queue sized for parallel asset downloads."""
from argparse import ArgumentParser
from functools import partial
import gzip
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class GameHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = Path(self.translate_path(self.path))
        self.game_source = path.is_dir() or path.suffix in {".html", ".js"}
        if path.suffix == ".glb" and not path.exists():
            compressed = path.with_suffix(".glb.gz")
            if compressed.is_file():
                stream = gzip.open(compressed, "rb")
                try:
                    header = stream.read(12)
                    if len(header) != 12 or header[:4] != b"glTF":
                        raise ValueError("Invalid compressed GLB")
                    stream.seek(0)
                except (OSError, EOFError, ValueError):
                    stream.close()
                    self.send_error(500, "Invalid stored game model")
                    return None
                self.send_response(200)
                self.send_header("Content-Type", "model/gltf-binary")
                self.send_header("Content-Length", str(int.from_bytes(header[8:12], "little")))
                self.end_headers()
                return stream
        if self.game_source:
            # Source files may change more than once within an HTTP timestamp's one-second precision.
            del self.headers["If-Modified-Since"]
        return super().send_head()

    def end_headers(self):
        if getattr(self, "game_source", False):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


class GameServer(ThreadingHTTPServer):
    request_queue_size = 128


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    game_dir = Path(__file__).resolve().parents[1]
    handler = partial(GameHandler, directory=str(game_dir))
    with GameServer(("127.0.0.1", args.port), handler) as server:
        print(f"Play Asphalt Heat at http://127.0.0.1:{args.port}/index.html", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
