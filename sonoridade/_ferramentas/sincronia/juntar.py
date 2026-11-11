# Junta os mapas em app/dados-teste/sincronia.json e grava o segundo do refrão em ritmos.js.
import json, re, sys, os
sys.stdout.reconfigure(encoding='utf-8')
S = sys.argv[1]
app = sys.argv[2]
NOMES = {
    'perda': 'felipe-rodrigues--tudo-e-perda', 'sublime': 'florianopolis-house-of-prayer--sublime',
    'meama': 'diante-do-trono--me-ama-', 'porqueelevive': 'harpa-crista--porque-ele-vive',
    'tudosobre': 'ministerio-morada--e-tudo-sobre-voce', 'grande': 'adhemar-de-campos--grande-o-senhor',
    'bondade': 'isaias-saad--bondade-de-deus', 'sotuessanto': 'ministerio-morada--so-tu-s-santo',
    'aeleagloria': 'diante-do-trono--a-ele-gloria',
}
TONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
TONS_M = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm']
NOT = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
cifras = json.load(open(os.path.join(S, 'sync', 'cifras.json'), encoding='utf-8'))
sinc, refr = {}, {}
for nome, mid in NOMES.items():
    p = os.path.join(S, 'sync', 'mapas', nome + '.json')
    if not os.path.exists(p): continue
    m = json.load(open(p, encoding='utf-8'))
    if m['refrao'] is not None: refr[mid] = m['refrao']
    # menos de 60% das trocas batendo com o som: o mapa mais atrapalha que ajuda; fica sem
    if m['acerto'] < 0.6:
        print(f'{nome}: mapa descartado (acerto {m["acerto"]})')
        continue
    item = {'ate': m['ate'], 'eventos': m['eventos'], 'conferido': m['acerto']}
    if m['desloc']:
        t = cifras[mid]['tom']
        r = NOT[t[0]] + (1 if t[1:2] == '#' else -1 if t[1:2] == 'b' else 0)
        menor = t.rstrip('#b').endswith('m') or t.endswith('m')
        item['tom'] = (TONS_M if menor else TONS)[(r + m['desloc']) % 12]
    sinc[mid] = item
json.dump(sinc, open(os.path.join(app, 'dados-teste', 'sincronia.json'), 'w', encoding='utf-8'), separators=(',', ':'))

rp = os.path.join(app, 'js', 'dados', 'ritmos.js')
s = open(rp, encoding='utf-8').read()
for mid, seg in refr.items():
    bloco = re.search(r"  '" + re.escape(mid) + r"': \{.*?\n  \},", s, re.S)
    b = bloco.group()
    b2 = re.sub(r"\n    refrao: -?[\d.]+,", '', b)
    b2 = b2.replace("\n    yt: '", f"\n    refrao: {seg},\n    yt: '", 1)
    s = s.replace(b, b2)
open(rp, 'w', encoding='utf-8').write(s)
print({k: (v['ate'], len(v['eventos']), v['conferido'], v.get('tom')) for k, v in sinc.items()})
print(refr)
