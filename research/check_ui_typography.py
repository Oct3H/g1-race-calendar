"""Read actual macOS font fallback for UI labels, without a browser or extra packages."""
import ctypes as C
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
css = (root / 'design/style.css').read_text()
stack = re.search(r'--font:([^;}]+)', css).group(1)
family = stack.split(',')[0].strip().strip('"')
cf = C.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
ct = C.CDLL('/System/Library/Frameworks/CoreText.framework/CoreText')
class Range(C.Structure):
    _fields_ = [('location', C.c_long), ('length', C.c_long)]
cf.CFStringCreateWithCString.argtypes = [C.c_void_p, C.c_char_p, C.c_uint32]
cf.CFStringCreateWithCString.restype = C.c_void_p
cf.CFStringGetCString.argtypes = [C.c_void_p, C.c_char_p, C.c_long, C.c_uint32]
cf.CFStringGetCString.restype = C.c_bool
cf.CFRelease.argtypes = [C.c_void_p]
ct.CTFontCreateWithName.argtypes = [C.c_void_p, C.c_double, C.c_void_p]
ct.CTFontCreateWithName.restype = C.c_void_p
ct.CTFontCreateForString.argtypes = [C.c_void_p, C.c_void_p, Range]
ct.CTFontCreateForString.restype = C.c_void_p
ct.CTFontCopyFamilyName.argtypes = [C.c_void_p]
ct.CTFontCopyFamilyName.restype = C.c_void_p
UTF8 = 0x08000100

def string(text):
    return cf.CFStringCreateWithCString(None, text.encode(), UTF8)

def font_name(font):
    value = ct.CTFontCopyFamilyName(font)
    buffer = C.create_string_buffer(256)
    assert cf.CFStringGetCString(value, buffer, len(buffer), UTF8)
    cf.CFRelease(value)
    return buffer.value.decode()

japanese_family = re.search(r':lang\(ja\)\{font-family:([^;}]+)', css).group(1).split(',')[0].strip().strip('"')
labels = ['继续查看新更正', '确认购买马券', '返回马匹资料', '语言与显示', '缓存管理', '关闭并查看比赛', '最新の訂正を確認する', '確認購買馬券', 'View latest correction']
report = {}
for label in labels:
    chosen_family = japanese_family if label == '最新の訂正を確認する' else family
    name = string(chosen_family)
    font = ct.CTFontCreateWithName(name, 16, None)
    cf.CFRelease(name)
    text = string(label)
    glyph_fonts = []
    for index, char in enumerate(label):
        selected = ct.CTFontCreateForString(font, text, Range(index, 1))
        glyph_fonts.append((char, font_name(selected)))
        cf.CFRelease(selected)
    cf.CFRelease(text)
    report[label] = glyph_fonts
    cf.CFRelease(font)
result = {'round': 73, 'first_ui_family': family, 'japanese_ui_family': japanese_family, 'labels': report, 'method': 'macOS CoreText per-character fallback for the shared CSS font; no browser rendering'}
print(json.dumps({'first_ui_family': family, 'label_families': {label: sorted({font for _, font in glyphs}) for label, glyphs in report.items()}}, ensure_ascii=False, indent=2))
assert all(len({font for _, font in values}) == 1 for values in report.values()), 'UI label mixes font families through per-character fallback'
def primary_weight(path, selector):
    source = (root / 'design' / path).read_text()
    block = re.search(re.escape(selector) + r'\{([^}]+)', source).group(1)
    return re.search(r'font-weight:([^;}]+)', block).group(1)
assert primary_weight('style.css', '.primary-button') == primary_weight('game-style.css', '.game-primary') == primary_weight('cache-style.css', '.cache-clear-actions #cache-clear-confirm'), 'primary action weights differ'
result['status'] = 'passed'
result['primary_action_weight'] = primary_weight('style.css', '.primary-button')
(root / 'research/ui-typography-check-73.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: ordinary UI labels use one font family, primary actions share a weight; browser pixels not rendered.')
