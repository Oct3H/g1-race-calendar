from pathlib import Path
import json,re
w=Path(__file__).parent;r=w.parents[1]
keys=json.loads((w/'missing.json').read_text());catalog=json.loads((w/'reused.json').read_text())
for line in (w/'translations.tsv').read_text().splitlines():
 if not line.strip():continue
 i,en,ja=line.split('\t');catalog[keys[int(i)]]=[en.replace('\\n','\n'),ja.replace('\\n','\n')]
catalog[keys[952]]=['Machikane Tannhauser · Surprised','マチカネタンホイザ・驚き顔']
# Explicit data-display names and conventional margins, separate from race/horse identity.
catalog.update({'日本 · 中山':['Japan · Nakayama','日本・中山'],'法国 · 巴黎隆尚':['France · ParisLongchamp','フランス・パリロンシャン'],'英国 · 纽马克特':['Great Britain · Newmarket','英国・ニューマーケット'],'英国 · 雅士谷':['Great Britain · Ascot','英国・アスコット'],'日本 · 京都':['Japan · Kyoto','日本・京都'],'日本 · 东京':['Japan · Tokyo','日本・東京'],'澳大利亚 · 弗莱明顿':['Australia · Flemington','オーストラリア・フレミントン'],'澳大利亚 · 示例场地':['Australia · Sample venue','オーストラリア・サンプル会場'],'日本 · 示例赛场':['Japan · Sample racecourse','日本・サンプル競馬場'],'日本 · 示例赛场 A':['Japan · Sample racecourse A','日本・サンプル競馬場A'],'香港 · 示例赛场':['Hong Kong · Sample racecourse','香港・サンプル競馬場'],'美国 · 示例赛场':['United States · Sample racecourse','米国・サンプル競馬場'],'法国 · 示例赛场':['France · Sample racecourse','フランス・サンプル競馬場'],'英国 · 示例赛场':['Great Britain · Sample racecourse','英国・サンプル競馬場'],'澳大利亚 · 示例赛场':['Australia · Sample racecourse','オーストラリア・サンプル競馬場'],'クビ':['Neck','クビ'],'ハナ':['Nose','ハナ'],'アタマ':['Head','アタマ'],'短アタマ':['Short head','短アタマ']})
catalog['{0}，{1}，查看示例详情']=['{0}, {1}, view sample details','{0}、{1}、サンプル詳細を表示']
catalog['本月 {0} 场 · 示例资料']=['Races this month: {0} · Sample data','今月 {0}レース・サンプル']
catalog['{0} · 示例赛场 · {1}']=['{0} · Sample racecourse · {1}','{0}・サンプル競馬場・{1}']
catalog['{4}，查看比赛示例信息']=['{4}, view sample race details','{4}、レースのサンプル詳細を見る']
catalog['{8} · 示例赛场 · {9}']=['{8} · Sample racecourse · {9}','{8}・サンプル競馬場・{9}']
catalog.update(json.loads((w/'data-translations.json').read_text()))
canonical=json.loads((w/'canonical.json').read_text())
missing=set(canonical)-set(catalog)
assert not missing,missing
errors=[]
for key,values in catalog.items():
 slots=set(re.findall(r'\{\d+\}',key))
 for language,value in zip(['en','ja'],values):
  if slots!=set(re.findall(r'\{\d+\}',value)):errors.append((key,language,value))
(w/'placeholder-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2)+'\n')
print('Catalog:',len(catalog),'Placeholder errors:',len(errors))
# Existing calendarUi may reorder expressions and thus use a different set of anonymous slots.
# Do not silently use those reused rows; replace them before applying the catalog.
if errors:
 for row in errors[:12]:print(row)
else:
 (r/'design/ui-messages.mjs').write_text('// UI messages only. Source race/horse names, surface badges and fixed artwork are exempt.\nexport const uiMessages = '+json.dumps(catalog,ensure_ascii=False,indent=2)+';\n')
