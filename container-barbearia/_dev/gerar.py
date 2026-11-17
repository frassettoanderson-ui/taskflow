import re
# Gera as 4 páginas do site v2 da Container Barbearia a partir dos dados abaixo.
# Rode da pasta container-barbearia/:  python _dev/gerar.py
import json, os
import hashlib
VER = hashlib.md5(open("css/container.css","rb").read() + open("js/container.js","rb").read()).hexdigest()[:8]
os.chdir(os.path.join(os.path.dirname(__file__), '..'))

AGENDA = 'https://sites.appbarber.com.br/barbeariacontainercentro'
INSTA = {'centro': 'https://www.instagram.com/barbeariacontainer_centro/',
         'vila-nova': 'https://www.instagram.com/containerbarbeariavilanova/',
         'nova-brasilia': 'https://www.instagram.com/barberia_containernb/'}
MAPA = {'centro': 'https://www.google.com/maps/search/?api=1&query=Barbearia+Container+Av.+Santa+Catarina+452+Imbituba+SC',
        'vila-nova': 'https://www.google.com/maps/search/?api=1&query=Posto+Benedetta+Vila+Nova+Imbituba+SC',
        'nova-brasilia': 'https://www.google.com/maps/search/?api=1&query=Posto+Sim+Nova+Bras%C3%ADlia+Imbituba+SC'}

# ---------- ícones ----------
I = {
 'seta': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
 'agenda': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 'whats': '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg>',
 'pino': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
 'insta': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
 'wifi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/></svg>',
 'carro': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM5 11h14"/><circle cx="7.5" cy="13.5" r=".5"/><circle cx="16.5" cy="13.5" r=".5"/></svg>',
 'cartao': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/></svg>',
 'crianca': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="6" r="3"/><path d="M12 9v7M8 12h8M9 21l3-5 3 5"/></svg>',
 'acesso': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="2"/><path d="M12 7v6h5l2 6M7 10a6 6 0 1 0 7 9"/></svg>',
 'vapor': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 4c-1.5 2 1.5 3 0 5s1.5 3 0 5M12 4c-1.5 2 1.5 3 0 5s1.5 3 0 5M16 4c-1.5 2 1.5 3 0 5s1.5 3 0 5M4 19h16"/></svg>',
}

# ---------- dados ----------
SERV_CENTRO = [
  ('Cabelo', [('Corte', '30 min', 50, True), ('Cabelo e barba', '1 h', 90, False), ('Corte infantil', '30 min', 50, False),
              ('Pigmentação', '30 min', 50, False), ('Hidratação', '30 min', 20, False), ('Pintura + corte', '2 h', 250, False), ('Platinado + corte', '3 h', 250, False)]),
  ('Barba e rosto', [('Barba', '30 min', 45, True), ('Barba com esfoliante', '30 min', 55, False), ('Sobrancelha', '30 min', 15, False),
                     ('Limpeza de pele', '30 min', 25, False), ('Esfoliação facial', '30 min', 10, False), ('Pelos do nariz', '30 min', 35, False)]),
]
SERV_ORDEM = lambda extra: [
  ('Cabelo', [('Corte', '', 50, True), ('Cabelo e barba', '', 90, False), ('Corte infantil', '', 50, False), (extra[0], '', 50, False)]),
  ('Barba e rosto', [('Barba', '', 45, True), (extra[1], '', 55, False), ('Sobrancelha', '', 15, False), ('Limpeza de pele', '', 25, False)]),
]
HORAS = [None, [9, 19], [9, 19], [9, 19], [9, 19], [9, 19], [9, 17]]  # dom..sáb

BARBEIROS = {
  'erison': ('Erison', '@erison_barbeiro', 'https://www.instagram.com/erison_barbeiro/', 'Centro'),
  'marllon': ('Marllon', '@marllon.sabino', 'https://www.instagram.com/marllon.sabino/', 'Centro'),
  'rogher': ('Rogher', '@barbeiro_rogher01', 'https://www.instagram.com/barbeiro_rogher01/', 'Centro'),
  'will': ('Will', '@willvaargas_', 'https://www.instagram.com/willvaargas_/', 'Nova Brasília'),
  'marco': ('Marco', '@08m4rco', 'https://www.instagram.com/08m4rco/', 'Nova Brasília'),
}

UNID = {
 'centro': dict(nome='Centro', num='01', logo='img/logo-centro-192.png', foto='img/fachada-centro.jpg', foto800='img/fachada-centro-800.jpg',
   alt='Fachada preta da Barbearia Container Centro, com letreiro estêncil, faixa vermelha e fita de LED',
   tipo='Hora marcada', agenda=True, end='Av. Santa Catarina, 452, sala 2', bairro='Centro, Imbituba',
   end_curto='Av. Santa Catarina, 452', fone=[('(48) 99854-0282', '5548998540282'), ('(48) 99917-3444', '5548999173444')],
   frase='Marque pelo app, escolha o barbeiro e chegue na hora. Sem horário, você passa se tiver cadeira livre.',
   card_foto='img/interior-centro-800.jpg', card_alt='Salão do Centro com cadeiras pretas e o teto de colmeia de LED'),
 'vila-nova': dict(nome='Vila Nova', num='02', logo='img/logo-vila-nova-192.png', foto='img/vn-hero.jpg', foto800='img/vn-hero-800.jpg',
   alt='Cliente de perfil com degradê recém-feito no salão de madeira clara da Vila Nova',
   tipo='Ordem de chegada', agenda=False, end='Anexo ao Posto Benedetta', bairro='Vila Nova, Imbituba', end_curto='Anexo ao Posto Benedetta',
   fone=[('(48) 99995-5894', '5548999955894')],
   frase='Sem agenda: chegou, pegou a vez. Estacionamento na porta e barboterapia com vapor de ozônio.',
   card_foto='img/vn-hero-800.jpg', card_alt='Corte degradê feito na Vila Nova'),
 'nova-brasilia': dict(nome='Nova Brasília', num='03', logo='img/logo-nova-brasilia-192.png', foto='img/nb-hero.jpg', foto800='img/nb-hero-800.jpg',
   alt='Nuca com degradê e risco feito na máquina, na Nova Brasília',
   tipo='Ordem de chegada', agenda=False, end='Anexo ao Posto Sim', bairro='Nova Brasília, Imbituba', end_curto='Anexo ao Posto Sim',
   fone=[],
   frase='Sem agenda: chegou, pegou a vez. Degradê, risco na máquina e corte infantil com o Will e o Marco.',
   card_foto='img/nb-hero-800.jpg', card_alt='Degradê com risco feito na Nova Brasília'),
}

GALERIA = {
 'todas': [('img/degrade-centro.jpg', 'Degradê', 'Centro'), ('img/nb-risco.jpg', 'Risco', 'Nova Brasília'), ('img/vn-infantil.jpg', 'Infantil colorido', 'Vila Nova'),
           ('img/corte-centro.jpg', 'Corte', 'Centro'), ('img/vn-salao.jpg', 'Na cadeira', 'Vila Nova'), ('img/vn-cinza.jpg', 'Social', 'Vila Nova'),
           ('img/barba-centro.jpg', 'Barba', 'Centro'), ('img/nb-infantil.jpg', 'Infantil', 'Nova Brasília'), ('img/nb-degrade.jpg', 'Degradê alto', 'Nova Brasília')],
 'centro': [('img/degrade-centro.jpg', 'Degradê', 'Centro'), ('img/corte-centro.jpg', 'Corte', 'Centro'), ('img/barba-centro.jpg', 'Barba', 'Centro'),
            ('img/marllon-trabalhando.jpg', 'Acabamento', 'Centro'), ('img/interior-centro.jpg', 'O salão', 'Centro')],
 'vila-nova': [('img/vn-infantil.jpg', 'Infantil colorido', 'Vila Nova'), ('img/vn-cinza.jpg', 'Social', 'Vila Nova'), ('img/vn-salao.jpg', 'Na cadeira', 'Vila Nova'), ('img/vn-hero.jpg', 'Degradê', 'Vila Nova')],
 'nova-brasilia': [('img/nb-risco.jpg', 'Risco', 'Nova Brasília'), ('img/nb-degrade.jpg', 'Degradê alto', 'Nova Brasília'), ('img/nb-infantil.jpg', 'Infantil', 'Nova Brasília'), ('img/nb-hero.jpg', 'Degradê com risco', 'Nova Brasília')],
}

# ---------- peças ----------
SITE = 'https://containerbarbearia.com.br/'

def head(titulo, desc, og, pagina=''):
    return f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{titulo}</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{SITE}{og}">
<meta property="og:url" content="{SITE}{pagina}">
<link rel="canonical" href="{SITE}{pagina}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0a0a0b">
<link rel="icon" href="favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Stardos+Stencil:wght@400;700&family=Pacifico&family=Cabin+Sketch:wght@700&family=Caveat:wght@500;600;700&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/container.css?v={VER}">
</head>
<body>
'''

def topo(ativo):
    def m(href, txt, chave):
        cur = ' aria-current="page"' if chave == ativo else ''
        return f'<a href="{href}"{cur}>{txt}</a>'
    return f'''<header class="topo">
  <div class="wrap">
    <a class="marca" href="index.html" aria-label="Container Barbearia, início"><img src="img/logo-centro-192.png" alt="" width="64" height="64"><span><b>Barbearia</b><small>Container</small></span></a>
    <nav class="menu" id="menu" aria-label="Principal">
      {m('centro.html', 'Centro', 'centro')}
      {m('vila-nova.html', 'Vila Nova', 'vila-nova')}
      {m('nova-brasilia.html', 'Nova Brasília', 'nova-brasilia')}
      {m('index.html#equipe', 'Barbeiros', 'x')}
      <a class="btn" href="{AGENDA}">Agendar horário {I['seta']}</a>
    </nav>
    <button class="abre-menu" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu"><i></i><i></i></button>
  </div>
</header>
'''

def corrida():
    itens = ['Corte', 'Barba', 'Degradê', 'Risco', 'Pigmentação', 'Platinado', 'Infantil', 'Sobrancelha']
    s = ''.join(f'<span>{t}</span>' for t in itens)
    return f'<div class="corrida" aria-hidden="true"><div class="corrida__trilho">{s}{s}</div></div>\n'

GIZ_DEFS = """<svg class="giz-defs" width="0" height="0" aria-hidden="true" focusable="false"><filter id="giz" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -2.1 0 0 0 1.95" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="t"/><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="1" seed="9" result="w"/><feDisplacementMap in="t" in2="w" scale="2.2" xChannelSelector="R" yChannelSelector="G"/></filter></svg>"""
RISCO = '<svg class="risco" viewBox="0 0 320 16" preserveAspectRatio="none" aria-hidden="true"><path d="M6 10 C 70 4, 140 13, 200 7 S 290 5, 314 9"/></svg>'
CIRCULO = '<svg class="circulo" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true"><path d="M70 6 C 30 2, 6 14, 7 31 C 8 50, 44 57, 74 54 C 104 51, 117 38, 112 22 C 107 8, 82 3, 52 8"/></svg>'

def precos(grupos, assumido, titulo_script, titulo, lead, pe_btn=True):
    cols = ''
    for g, itens in grupos:
        lis = ''
        for nome, tempo, valor, dest in itens:
            a = ' data-assumed' if assumido else ''
            t = f'<span class="tempo">{tempo}</span>' if tempo else ''
            ped = '<em class="pedido">o mais pedido!</em>' if dest else ''
            circ = CIRCULO if dest else ''
            lis += f'<li><span class="nome">{nome}</span>{t}{ped}<i class="pontos"></i><span class="valor"{a}>R$ {valor}{circ}</span></li>\n'
        cols += f'<div class="lousa__col"><h3>{g}</h3><ul>\n{lis}</ul></div>\n'
    pe = f'<div class="precos__pe sobe"><a class="btn btn--grande" href="{AGENDA}">{I["agenda"]} Agendar horário</a></div>' if pe_btn else ''
    return f'''<section class="secao secao--lousa" id="precos" aria-labelledby="precos-h">
  {GIZ_DEFS}
  <div class="wrap">
    <div class="lousa">
      <div class="lousa__quadro">
        <div class="lousa__cab">
          <span class="lousa__rotulo">{titulo_script}</span>
          <h2 class="lousa__titulo" id="precos-h">{titulo}</h2>
          {RISCO}
          <p class="lousa__lead">{lead}</p>
        </div>
        <div class="lousa__cols">
{cols}        </div>
      </div>
      <div class="lousa__bandeja" aria-hidden="true"><i class="giz-branco"></i><i class="giz-laranja"></i><span class="apagador"></span></div>
    </div>
    {pe}
  </div>
</section>
'''

def equipe(chaves, titulo_script, titulo, lead):
    cards = ''
    for k in chaves:
        nome, arroba, url, unid = BARBEIROS[k]
        cards += f'''<a class="barbeiro" href="{url}" target="_blank" rel="noopener">
        <div class="barbeiro__foto"><img src="img/equipe/{k}.jpg" srcset="img/equipe/{k}-600.jpg 600w, img/equipe/{k}.jpg 1024w" sizes="(max-width: 900px) 50vw, 30vw" alt="Retrato do barbeiro {nome}, de camisa preta da Container" width="1024" height="1280" loading="lazy"></div>
        <span class="barbeiro__unid">{unid}</span>
        <div class="barbeiro__nome"><b>{nome}</b><span>{I['insta'].replace('<svg', '<svg width="14" height="14"')} {arroba}</span></div>
      </a>
      '''
    return f'''<section class="secao" id="equipe" aria-labelledby="equipe-h">
  <div class="wrap">
    <div class="secao-cab secao-cab--centro">
      <span class="rotulo">Barbeiros</span><h2 class="titulo estencil inteira" id="equipe-h" data-pal><span class="script">{titulo_script}</span>{titulo}</h2>
      <p class="lead sobe">{lead}</p>
    </div>
    <div class="equipe" style="--n:{min(len(chaves), 3) if len(chaves) != 5 else 5}" data-grupo>
      {cards}
    </div>
  </div>
</section>
'''

# mosaico de 3 colunas (2 no celular) sem buracos: classes por quantidade de fotos
MOSAICO = {9: {0: 'grande', 7: 'm-largo', 8: 'grande grande-d'}, 5: {0: 'grande', 3: 'm-largo', 4: 'largo'}, 4: {0: 'grande', 3: 'faixa'}}

def galeria(chave, titulo_script, titulo):
    itens = GALERIA[chave]
    cls = MOSAICO.get(len(itens), {})
    figs = ''.join(f'<figure class="{cls.get(n, "")}"><img src="{src}" alt="{leg} feito na unidade {u}" loading="lazy"><figcaption>{leg} · {u}</figcaption></figure>'
                   for n, (src, leg, u) in enumerate(itens))
    return f'''<section class="secao secao--galeria" id="cortes" aria-labelledby="cortes-h">
  <div class="wrap">
    <div class="secao-cab secao-cab--centro"><span class="rotulo">Cortes</span><h2 class="titulo estencil inteira" id="cortes-h" data-pal><span class="script">{titulo_script}</span>{titulo}</h2><p class="lead sobe">Cada foto é de um cliente da casa.</p></div>
    <div class="galeria">{figs}</div>
  </div>
</section>
'''

def final(script, titulo, lead, botoes):
    return f'''<section class="final chapa ruido secao--chapa" aria-labelledby="final-h">
  <div class="wrap">
    <h2 id="final-h"><span class="script">{script}</span><span class="estencil" data-pal>{titulo}</span></h2>
    <p class="lead sobe">{lead}</p>
    <div class="sobe" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">{botoes}</div>
  </div>
</section>
'''

def rodape():
    cols = ''
    for k, u in UNID.items():
        tel = ''.join(f'<p><a href="https://wa.me/{n}">{f}</a></p>' for f, n in u['fone'])
        cols += f'''<div><h4><a href="{k}.html">{u['nome']}</a></h4><p>{u['end_curto']}</p><p>{u['tipo']}</p>{tel}<p><a href="{INSTA[k]}" target="_blank" rel="noopener">Instagram</a></p></div>'''
    return f'''<footer class="rodape">
  <div class="faixa" style="position:absolute;inset:0 0 auto"></div>
  <div class="wrap">
    <div class="rodape__grid">
      <div class="rodape__marca"><img src="img/logo-centro.png" alt="Logo da Barbearia Container" width="120" height="120" loading="lazy"><p>Três contêineres de barbearia em Imbituba, SC. Corte, barba e acabamento de quem faz isso todo dia.</p></div>
      {cols}
    </div>
    <div class="rodape__fim"><span>© 2026 Barbearia Container · Imbituba, SC</span><span><a href="{AGENDA}">Agendar no Centro</a></span></div>
  </div>
</footer>
'''

def barra(principal):
    return f'''<div class="barra-cta">{principal}<a class="btn btn--fantasma" href="https://wa.me/5548998540282" aria-label="WhatsApp do Centro">{I['whats']}</a></div>
<script src="js/vendor/gsap.min.js" defer></script>
<script src="js/vendor/ScrollTrigger.min.js" defer></script>
<script src="js/vendor/lenis.min.js" defer></script>
<script src="js/container.js?v={VER}" defer></script>
</body>
</html>
'''

BTN_AGENDA = f'<a class="btn btn--grande btn--pulsa" href="{AGENDA}">{I["agenda"]} Agendar horário</a>'

# ---------- home ----------
def home():
    ctns = ''
    for k, u in UNID.items():
        tcls = 'ctn__tipo ctn__tipo--agenda' if u['agenda'] else 'ctn__tipo'
        ctns += f'''<a class="ctn chapa" href="{k}.html">
        <div class="ctn__foto"><img src="{u['card_foto']}" alt="{u['card_alt']}" loading="lazy"></div>
        <div class="ctn__porta" aria-hidden="true"><i class="chapa"></i><i class="chapa"></i></div>
        <div class="ctn__cod"><span class="ctn__num">{u['num']}</span><span class="ctn__placa">CTNR {u['num']}<br>Imbituba · SC</span></div>
        <div class="ctn__corpo">
          <h3>{u['nome']}</h3>
          <span class="{tcls}">{u['tipo']}</span>
          <p class="ctn__end">{u['end_curto']}</p>
          <span class="ctn__vai">Ver a unidade {I['seta']}</span>
        </div>
      </a>
      '''
    fotos_mapa = {'centro': ('img/fachada-centro-800.jpg', 'Fachada da unidade Centro'), 'vila-nova': ('img/vn-cinza-480.jpg', 'Cliente na cadeira da unidade Vila Nova'),
                  'nova-brasilia': ('img/nb-hero-800.jpg', 'Corte feito na unidade Nova Brasília')}
    mapas = ''.join(f'''<a class="mapa-card" href="{MAPA[k]}" target="_blank" rel="noopener" aria-label="Ver a unidade {u['nome']} no Google Maps">
        <span class="mapa-card__foto"><img src="{fotos_mapa[k][0]}" alt="{fotos_mapa[k][1]}" loading="lazy"></span>
        <span class="mapa-card__txt"><small>Unidade {u['num']}</small><strong>{u['nome']}</strong><span>{u['end']} · {u['bairro']}</span></span>
        <span class="mapa-card__vai">{I['pino']} Ver no mapa</span>
      </a>''' for k, u in UNID.items())
    mimos = ''.join(f'<li>{I[i]} {t}</li>' for i, t in [('wifi', 'Wi-fi'), ('carro', 'Estacionamento'), ('acesso', 'Acessível'), ('crianca', 'Cadeirinha kids'), ('cartao', 'Pix, cartão e dinheiro')])
    passos = ''.join(f'<li class="sobe"><b>0{n}</b><div><strong>{a}</strong><span>{b}</span></div></li>' for n, (a, b) in enumerate([
        ('Escolha o serviço', 'Corte, barba, combo, pigmentação ou platinado.'),
        ('Escolha o barbeiro', 'Erison, Marllon ou Rogher: veja quem está livre.'),
        ('Escolha o horário', 'Confirmou, a cadeira é sua. Sem fila e sem espera.')], 1))
    return (head('Barbearia Container | 3 unidades em Imbituba, agende seu horário',
                 'Barbearia Container em Imbituba, SC: Centro com hora marcada, Vila Nova e Nova Brasília por ordem de chegada. Corte R$ 50, barba R$ 45. Agende pelo app.',
                 'share.jpg')
     + topo('home') + f'''<main>
<section class="heroi heroi--guincho" aria-labelledby="heroi-h">
  <div class="guincho" aria-hidden="true">
    <div class="guincho__lanca">
      <svg class="guincho__trelica" preserveAspectRatio="none"><defs><pattern id="trelica" width="56" height="48" patternUnits="userSpaceOnUse"><path d="M0 44L28 4L56 44" fill="none" stroke="#e8772e" stroke-width="2.5"/></pattern></defs><rect width="100%" height="48" fill="url(#trelica)"/><rect width="100%" height="5" y="1" fill="#e8772e"/><rect width="100%" height="5" y="42" fill="#e8772e"/></svg>
      <span class="guincho__ponta"></span>
      <div class="guincho__carro"><i></i></div>
    </div>
  </div>
  <div class="wrap heroi__txt">
    <div class="heroi__palco">
      <div class="carga" aria-hidden="true">
        <div class="gancho">
          <span class="gancho__cabo"></span>
          <span class="gancho__bloco"></span>
          <svg class="gancho__lingas" viewBox="0 0 1200 160" preserveAspectRatio="none"><path d="M600 6L14 160M600 6L1186 160" fill="none" stroke="#c9c4bc" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>
        </div>
        <svg class="carga__ctn" viewBox="0 0 1200 440" preserveAspectRatio="none">
            <defs><pattern id="onda" width="48" height="440" patternUnits="userSpaceOnUse"><rect x="9" width="24" height="440" fill="rgba(232,119,46,.07)"/><path d="M9 0V440M33 0V440" stroke="#e8772e" stroke-opacity=".42" stroke-width="2"/><path d="M21 0V440" stroke="#000" stroke-opacity=".35" stroke-width="2"/></pattern>
            <linearGradient id="ctn-luz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a0f"/><stop offset=".55" stop-color="#160f0a"/><stop offset="1" stop-color="#0d0a08"/></linearGradient></defs>
            <rect x="6" y="6" width="1188" height="428" fill="url(#ctn-luz)"/>
            <rect x="44" y="46" width="1112" height="348" fill="url(#onda)"/>
            <g fill="none" stroke="#e8772e" stroke-width="4" stroke-linejoin="round">
              <rect x="6" y="6" width="1188" height="428"/>
              <path d="M6 46H1194M6 394H1194M44 46V394M1156 46V394"/>
              <rect x="10" y="10" width="34" height="32"/><rect x="1156" y="10" width="34" height="32"/><rect x="10" y="398" width="34" height="32"/><rect x="1156" y="398" width="34" height="32"/>
            </g>
            <g fill="#e8772e"><rect x="19" y="20" width="16" height="10" rx="5"/><rect x="1165" y="20" width="16" height="10" rx="5"/><rect x="19" y="410" width="16" height="10" rx="5"/><rect x="1165" y="410" width="16" height="10" rx="5"/></g>
            <rect x="44" y="350" width="1112" height="14" fill="#d23a2c"/>
            <g class="carga__placa" font-family="Stardos Stencil, serif" font-weight="700" fill="#e8772e"><text x="72" y="96" font-size="30" letter-spacing="3">CTNR 001</text><text x="72" y="124" font-size="17" letter-spacing="4" fill-opacity=".7">IMBITUBA · SC</text><text x="1128" y="96" font-size="17" letter-spacing="3" text-anchor="end" fill-opacity=".7">MAX GROSS 30.480 KG</text><text x="1128" y="122" font-size="17" letter-spacing="3" text-anchor="end" fill-opacity=".7">TARE 2.200 KG</text></g>
          </svg>
        <span class="poeira poeira--e"><i></i><i></i><i></i></span><span class="poeira poeira--d"><i></i><i></i><i></i></span>
      </div>
      <h1 id="heroi-h"><span class="script">Barbearia</span><span class="estencil inteira" data-pal>Contai<em>ner</em></span></h1>
    </div>
    <div class="heroi__base">
      <p><strong>3 unidades em Imbituba.</strong> No Centro você marca a hora pelo app e escolhe o barbeiro; na Vila Nova e na Nova Brasília é por ordem de chegada.</p>
      <div class="heroi__acoes">{BTN_AGENDA}<a class="btn btn--fantasma" href="#unidades">Ver unidades</a></div>
    </div>
  </div>
</section>
{corrida()}
<section class="secao chapa ruido secao--chapa" id="unidades" aria-labelledby="unidades-h">
  <div class="wrap">
    <div class="secao-cab">
      <div><span class="rotulo">Unidades</span><h2 class="titulo estencil" id="unidades-h" data-pal><span class="script">Três contêineres,</span>um jeito de cortar</h2></div>
      <p class="lead sobe">Cada unidade atende de um jeito. Veja qual é a sua antes de sair de casa.</p>
    </div>
    <div class="conteineres">
      {ctns}
    </div>
  </div>
</section>
<section class="secao" id="agendar" aria-labelledby="agendar-h" data-horas='{json.dumps(HORAS)}'>
  <div class="wrap agendar">
    <div>
      <span class="rotulo">Hora marcada no Centro</span>
      <h2 class="titulo estencil" id="agendar-h" data-pal><span class="script">Sem fila,</span>em três toques</h2>
      <ol class="passos">{passos}</ol>
      <div class="agendar__acoes sobe">{BTN_AGENDA}<a class="btn btn--fantasma" href="https://wa.me/5548998540282">{I['whats']} WhatsApp</a></div>
    </div>
    <div class="agendar__foto revela">
      <img src="img/erison-tesoura.jpg" alt="Erison, barbeiro do Centro, de braços cruzados com a tesoura na mão" loading="lazy" data-paralaxe>
      <div class="agendar__hora"><div><small>Centro · hoje</small><strong data-status>Seg a sex 9h às 19h</strong></div><span class="ponto"></span></div>
    </div>
  </div>
</section>
''' + precos(SERV_CENTRO, False, 'Tabela do Centro', 'Serviços e preços', 'Preço fechado, sem surpresa no fim. A hora marcada vale para todos os serviços.')
     + equipe(['erison', 'marllon', 'rogher', 'will', 'marco'], 'Quem corta', 'Os barbeiros', 'Cinco barbeiros nas três unidades. No Centro, você escolhe com quem marcar pelo app. Toque no retrato e veja os trabalhos no Instagram.')
     + galeria('todas', 'Feitos na casa', 'Os cortes')
     + f'''<section class="espaco" aria-labelledby="espaco-h">
  <div class="espaco__foto"><img src="img/fachada-centro.jpg" alt="Fachada da Barbearia Container Centro" loading="lazy" data-paralaxe></div>
  <div class="wrap espaco__txt">
    <span class="rotulo">O espaço</span>
    <h2 class="titulo estencil" id="espaco-h" data-pal><span class="script">Chegou,</span>é aqui</h2>
    <p class="lead sobe" style="margin-inline:auto">Chapa preta, faixa vermelha e a colmeia de LED no teto. Ar-condicionado, café e a cadeirinha de carro para os pequenos.</p>
    <ul class="mimos sobe">{mimos}</ul>
    <div class="mapas">{mapas}</div>
  </div>
</section>
''' + final('Seu horário', 'te espera', 'Corte R$ 50, barba R$ 45, cabelo e barba R$ 90. Marque agora e chegue na hora certa.',
            BTN_AGENDA + f'<a class="btn btn--fantasma" href="#unidades">Ver as 3 unidades</a>')
     + '</main>\n' + rodape() + barra(f'<a class="btn" href="{AGENDA}">{I["agenda"]} Agendar horário</a>'))

# ---------- unidade ----------
def unidade(k):
    u = UNID[k]
    horas_json = json.dumps(HORAS)
    a = '' if k == 'centro' else ' data-assumed'
    dias = [('Seg a sex', '1 2 3 4 5', '9h às 19h'), ('Sábado', '6', '9h às 17h'), ('Domingo', '0', 'Fechado')]
    horas = ''.join(f'<dt data-dia="{d}">{n}</dt><dd data-dia="{d}">{h}</dd>' for n, d, h in dias)
    if u['agenda']:
        contato = '<p>' + '<br>'.join(f'<a href="https://wa.me/{n}">{f}</a>' for f, n in u['fone']) + '</p>'
        botao_ficha = f'<p style="margin-top:18px"><a class="btn" href="{AGENDA}">{I["agenda"]} Agendar</a></p>'
        acoes = BTN_AGENDA + f'<a class="btn btn--fantasma" href="{MAPA[k]}" target="_blank" rel="noopener">{I["pino"]} Como chegar</a>'
        barra_p = f'<a class="btn" href="{AGENDA}">{I["agenda"]} Agendar horário</a>'
    else:
        if u['fone']:
            f, n = u['fone'][0]
            contato = f'<p><a href="https://wa.me/{n}">{f}</a></p>'
            acoes = f'<a class="btn btn--grande" href="https://wa.me/{n}">{I["whats"]} Ver a fila no WhatsApp</a>'
            barra_p = f'<a class="btn" href="https://wa.me/{n}">{I["whats"]} Ver a fila</a>'
        else:
            contato = f'<p><a href="{INSTA[k]}" target="_blank" rel="noopener">Instagram da unidade</a></p>'
            acoes = f'<a class="btn btn--grande" href="{MAPA[k]}" target="_blank" rel="noopener">{I["pino"]} Como chegar</a>'
            barra_p = f'<a class="btn" href="{MAPA[k]}" target="_blank" rel="noopener">{I["pino"]} Como chegar</a>'
        botao_ficha = f'<p style="margin-top:18px"><a class="btn btn--fantasma" href="{AGENDA}">Hora marcada no Centro</a></p>'
        if u['fone']:
            acoes += f'<a class="btn btn--fantasma" href="{MAPA[k]}" target="_blank" rel="noopener">{I["pino"]} Como chegar</a>'
    ficha = f'''<section class="secao" id="visita" aria-labelledby="visita-h" data-horas='{horas_json}' style="padding-top:clamp(64px,8vw,110px)">
  <div class="wrap">
    <h2 class="sr" id="visita-h">Endereço, horário e contato</h2>
    <div class="ficha" data-grupo>
      <div><h3>Endereço</h3><p>{u['end']}<br>{u['bairro']}</p><p style="margin-top:14px"><a href="{MAPA[k]}" target="_blank" rel="noopener">Abrir no mapa</a></p></div>
      <div><h3>Horário</h3><dl class="horas"{a}>{horas}</dl><span class="status"><span class="ponto agendar__hora" style="all:unset"></span><span data-status></span></span></div>
      <div><h3>{u['tipo']}</h3>{contato}{botao_ficha}</div>
    </div>
  </div>
</section>
'''
    if u['agenda']:
        passos = ''.join(f'<li class="sobe"><b>0{n}</b><div><strong>{x}</strong><span>{y}</span></div></li>' for n, (x, y) in enumerate([
            ('Escolha o serviço', 'Corte, barba, combo, pigmentação ou platinado.'),
            ('Escolha o barbeiro', 'Erison, Marllon ou Rogher.'),
            ('Escolha o horário', 'Confirmou, a cadeira é sua.')], 1))
        meio = f'''<section class="secao chapa ruido secao--chapa" id="agendar" aria-labelledby="agendar-h">
  <div class="wrap agendar">
    <div>
      <span class="rotulo">Como funciona</span>
      <h2 class="titulo estencil" id="agendar-h" data-pal><span class="script">Hora marcada,</span>sem fila</h2>
      <ol class="passos">{passos}</ol>
      <p class="lead sobe" style="font-size:15px">Sem horário? Passe aqui: se tiver cadeira livre na agenda, você corta na hora.</p>
      <div class="agendar__acoes sobe">{BTN_AGENDA}</div>
    </div>
    <div class="agendar__foto revela"><img src="img/interior-centro.jpg" alt="Salão do Centro com o teto de colmeia de LED" loading="lazy" data-paralaxe></div>
  </div>
</section>
''' + precos(SERV_CENTRO, False, 'Tabela do Centro', 'Serviços e preços', 'Preço fechado. Escolha o serviço no app e o tempo já fica reservado.') \
    + equipe(['erison', 'marllon', 'rogher'], 'No Centro', 'Os barbeiros', 'Escolha com quem marcar pelo app. Toque no retrato e veja os trabalhos no Instagram.')
        galeria_k = 'centro'
    else:
        foto_ordem = {'vila-nova': 'img/vn-salao.jpg', 'nova-brasilia': 'img/nb-infantil.jpg'}[k]
        passos = ''.join(f'<li class="sobe"><b>0{n}</b><div><strong>{x}</strong><span>{y}</span></div></li>' for n, (x, y) in enumerate([
            ('Chegue', 'Sem agenda e sem cadastro. ' + ('Estacione na porta do posto.' if k == 'vila-nova' else 'É anexo ao Posto Sim.')),
            ('Pegue a vez', 'Quem chega primeiro corta primeiro.' + (' Pelo WhatsApp você vê como está a fila.' if u['fone'] else '')),
            ('Sente na cadeira', 'Corte, barba e acabamento, para adulto e criança.')], 1))
        meio = f'''<section class="secao chapa ruido secao--chapa" id="como" aria-labelledby="como-h">
  <div class="wrap agendar">
    <div>
      <span class="rotulo">Como funciona</span>
      <h2 class="titulo estencil" id="como-h" data-pal><span class="script">Por ordem</span>de chegada</h2>
      <ol class="passos">{passos}</ol>
      <div class="agendar__acoes sobe">{acoes}</div>
    </div>
    <div class="agendar__foto revela"><img src="{foto_ordem}" alt="Cliente na cadeira da unidade {u['nome']}" loading="lazy" data-paralaxe></div>
  </div>
</section>
'''
        extra = ('Penteado', 'Barboterapia (ozônio)') if k == 'vila-nova' else ('Risco na máquina', 'Barba com esfoliante')
        meio += precos(SERV_ORDEM(extra), True, f'Na {u["nome"]}', 'Serviços e preços', 'Preço fechado, pago na hora: Pix, cartão ou dinheiro.', pe_btn=False)
        if k == 'nova-brasilia':
            meio += equipe(['will', 'marco'], 'Na Nova Brasília', 'Os barbeiros', 'Will e Marco atendem por ordem de chegada. Toque no retrato e veja os trabalhos no Instagram.')
        galeria_k = k
    return (head(f'Barbearia Container {u["nome"]} | {u["tipo"].lower()} em Imbituba',
                 f'Barbearia Container {u["nome"]}, {u["end_curto"]}, Imbituba: {u["tipo"].lower()}. {u["frase"]}', f'share-{k}.jpg', f'{k}.html')
     + topo(k) + f'''<main>
<section class="heroi heroi--unidade" aria-labelledby="heroi-h" style="min-height:88svh">
  <div class="heroi__foto"><img src="{u['foto']}" srcset="{u['foto800']} 800w, {u['foto']} 1536w" sizes="100vw" alt="{u['alt']}" fetchpriority="high"></div>
  <div class="wrap heroi__txt">
    <span class="rotulo">Unidade {u['num']} · {u['tipo']}</span>
    <h1 id="heroi-h" style="margin-top:18px"><span class="script">Container</span><span class="estencil" data-pal>{u['nome']}</span></h1>
    <div class="heroi__base">
      <p><strong>{u['end_curto']}.</strong> {u['frase']}</p>
      <div class="heroi__acoes">{acoes}</div>
    </div>
  </div>
</section>
{corrida()}{ficha}{meio}'''
     + galeria(galeria_k, 'Feitos aqui', 'Os cortes')
     + (final('Seu horário', 'te espera', 'Marque pelo app, escolha o barbeiro e chegue na hora certa.', BTN_AGENDA) if u['agenda'] else
        final('Prefere', 'hora marcada?', 'Na Vila Nova e na Nova Brasília é por ordem de chegada. Se quiser horário certo, o Centro agenda pelo app.' if True else '', BTN_AGENDA + f'<a class="btn btn--fantasma" href="{MAPA[k]}" target="_blank" rel="noopener">{I["pino"]} Como chegar aqui</a>'))
     + '</main>\n' + rodape() + barra(barra_p))

def ico(h):  # botão que começa com ícone ganha o bloco escuro da placa
    return re.sub(r'<a class="btn((?: [\w-]+)*)"([^>]*)><svg', lambda m: '<a class="btn' + m.group(1) + ' btn--ico"' + m.group(2) + '><svg', h)

open('index.html', 'w', encoding='utf-8').write(ico(home()))
for k in UNID:
    open(f'{k}.html', 'w', encoding='utf-8').write(ico(unidade(k)))
print('ok: index + ' + ', '.join(UNID))
