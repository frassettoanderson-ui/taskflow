# Monta o mapa "quando cada acorde toca" de uma gravação.
#
# 1. A letra cantada (whisper, com o tempo de cada palavra) é casada com as linhas da cifra por um
#    Viterbi: estados = (linha, palavra); dá para seguir a linha, pular para qualquer linha (refrão
#    repetido, parte que a cifra não escreveu de novo) ou cair num estado "fala/improviso".
# 2. Cada acorde escrito numa sílaba ganha o tempo da palavra cantada ali (encaixado na batida).
# 3. Linhas só de acordes (intro, solo, final) preenchem os vãos sem letra, um acorde por compasso.
# 4. Conferência: o acorde marcado é comparado com o croma do áudio naquele trecho.
import sys, json, re, unicodedata, os
from difflib import SequenceMatcher
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
cifras_json, whisper_json, wav, mid, bpm, cpa = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]), float(sys.argv[6])
saida = sys.argv[7]

c = json.load(open(cifras_json, encoding='utf-8'))[mid]
w = json.load(open(whisper_json, encoding='utf-8'))
duracao = w['duracao']


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s)


# ---------- linhas de letra ----------
linhas = c['linhas']
letra = []          # índice da linha → lista de (palavra normalizada, posição inicial no texto)
for L in linhas:
    pal = []
    if L['texto'].strip():
        for mm in re.finditer(r'\S+', L['texto']):
            n = norm(mm.group())
            if n: pal.append((n, mm.start()))
    letra.append(pal)

estados = [(i, j) for i, p in enumerate(letra) for j in range(len(p))]
S = len(estados) + 1            # último = fala/improviso
G = S - 1
idx = {e: n for n, e in enumerate(estados)}
inicio_linha = np.array([idx[(i, 0)] for i, p in enumerate(letra) if p])
fim_linha = np.zeros(S, bool)
for i, p in enumerate(letra):
    if p: fim_linha[idx[(i, len(p) - 1)]] = True
prox_linha = {}     # estado do fim da linha i → início da próxima linha com letra
com_letra = [i for i, p in enumerate(letra) if p]
for a, b in zip(com_letra, com_letra[1:]):
    prox_linha[idx[(a, len(letra[a]) - 1)]] = idx[(b, 0)]

falas = [x for x in w['palavras'] if norm(x[2])]
T = len(falas)
L = np.log
emis = np.full((T, S), L(0.12))
cache = {}
for t, x in enumerate(falas):
    a = norm(x[2])
    for n, (i, j) in enumerate(estados):
        b = letra[i][j][0]
        k = (a, b)
        if k not in cache:
            r = SequenceMatcher(None, a, b).ratio()
            cache[k] = L(0.03 + 0.97 * r ** 2)
        emis[t, n] = cache[k]
    emis[t, G] = L(0.12)

NL = len(inicio_linha)
p_seg, p_pula, p_fica = L(0.8), L(0.04), L(0.04)
p_prox, p_qualquer_fim, p_qualquer_meio = L(0.75), L(0.2 / NL), L(0.004 / NL)
p_G, p_GG, p_Gsai = L(0.02), L(0.6), L(0.4 / NL)

V = np.full(S, -1e9)
V[inicio_linha] = L(1 / NL)
V[G] = L(0.5)
V += emis[0]
volta = np.zeros((T, S), np.int32)
for t in range(1, T):
    novo = np.full(S, -1e9)
    de = np.zeros(S, np.int32)
    gap = falas[t][0] - falas[t - 1][1]
    bonus_quebra = L(3.0) if gap > 1.5 else 0.0     # pausa longa: provável troca de linha
    def oferta(alvo, origem, val):
        m = val > novo[alvo]
        novo[alvo] = np.where(m, val, novo[alvo])
        de[alvo] = np.where(m, origem, de[alvo])
    n = np.arange(S - 1)
    # ficar / seguir / pular dentro da linha
    oferta(n, n, V[:-1] + p_fica)
    seg_ok = ~fim_linha[:-1]
    o = n[seg_ok]
    oferta(o + 1, o, V[o] + p_seg)
    E = S - 1
    o2 = np.arange(E - 2)[~fim_linha[:E - 2] & ~fim_linha[1:E - 1]]
    oferta(o2 + 2, o2, V[o2] + p_pula)
    # fim da linha → próxima linha
    for a, b in prox_linha.items():
        oferta(np.array([b]), np.array([a]), np.array([V[a] + p_prox + bonus_quebra]))
    # fim de qualquer linha → começo de qualquer linha
    fins = np.where(fim_linha)[0]
    melhor_fim = fins[np.argmax(V[fins])]
    oferta(inicio_linha, np.full(NL, melhor_fim), np.full(NL, V[melhor_fim] + p_qualquer_fim + bonus_quebra))
    # meio de linha → começo de outra (improviso)
    melhor = int(np.argmax(V[:-1]))
    oferta(inicio_linha, np.full(NL, melhor), np.full(NL, V[melhor] + p_qualquer_meio + bonus_quebra))
    # fala
    oferta(np.array([G]), np.array([melhor]), np.array([V[melhor] + p_G]))
    oferta(np.array([G]), np.array([G]), np.array([V[G] + p_GG]))
    oferta(inicio_linha, np.full(NL, G), np.full(NL, V[G] + p_Gsai))
    V = novo + emis[t]
    volta[t] = de
cam = np.zeros(T, np.int32)
cam[-1] = int(np.argmax(V))
for t in range(T - 1, 0, -1):
    cam[t - 1] = volta[t, cam[t]]

# ---------- ocorrências de cada linha ----------
ocorr = []          # {linha, palavras: {j: (ini, fim)}}
atual = None
for t, s in enumerate(cam):
    if s == G:
        atual = None
        continue
    i, j = estados[s]
    if atual is None or atual['linha'] != i or j < atual['ultimo'] or (falas[t][0] - atual['fim'] > 6):
        atual = {'linha': i, 'palavras': {}, 'ultimo': j, 'fim': falas[t][1]}
        ocorr.append(atual)
    atual['palavras'].setdefault(j, (falas[t][0], falas[t][1]))
    atual.setdefault('sims', []).append(SequenceMatcher(None, norm(falas[t][2]), letra[i][j][0]).ratio())
    atual['ultimo'] = j
    atual['fim'] = falas[t][1]
# descarta ocorrências que casaram pouco (1 palavra de linha longa) ou mal (fala parecida com a letra)
ocorr = [o for o in ocorr
         if (len(o['palavras']) >= max(2, 0.4 * len(letra[o['linha']])) or len(letra[o['linha']]) <= 2)
         and np.mean(o['sims']) >= 0.62]

# ---------- batidas ----------
import librosa
y, sr = librosa.load(wav, sr=22050, mono=True)
dur_audio = len(y) / sr
hop = 512
env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
_, bts = librosa.beat.beat_track(onset_envelope=env, sr=sr, hop_length=hop, bpm=bpm, tightness=300)
batidas = librosa.frames_to_time(bts, sr=sr, hop_length=hop)
P = 60 / bpm
compasso = 4 * P * cpa


def encaixa(t):
    if not len(batidas): return t
    i = np.searchsorted(batidas, t)
    perto = [batidas[k] for k in (i - 1, i) if 0 <= k < len(batidas)]
    b = min(perto, key=lambda x: abs(x - t))
    return float(b) if abs(b - t) < 0.4 * P else t


# ---------- acordes das linhas cantadas ----------
eventos = []        # (tempo, k, linha)
for o in ocorr:
    i = o['linha']
    pal = letra[i]
    js = sorted(o['palavras'])
    def tempo_palavra(jj):
        if jj in o['palavras']: return o['palavras'][jj][0]
        # interpola entre vizinhas casadas
        antes = [x for x in js if x < jj]
        depois = [x for x in js if x > jj]
        if antes and depois:
            a, b = antes[-1], depois[0]
            ta, tb = o['palavras'][a][0], o['palavras'][b][0]
            return ta + (tb - ta) * (jj - a) / (b - a)
        if antes: return o['palavras'][antes[-1]][1] + 0.3 * (jj - antes[-1])
        return o['palavras'][depois[0]][0] - 0.35 * (depois[0] - jj)
    o['acordes'] = []
    for a in linhas[i]['acordes']:
        # palavra que contém (ou vem logo depois de) a posição do acorde
        jj = None
        for n2, (_, pos) in enumerate(pal):
            fim_pal = pos + len(linhas[i]['texto'][pos:].split()[0])
            if pos <= a['pos'] < fim_pal or pos >= a['pos']:
                jj = n2
                break
        t = tempo_palavra(jj) if jj is not None else o['fim'] + 0.2
        t = encaixa(t - 0.05)
        o['acordes'].append(t)
        eventos.append([t, a['k'], i])

# ---------- vãos sem letra: linhas só de acordes ----------
so_ac = [i for i, Lh in enumerate(linhas) if not letra[i] and Lh['acordes']]


def antes_de(i):
    """linhas só de acordes logo antes da linha i (intro da parte)"""
    r = []
    n = i - 1
    while n >= 0 and not letra[n]:
        if linhas[n]['acordes']: r.insert(0, n)
        n -= 1
    return r


def depois_de(i):
    r = []
    n = i + 1
    while n < len(linhas) and not letra[n]:
        if linhas[n]['acordes']: r.append(n)
        n += 1
    return r


def preencher(t0, t1, lns, alinhar_fim=True):
    seqk = [a['k'] for n in lns for a in linhas[n]['acordes']]
    if not seqk: return
    vagas = int((t1 - t0) / compasso + 0.35)
    if vagas <= 0: return
    if vagas >= len(seqk):
        reps = [seqk[(n - vagas) % len(seqk)] for n in range(vagas)] if alinhar_fim else [seqk[n % len(seqk)] for n in range(vagas)]
    else:
        reps = seqk[-vagas:] if alinhar_fim else seqk[:vagas]
    for n, k in enumerate(reps):
        t = (t1 - (vagas - n) * compasso) if alinhar_fim else (t0 + n * compasso)
        eventos.append([encaixa(t), k, -1])


ocorr.sort(key=lambda o: min(o['acordes']) if o['acordes'] else o['palavras'][min(o['palavras'])][0])
primeiro_som = float(librosa.frames_to_time(np.argmax(env > env.mean() * 0.6), sr=sr, hop_length=hop))
if ocorr:
    a = ocorr[0]
    t1 = min(a['acordes']) if a['acordes'] else a['palavras'][min(a['palavras'])][0]
    lns = [n for n in range(0, a['linha']) if not letra[n] and linhas[n]['acordes'] and n < (com_letra[0] if com_letra else 0)] or antes_de(a['linha'])
    preencher(primeiro_som, t1, lns)
for a, b in zip(ocorr, ocorr[1:]):
    fim_a = max(a['acordes'] + [a['fim']]) + compasso
    ini_b = min(b['acordes']) if b['acordes'] else b['palavras'][min(b['palavras'])][0]
    if ini_b - fim_a < compasso * 0.9: continue
    if b['linha'] > a['linha']:
        lns = [n for n in range(a['linha'] + 1, b['linha']) if n in so_ac]
    else:
        lns = depois_de(a['linha']) + [n for n in antes_de(b['linha']) if n not in depois_de(a['linha'])]
    preencher(fim_a, ini_b, lns)
fim_letra = max((max(o['acordes'] + [o['fim']]) for o in ocorr), default=0)
if ocorr and dur_audio - fim_letra > 2 * compasso:
    ult = max(ocorr, key=lambda o: o['fim'])
    lns = depois_de(ult['linha'])
    if lns: preencher(fim_letra + compasso, min(dur_audio, fim_letra + compasso * (1 + sum(len(linhas[n]['acordes']) for n in lns))), lns, alinhar_fim=False)

eventos.sort()
# tira repetições coladas (mesmo k em seguida) e eventos quase simultâneos
limpo = []
for e in eventos:
    if limpo and (e[1] == limpo[-1][1] or e[0] - limpo[-1][0] < 0.25):
        if e[0] - limpo[-1][0] < 0.25 and e[1] != limpo[-1][1]: limpo[-1] = e
        continue
    limpo.append(e)
eventos = limpo

# ---------- conferência pelo croma ----------
NOT = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def notas(sim):
    m = re.match(r'^([A-G])([#b]?)(.*?)(?:/([A-G][#b]?))?$', sim)
    r = (NOT[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)) % 12
    resto = m.group(3)
    menor = resto.startswith('m') and not resto.startswith('maj') and not resto.startswith('7M')
    terca = 3 if menor else 4
    if 'sus4' in resto or re.match(r'^4', resto): terca = 5
    if 'sus2' in resto: terca = 2
    return r, [r, (r + terca) % 12, (r + 7) % 12]
k2sim = {a['k']: a['acorde'] for Lh in linhas for a in Lh['acordes']}
h = librosa.effects.harmonic(y)
ch = librosa.feature.chroma_cqt(y=h, sr=sr, hop_length=hop)
tempos_ch = librosa.frames_to_time(np.arange(ch.shape[1]), sr=sr, hop_length=hop)
def nota_trecho(t0, t1, desloc):
    a, b = np.searchsorted(tempos_ch, [t0, t1])
    if b <= a: return None
    v = ch[:, a:b].mean(axis=1)
    v = v / (np.linalg.norm(v) + 1e-9)
    # o acorde certo deve ganhar dos outros 23 maiores/menores
    melhores = []
    for r in range(12):
        for q in (4, 3):
            m = np.zeros(12); m[[r, (r + q) % 12, (r + 7) % 12]] = 1; m[r] += .5
            melhores.append(((m / np.linalg.norm(m)) @ v, r, q))
    melhores.sort(reverse=True)
    return melhores
capo = c['capo']
def acerto(desloc):
    ok = tot = 0
    for n, (t, k, _) in enumerate(eventos):
        t1 = eventos[n + 1][0] if n + 1 < len(eventos) else t + compasso
        if t1 - t < 0.6: continue
        r, ns = notas(k2sim[k])
        r = (r + capo + desloc) % 12
        q = (ns[1] - ns[0]) % 12
        top = nota_trecho(t + 0.1, t1 - 0.1, desloc)
        if not top: continue
        tot += 1
        top3 = [(x[1], x[2]) for x in top[:3]]
        if (r, q) in top3 or (q not in (3, 4) and r in [x[0] for x in top3]): ok += 1
    return ok / max(1, tot), tot
res = {d: acerto(d) for d in range(-6, 6)}
desl = max(res, key=lambda d: res[d][0])
cobre = min(dur_audio, max(o['fim'] for o in ocorr) + compasso) if ocorr else 0
ate = eventos[-1][0] + compasso if eventos else 0
ate = min(dur_audio - 0.5, ate)

# refrão: primeira vez que canta uma linha de refrão DEPOIS de alguma estrofe
# (gravação ao vivo que abre cantando o refrão: o trecho de prévia fica o refrão "de verdade")
refrao = None
viu_outra = False
for o in sorted(ocorr, key=lambda o: o['palavras'][min(o['palavras'])][0]):
    t0 = o['palavras'][min(o['palavras'])][0]
    if linhas[o['linha']]['parte'] != 'refrao':
        viu_outra = True
    elif refrao is None and t0 >= 1.5:
        refrao = round(t0 - 1.5, 1)       # reserva: a primeira de todas
    if viu_outra and linhas[o['linha']]['parte'] == 'refrao':
        refrao = round(max(0.0, t0 - 1.5), 1)
        break

print(f"{mid}: {len(ocorr)} linhas cantadas, {len(eventos)} trocas, até {ate:.0f}s de {dur_audio:.0f}s; "
      f"croma bate {res[0][0]*100:.0f}% (n={res[0][1]}) no tom da cifra; melhor deslocamento {desl:+d} ({res[desl][0]*100:.0f}%); refrão {refrao}s")
seqtxt = []
for o in sorted(ocorr, key=lambda o: o['palavras'][min(o['palavras'])][0])[:400]:
    seqtxt.append(f"{o['palavras'][min(o['palavras'])][0]:6.1f} [{linhas[o['linha']]['parte'][:5]}] {linhas[o['linha']]['texto'].strip()[:50]}")
open(saida + '.log', 'w', encoding='utf-8').write('\n'.join(seqtxt) + '\n\n' + '\n'.join(f"{t:6.1f} {k2sim[k]}  (linha {i})" for t, k, i in eventos))
json.dump({'ate': round(ate, 1), 'refrao': refrao, 'desloc': desl, 'acerto': round(res[desl][0], 2),
           'eventos': [[round(max(0.0, t), 2), k] for t, k, _ in eventos]}, open(saida, 'w', encoding='utf-8'))
