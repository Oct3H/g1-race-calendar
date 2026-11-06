# 角色立绘来源

## 第五十四轮：选择不哭表情

- 用户选择第五十三轮 A 图 `machikane-tannhauser-reference-v1.png`；当前异常入口固定使用这张图，以圆形头像显示，未编辑图像像素。
- 已撤去网页中的双表情切换。B 哭泣图仅保留为历史备选，不再由当前异常入口引用。

## 第五十三轮：按用户参考重绘诗歌剧双表情

- 当前异常入口使用 `machikane-tannhauser-reference-v1.png`（A 原图表情）或 `machikane-tannhauser-cry-v2.png`（B 哭泣），均为 1254 × 1254、RGBA、alpha 0—255 的透明 PNG。
- 用户参考：`[local reference, not distributed]`；原图未修改，不声称是官方素材。A 按该参考重绘，B 以 A 作为编辑目标，只改变表情。
- 工具：内置 `image_gen.imagegen`，透明背景；复制后没有像素编辑。成品及完整提示词见 [提示词记录](machikane-tannhauser-prompts-53.md)。
- A SHA-256：`8dabd4623b4e8fda82140099a9849aa7e8e6c3b02219ecf0d504834b0a877454`。
- B SHA-256：`4b030ef52ccf0cab496c6c79657f3712f321a3a3d5b496fc0d4a6d9731c4deb2`。
- 上一轮下载表情作为历史素材保留，已从当前异常入口替换。

## 第五十二轮：诗歌剧·哭哭异常入口（历史方案）

- 文件：`machikane-tannhauser-cry.png`，447 × 412，RGBA PNG，197,539 字节；下载后未修改图像像素，仅在网页以 CSS 等比缩放。
- 原始包：[Asanatsa/additional-sticker 的待兼诗歌剧包](https://github.com/Asanatsa/additional-sticker/tree/1a8b7da78e437738f8d98938421e7e78537be2ba/stickers/sblj)。其 `info.json` 明确标记角色为「待兼诗歌剧」、此图为「哭」、作者为「是我祭祭哒」、版权字段为「© 2023 是我祭祭哒」。这是作者表情素材，不是官方游戏素材包；保留角色及作者权利信息，用于本地界面评审。
- 原图：[cry.png](https://raw.githubusercontent.com/Asanatsa/additional-sticker/1a8b7da78e437738f8d98938421e7e78537be2ba/stickers/sblj/cry.png)；[包说明](https://github.com/Asanatsa/additional-sticker/blob/1a8b7da78e437738f8d98938421e7e78537be2ba/stickers/sblj/info.json)。固定提交便于核对来源，2026-10-24 获取。
- 已视觉核对为待兼诗歌剧哭泣的 Q 版图。界面按用户用语显示「诗歌剧·哭哭」，不声称是原包中名为「诗歌剧-哭哭」的另一个指定文件。
- SHA-256：`ca69745bc13be41cb14eb1bcc85f7198f8f45bfe675adc9939daef1ea9747542`。
- 本轮搜索中仅读取公开表情配置以寻找图片，没有执行或整合其 JavaScript，也没有安装第三方依赖。

## 第二十五轮：特别周商店入口

- 项目文件：`special-week-shop-v1.png`。
- 按用户明确要求使用卡通特别周头像、商店背景和圆角方形气泡，内置 imagegen 于 2026-10-22 生成；为本地界面评审的 AI 同人风格素材，不是官方游戏素材。
- 使用下方哭泣图作角色身份参考，生成新的微笑表情与店铺画面；未覆盖或改写参考原图。保留生成输出的透明边缘。
- 完整提示词与生成方式：[special-week-shop-prompt.md](special-week-shop-prompt.md)。

## 第二十五轮：特别周哭泣表情候选

- 文件：`special-week-cry.png`，原下载文件保留透明背景，未编辑像素。
- 公开页面：https://chomagireko.blog.jp/archives/33017095.html
- 页面实际链接：https://livedoor.blogimg.jp/gruntz21-magireko/imgs/e/e/eecc39bb.png
- 已视觉检查为特别周哭泣的 Q 版表情；同页游戏截图说明来自《うまゆる》第 19 话相关内容。收录站不是官方素材包，游戏／动画内容权利归 © Cygames, Inc. 及相关权利人。
- 获取日期：2026-10-22。仅用于用户要求的本地界面预览，仍是待用户确认的候选。
- 「求女儿们给钱」的指定版本尚未定位，网页明确保留待确认位置。第二十八轮按用户授权新绘制「眼冒星星」表情，标记为生成的二创素材，没有冒充原游戏截图。

## 第二十八轮绘制素材

- 工具：内置 `image_gen.imagegen`，2026-10-22；角色二创设计素材，不是官方游戏截图。
- `special-week-star-eyes-v1.png`：新绘制的特别周双眼金色星星表情，透明 PNG，用于赢的结算。
- `eishin-flash-line-v1.png`：荣进闪耀淡紫轮廓画，透明 PNG，用于独立日历背景预览；原图未改，网页以 CSS multiply 与透明度融合。
- 角色参考：https://umamusume.jp/character/eishinflash 。生成提示词见 `round-28-image-prompts.md`。候选简化稿没有采用，未覆盖已保存素材。
- 青春永驻立绘已从主页面移除；文件保留以便后续重新设计，不再出现在当前网页中。
- 第二十九轮用户选择第二张半身候选，保存为 `eishin-flash-half-v1.png` 并放到月历左侧。来源为同日内置 imagegen 的半身生成结果 `exec-6e65c255-4afa-4499-a1a4-b72eaad47689.png`；仅复制，不修改原图像素。提示词补充于 `round-28-image-prompts.md`。

## 第三十轮：爱丽数码半身两案

- 官方身份／性格参考：https://umamusume.jp/character/agnesdigital ，核对其页面直接链接的 agnesdigital_02.png；参考页用于造型识别，未作为网页素材复制。
- 使用内置 image_gen.imagegen 生成二创淡紫线稿，不是官方游戏截图。两图复制后未改像素；网页沿用左侧水印布局。
- `agnes-digital-half-a-v1.png`：合掌应援，生成结果 exec-e53e2478-e6cb-4894-9d0c-18116e77998c.png。
- `agnes-digital-half-b-v1.png`：笔记观察，生成结果 exec-5b1acc04-a3b7-4855-91d8-ead9b5f9e655.png。
- 完整提示词：`agnes-digital-prompts-30.md`。原有荣进闪耀素材与方案保留。

## 第三十二轮：用户参考的侦探半身版

- 用户提供参考：`[local reference, not distributed]`，参考形象为蝴蝶结侦探帽、放大镜、侦探披肩与外翘长发；不声称其为官方截图。输入文件没有修改。
- 风格参考：已选 `eishin-flash-half-v1.png`，仅借鉴淡紫透明线稿形式，未借用荣进闪耀的外貌／服装。
- 工具：内置 image_gen.imagegen；输出 `exec-d168c199-787d-46c6-b2eb-1c52c1d06ac4.png`，复制为 `agnes-digital-detective-half-v1.png`，像素未再编辑。
- 1024×1536 RGBA，alpha 范围 0—254；半身、无鼻血、无对白与日文文字。提示词见 `agnes-digital-detective-prompt-32.md`。
- 第三十一轮鼻血草稿未作为当前方案接入；最新用户参考与无鼻血要求优先。

## 青春永驻

- 角色：青春永驻 / フォーエバーヤング / Forever Young。
- 文件：`forever-young-racing.png`（胜负服，原图保留，未修改像素）。
- 页面：https://umamusume.jp/character/foreveryoung
- 官方页面直接链接的图片：https://images.microcms-assets.io/assets/973fc097984b400db8729642ddff5938/9e4c1db04cdb4722bc545ee778ba38e6/foreveryoung_02.png
- 权利标识：© Cygames, Inc.
- 获取日期：2026-10-20。
- 本项目用于用户要求的本地界面设计预览；网页使用 CSS 控制显示区域。

## 赛事等级图标

- 来源页面：[Gamerch 赛马娘赛程攻略](https://gamerch.com/umamusume/230663)，页面按 GI、GII、GIII 标识这些图片。
- 获取日期：2026-10-21。
- 使用页面实际列出的 90 像素 WebP 候选；下载后未修改图片内容。是攻略页收录的游戏样式图标，不是官方开发者素材包。游戏相关内容权利归 © Cygames, Inc.
- 当前用于马匹近五场及历史比赛详情的本地排版设计。

- race-grade-g1.webp：https://cdn.gamerch.com/resize/eyJidWNrZXQiOiJnYW1lcmNoLWltZy1jb250ZW50cyIsImtleSI6Indpa2lcLzE4NjhcL2VudHJ5XC9XUHFvbEU0My5qcGciLCJlZGl0cyI6eyJ3ZWJwIjp7InF1YWxpdHkiOjg1fSwidG9Gb3JtYXQiOiJ3ZWJwIiwicmVzaXplIjp7IndpZHRoIjo5MCwiZml0IjoiY292ZXIifX19
- race-grade-g2.webp：https://cdn.gamerch.com/resize/eyJidWNrZXQiOiJnYW1lcmNoLWltZy1jb250ZW50cyIsImtleSI6Indpa2lcLzE4NjhcL2VudHJ5XC9jUEdNMmRpeS5qcGciLCJlZGl0cyI6eyJ3ZWJwIjp7InF1YWxpdHkiOjg1fSwidG9Gb3JtYXQiOiJ3ZWJwIiwicmVzaXplIjp7IndpZHRoIjo5MCwiZml0IjoiY292ZXIifX19
- race-grade-g3.webp：https://cdn.gamerch.com/resize/eyJidWNrZXQiOiJnYW1lcmNoLWltZy1jb250ZW50cyIsImtleSI6Indpa2lcLzE4NjhcL2VudHJ5XC90RHE2YkJXai5qcGciLCJlZGl0cyI6eyJ3ZWJwIjp7InF1YWxpdHkiOjg1fSwidG9Gb3JtYXQiOiJ3ZWJwIiwicmVzaXplIjp7IndpZHRoIjo5MCwiZml0IjoiY292ZXIifX19


## 爱丽速子详情状态（第85轮）

`agnes-tachyon-status-sprites-v1.png`：2026-11-06 内置 image_gen 生成的透明 Q 版 2×2 状态贴图，供奔跑、跳跃和叉腰动画使用。提示词和角色官方参考见 `agnes-tachyon-status-prompt-85.md`。
