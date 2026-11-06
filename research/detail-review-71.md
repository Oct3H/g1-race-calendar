# 第71轮：U3 详情内容与历史定位预览

2026-10-27。用户说“好的，下一步”，U2 导航按第70轮修复方案保留，进入 ROADMAP U3。仍为网页设计，未开始正式桌面开发。

[打开本轮详情评审](http://127.0.0.1:8765/index.html?preview=calendar&settingsMenu=preview&lang=zh&year=2026&month=10&detailReview=preview&entry=compact&race=detail-long&v=71)。先关闭详情可见五个评审入口：长赛事名／缺项、马匹资料、历史未定位、北京跨日、纽约跨日。普通入口不增加这些赛事，不替换已确认布局。

## 本轮内容

- 英国长赛事名和较长英文马名自动换行；沿用英国地区主题、原血统六项布局、缺赔率与骑师的原有表示和诗歌剧入口。
- 具体发走时间未知时保留来源日期，不补 00:00、不推算电脑时区跨日；赏金暂缺继续标为暂无数据。
- 同一个虚构时间点 2026-10-31T03:30Z，在北京显示 10/31 11:30，在纽约显示 10/30 23:30。详情同时保留赛场当地时间；只有明确的本轮预览参数能覆盖电脑时区。
- 从马匹近五场打开尚未定位的历史赛事，保留这匹马的已知表现快照及来源日期，隐藏完整赛事身份和未核实的其他资料，说明尚未核实链接。不会借用本场或同名赛事的出马表／赛果。原返回按钮、焦点和滚动位置保留；打开其他已定位的虚构历史记录会恢复原布局。

名称取自本地已保存的 `ifha-top100-2025-raw.json` 和 `2026-10-26-pre-race/bcc_preentries.embedded.json`，仅用于排版。赛事日期、马匹参赛关系、血统关系、表现、赔率均是虚构组合，不是这两场比赛的真实资料。真实历史匹配和跨源数据合并仍待 V5 验证，不因显示此提示而标为完成。

## 验证

`node research/check_detail_review.mjs` 通过，实际执行 showRace/showHorse/showPastRace/backToHorse/backToEntries 控制器配合 DOM 替身，检查缺时间／缺赏金、历史隐藏与恢复、同马表现、返回焦点与滚动、跨日详情字段以及预览入口隔离。记录见 `detail-review-check-71.json`。

现有 `check_data_quality_preview.mjs`、`check_preview_navigation.mjs`、`check_first_collection_preview.mjs`、`check_welcome_race_visibility.mjs` 均通过；两个模块语法检查通过。4 个本机 HEAD 请求均 200 / no-store。没有执行浏览器渲染，不能据此宣称文字换行或像素布局已通过；U3 仍待用户网页评审。没有新增依赖、实际联网采集、钱包存储或资金操作。

下一步：按评审反馈调整；U3 收口后进入 U4 组合通知场景，再继续真实来源缺口。完整三语与窄窗口检查属于 U6，未提前宣称完成。
