# 2025 年两版月历的数据核验

整理日期：2026-10-21。交付是本地日期密度比较网页，未开始正式桌面应用制作。

第十七轮用户已选 **B** 为正式应用收集范围。网页默认 B，A 和全量比较资料继续保留供核对；范围选择不触发删除既有资料。

## 本轮口径

- A：2025 自然年、全球国际认可的纯血马平地 GⅠ，另加日本 JpnⅠ。
- B：日本 GⅠ／JpnⅠ 全部保留；海外仅取 **2025 年度**浪琴／IFHA 前百榜单。
- 只整理日期、赛名、等级、场地和来源，不下载全部出马表。
- 保留实际举办实例：同一系列同年举行两届时计为两场。
- 日期精度为赛场当地的日，未构造 UTC 时刻，未做电脑时区换日。正式应用取得准确发走时间后再换算。

## 数量与范围

| 国家／地区 | A 全量 | B 海外前百＋日本全量 |
| --- | ---: | ---: |
| 日本 | 37 | 37 |
| 美国 | 93 | 16 |
| 澳大利亚 | 77 | 19 |
| 英国 | 38 | 20 |
| 法国 | 28 | 10 |
| 德国 | 7 | 1 |
| 爱尔兰 | 13 | 4 |
| 香港 | 12 | 11 |
| 阿联酋 | 7 | 3 |
| 沙特阿拉伯 | 1 | 1 |
| 新西兰 | 19 | 0 |
| 南非 | 27 | 0 |
| 阿根廷 | 37 | 0 |
| 巴西 | 26 | 0 |
| 智利 | 17 | 0 |
| 秘鲁 | 5 | 0 |
| 乌拉圭 | 2 | 0 |
| 加拿大 | 5 | 0 |
| **合计** | **451** | **122** |

B 减少 329 场，约 73%。榜单自身为完整 100 条，其中 15 场在日本；合并日本全部 37 场后为 122，不能简单计算 100＋37。

以赛场当地日期归档，10 月为 A 62 场／B 15 场，最密集单日分别为 18／6 场。以上是当前整理集合的统计，不是按北京时间换日后的统计。

## 来源与完整性核对

- **IFHA**：保存 [2025 完整前百榜单](https://www.ifhaonline.org/resources/WTGradedRanking/LWGRank.asp?batch=10) 100 条。普通 [赛程库](https://www.ifhaonline.org/default.asp?area=0&section=Racing) 查询仅给出 261 条，存在缺失和重复，不能直接充作全量集合。网页文本抽取还曾漏掉榜末德国一条；已用浏览器完整 DOM 保存 100 条。
- **日本**：[JRA 2025 结果目录](https://www.jra.go.jp/datafile/seiseki/replay/2025/g1.html) 排除两场障碍后 24 场，加上 [NAR 目录](https://www.keiba.go.jp/dirtgraderace/2025/racelist/index.html) 中东京大赏典 GⅠ 与 12 场 JpnⅠ，共 37 场。
- **香港／阿联酋**：香港按两马季官方手册合为 2025 自然年 12 场，保留繁体名称；阿联酋用官方年度目录补齐 7 场，包括 1 月的两场与世界杯夜五场。详细链接逐条保存在 `research/japan-asia-g1-2025.json`。
- **美国**：[TOBA 2025 全年赛果表](https://toba.org/graded-stakes/2025-races/) 与 [年度等级公告](https://toba.org/toba-announces-u-s-graded-and-listed-stakes-for-2025/) 核对为 93 场。汇总表把 Cecil B. DeMille 写成一级，按 [Del Mar 官方 GⅢ 记录](https://www.dmtc.com/racing/entries/2025-11-30) 排除这一错误条目。采用赛果表中 Jaipur／Manhattan 实际改至 6 月 8 日的日期，非 IFHA 中旧的 6 月 7 日。
- **英国／法国／德国／爱尔兰／加拿大**：分别核对 [BHA 全年目录](https://media.britishhorseracing.com/bha/Publications/Pattern_Listed_Books/British_Flat_Pattern_Listed_2025.pdf)、[France Galop 全年目录](https://www.france-galop.com/sites/default/files/2025-02/groupeslisted_plat_2025v7.pdf)、[德国年度公告](https://www.deutscher-galopp.de/gr/aktuelles/meldungen/20250109-deutscher-galopp-praesentiert-attraktives-rennprogramm-mit-deutlich-erhoehten-rennpreisen-fuer-eine-erfolgreiche-zukunft.php)、[IHRB 年终公告](https://www.ihrb.ie/general-press-release-page/longines-world-rankings-2025)、[Woodbine 官方日程](https://woodbine.com/woodbine-news/woodbine-releases-2025-thoroughbred-stakes-schedule/)，数量为 38／28／7／13／5。补齐 IFHA 未返回的 Flying Five 与 National Stakes。保留法国 Vermeille／Moulin 9 月 7 日、Grand Prix de Paris 7 月 13 日及德国 Bayern 11 月 8 日等当年日期。
- **澳大利亚／新西兰／南非**：以官方跨年两季目录或自然年目录确定集合，补上实际赛果或赛后证据。77／19／27，包含 C.F. Orr 同年两届，排除 2025 已降为 GⅡ 的 Levin Classic、Golden Horse Sprint、Woolavington 2000。逐条资料及边界见 `research/southern-g1-2025-coverage.md`。
- **南美洲**：以 [OSAF 2025 全年等级赛日历](https://www.osafweb.net/wp-content/uploads/Calendario-Clasico-Latinoamericano-2025-orden-cronologico.pdf) 确定 87 场基线，再用各赛马机构赛果／比赛册核对日期；每条验证程度保存在 `research/south-america-g1-2025.json`，没有将所有条目都声称为逐场完整赛果验证。

## 合并与验证

- 原始快照保留在 `research/`；各地区补充完整集合后按地区替换，不对 261 条直接无条件追加。
- `ranking-crosswalk-2025.json` 保存明确的 100 条赛事实例 ID 对照。候选相似度只用于人工检查，不参与网页收录判断；最终断言 100 条均匹配唯一实例，国家一致，B 为 122。
- `build_2025_dataset.py` 仅读取本地已整理文件，不联网。它检查 ID、国家＋日期＋名称重复、年份、真实等级、场地值、100 条匹配、十场优先组及日本 37 场。
- 前端用文本节点显示来源名称，复用现有九组地区色、场地标签和同日折叠规则。真实日期详情不链接虚构出马表。
- 浏览器检查了两版的全部 12 个月：24 次月历统计均与渲染条数一致，折叠规则无误，年度合计为 451／122。日本筛选两版均为 37，10 月均为 4 场。
- 已检查 1280 与 682 像素窗口。页面本身无横向溢出，窄窗口的月历在内部横向滚动；没有宣称已完成手机适配。

## 仍未验证的功能

本次可以比较日期密度，并不代表正式应用已经能稳定读取全球出马表、每匹马的最终赔率、实时赔率、赏金或完整近五场历史。部分日期仍依据官方赛程资料，尚未逐场对照完整赛果。来源网页有数据、一次能够读取和长期稳定接入，是三种不同的结论。

历史排名规则按用户要求记录：2010 年起优先对应年度，缺失采用最新已公布榜单；本年和未来两年先用最新；2010 年前不套用排名。本轮只实现 2025 比较，尚未收集或声称存在 2010 年的年度榜单。
