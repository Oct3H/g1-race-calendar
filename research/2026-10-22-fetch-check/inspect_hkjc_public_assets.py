"""Download page-referenced public JS as text evidence; never execute it."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
probe = json.loads((ROOT / "http-probe.json").read_text())
shell = next(s for s in probe["sources"] if s["name"] == "hkjc_cox_2025_result")
# Inspect eight route-level chunks, rather than repeatedly request race pages.
paths = ["/simulcast/informationAsset/config/globalConfig.js"] + shell["html"]["script_sources"][-8:]


def fetch(path):
    url = urljoin(shell["url"], path)
    result = {"url": url, "requested_at": datetime.now(timezone.utc).isoformat()}
    try:
        with urlopen(url, timeout=30) as response:
            body = response.read()
            result.update(status=response.status, bytes=len(body), content_type=response.headers.get("Content-Type"), sha256=sha256(body).hexdigest())
            filename = "public-" + path.rsplit("/", 1)[1]
            if filename == "public-globalConfig.js":
                # Keep only needed public endpoint evidence, without reproducing
                # unrelated CMS API-key parameters or telemetry client values.
                content = body.decode("utf-8")
                content = re.sub(r'sc_apikey=[^"\s]+', 'sc_apikey=REDACTED_PUBLIC_CLIENT_VALUE', content)
                content = re.sub(r'(CLIENT_TOKEN:\s*)"[^"]+"', r'\1"REDACTED_PUBLIC_CLIENT_VALUE"', content)
                content = re.sub(r'(APPLICATION_ID:\s*)"[^"]+"', r'\1"REDACTED_PUBLIC_CLIENT_VALUE"', content)
                body = content.encode()
                result["evidence_redactions"] = ["Unrelated public CMS API-key parameter and telemetry client identifiers; QIDS endpoint unchanged. sha256 above is the original response."]
                result["saved_sha256"] = sha256(body).hexdigest()
            (ROOT / filename).write_bytes(body)
            result["evidence_file"] = filename
    except (HTTPError, URLError, TimeoutError) as error:
        result.update(status=getattr(error, "code", None), error=str(error))
    return result


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(fetch, paths))
    (ROOT / "hkjc-public-assets.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
    for result in results:
        print(result.get("status"), result.get("bytes"), result.get("evidence_file"), result.get("error", ""))
