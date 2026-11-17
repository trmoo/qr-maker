#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""QR 코드 만들기 — 검증 기준(golden) 만들기
© 2026 티쳐무 · 모든 권리 보유.

우리가 직접 구현한 QR 인코더(src/lib/qr.js)가 맞는지 대조할 기준을
파이썬 segno(규격을 그대로 구현한 다른 사람의 라이브러리)로 만들어 둔다.
결과는 test/golden.json 이고, `npm test` 가 이것과 모듈 한 칸까지 맞대어 본다.

  python tools/golden.py

⚠ segno 는 이 검증에만 쓴다. 앱 자체는 외부 라이브러리를 쓰지 않는다.
⚠ segno 는 기본으로 오류 정정 수준을 더 높게 올려 준다(boost_error).
   비교하려면 boost_error=False 로 꺼야 한다.
"""
import gzip
import json
import os
import sys

# ⚠ 윈도우 콘솔은 CP949 라 그냥 print 하면 한글·기호에서 죽는다. 출력을 UTF-8 로 맞춘다.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

try:
    import segno
except ImportError:  # pragma: no cover
    print('segno 가 없습니다. pip install --user segno', file=sys.stderr)
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'test', 'golden.json.gz')

# 실제로 쓸 만한 글들
TEXTS = [
    'https://trmoo.github.io/comedu_portal/',
    'https://www.google.com',
    'HTTPS://EXAMPLE.COM/ABC',
    '01234567',
    '8675309',
    '1234567890123456789012345678901234567890',
    'Hello, World!',
    'ABCDEFG 1234 $%*+-./:',
    '와우고등학교 정보 수업',
    '안녕하세요. QR 코드 시험용 글입니다.',
    'WIFI:T:WPA;S:wawoo-class;P:school1234;H:false;;',
    'BEGIN:VCARD\r\nVERSION:3.0\r\nN:티쳐무\r\nTEL:010-0000-0000\r\nEND:VCARD\r\n',
    'tel:01000000000',
    'SMSTO:01000000000:안녕하세요',
    'mailto:enssam21@gmail.com',
    'a',
    '0',
    '가',
    '*' * 100,
    '한글을 길게 넣어 보는 시험용 글입니다. ' * 12,
    'https://example.com/?q=%EA%B0%80%EB%82%98%EB%8B%A4&utm_source=qr',
]

ERRORS = ['l', 'm', 'q', 'h']


def rows_of(symbol):
    return [''.join(str(b) for b in row) for row in symbol.matrix]


def entry(content, error, version=None, mask=None, mode=None):
    qr = segno.make(content, error=error, version=version, mask=mask,
                    mode=mode, boost_error=False, micro=False)
    return {
        'text': content,
        'ecl': error.upper(),
        'version': qr.version,
        'mask': qr.mask,
        'mode': qr.mode,
        'size': len(qr.matrix),
        'rows': rows_of(qr),
    }


def main():
    cases = []

    # ① 보통 글 × 수준 네 가지 (버전·마스크까지 저절로 고르게 둔다)
    for text in TEXTS:
        for err in ERRORS:
            try:
                cases.append(entry(text, err))
            except segno.DataOverflowError:
                pass

    # ② 마스크 여덟 가지를 손으로 지정해 모두 대조
    for text in ('https://trmoo.github.io/comedu_portal/', '와우고 정보', '01234567'):
        for err in ERRORS:
            for mask in range(8):
                cases.append(entry(text, err, mask=mask))

    # ③ 버전 1~40 × 수준 네 가지 — 짧은 글과 거의 꽉 찬 글 두 가지로
    for version in range(1, 41):
        for err in ERRORS:
            cases.append(entry('A', err, version=version))
            # 거의 꽉 차는 길이를 찾아 넣는다
            lo, hi, best = 1, 4300, None
            while lo <= hi:
                mid = (lo + hi) // 2
                try:
                    segno.make('7' * mid, error=err, version=version,
                               boost_error=False, micro=False)
                    best, lo = mid, mid + 1
                except segno.DataOverflowError:
                    hi = mid - 1
            if best:
                cases.append(entry('7' * best, err, version=version))

    # ④ 모드를 손으로 지정 (숫자·영숫자·바이트)
    for text, mode in (('123456', 'numeric'), ('123456', 'alphanumeric'),
                       ('123456', 'byte'), ('ABC123', 'alphanumeric'),
                       ('ABC123', 'byte')):
        for err in ERRORS:
            cases.append(entry(text, err, mode=mode))

    # ⑤ 다른 구현 하나로 더 대조한다 — 파이썬 qrcode(주류 구현).
    #    segno 가 자리 채우기 한 곳에서 규격과 달라서, 그쪽이 맞는지 가리는 데 쓴다.
    cross = []
    try:
        import qrcode
        from qrcode.constants import (ERROR_CORRECT_L, ERROR_CORRECT_M,
                                      ERROR_CORRECT_Q, ERROR_CORRECT_H)
        levels = {'L': ERROR_CORRECT_L, 'M': ERROR_CORRECT_M,
                  'Q': ERROR_CORRECT_Q, 'H': ERROR_CORRECT_H}
        for text in TEXTS:
            for name, const in levels.items():
                q = qrcode.QRCode(error_correction=const, border=0, box_size=1)
                q.add_data(text, optimize=0)  # 여러 모드로 쪼개지 않게 끈다
                q.make(fit=True)
                m = q.get_matrix()
                rows = [''.join('1' if c else '0' for c in row) for row in m]
                # 어느 마스크를 골랐는지는 알려 주지 않으므로, 여덟 가지를 넣어 보고 찾는다
                # (qrcode 의 마스크 고르는 식이 규격과 조금 달라, 대조할 때 맞춰 주어야 한다)
                chosen = None
                for mk in range(8):
                    q2 = qrcode.QRCode(error_correction=const, border=0, box_size=1,
                                       version=q.version, mask_pattern=mk)
                    q2.add_data(text, optimize=0)
                    q2.make(fit=False)
                    if [''.join('1' if c else '0' for c in row) for row in q2.get_matrix()] == rows:
                        chosen = mk
                        break
                cross.append({
                    'text': text,
                    'ecl': name,
                    'version': q.version,
                    'mask': chosen,
                    'size': len(m),
                    'rows': rows,
                })
    except ImportError:
        print('파이썬 qrcode 가 없어 교차 대조는 건너뜁니다 (pip install --user qrcode)',
              file=sys.stderr)

    data = {'generator': 'segno %s' % segno.__version__,
            'cases': cases, 'cross': cross}
    # 4.5MB 가 넘으므로 gzip 으로 담는다. 시험이 node:zlib 로 푼다.
    with gzip.open(OUT, 'wt', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    sizes = sorted({c['size'] for c in cases})
    print('기준 %d가지(segno) + 교차 %d가지(qrcode)를 만들었습니다'
          % (len(cases), len(cross)))
    print('격자 크기 %d~%d, 버전 %d~%d'
          % (sizes[0], sizes[-1], (sizes[0] - 17) // 4, (sizes[-1] - 17) // 4))


if __name__ == '__main__':
    main()
