# 代表赛事详情来源核验

核验日期：2026-10-21；第二十轮记录整理至 2026-10-22。当前仍为需求与数据可行性验证，没有实现正式采集器。首版赔率已确认仅单胜／独赢（Win）。以下是单场证据，不能外推为整年覆盖或稳定服务。

后续第二十三轮见[赛前赔率与跨国马匹记录核验（2026-10-22）](odds-and-horse-validation-2026-10-22.md)：补齐 JRA 有马纪念 PDF 的 16 匹最终赔率证据，以及 Racing.com 当前 Cox Plate 12 匹马的赛前 Win 样本（Sportsbet 报价，未纳入正式来源顺序）；区分赔率未公布、赛后旧值、来源维护与已索引缓存，新增 JRA／HKJC 跨国马匹记录的字段与缺失验证。

## 本轮直接核得的字段

| 地区／实例 | 实际读取方式与证据 | 可确认 | 不能由此确认 |
| --- | --- | --- | --- |
| 日本 JRA／2025 有马纪念 | [官方固定赛果页](https://www.jra.go.jp/datafile/seiseki/g1/arima/result/arima2025.html)，网页文本 | 16 匹马名次、马号、骑师、着差；冠军本赏金 JPY 500,000,000，另列附加赏 JPY 3,528,000 | 该固定页最后一列为单胜人气，不是逐马赔率；冠军派彩不能填充其他马的赔率。不能以本页替代 JRA 的最终赔率入口 |
| 日本 NAR／2025 帝王赏 JpnⅠ | 浏览器沿[官方对战表](https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/CompeteTable?k_babaCode=20&k_raceDate=2025%2F07%2F02&k_raceNo=11)进入[出马表](https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_raceDate=2025%2F07%2F02&k_raceNo=11&k_babaCode=20)和[赛果](https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_raceDate=2025%2F07%2F02&k_raceNo=11&k_babaCode=20) | 14 匹名单中实际 13 匹完成、1 匹除外；名次、骑师、负重、着差与冠军赏金 JPY 80,000,000 可读；出马表有近五场 | 此次浏览器呈现的历史单胜赔率列为空，不能因表头存在就算可用。Web 工具的 cache miss 也不能用来断言网站无法访问，浏览器实际成功 |
| NAR／ミッキーファイト战绩 | [官方马匹战绩](https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=30097400486)，从出马表马名进入 | 赛事日期、名称、等级、场地距离、骑师、名次，记录包含 JRA 与地方赛以及 GⅢ／普通赛；比赛名称有详情入口 | 此战绩表有人气，无逐场单胜赔率。不能承诺全球转战记录完整；不足五场或缺赔率须保留缺失状态 |
| 美国／2025 BCC | 浏览器读取[官方比赛页](https://www.breederscup.com/races/2025-classic?tab=overview)，跟随 Results Chart 到[Equibase 赛果 PDF](https://assets.contentstack.io/v3/assets/blt9b0ea57b1efe7a70/blt7af912c85f2c0fc6/6a2c596dc5524b8a199b4f57/2025_Classic_Results_Chart.pdf)，下载并视觉核对第 1 页 | PDF 有 9 匹参赛马、骑师、名次、逐马 Odds 和除外马；保证总赏金 USD 7,000,000、冠军 USD 3,640,000、实际分配 USD 6,370,000 分别列出 | 总赏金和实际分配不是同一项。网页 Results 的 WIN 金额是派彩，不能当作赔率；此次 HTML 赛果未列第 8 名，PDF 有，故不采用 HTML 作完整名单。网页顶部日期与正文不一致，采用 PDF 及正文的赛场日期 2025-11-01。Equibase 原入口 Web 工具返回 403，但赛事官网公开 PDF 可读；不尝试绕过限制 |
| 德国／2025 巴登大奖赛 | [Deutscher Galopp 官方赛果](https://www.deutscher-galopp.de/gr/renntage/rennen.php?d=20250907&id=1356402&s=R)，网页文本 | 6 匹实际参赛、2 匹未出赛，名次、马号、档位、骑师、负重、距离差、逐马 Quote；总 EUR 300,000、冠军 EUR 165,000 | 数字采用逗号小数点，未出赛是 NS。最终赔率可读不代表赛前赔率可稳定刷新；距离差含义仍需独立核验 |

本轮只将公开来源中的必要事实整理为验证记录，没有把真实数据填入原网页的虚构马匹样例。

## 其他代表来源的进度

- **香港**：上轮已核对 [2025 香港盃官方赛果](https://racing.hkjc.com/zh-hk/local/information/archive/localresults?RaceNo=8&racecourse=ST&racedate=2025%2F12%2F14)，7 匹逐马独赢赔率和头马距离可读；头马距离按与冠军比较保留。
- **阿联酋**：上轮 [ERA 2025 迪拜世界杯](https://emiratesracing.com/racecard/2025-04-05/9/results)的总赏金与冠军赏金已核得；逐马赛果动态表及赛前赔率来源仍待验证。
- **法国**：第十八轮 [France Galop 2025 赛事介绍](https://www.france-galop.com/en/content/new-2025-arc-races-incredible-races-come-wildcard-arc)明确凯旋门总赏金 EUR 5,000,000、冠军 EUR 2,857,000，并另述育马奖励；[赛后官方报道](https://www.france-galop.com/fr/content/qatar-prix-de-larc-de-triomphe-daryz-offre-un-huitieme-succes-la-famille-aga-khan-record-de)核对举办日与前三名。第二十轮另在 HKJC 取得完整逐马补充证据，见下文；未证明 France Galop 直接详情可读取。
- **澳大利亚**：[Racing Australia 官方当日比赛册](https://publishingservices.racingaustralia.horse/racebooks/The_Valley_25102025/)说明 2025 Cox Plate 现金总赏金 AUD 6,000,000、冠军 AUD 4,000,000；另有奖杯金额的资料不能无说明地并入现金赏金。第二十轮 HKJC 完整赛果及赛前比赛册补充见下文，Racing.com 本轮仍只读到前三名摘要。
- **沙特**：[JCSA 官方赛后报道](https://www.jcsa.sa/en/news/20250222_tsc25_saudicup_recap)可核对 2025 Saudi Cup 举办与总赏金；报道不是出马表、逐马赔率或完整近五场来源。
- **英国／爱尔兰**：第十八轮检索未取得完整详情；第二十轮通过 BHA 与 HRI 站内赛果导航成功，见下文。

## 对首版要求的影响

1. 赔率保留类型、来源原值、来源表示法及最后成功时间，只有口径确认后才允许转换；派彩、人气、预估赔率、赛前赔率和最终赔率分别处理。
2. 总赏金、实际发放总额、冠军赏金和附加奖励分别保存。来源缺失不能用固定比例补造。第十九轮已确认日本默认本赏金、附加赏另注，海外保留来源口径。
3. 赛果应保留完赛、除外／未出赛等真实状态，不把它们转成普通名次；三层颜色仅用于有数值的名次。
4. 完整名单优先采用该场正式赛果，资料冲突保留出处与核对说明。不同国家的同名马须结合来源马匹 ID、出生年及产地核对，不能仅凭译名拼接近五场。
5. 第二十轮补齐英国、爱尔兰及 HKJC 转播范围内法国／澳大利亚的单场详情证据。剩余工作是赛前赔率、其他场次覆盖、跨国马匹历史、公开访问方式、请求限制及多次实际获取测试。尚不能承诺全球自动获取稳定性。

## 本地验证材料

- `bcc-classic-2025-result.pdf`：官网公开链接的原件；未运行任何下载代码。
- `bcc-classic-2025-result-page1.png`：第 1 页渲染，已检查主要表格、金额、9 行赔率和日期。
- 原 PDF 字体配置产生环境警告，但渲染文件生成成功，文字和表格可读；不修改系统字体配置。

## 第二十轮：英国、爱尔兰与 HKJC 海外转播资料

公开页面于 2026-10-21 实际打开核对；整理记录与马匹页设计延续至 10 月 22 日。没有实现采集器、访问账户或执行投注。

| 实例／来源 | 本次核得内容 | 仍存在的限制 |
| --- | --- | --- |
| [BHA 2025 Champion Stakes](https://www.britishhorseracing.com/racing/results/fixture-results/result/#!/2025/435/5384/0/) | 从 Results 的 2025 年／10 月／Ascot 筛选进入。2025-10-18、当地 16:05、Group 1、11 匹完整名次、马号、骑师、Margin 与 SP；总赏金 GBP 1,417,500。冠军 Calandagan，SP 为 15/8 | 是动态网页，初始 Loading／No Races Found 后正常加载，不能据此记作失败；未核得冠军赏金或稳定数据接口。15/8 的分数赔率可按 1＋15/8 得 2.875 倍，不应强制仅保留一位小数 |
| [HRI 2025 Irish Champion Stakes](https://www.hri.ie/results/race-result/?meeting=2025-271&race=1730) | 2025-09-13、17:30、Group 1、8 匹完整赛果、马号、骑师、着差；总 EUR 1,250,000，冠军 EUR 725,000；冠军 Delacroix | Penalty Value EUR 712,500 是另一口径。展开冠军行的 Win EUR 3.00 是 Tote Dividend，不能未经单位／市场核验当作 SP。表内 9 - 3 等是英制负重，不能当赔率 |
| [HKJC 2025 凯旋门](https://racing.hkjc.com/en-us/overseas/results?RaceDate=20251005&Racecourse=S1&RaceNo=4) | View More 展开后有 17 匹完赛＋1 匹 SCR（Estrange），逐马名次、马号、骑师、练马师、Margin 与 Win Odds。冠军 Daryz 原值 17；当地赛场巴黎隆尚、芝 2400m | 页内开赛时间 22:05 为香港时间。展开后的表头为 Margin，差值非单调，不因移动标签曾显示 Length Behind Winner 就统一解释为距冠军；保留此场原值与口径待核。Win Odds 与派彩不能无说明互推 |
| [HKJC 2025 Cox Plate](https://racing.hkjc.com/en-us/overseas/results?RaceDate=20251025&Racecourse=S1&RaceNo=10) | 展开后 8 匹完赛＋1 匹 SCR（Globe），包含马名、性龄、骑师、练马师、Length Behind Winner、Win Odds；冠军 Via Sistina 原值 1.9，芝 2040m | 页内 14:40 是香港时间，赛前 PDF 明列澳洲 17:40。同一场 [Racing.com 页面](https://www.racing.com/form/2025-10-25/the-valley)前三名摘要中的冠军 SP 为 $2.25，不能与 HKJC 1.9 当作同市场的更正；本轮未从 Racing.com 成功展开完整赛果 |

### 血统与跨国近五场

- [HRI Delacroix 档案](https://www.hri.ie/statistics/horse/data/?hid=227935)提供出生年、性别及父母 Dubawi－Tepin (USA)，并有 12 条含英国与爱尔兰的记录。英国部分记录虽有日期、场地、名次、骑师，却缺比赛名／等级等字段；无逐场赔率列。证明跨境记录存在，不证明近五场字段完整。
- HKJC 的 Cox Plate「Download Form Guide」公开 [赛前 PDF](https://consvc.hkjc.com/-/media/Sites/JCRW/FormGuide/Simulcast/25_26/20251025/OSE20251025_starter_S1_r10.pdf)共 6 页。已用 pdfplumber 提取文字，并渲染第 5 页视觉核对 Via Sistina：IRE、8 岁雌马、Chris Waller；父 Fastnet Rock (AUS)，母 Nigh (IRE)，母父 Galileo (IRE)。这六类资料可用于证明字段存在，未接入网页示例。
- PDF 的五场由早到晚为 2025-03-22 Ranvet（1/6，1.22F）、04-12 Queen Elizabeth（1/13，2F）、08-23 Winx（1/11，2.80F）、09-13 Makybe Diva（3/6，1.80F）、10-04 Turnbull（3/14，2.60F），均标 G1。原件标头 Odds；保留 F 等原始记法，市场与归一化规则仍需核验。
- 这是 2025-10-25 **赛前快照**，不包含 Cox Plate 本身，不能直接作为赛后或 2026 年的最新五场。正式资料须记录快照对应时间，并按用户已确认的触发规则更新。

### 来源与市场的含义

- France Galop 首页本次浏览器返回 Application unavailable／Access refused；未尝试绕过，HKJC 是公开转播资料的替代证据，不代表已打通法国直接详情。
- [HKJC 海外合并彩池说明](https://special.hkjc.com/e-win/en-US/betting-info/racing/beginners-guide/commingling-pools/)解释指定法国独赢／位置可并入 PMU France；无法合并时可能使用香港彩池。这也说明赔率必须保留具体来源与市场／彩池标签，不能假定 HKJC 所有海外场次的口径一致。
- 第二十一轮用户确认海外赔率优先当地权威赛马机构，没有可信当地数据时使用已核实的港马会数据；始终保留实际市场与来源。不能平均不同市场数值，也不能将最后一次成功的旧值伪装成新值。本轮只确认展示与来源选择规则，没有实现切换来源的采集逻辑。
- 目前只完成代表场次的字段可读性验证。尚未完成 B 范围 122 场的详情覆盖率、所有马匹近五场、赛前可刷新赔率或长期稳定性验证。

### 新增本地材料

- `hkjc-arc-2025-verification.json`：从展开后的可见表格保存表头与 18 行（含 SCR），记录来源网址与核验日期。
- `hkjc-cox-2025-verification.json`：展开表格的 9 行（含 SCR）及出处。
- `hkjc-cox-2025-form.pdf`：官网公开赛前 PDF 原件；仅解析和渲染，没有运行下载代码。
- `hkjc-cox-2025-via-sistina.png`：PDF 第 5 页渲染，已检查血统与近五场字段。

真实研究材料与 `design/index.html` 的虚构出马表示例分开保存；没有混入 2025 日期比较数据，也没有接入正式更新或缓存。
