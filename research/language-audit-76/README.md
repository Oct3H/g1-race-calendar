# 第 76 轮：三语界面全面补查

日期：2026-10-30。针对设置选英语后仍出现中文的反馈，完成现有网页原型的界面文案与控制器审查。此记录不代表真实来源接通、资金持久化或桌面应用完成。

## 修复范围

采用项目原生 ES 模块，复用已存在的三语字典，新增集中消息表及显式 UI 输出绑定；不引入前端框架或生产依赖，不做 DOM 全文替换。静态节点用明确的 `data-ui-text`／`data-ui-attrs` 标记；动态文案在生成位置调用翻译函数。集中表包含 1,283 条消息，编译记录为 28 个文件、877 处边界（包括无业务改动的依赖版本更新）。

覆盖主月历、地区／年月弹窗、空状态、赛事简洁／详细表、赛果、马匹基础资料和历史入口、缺项／失败头像及异常详情、设置、来源、首次语言选择、缓存清理／重下、首次收集、商店、银行、购买确认、分组马券、退款、结算、更正及破产提示。附属的 2025 密度比较、设置方案与启动说明页也纳入检查。

修复了多项动态遗漏：缺项数组先逐项翻译再拼接；缓存说明不重复处理已生成的日文；密度比较页的 JSON 说明与来源名称可翻译；首次收集的加载摘要比较使用当前界面语言。语言选择中的「中／日／EN」固定标识不随界面语言改变。既有金额计算、购买／退款日期、结果版本和支付条件未改动。

## 保留原样的内容

- 赛事与马匹按已确认地区命名规则保留原名；赛场来源名称和历史资料保留。
- 等级 GⅠ／GⅡ／GⅢ／JpnⅠ，场地「芝／ダート／AW」，地区英文缩写与数值不翻译。
- 语言选项以本族语显示「中文／日本語／English」，固定语言图标「中／日／EN」保留。
- 装饰性英文标题和已确认的日文顶部艺术文案保留；破产画面的「ギャンブルはやめよう。」按用户要求保留日文。

这些例外按具体源字段或节点登记；不以整页或整段 `lang` 属性豁免未翻译界面。

## 已执行的验证

- [三语 DOM 状态矩阵](matrix-result.json)：**336 个快照，0 项问题**。执行实际模块和事件处理，检查正文、隐藏状态、aria-label、title、placeholder 和 alt；检查缺失消息、英文残留汉字、完整中文消息残留于日文，以及 `undefined`、对象字符串、未填充占位符。
- 设置在三种初始语言下反复执行 English → 日本語 → 中文 → English，核对实际根语言、返回链接、月份和文案。三语月历均有赛事，逐场打开赛事／马匹／历史；展示赛事名称与原始数据一致。
- 三语执行银行累计 7 天、取出 ¥10,000、购买 ¥10,000，余额分别按 ¥500,000 → ¥510,000 → ¥500,000 变化，银行余 ¥60,000。
- [既有 18 项回归](legacy-checks.json)：**18／18 通过**，包括跨日时区、资格、首次进店、退款、重复结算、更正接续、通知和导航。原使用函数截取／VM 的检查仅补入实际 UI 模块依赖；未改变其金额与规则预期。
- [全部 25 个顶层 JS／MJS 语法检查](syntax-check.json)：通过。
- [前后版本证据](regression-evidence.json)：原 v75 英文马匹页仍出现「性龄」；当前英文页通过同一项检查。前后赛事身份、名称及发走时间一致，避免只有绿灯而无法捕获旧问题。
- [本机网页与资源 HEAD 检查](preview-head.json)：7 项 200／no-store。服务器仅绑定 127.0.0.1，没有浏览器渲染。
- [消息占位符检查](placeholder-errors.json)：0 错误；翻译的占位符集合与源消息一致。

矩阵是离线 DOM 执行，不是浏览器。它没有像素布局、CSS 排版、实际字体、Retina、原生 dialog 键盘行为或 macOS 生命周期能力；**U6 的窗口适配和视觉验收仍未完成**。新增长英语／日文的溢出与间距需网页评审。金额使用固定时钟与内存虚构数据，不构成生产钱包或联网验证。

## 重跑

在项目根目录，用现有 Node 执行：

```sh
node --experimental-vm-modules research/language-audit-76/check-matrix.mjs
node --experimental-vm-modules research/language-audit-76/check-regression-evidence.mjs
```

`dom-runner.mjs` 不启动浏览器，不联网；仅允许从本地读取原有密度 JSON，其余 fetch 会抛错。导航、时钟、dialog、焦点与窗口尺寸是显式模型，不模拟浏览器渲染。

测试专用依赖为 [LinkeDOM 官方项目](https://github.com/WebReflection/linkedom) 0.18.14 的 standalone worker，ISC。从官方 npm tarball 提取，SHA-512 已与 registry integrity 核对；保留 [许可证](vendor/LICENSE.linkedom)与[来源](vendor/provenance.json)，没有执行安装脚本。官方 parseHTML／standalone 文档通过 Context7 检索。该文件只在 research 下使用，不作为 App 的生产依赖。

`baseline/`、原始 AST、TSV 与编译器保留用于定位和复现。`compile.py` 从基线生成显式绑定；`catalog.py` 合并已有字典与人工翻译并校验占位符。**不要重新生成 missing.json 的索引，或拿当前代码覆盖原始 AST**，否则会破坏翻译索引和基线。

## 网页预览

- [中文主月历](http://127.0.0.1:8765/index.html?preview=calendar&settingsMenu=preview&lang=zh&year=2026&month=10&v=76)
- [日本語主月历](http://127.0.0.1:8765/index.html?preview=calendar&settingsMenu=preview&lang=ja&year=2026&month=10&v=76)
- [English 主月历](http://127.0.0.1:8765/index.html?preview=calendar&settingsMenu=preview&lang=en&year=2026&month=10&v=76)

先完成这轮多语言文案验收，再按 ROADMAP 继续 U5 金额交互、U6 视觉适配与尚未通过的 V1—V6 来源验证，不提前进入封装。
