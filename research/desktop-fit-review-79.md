# 第 79 轮：桌面窗口适配预览

日期：2026-10-31。用户明确要求：小窗口赛事名称更多省略，例如 breeders cup…，适当增加换行。采用七列随窗口压缩、不额外增加月历横向滚动；本轮先按最多三行制作网页，尚待视觉反馈。

## 网页入口

- [中文月历／长名称](http://127.0.0.1:8765/index.html?preview=calendar&settingsMenu=preview&lang=zh&year=2026&month=10&detailReview=preview&v=79)
- [英文月历／长名称](http://127.0.0.1:8765/index.html?preview=calendar&settingsMenu=preview&lang=en&year=2026&month=10&detailReview=preview&v=79)
- [缺项头像／详情](http://127.0.0.1:8765/index.html?preview=calendar&settingsMenu=preview&lang=zh&year=2026&month=10&quality=official-partial&entry=compact&race=quality-demo&view=results&v=79)
- [小店](http://127.0.0.1:8765/index.html?preview=calendar&settingsMenu=preview&lang=zh&availability=complete&refund=preview&game=wallet&v=79)

以上直接使用正常主月历，不新增窗口示意页。长名称沿用第71轮既有虚构排版样例，不新增真实赛事资料。

## 变更

新增共用 desktop-fit.css，主日历（含缓存、详情和小店）及设置页加载；保留现有字体和地区主题。

- 宽度不超过1100px时，月历名称最多三行，超出使用省略号。完整名称保留在 DOM、按钮 title、无障碍标签及详情页；没有修改赛事名数据或按长度截断字符串。
- 覆盖原760px以下强制600／680px宽的日历规则，继续七列 minmax(0,1fr)；工具栏与空状态可换行，不新增月历水平滚动。详细出马表仍可在原表格区域左右滚动，这与月历是两个独立区域。
- 较窄时头部可换行，长马名及按钮文字可换行；逐笔资金网格允许列缩小，选定地区配色保持。
- 宽度不超过1100px或高度不超过760px时，弹窗明确纵向滚动与视口最大高度，标题／关闭栏设为sticky；主要操作箭头保持独立空间。
- 低于700px高时略减弹窗上下留白，结果图限制高度，设置侧栏不吸顶；窄详情的异常头像移到右侧，对话气泡向内对齐，避免继续向右伸出。

本轮未设正式 App 最小窗口尺寸，也未实现手机专版。建议用1280×800、1024×700及900×650一带的实际网页窗口评审；这些是评审目标，**不是已测浏览器尺寸**。

## 验证与限制

[检查结果](desktop-fit-check-79.json)：已安装 tinycss2 解析新增CSS，0语法错误；5项相关既有交互检查通过；三语全页矩阵336个状态快照、0问题。离线实际DOM执行确认三语长名称的title、无障碍名称及点击后详情均保留完整原名，网页引用新增样式。

没有浏览器渲染，不能从CSS声明或离线DOM断言实际像素、截断位置、头像遮挡、浏览器原生Tab／Escape及Retina已经通过。U6仍需用户网页视觉评审，原生键盘／窗口体验留待真实运行继续验收。没有改动资金、马券默认折叠、数据收集、语言规则或桌面框架选择。

下一轮根据网页反馈调整两／三／四行密度，再继续U6余项与V1—V6未通过的来源验证；不直接进入封装。
