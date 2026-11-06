# 第74轮：设置选英语后主日历仍为中文

2026-10-28。用户从设置选择 English，返回URL确有lang=en，但主日历仍中文。根因是设置页已有messages翻译、导航也传了lang，design.js却没有按此参数渲染主日历文字；此前完成的是导航联动，不是全应用翻译。

本轮补主日历语言渲染：显式标记静态UI文本，按lang更新；动态月份、场数、地区筛选、空状态、展开折叠、时区、变更标注及检查更新状态在原控制器生成对应文案。设置往返引用新版本74，保留原导航规则。日文核心文案沿用同一函数；无翻译的旧说明仍保留原文。赛事/马名未纳入界面文案替换，原命名和字体规则保留。

入口：http://127.0.0.1:8765/index.html?preview=calendar&settingsMenu=preview&lang=en&year=2026&month=10&v=74

验证：check_calendar_language.mjs执行实际updateCalendarControls、静态UI更新，检查en/ja/zh、切月、空状态、主要按钮及地区图例。地区图例缺翻译时失败，补后通过。check_preview_navigation、check_change_preview、check_detail_review、check_data_quality_preview、check_notification_review通过；design.js语法通过；4个本机HEAD均200。旧变更检查补齐第72轮引入的通知上下文和更正DOM来源，仅修正测试替身。

限制：没有浏览器渲染；这不是整套原型英语化完成。详情、马匹页、小店、缓存、首次收集和设计演示说明仍含中文，完整静态/动态/无障碍文案需要继续逐组件接入。不能通过改lang标签或URL称为完成，也不要用通用DOM文字替换或Observer掩盖缺项。U6完整三语仍未通过。
