# 第81轮：真实发布后的名单与赛前Win

日期：2026-10-31。按ROADMAP继续日本V1—V4验证。未修改网页、生产缓存或钱包。

## 结果

1. NAR固定首页→2026年度目录→最近未来JpnI→实际出马表链接。当前年度仍13场地方G1／JpnI。自动选中的JBC Classic，与10月27日的同一racecard URL、同一年度举办实例比较：旧页只有出走予定和10月30日枠顺计划，没有DebaTable链接；新页已经发布实际链接，取得11月3日金泽第9场、16:25、泥地2100米、12匹唯一马号／马名／骑师。**这是一例真正发布前后读取，不是仅修改本地虚构数据。**
2. 本轮该NAR未来出马表没有赔率节点或OddsTanFuku链接，12匹的Win均为缺失。只能说这个来源本轮未取得，不能外推所有发行渠道均无赛前赔率。按现有购买条件仍禁购，不能用预测值填补。
3. JAIRS／日本赛马英文固定首页→公开导航／年份脚本→2026年度目录，重新取得24场中央平地G1。程序选择下一场天皇赏（秋），再沿首页匹配该赛事的实际新闻链接取得枠顺与Win PDF，不用搜索结果或手填逐场URL作为发现输入。
4. 10月30日枠顺17匹与10月31日赔率17行的马号和英文马名逐条一致。PDF表头为TOKYO 11R／Tenno Sho (Autumn)，标注JRA pari-mutuel pool odds、Saturday 17:30；结合10月31日发布标签为**2026-10-31 17:30 JST**。发走时间由正式枠顺正文读取为11月1日15:40 JST，时间和场次与目标赛事一致。
5. 首页叫它Morning Line，正文市场标注才是分类依据。不是看到标题就当预测，也不是凭正数就当合格官方赔率。含本金语义沿用第64轮JRA相同市场Odds与100日元单胜派彩的交叉核验；此次没有未来赛果可以交叉派彩。

13个不同实际GET均200，记录完整父链接、请求时间、SHA-256和响应。对本轮快照的重用不再发请求；成功率不是长期稳定性指标。中央10月27日通道失败是历史记录，今日重新联网成功，不能继续把旧失败写成当前状态。

## 修复与复用

复用既有discover.Runner、普通HTTP捕获、年度解析与merge；没有执行远端JS、登录、cookies、重试循环、伪装客户端、修改系统网络或新增依赖。搜索仅辅助核对，不进入发现程序。

旧entry_horses全页正则强制要求odds_Black。未来名单完全没有该节点，导致严重回溯；两份解析进程中断后保留四份成功响应，从响应恢复继续，未重复请求。现在按单个tr小块提取马号／马名／骑师，赔率可缺失。新12匹名单解析一次约0.001秒（本机测量，不作性能保证），旧南部杯11匹出马／正式赛果／最终Win及历年目录检查仍通过。

目录重复合并没有新增重复举办实例；本轮没有实现正式App字段状态合并、消息提醒或生产数据库，因此不称为生产更新服务已经完成。

## 检查与材料

- [publication.json](publication.json)：13条溯源与两个来源的实际资料；`live/`为原始响应与HTTP元数据。用`probe.py --resume`仅继续未抓取地址；默认不覆盖已有证据。联网复测新建日期目录。
- [checks.json](checks.json)：源父链接／哈希、年度37条目录、同场真实发布差异、NAR12匹、无赔率语义、重复合并、中央17对17及市场／时间身份核对。
- [game-bridge.json](game-bridge.json)：真实快照传入原小游戏规则的独立内存回放。先激活测试小店，再购买一笔；实际源／倍率／时间锁定，扣款一次，无赛果保持pending不派发。D0无需联网也拒绝购买，NAR缺赔率仍拒绝。不是生产钱包或真实下注。
- [odds-page-1.png](odds-page-1.png)：按PDF技能用既有PDFium渲染，已视觉核对表头、17行及脚注；`odds-text.txt`／`odds-tables.json`、`draw-rows.json`、`normalized-sample.json`为提取及回放输入。原PDF未编辑。
- 原第67轮`check_japan.py`回归通过；本轮`check_publication.py`及`check_game_bridge.mjs`均离线运行。

```sh
python3 research/2026-10-31-publication/check_publication.py
node research/2026-10-31-publication/check_game_bridge.mjs
```

Python使用项目既有bundled runtime（pdfplumber、PDFium均已存在），没有安装包或改全局环境。

## 限制与下一步

已证明代表来源能从固定入口发现新公布链接、读取真正变化，并在比赛日前取得一份合格JRA报价。仍不能保证未来每个站点永久免维护，或所有赛事都在D0前有报价；这是一个官方快照，不是实时赔率接口或持续可用性合同。

中央本轮是英文资料，日文显示名与正式马匹身份的映射尚未补全；赛事结果和后续正式更正未出现，不提前验证通过。全部马匹资料、普通条件赛历史详情、全球全年覆盖及正式App后台／持久化仍未完成。下一步补日本日文身份关联和历史详情，再按原顺序扩展香港及海外覆盖；不改变现有购买时间规则。

## 官方入口

- [NAR年度目录](https://www.keiba.go.jp/dirtgraderace/2026/racelist/index.html)
- [JBC Classic官方页面](https://www.keiba.go.jp/dirtgraderace/2026/1103_JBCclassic/racecard.html)
- [正式出马表](https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_raceDate=2026/11/03&k_raceNo=9&k_babaCode=22)
- [中央年度目录](https://japanracing.jp/en/racing/schedule/graded/list/2026.html)
- [天皇赏秋枠顺](https://japanracing.jp/_news2026/261030.html)
- [10月31日JRA Win快照](https://japanracing.jp/_news2026/pdf/261031.pdf)
