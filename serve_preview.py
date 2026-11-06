"""Local design preview; never cache work-in-progress pages or assets."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


class PreviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        url = urlsplit(self.path)
        if url.path == "/desktop-calendar-preview.html":
            template = "index.html"
        elif url.path == "/settings.html" and parse_qs(url.query).get("desktopLayout") == ["preview"]:
            template = "settings.html"
        else:
            return super().send_head()

        html = (Path(self.directory) / template).read_text(encoding="utf-8")
        assets = (
            '<link rel="stylesheet" href="desktop-calendar-preview.css">'
            '<script src="desktop-calendar-preview.js"></script>'
        )
        if 'src="desktop-calendar-preview.js"' not in html:
            html = html.replace("</head>", assets + "\n</head>", 1)
        page = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.end_headers()
        return BytesIO(page)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    directory = Path(__file__).resolve().parent / "design"
    server = ThreadingHTTPServer(("127.0.0.1", 8765), partial(PreviewHandler, directory=str(directory)))
    print("Design preview: http://127.0.0.1:8765/ (Cache-Control: no-store)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
