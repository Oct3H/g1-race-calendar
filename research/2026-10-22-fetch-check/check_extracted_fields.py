"""Parse saved official responses and assert race identity and populated fields.

The assertions are one-off checks of these observed races, not a production parser
or a test of future announcements. Missing odds remain missing.
"""
from datetime import datetime, timezone
from decimal import Decimal
from html import unescape
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
probe = json.loads((ROOT / "http-probe.json").read_text())
sources = {source["name"]: source for source in probe["sources"]}


def text(name):
    return (ROOT / f"{name}.text.txt").read_text()


def rows(name):
    return json.loads((ROOT / f"{name}.rows.json").read_text())


def clean(value):
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", "", value))).strip()


def race_identity_nar(name):
    content = text(name)
    date = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日[^\n]*大\s*井[^\n]*第(\d+)競走", content)
    title = next(line.strip() for line in content.splitlines() if "帝王賞Jpn" in line)
    distance = re.search(r"ダート\s+(\d+)ｍ", content)
    prize = re.search(r"1着([0-9,]+)円", content)
    return {"name_raw": title, "date": f"{int(date[1]):04}-{int(date[2]):02}-{int(date[3]):02}",
            "course": "大井", "race_no": int(date[4]), "grade_raw": "JpnＩ",
            "surface_raw": "ダート", "distance_m": int(distance[1]),
            "winner_prize_jpy": int(prize[1].replace(",", ""))}


nar_entry_html = (ROOT / "nar_teio_2025_entries.response").read_text()
entry_pattern = re.compile(
    r'<td[^>]*class="horseNum"[^>]*>(?P<no>.*?)</td>.*?'
    r'<a class="horseName"[^>]*href="(?P<href>[^"]+)"[^>]*>(?P<name>.*?)</a>.*?'
    r'<a class="jockeyName"[^>]*>(?P<jockey>.*?)</a>.*?'
    r'<span class="odds_Black\s*">(?P<odds>.*?)</span>', re.S)
nar_entries = [
    {"horse_no": int(clean(match["no"])), "horse_name": clean(match["name"]),
     "horse_source_id": re.search(r"k_lineageLoginCode=(\d+)", match["href"])[1],
     "jockey_raw": clean(match["jockey"]), "win_odds_raw": clean(match["odds"]) or None}
    for match in entry_pattern.finditer(nar_entry_html)
]
nar_result_rows = [row for row in rows("nar_teio_2025_result") if len(row) == 17 and (row[0].isdigit() or row[0] == "除外")]
nar_results = [{"position_raw": row[0], "horse_no": int(row[2]), "horse_name": row[3],
                "jockey_raw": row[7], "trainer_raw": row[8], "finish_time": row[10] or None,
                "margin_raw": row[11] or None, "win_odds_raw": row[15] or None} for row in nar_result_rows]
nar_identity = race_identity_nar("nar_teio_2025_result")
assert race_identity_nar("nar_teio_2025_entries") == nar_identity
assert nar_identity["date"] == "2025-07-02" and nar_identity["distance_m"] == 2000
assert len(nar_entries) == len(nar_results) == 14
assert len({horse["horse_source_id"] for horse in nar_entries}) == 14
assert {h["horse_no"]: h["horse_name"] for h in nar_entries} == {h["horse_no"]: h["horse_name"] for h in nar_results}
assert sum(r["position_raw"].isdigit() for r in nar_results) == 13
assert next(r for r in nar_results if r["position_raw"] == "1")["horse_name"] == "ミッキーファイト"
assert all(r["win_odds_raw"] is None for r in nar_results + nar_entries)

hk_text = text("hkjc_cup_2025_result")
hk_rows = rows("hkjc_cup_2025_result")
hk_header = next(row for row in hk_rows if len(row) == 12 and row[0] == "名次")
hk_runners = [row for row in hk_rows if len(row) == 12 and row[0].isdigit()]
hk_date = re.search(r"賽事日期:\s*(\d{1,2})/(\d{1,2})/(\d{4})", hk_text)
hk_identity = {
    "date": f"{int(hk_date[3]):04}-{int(hk_date[2]):02}-{int(hk_date[1]):02}",
    "name_raw": next(row[0] for row in hk_rows if "浪琴香港盃" in row),
    "grade_distance_raw": next(row[0] for row in hk_rows if row[0].startswith("一級賽")),
    "course": "沙田" if "沙田:" in hk_text else None,
    "surface_raw": next(row[2] for row in hk_rows if len(row) > 2 and row[1] == "賽道 :"),
    "total_prize_raw": next(row[0] for row in hk_rows if row[0].startswith("HK$")),
}
hk_results = [{"position": int(row[0]), "horse_no": int(row[1]), "horse_name_raw": row[2],
               "jockey": row[3], "trainer": row[4], "margin_from_winner_raw": row[8],
               "finish_time": row[10], "win_odds_raw": row[11]} for row in hk_runners]
assert hk_identity["date"] == "2025-12-14" and hk_identity["name_raw"] == "浪琴香港盃"
assert len(hk_results) == 7 and sorted(r["position"] for r in hk_results) == list(range(1, 8))
assert hk_results[0]["horse_name_raw"] == "浪漫勇士 (E486)" and hk_results[0]["win_odds_raw"] == "1.1"
assert all(Decimal(r["win_odds_raw"]) >= 1 for r in hk_results)

query_response = json.loads((ROOT / "hkjc-cox-query.decoded.json").read_text())
assert not query_response.get("errors")
meetings = query_response["data"]["raceMeetingProfile"]
meeting = next(m for m in meetings if m["date"] == "2025-10-25" and m["venueCode"] == "S1")
cox = next(r for r in meeting["races"] if r["no"] == 10)
assert cox["raceName_en"] == "Cox Plate" and cox["raceClass_en"] == "Group 1"
assert cox["postTime"] == "2025-10-25T14:40:00+08:00"
assert cox["country_en"] == "Australia" and cox["raceTrack"]["description_en"] == "Turf" and cox["distance"] == 2040
assert cox["status"] == "RESULT" and cox["raceResults"][0]["status"] == "WCFULLMARGIN"
ran = [runner for runner in cox["runners"] if runner["status"] == "Ran"]
scratched = [runner for runner in cox["runners"] if runner["status"] == "Scratched"]
assert len(ran) == 8 and len(scratched) == 1
assert sorted(r["finalPosition"] for r in ran) == list(range(1, 9))
assert scratched[0]["horse"]["name_en"] == "Globe (NZ)" and scratched[0]["winOdds"] == ""
winner = next(r for r in ran if r["finalPosition"] == 1)
assert winner["horse"]["name_en"] == "Via Sistina (IRE)" and winner["winOdds"] == "1.9"
assert all(r["horse"]["id"] and r["jockey"]["name_en"] and r["trainer"]["name_en"] and r["lbwNm"] and Decimal(r["winOdds"]) >= 1 for r in ran)

report = {
    "checked_at": datetime.now(timezone.utc).isoformat(),
    "method": "Offline parsing and identity/row-count/field assertions against saved direct HTTP responses; no browser; no fabricated missing values",
    "sources": {
        "jra_2026_directory": {"url": sources["jra_2026_directory"]["url"], "passed": False, "status": sources["jra_2026_directory"]["status"], "missing": ["年度赛事目录", "未来赛事自动发现链路"], "reason": "HTTP 403; not bypassed"},
        "jra_arima_2025_result": {"url": sources["jra_arima_2025_result"]["url"], "passed": False, "status": sources["jra_arima_2025_result"]["status"], "missing": ["赛事身份", "逐马赛果", "赔率"], "reason": "HTTP 403; not bypassed"},
        "nar_teio_2025": {"urls": [sources["nar_teio_2025_entries"]["url"], sources["nar_teio_2025_result"]["url"]], "passed": True, "status": [200, 200], "identity": nar_identity, "entries": nar_entries, "results": nar_results,
                         "missing": ["14 匹历史逐马单胜赔率均为空；单胜派彩 170 円另存于原表，不冒充逐马赔率", "本次不是年度发现或未来公布窗口验证"]},
        "hkjc_cup_2025": {"url": sources["hkjc_cup_2025_result"]["url"], "passed": True, "status": 200, "identity": hk_identity, "headers_raw": hk_header, "results": hk_results, "missing": ["本次历史赛果不证明赛前赔率可刷新", "未核对整年覆盖或赛前出马表发布流程"]},
        "hkjc_cox_2025_html": {"url": sources["hkjc_cox_2025_result"]["url"], "passed": False, "status": 200, "table_count": sources["hkjc_cox_2025_result"]["html"]["table_count"], "missing": ["逐马数据"], "reason": "HTML application shell; a separate public query succeeded below"},
        "hkjc_cox_2025_public_query": {"url": "https://info.cld.hkjc.com/graphql/base/", "passed": True, "status": 200,
            "identity": {key: cox[key] for key in ("id", "no", "raceName_en", "postTime", "country_en", "distance", "raceTrack", "raceCourse", "raceClass_en", "raceResults")},
            "results": cox["runners"], "missing": ["本查询未请求赏金", "近五场只有 last6run 简写，未取得逐场赛事详情", "仅为当前公开网页使用的内部查询响应，不是已验证的正式稳定 API 合同", "单场历史赛果不证明赛前实时赔率或未来赛事自动发现"]},
    },
    "overall": {"passed": ["NAR 静态出马表与赛果名单匹配", "HKJC 香港盃静态 HTML 七匹赛果与独赢赔率", "HKJC Cox Plate 公开查询八匹赛果、赔率及一匹退出"],
                "not_passed": ["JRA 无浏览器年度目录与赛事详情", "应用的端到端自动发现/合并/持久缓存更新", "未来出马表公布后的真实更新窗口", "赛前赔率连续可用性与所有地区覆盖"]},
}
(ROOT / "extracted-fields.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print("PASS: NAR 14 entries match 13 finishers + 1 excluded; missing odds preserved")
print("PASS: HKJC Hong Kong Cup 7 finishers with raw win odds")
print("PASS: HKJC Cox Plate public query 8 finishers with raw win odds + 1 scratched")
print("NOT PASSED: JRA HTTP 403; automated discovery, future release and app updates unverified")
