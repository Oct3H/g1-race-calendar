# 爱丽速子详情状态素材

2026-11-06，内置 `image_gen`，透明背景。输出 `agnes-tachyon-status-sprites-v1.png`，1254×1254 RGBA。直接使用 2×2 贴图和 CSS 动画，没有裁剪、重新绘制或增加 3D 运行时。

角色造型核对：[官方角色页](https://umamusume.jp/character/agnestachyon/)。图为重新生成的 Q 版角色素材。

## 生成提示词

Create a production game UI sprite sheet: a perfectly regular 2 by 2 grid on a genuinely transparent 1024x1024 canvas, each cell exactly 512x512, no visible grid lines. All four cells depict the SAME recognizable chibi Agnes Tachyon (アグネスタキオン, 爱丽速子) from Uma Musume Pretty Derby in her iconic scientist racing outfit. She has tousled chestnut/ash brown bobbed hair, a large curved ahoge, brown horse ears, mischievous half-lidded amber eyes, fluffy brown tail, an oversized open ivory-white laboratory coat with extremely long wide sleeves, dark olive/black vest over white blouse, dark red neck bow, dark shorts, black tights and shoes, tiny colorful vial details at belt. Cute polished 2D anime SD game art, around 2.5 heads tall, clean rich brown outlines, simple cel shading, very readable at 96 pixels. Consistent face, outfit, same camera, same character height and foot baseline in each cell. Leave 40px transparent padding on all sides of every cell; nothing crosses cells. TOP LEFT: running in place, three-quarter facing right, left leg raised, right leg pushing back, sleeves swinging, playful determined face. TOP RIGHT: matching second running cycle pose, right leg raised, left leg behind, same orientation and framing, complementary sleeve movement. BOTTOM LEFT: joyful victory jump, BOTH arms fully raised high in a V above head, both feet slightly off ground, happy mischievous smile, coat flares; keep entire raised arms and ears inside cell. BOTTOM RIGHT: confidently standing with both hands on hips, elbows out under oversized sleeves, feet apart, relaxed half-lidded smug smile, chin slightly up, low-cortisol relaxed meme attitude. Every cell is a separate full-body pose. No text, lettering, speech balloons, backgrounds, props held in hands, watermarks, labels, panels, glow, ground plane or opaque color filling the transparent background.

## 页面表现

- 左上／右上：两帧奔跑，配合起伏运动，表示确实需要联网取得资料。
- 左下：举手跳跃并显示「加载完成」，约 3.2 秒后进入待机。
- 右下：叉腰待机；本机资料已就绪时直接使用，后台检查不遮挡旧记录。
- 来源失败或未取得不播放完成动画。减少动态效果偏好下保留姿态与文案，停止循环动画。
