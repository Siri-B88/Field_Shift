"""Run Field Shift locally from any working directory: python path/to/run.py."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

def main():
    parser = argparse.ArgumentParser(description='Serve the Field Shift app on localhost.')
    parser.add_argument('--port', type=int, default=5173)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent / 'dist'
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        parser.exit(1, f'Cannot start Field Shift on port {args.port}: {error}\nTry --port 5174.\n')
    print(f'Field Shift is ready at http://127.0.0.1:{args.port}\nPress Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nField Shift stopped.')
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
