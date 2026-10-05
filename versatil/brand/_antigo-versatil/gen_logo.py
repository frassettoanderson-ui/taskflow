from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
OUT="C:/Users/ander/Downloads/taskflow_backup_completo/versatil/brand/"
def text_path(font, text, x, baseline, size, tracking=0):
    gs=font.getGlyphSet(); cmap=font.getBestCmap(); upm=font['head'].unitsPerEm
    s=size/upm; pen=SVGPathPen(gs); cx=x
    for ch in text:
        g=cmap[ord(ch)]
        tp=TransformPen(pen,(s,0,0,-s,cx,baseline)); gs[g].draw(tp)
        cx+=gs[g].width*s+tracking
    return pen.getCommands(), cx
bold=instantiateVariableFont(TTFont('Montserrat.ttf'),{'wght':800})
semi=instantiateVariableFont(TTFont('Montserrat.ttf'),{'wght':700})
t1,end1=text_path(bold,"VERSÁTIL",168,98,92,2)
_,e=text_path(semi,"MELHOR PREÇO DA REGIÃO",172,138,25.5,0)
trk=(end1-2-e)/21
t2,end2=text_path(semi,"MELHOR PREÇO DA REGIÃO",172,138,25.5,trk)
W=int(max(end1,end2)+12)
icon='''<rect x="14" y="14" width="126" height="126" rx="3" fill="none" stroke="{c}" stroke-width="9"/>
<g transform="translate(64 58) rotate(-45)" fill="{c}">
 <rect x="-34" y="-20" width="11" height="40" rx="3"/>
 <rect x="-20" y="-17" width="40" height="34" rx="2"/>
 <rect x="23" y="-20" width="11" height="40" rx="3"/>
 <rect x="-5.5" y="17" width="11" height="62" rx="4.5"/>
</g>
<rect x="30" y="111" width="52" height="11" rx="5.5" fill="{c}"/>'''
defs='''<defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#F3D98B"/><stop offset=".45" stop-color="#D4AF55"/><stop offset="1" stop-color="#A67C2E"/></linearGradient></defs>'''
def svg(fill, bg=None, w=W, content=None):
    b=f'<rect width="{w}" height="154" fill="{bg}"/>' if bg else ''
    body=content or (icon.format(c=fill)+f'<path fill="{fill}" d="{t1}"/><path fill="{fill}" d="{t2}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} 154" width="{w}" height="154">{defs}{b}{body}</svg>'
open(OUT+'logo-dourado-fundo-preto.svg','w').write(svg('url(#gold)','#0B0B0C'))
open(OUT+'logo-dourado.svg','w').write(svg('url(#gold)'))
open(OUT+'logo-preto.svg','w').write(svg('#0B0B0C'))
# ícone quadrado (favicon/app)
ic=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 154 154">{defs}<rect width="154" height="154" rx="28" fill="#0B0B0C"/><g transform="translate(15.4 15.4) scale(.8)">{icon.format(c="url(#gold)")}</g></svg>'
open(OUT+'icone-app.svg','w').write(ic)
print(W)
