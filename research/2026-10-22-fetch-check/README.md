# 真实 HTTP 数据获取复测

验证时间：2026-10-22（香港公开数据查询响应时间 19:10，Asia/Shanghai）。本轮没有使用浏览器、cookies、登录、凭据、自定义浏览器指纹或访问限制规避，也没有把采集接入正式 App。脚本只使用 Python 标准库；公开脚本文本仅下载检查，没有执行。

**本次已从真正的 HTTP 响应取得 NAR、HKJC 的具体名单和赛果。JRA 直接访问仍返回 403，未来赛事自动发现与正式应用更新链路尚未通过。**

| 来源 | 请求结果 | 字段提取结论 |
| --- | --- | --- |
| [JRA 2026 年 GⅠ 目录](https://www.jra.go.jp/datafile/seiseki/replay/2026/g1.html) | 403，425 字节拒绝页 | 未通过；没有年度目录，也不能据此验证后续新增链接发现 |
| [JRA 2025 有马纪念赛果](https://www.jra.go.jp/datafile/seiseki/g1/arima/result/arima2025.html) | 403，438 字节拒绝页 | 未通过；不绕过拒绝，不以此前浏览器可读替代直接 HTTP 成功 |
| [NAR 2025 帝王賞出马表](https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_raceDate=2025%2F07%2F02&k_raceNo=11&k_babaCode=20)／[赛果](https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_raceDate=2025%2F07%2F02&k_raceNo=11&k_babaCode=20) | 两页 200，313,589／107,905 字节，含实际 HTML 表格 | 通过名单和赛果字段：2025-07-02，大井 11R，帝王賞 JpnⅠ，ダート 2000m，冠军本赏金 JPY 80,000,000；14 匹出马表与赛果逐一匹配，13 匹完赛、メイショウハリオ 除外，冠军 ミッキーファイト。14 匹逐马单胜赔率均为空，仍标缺失；单胜派彩 170 円不替代逐马赔率 |
| [HKJC 2025 香港盃](https://racing.hkjc.com/zh-hk/local/information/archive/localresults?RaceNo=8&racecourse=ST&racedate=2025%2F12%2F14) | 200，199,152 字节，静态 HTML 真实表格 | 通过：2025-12-14，沙田，浪琴香港盃，一級賽，草地 2000m，总赏金 HKD 40,000,000；7 匹名次、马号、马名、骑师、练马师、头马距离、时间及独赢赔率。冠军 浪漫勇士，赔率原值 1.1 |
| [HKJC 2025 Cox Plate 页面](https://racing.hkjc.com/en-us/overseas/results?RaceDate=20251025&focus=Y&Racecourse=S1&RaceNo=10) | 200，33,817 字节，0 个 table／0 行 | 单靠 HTML 未通过：仍是应用外壳，不将其当作更新成功 |
| 同页公开脚本使用的 [HKJC 数据端点](https://info.cld.hkjc.com/graphql/base/) | 一次只读 `RaceResultsProfile` 查询；200、gzip JSON，19,913 字节，解压后 153,422 字节；无 GraphQL errors | 通过本场真实字段：Cox Plate，2025-10-25T14:40:00+08:00，Australia，Moonee Valley Racecourse，Turf 2040m，Group 1，正式赛果状态 WCFULLMARGIN；8 匹完赛和 Globe 退出。冠军 Via Sistina，独赢赔率原值 1.9；8 匹均有名次、马号、马名、骑师、练马师和头马距离 |

## HKJC 海外页面的实际数据路径

从赛果 HTML 明确引用的 `globalConfig.js` 得到 QIDS 数据端点，从同页引用的公开 JS 得到现成的 `RaceResultsProfile` 查询与 `date`／`venueCode` 格式。直接发送该只读查询，变量为 `2025-10-25`、`S1`，仅设置 JSON Content-Type；没有复制浏览器 `sec-*` 头、登录 cookie 或 CMS 的其他配置。收到的 gzip 通过标准库解压，再按 `meeting.date`、`venueCode`、`race.no == 10` 与名称、日期、等级核对身份。

这是网站当前公开使用的内部查询，本次可读，**没有核实正式 API 服务合同、第三方再利用许可或长期稳定性**。没有做 schema 枚举、循环扫描或绕过。返回的赛事 `id` 是来源原值（本场 `20251025S109`），与展示 `no=10` 不能按字符串拼接推导；后续适配器须保存原始 ID 并以实际返回身份校验。

原始 `winOdds` 保留字符串及实际来源，不把 HKJC 1.9 与澳大利亚其他市场曾显示的 2.25 互相覆盖。退出马为空赔率、`finalPosition=0`，不显示为普通第 0 名。头马距离取该场响应的 `lbwNm`，不把可空的 `margin` 强行填成相同口径。

## 本次仍不能承诺的部分

- 尚未无人工逐场 URL 地从年度目录发现全部赛事；JRA 年度入口本次被拒绝。
- 尚未验证真实未来公布窗口的“只有日期 → 出马表 → 赔率 → 正式赛果”全过程，也未验证赛前赔率连续可用性。
- 历史单场成功不能外推为所有地区、所有年份或 122 场完整覆盖。本场公开查询未请求赏金；`last6run` 简写不等同于完整近五场赛事详情。
- 正式应用的数据合并、旧缓存保留、持久化与触发更新仍未接入。这些脚本没有修改设计稿的虚构马匹或小游戏资金。

## 证据和复现

- `sandbox-network-check.json`：最初沙箱内 DNS 受限，独立保存；不误记为网站拒绝。
- `http-probe.json`：获得正常只读出网审批后的六次真实 HTTP 状态、时间、响应类型、字节和 SHA-256。不会保存或复用 Set-Cookie。
- `*.response`、`*.rows.json`、`*.text.txt`：原始响应、表格与文本证据；拒绝页也保留。
- `hkjc-public-assets.json`、`public-*.js`：同页明确引用的公开配置及八个路由块，用于确认数据路径；没有执行这些下载代码。配置中无关的公开 CMS API-key 参数和遥测标识已打码，清单分开记录原响应与打码后 SHA-256；QIDS 端点原值保留。
- `hkjc-cox-query-request.json`、`hkjc-cox-query-http.json`、`hkjc-cox-query.response`、`hkjc-cox-query.decoded.json`：只读查询、响应元数据、原始 gzip 和解压后的 JSON。
- `extracted-fields.json`：最终字段、来源、缺失与通过／未通过清单。

标准库脚本 `probe_official_sources.py`、`inspect_hkjc_public_assets.py`、`probe_hkjc_public_query.py` 分别用于联网取证。离线执行 `python3 research/2026-10-22-fetch-check/check_extracted_fields.py` 已通过名单一致性、赛事身份、逐马记录数、赔率原值和空字段断言；不需要再次联网或安装依赖。
