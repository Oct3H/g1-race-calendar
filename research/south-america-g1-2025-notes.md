# 2025 南美平地 G1 日期核对

核对日期：2026-10-21。文件 `south-america-g1-2025.json` 收录 OSAF 2025-01-07 发布全年逐日 pattern calendar 中，Argentina/Brazil/Chile/Peru/Uruguay 五个 Part I 国家全部 87 场 G1 基线：ARG 37、BRZ 26、CHI 17、PER 5、URU 2。OSAF 的质量审查委员会官方说明列出的 Part I 成员正是这五国；本次未将 Venezuela 或 Panama 国内等级比赛加入国际 G1。

## 已核对与边界

- 79 场的实际日期由官方赛果、赛马场赛后报道、官方后续出马表中的过去战绩或官方年度报告核对；另8场仅有官方当日出马表、全年赛程，或预定日期与赛后全年胜者记录的组合，均逐条明确标记，不应宣称87场已逐场拿到最终赛果。
- 巴西26场、秘鲁5场、乌拉圭2场均有赛后/过去战绩核对。巴西以 Jockey Club Brasileiro 和 Jockey Club de São Paulo 的官方2025全年赛果汇总为依据；两家结果名单与OSAF基线相符，没有漏项。
- 日期为赛场当地日历日期。`start_at` 为null；尚未逐场收集准确开跑时刻，不应伪造UTC时间或直接按北京时间把南美日期整体平移。
- Gran Premio Latinoamericano于2025-10-18在Gávea举行；同日 GP Jockey Club de São Paulo也确实在Gávea举办，不能凭赛事名称将其移到CidadeJardim。
- Argentine Stud Book 的部分本地会议programme含海外转播赛，例如18October册列出Latinoamericano，不能据此把巴西比赛再记为SanIsidro的第二场比赛。
- Palermo Estrellas Distaff实际出马/赛果为1800m，OSAF年初日历写2000m；本文件已依据官方结果改为1800m。IFHA部分calendar行也出现距离差异，因此日期验证不代表所有额外字段均完成严格核对。
- No cancellation or postponed date was found among verified entries; remaining8 require final exact-date result corroboration before claiming exhaustive actual-race verification.

## 主要官方来源

- OSAF全年基线：https://www.osafweb.net/wp-content/uploads/Calendario-Clasico-Latinoamericano-2025-orden-cronologico.pdf
- OSAF Part I范围：https://www.osafweb.net/comite-fiscalizador-de-calidad-de-carreras-de-calendario-clasico-de-osaf/
- Gávea2025赛果汇总：https://www.jcb.com.br/imagens/2025/12/CALENDARIO-CLASSICO-25-FINAL.pdf
- CidadeJardim2025赛果汇总：https://jockeysp.com.br/corridas/temporadaclassicaword.asp?ano=2025
- 智利历史赛果：https://studbookdechile.cl/public/historicos/calendario/2025/
- 阿根廷官方赛果：https://www.studbook.org.ar/
- Copa de Plata 13December官方胜马过去战绩：https://www.studbook.org.ar/ejemplares/perfil/424547/knows-all
- 秘鲁官方赛果/赛后报道：https://hipodromodemonterrico.com.pe/
- 乌拉圭两场G1赛后报道：https://www.gub.uy/ministerio-economia-finanzas/comunicacion/noticias/se-corrio-gran-premio-jose-pedro-ramirez-2025

秘鲁JockeyClubdelPerú的22June结果之一使用JCP官方Semana26周刊的Scribd转载；Pamplona另用HKJC官方国际赛事form核对。JSON保留所有逐场来源与核对说明。

## 尚待最终日期赛果佐证

- ARG 2025-04-05 Gilberto Lerena — official_calendar_corroborated
- CHI 2025-05-03 Gran Premio Hipódromo Chile — official_programme_and_result_report
- ARG 2025-09-21 Selección de Potrancas — official_calendar_corroborated
- ARG 2025-10-04 San Isidro - Copa Melchor Ángel Posse — official_programme_verified
- CHI 2025-10-04 Gran Criterium Mauricio Serrano Palma — official_programme_and_result_report
- CHI 2025-10-05 Nacional Ricardo Lyon — official_programme_and_result_report
- ARG 2025-11-19 Dardo Rocha (Internacional) — official_programme_and_result_report
- CHI 2025-12-26 Las Oaks — official_programme_and_result_report
