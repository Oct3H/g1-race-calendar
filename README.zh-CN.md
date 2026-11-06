# G1 Race Calendar · GⅠ 赛马日历

**测试版 — v0.2.4 / Dev v2.4。目前仍在开发和验证中，不是稳定发行版。**

[English](README.md) · [简体中文](README.zh-CN.md)

面向 macOS 的本地赛马日历，以月历为主体，包含赛事详情、马匹资料、本地缓存与虚拟马券小游戏。界面采用受《赛马娘》启发的明亮配色。

## 目前功能

- 年月跳转、地区筛选、赛事地区配色、等级及芝／ダート标记。
- 日本平地 GⅠ／JpnⅠ；海外按可取得的对应年度浪琴／IFHA 前百名单筛选。
- 从已接入官方来源查询出马表、赛果、单胜赔率、赏金与来源链接。
- 马匹基础资料、血统，以及所看赛事之前的五场战绩；缺失字段保持为空。
- SQLite 本地存储，先显示缓存，更新失败保留旧资料。
- 中／日／英界面，赛事与马名保留来源命名规则。
- 使用本地虚拟资金的银行、马券、退款与赛果通知。
- 按名次渐变的战绩卡，以及 2D 爱丽速子加载／完成／待机提示。

## 测试版范围

界面、数据接入和小游戏仍在测试。部分设计入口包含明确标注的架空示例，不能当作官方数据。

**有日期气泡，不代表详情一定完整。** 海外详情目前较多依赖港马会转播档案，尚未覆盖全部地区、年份和马匹资料。最近记录的 2025 年样本共 122 场，经整轮与局部复查取得 93 场详情，不代表实时可用性保证。详见[查询复查](research/2026-11-05-history-future/README.md)与[当前 UI 验证](research/2026-11-06-horse-ui/README.md)。

## 构建与启动

目前验证目标为 macOS 13 及以上的 Apple Silicon Mac，需要 Xcode Command Line Tools。

```sh
git clone https://github.com/Oct3H/g1-race-calendar.git
cd g1-race-calendar
bash desktop/build.sh
open "dist/GⅠ 赛马日历 Dev v2.4.app"
```

原生 App 自带界面与本机服务，不必另外启动预览服务器。构建产物不上传 Git；本地缓存、设置、虚拟资金及马券保存在：

```text
~/Library/Application Support/G1 Race Calendar Dev/calendar.sqlite
```

用户数据库和资金记录不在仓库中。更换开发版时先使用 **⌘Q** 完全退出旧版。

## 网页预览与检查

网页设计预览需要 Python 3：

```sh
python3 serve_preview.py
```

打开[月历预览](http://127.0.0.1:8765/desktop-calendar-preview.html?lang=zh)或[战绩与动作预览](http://127.0.0.1:8765/index.html?horseReview=preview&preview=calendar&settingsMenu=preview&lang=zh&v=85)。普通浏览器预览不具备原生 App 的联网和 SQLite 功能。

离线回归需要 Node.js，项目根目录执行：

```sh
for test_file in research/check_*.mjs
do
  node --experimental-vm-modules "$test_file" || exit 1
done
```

最近记录为 23 项通过。目录结构与原生检查说明见[英文首页](README.md)。

## 来源与素材

已接入来源包括 JAIRS／JRA、NAR、IFHA 与香港赛马会。素材来源见 [`design/assets/SOURCES.md`](design/assets/SOURCES.md)，第三方测试依赖保留原许可证。本项目为非官方同人项目，尚未选择统一的软件开源许可证。
