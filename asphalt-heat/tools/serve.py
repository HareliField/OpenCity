"""Serve Asphalt Heat on this computer with a queue sized for parallel asset downloads."""
from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class GameServer(ThreadingHTTPServer):
    request_queue_size = 128


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    game_dir = Path(__file__).resolve().parents[1]
    handler = partial(SimpleHTTPRequestHandler, directory=str(game_dir))
    with GameServer(("127.0.0.1", args.port), handler) as server:
        print(f"Play Asphalt Heat at http://127.0.0.1:{args.port}/index.html", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
