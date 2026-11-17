#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""QR 코드 만들기 — 「정말 읽히는가」 점검 (② 해독해 보기)
© 2026 티쳐무 · 모든 권리 보유.

tools/decode-check.mjs 가 만들어 둔 PNG 를 OpenCV 의 QR 해독기로 읽어,
담은 글이 그대로 나오는지 본다. 우리가 만든 격자가 「규격과 같다」를 넘어
「다른 프로그램이 실제로 읽는다」까지 확인하는 자리다.

⚠ OpenCV 는 이 점검에만 쓴다. 앱 자체는 외부 라이브러리를 쓰지 않는다.
"""
import json
import os
import sys
import tempfile

# ⚠ 윈도우 콘솔은 CP949 라 그냥 print 하면 한글·기호에서 죽는다. 출력을 UTF-8 로 맞춘다.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

try:
    import cv2
except ImportError:  # pragma: no cover
    print('opencv 가 없습니다. pip install --user opencv-python-headless', file=sys.stderr)
    sys.exit(1)

OUT = os.path.join(tempfile.gettempdir(), 'qr-maker-decode')
MANIFEST = os.path.join(OUT, 'manifest.json')

if not os.path.exists(MANIFEST):
    print('먼저 node tools/decode-check.mjs 를 돌리세요', file=sys.stderr)
    sys.exit(1)

with open(MANIFEST, encoding='utf-8') as f:
    cases = json.load(f)

def segno_can_read(text):
    """같은 글을 segno(다른 구현)로 그려도 이 해독기가 못 읽는지 본다.

    ⚠ OpenCV 의 해독기는 버전 26쯤부터 아예 못 읽는다 — segno 가 그린 것도 그렇다.
       그러니 큰 QR 코드가 안 읽히는 것은 우리 잘못이 아니다. 그 사실을 여기서 가린다.
    """
    try:
        import segno
    except ImportError:
        return None
    path = os.path.join(OUT, '_control.png')
    try:
        segno.make(text, error='l', micro=False).save(path, scale=8, border=4)
    except Exception:
        return None
    got, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(path))
    return got == text


detector = cv2.QRCodeDetector()
bad = []
limits = []
for c in cases:
    img = cv2.imread(c['file'])
    if img is None:
        bad.append('%s — 그림을 읽을 수 없습니다' % c['name'])
        continue
    text, points, _ = detector.detectAndDecode(img)
    if text == c['text']:
        if c.get('covered'):
            print('  가린 칸 %d개 → 읽힘 (화면 판정: %s)'
                  % (c['covered'], '읽힘' if c['predict'] else '못 읽음'))
        continue
    if not c.get('predict', True):
        # 화면이 「못 읽습니다」 라고 한 것 — 실제로도 안 읽혔으니 맞다
        print('  가린 칸 %d개 → 안 읽힘 (화면 판정도 못 읽음)' % c.get('covered', 0))
        continue
    if text:
        bad.append('%s (v%d-%s) — 다른 글이 나왔습니다\n      받음: %r\n      기대: %r'
                   % (c['name'], c['version'], c['ecl'], text[:60], c['text'][:60]))
        continue
    # 못 찾았다 — 해독기의 한계인지 우리 잘못인지 가린다
    control = segno_can_read(c['text'])
    if control is False:
        limits.append('%s (v%d-%s)' % (c['name'], c['version'], c['ecl']))
    else:
        bad.append('%s (v%d-%s) — 해독기가 QR 코드를 찾지 못했습니다'
                   % (c['name'], c['version'], c['ecl']))

print('PNG %d장을 해독해 보았습니다 (OpenCV %s)' % (len(cases), cv2.__version__))
if limits:
    print('  — 이 해독기가 큰 QR 코드를 못 읽어 건너뛴 것 %d개: %s'
          % (len(limits), ', '.join(limits)))
    print('    (같은 글을 segno 로 그려도 못 읽습니다. 우리 격자는 npm test 에서 기준과 대조합니다)')
if bad:
    print('\n❌ 읽히지 않은 것\n')
    for b in bad:
        print('  ' + b)
    sys.exit(1)
print('✅ 모두 글자까지 똑같이 읽혔습니다')
