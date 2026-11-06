"""Replay one read-only query embedded in the public results page's JS.

No introspection, credentials, browser headers, cookies or retries. This checks
today's public response and does not imply an officially supported API contract.
"""
from datetime import datetime, timezone
from hashlib import sha256
import gzip
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
SAFE_HEADERS = {"content-type", "content-encoding", "content-length", "last-modified", "cache-control", "date", "etag", "server", "access-control-allow-origin"}
config = (ROOT / "public-globalConfig.js").read_text()
endpoint = re.search(r'QIDS_URI:\s*"([^"]+)"', config).group(1)
client = (ROOT / "public-39-oxo0t1ynu4.js").read_text()
query = re.search(r'`\s*(query RaceResultsProfile\b[\s\S]*?)`', client).group(1)
variables = {"date": "2025-10-25", "venueCode": "S1"}
payload = {"query": query, "variables": variables}
(ROOT / "hkjc-cox-query-request.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2))
request = Request(endpoint, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
report = {"requested_at": datetime.now(timezone.utc).isoformat(), "url": endpoint,
          "method": "POST of page-embedded read-only RaceResultsProfile query; JSON content type only, no credentials, cookies, custom user agent or retries",
          "variables": variables, "query_evidence": "public-39-oxo0t1ynu4.js"}
try:
    with urlopen(request, timeout=30) as response:
        body = response.read()
        report.update(status=response.status, content_type=response.headers.get("Content-Type"), headers={k: v for k, v in response.headers.items() if k.lower() in SAFE_HEADERS})
except HTTPError as error:
    body = error.read()
    report.update(status=error.code, error=str(error), content_type=error.headers.get("Content-Type"), headers={k: v for k, v in error.headers.items() if k.lower() in SAFE_HEADERS})
except (URLError, TimeoutError) as error:
    body = b""
    report.update(status=None, error=str(error))
report.update(bytes=len(body), sha256=sha256(body).hexdigest())
(ROOT / "hkjc-cox-query.response").write_bytes(body)
try:
    decoded = gzip.decompress(body) if report.get("headers", {}).get("Content-Encoding") == "gzip" else body
    parsed = json.loads(decoded)
    (ROOT / "hkjc-cox-query.decoded.json").write_text(json.dumps(parsed, ensure_ascii=False, indent=2))
    report["decoded_bytes"] = len(decoded)
    report["response_top_level_keys"] = list(parsed)
    report["graphql_errors"] = parsed.get("errors")
except (ValueError, UnicodeDecodeError):
    report["json_parsed"] = False
(ROOT / "hkjc-cox-query-http.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({k: report.get(k) for k in ("status", "content_type", "bytes", "error", "response_top_level_keys", "graphql_errors")}, ensure_ascii=False))
