# 2025 南半球 GⅠ 日期覆盖核对

核对日：2026-10-21。数据文件为 `southern-g1-2025.json`，只覆盖澳大利亚、新西兰、南非的国际纯血马平地 Group/Grade 1，按 **2025 自然年**收录，不以 2024/25 单季替代自然年。不包含障碍赛、纯血阿拉伯马赛事。

| 地区 | 举办实例 | 对应 2025 IFHA 前百 | 覆盖依据 |
| --- | ---: | ---: | --- |
| AUS | 77 | 19 | Racing Australia 2024/25 实际 G1 赛果年鉴 21—23 页的 2025 部分，加 2025/26 官方分级目录的 2025 部分；所有条目另有实际赛果、赛后报道或监管记录 |
| NZ | 19 | 0 | NZTR 2024/25 与 2025/26 分级目录取 2025 交集，逐场 NZTR/主办方赛后报道、结果或监管决定核对 |
| SAF | 27 | 0 | NHRA《National Feature Race Programme 2025》全部 G1 行；逐场用 NHRA 赛后评级、主办方/行业组织赛后报道或成熟赛果提供者核对 |
| 合计 | 123 | 19 | 日期为来源当地日历日期 |

## 关键处理

- **C.F. Orr Stakes**：2025-02-08 与 2025-11-15 都实际举行。`id` 含日期分别保留，`series_key` 相同。不能按赛事名把两个实例合并。
- **The All-Star Mile**：2025 已获 G1；**Golden Eagle** 在 2025 尚非 G1，排除，不能将 2026/27 升级回溯到 2025。
- **Tancred / Vinery Stud**：采用延期后的实际 2025-04-01，舍弃原 3 月 29 日。
- **Queensland Derby / Kingsford-Smith Cup**：采用官方赛果年鉴的实际 2025-06-07，舍弃原 5 月 31 日。Queensland Oaks 同日举行，三场分别保留。
- **NZ Telegraph**：实际 1 月 4 日，不能使用旧版奖金系列宣传中的 1 月 11 日。
- **NZ Levin Classic**：2025 已降 G2，排除。
- **NZ Ōtaki-Māori WFA Classic**：2 月 22 日实际在 Ellerslie，不能从赛事名称猜为 Ōtaki。
- **NZ Manawatu Sires' Produce**：3 月 29 日实际在 Trentham，不能从主办俱乐部猜为 Awapuni。
- **NZ 春季三冠**：Proisir Plate（原 Tarzino）9 月 6 日 Ellerslie；Howden Insurance Mile（原 Arrowfield）9 月 27 日 Te Rapa；Livamol 10 月 18 日 Ellerslie，舍弃旧版 10 月 11 日 Awapuni。
- **NZ Guineas**：2025 的 1000 Guineas 在 11 月 8 日，2000 Guineas 在 11 月 15 日，使用修订目录和实际赛后报道。
- **SAF Golden Horse Sprint / Woolavington 2000**：2025 实际均为 G2，排除。旧版通用赛事列表会将它们错列为 G1。
- **SAF SA Derby / Allan Robertson / Thekwini**：2025 当届仍为 G1。之后降级不追溯改变 2025 等级。
- **Champions 系列**：同日 Sprint = IFHA racepid 81703，Mile = 81704，Stakes = 81705；已修正初次名称包含匹配造成的 Stakes → Sprint 误关联，并用显式映射核对全部 30 个 AUS IFHA 来源，未发现其他碰撞。

## 验证含义与限制

- 123 条当前均为 `actual_result`：至少有实际结果、赛后官方报道、赛后监管记录或明确赛后行业组织记录支持已举办，并与官方目录交叉核对日期/等级。它**不代表**已抓取完整出马表、全马赛果、赔率、精确时间，也不代表已验证自动接口可长期使用。
- 全部 123 条为草地赛；没有为未知起跑时间补默认值，也没有将日期擅自转成 UTC。根任务的密度比较应以来源日期展示并明示精度。
- 每条有 `source_url`，补充目录保存在 `corroborating_source_urls`，有 `canonical_name` 和 `aliases`。官方前百中的 19 个 AUS 名称已做严格的标点归一匹配，每个恰好命中 1 个独立举办实例；NZ / SAF 未出现在 2025 前百名单内。
- 当前未发现缺名或未处理的取消/移期条目，但本文件仅是三个地区的覆盖核对，不证明全球集合完整。
- 目录页和个别 PDF 在终端/浏览器直接读取返回 403；使用公开网页检索工具可检索的官方内容继续核对，没有把沙箱 DNS 故障判断为来源不存在。未安装依赖。

## 主要完整性来源

- [Racing Australia 实际 G1 赛果年鉴 2024/25，21 页](https://publishingservices.racingaustralia.horse/Newsletters/2025_Racing_Australia_Fact_Book/21/)、[22 页](https://publishingservices.racingaustralia.horse/Newsletters/2025_Racing_Australia_Fact_Book/22/)、[23 页](https://publishingservices.racingaustralia.horse/Newsletters/2025_Racing_Australia_Fact_Book/23/)
- [Racing Australia 官方 2025/26 分级目录](https://racingaustralia.horse/arb/Group_ListedRaceDates/2025-2026.aspx)
- [NZTR 官方 2024/25 分级目录](https://nztr.co.nz/sites/nztrindustry/files/2024-09/RPG_Group-Listed_1October2024.pdf)
- [NZTR 官方 2025/26 修订分级目录](https://nztr.co.nz/sites/nztrindustry/files/2025-10/Pattern%20Races%202025-26_FINAL.pdf)
- [NHRA 官方 2025 自然年特选赛事目录](https://www.nhra.co.za/media/attachments/2025/04/16/national-feature-race-programme-2025.pdf)

## 完整性检查结果

JSON 可解析；123 个 id 全部唯一；日期全部为 2025 有效 ISO 日期；77/19/27 地区计数；必要字段非空（可选别名允许空数组）；前百 19 条 AUS 别名精确命中且无重复；全部 30 个 AUS IFHA 来源名称已按显式映射核对。未改主应用。
