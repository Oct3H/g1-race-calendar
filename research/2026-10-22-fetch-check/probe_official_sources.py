"""Read-only HTTP evidence probe; no browser, cookies, login, headers or retries.

Run with the Python standard library. Response bodies are evidence, not code.
This is a one-off feasibility check, not an application data adapter.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parent
SAFE_HEADERS = {"content-type", "content-encoding", "content-length", "last-modified", "cache-control", "date", "etag", "server"}
SOURCES = [
    ("jra_2026_directory", "https://www.jra.go.jp/datafile/seiseki/replay/2026/g1.html"),
    ("jra_arima_2025_result", "https://www.jra.go.jp/datafile/seiseki/g1/arima/result/arima2025.html"),
    ("nar_teio_2025_entries", "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_raceDate=2025%2F07%2F02&k_raceNo=11&k_babaCode=20"),
    ("nar_teio_2025_result", "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_raceDate=2025%2F07%2F02&k_raceNo=11&k_babaCode=20"),
    ("hkjc_cox_2025_result", "https://racing.hkjc.com/en-us/overseas/results?RaceDate=20251025&focus=Y&Racecourse=S1&RaceNo=10"),
    ("hkjc_cup_2025_result", "https://racing.hkjc.com/zh-hk/local/information/archive/localresults?RaceNo=8&racecourse=ST&racedate=2025%2F12%2F14"),
]


class HTMLFields(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = None
        self.cell = None
        self.tables = 0
        self.scripts = []
        self.links = []
        self.text = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table":
            self.tables += 1
        if tag in ("script", "style"):
            self.skip += 1
            if tag == "script" and attrs.get("src"):
                self.scripts.append(attrs["src"])
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "tr":
            self.row = []
        if tag in ("td", "th") and self.row is not None:
            self.cell = []
        if tag == "br" and self.cell is not None:
            self.cell.append(" ")

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.text.append(data.strip())
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if tag in ("td", "th") and self.row is not None and self.cell is not None:
            self.row.append(re.sub(r"\s+", " ", "".join(self.cell)).strip())
            self.cell = None
        if tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None


def probe(source):
    name, url = source
    result = {"name": name, "url": url, "requested_at": datetime.now(timezone.utc).isoformat()}
    try:
        with urlopen(url, timeout=30) as response:
            body = response.read()
            result.update(status=response.status, final_url=response.url,
                          content_type=response.headers.get("Content-Type"),
                          headers={k: v for k, v in response.headers.items() if k.lower() in SAFE_HEADERS})
    except HTTPError as error:
        body = error.read()
        result.update(status=error.code, final_url=error.url,
                      content_type=error.headers.get("Content-Type"),
                      error_type="HTTPError", error=str(error),
                      headers={k: v for k, v in error.headers.items() if k.lower() in SAFE_HEADERS})
    except (URLError, TimeoutError) as error:
        result.update(status=None, error_type=type(error).__name__, error=str(error))
        return result
    result.update(bytes=len(body), sha256=sha256(body).hexdigest())
    (ROOT / f"{name}.response").write_bytes(body)
    charset = re.search(rb"charset\s*=\s*[\"']?([a-zA-Z0-9_-]+)", body[:10000])
    header_charset = re.search(r"charset=([^; ]+)", result.get("content_type") or "", re.I)
    encoding = header_charset.group(1) if header_charset else charset.group(1).decode() if charset else "utf-8"
    result["decoding"] = encoding
    content = body.decode(encoding, errors="replace")
    parser = HTMLFields()
    parser.feed(content)
    result["html"] = {"table_count": parser.tables, "row_count": len(parser.rows),
                      "script_sources": parser.scripts, "links": parser.links}
    (ROOT / f"{name}.rows.json").write_text(json.dumps(parser.rows, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / f"{name}.text.txt").write_text("\n".join(parser.text), encoding="utf-8")
    return result


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(probe, SOURCES))
    report = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "method": "Python standard-library urllib.request GET; default Python user agent, no cookies, credentials, custom headers, browser, retries or bypass",
        "sources": results,
    }
    (ROOT / "http-probe.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    for result in results:
        print(json.dumps({key: result.get(key) for key in ("name", "status", "bytes", "decoding", "error")}, ensure_ascii=False))
