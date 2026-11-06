from prepare import *
v={'en':set(),'ja':set()}
for p in work.glob('*.ast.json'):
 for n,path in walk(json.loads(p.read_text())):
  if n.get('type')=='CallExpression' and n.get('callee',{}).get('name')=='calendarUi':
   for language,index in [('en',1),('ja',2)]:
    args=n.get('arguments',[])
    if len(args)<=index:continue
    x=args[index]
    for value,_ in walk(x):
     if value.get('type')=='StringLiteral':v[language].add(value['value'].strip())
     elif value.get('type')=='TemplateLiteral':v[language].add(''.join(t['value'].get('cooked',t['value']['raw'])+(f'{{{i}}}'if i<len(value['expressions'])else'')for i,t in enumerate(value['quasis'])).strip())
for p in work.glob('*.ast.json'):
 for n,path in walk(json.loads(p.read_text())):
  if n.get('type')=='ObjectProperty' and n.get('key',{}).get('name') in {'en','ja'} and any(a.get('type')=='VariableDeclarator' and a.get('id',{}).get('name') in {'messages','copies'} for a in path):
   language=n['key']['name']
   for value,_ in walk(n['value']):
    if value.get('type')=='StringLiteral':v[language].add(value['value'].strip())
for pair in json.loads((work/'reused.json').read_text()).values():
 for language,index in [('en',0),('ja',1)]:v[language].add(pair[index])
(design/'ui-locale-variants.mjs').write_text('// Existing explicitly localized component outputs; prevents translating them twice.\nexport const uiLocaleVariants = '+json.dumps({k:sorted(x)for k,x in v.items()},ensure_ascii=False,indent=2)+';\n')
