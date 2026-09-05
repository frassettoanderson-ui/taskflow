<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe\Danfse;

/** Layout padrão (Padrão Nacional) — usado por municípios sem layout próprio. */
final class DanfseNacional extends BaseDanfse
{
    public function nome(): string
    {
        return 'nacional';
    }

    public function render(string $xmlNfse, array $extra = []): string
    {
        $d = $this->extrair($xmlNfse, $extra);
        $m = fn (float $v) => $this->moeda($v);
        $qr = $this->qr(self::URL_CONSULTA);
        $selo = $d['tpAmb'] === '1' ? '' :
            '<div class="selo">DOCUMENTO EMITIDO EM AMBIENTE DE TESTE — SEM VALOR FISCAL</div>';
        $optante = in_array($d['opSN'], ['2', '3'], true) ? 'Sim' : 'Não';
        $regime = $d['opSN'] === '2' ? 'MEI' : ($d['opSN'] === '3' ? 'Simples Nacional' : 'Normal');
        $end = trim("{$d['emitLgr']}, {$d['emitNro']} - {$d['emitBairro']}");

        $tom = ($d['tomaNome'] || $d['tomaDoc'])
            ? "<div><b>{$this->e($d['tomaNome'])}</b> — {$this->e($d['tomaDoc'])}</div>"
            : '<div class="muted">Consumidor não identificado</div>';

        $html = '<style>
          *{font-family:DejaVu Sans,sans-serif;font-size:10px;color:#111}
          .doc{border:1.2px solid #333;border-radius:6px;overflow:hidden}
          .head{background:#0e3a5f;color:#fff;padding:10px 14px}
          .head .t{font-size:15px;font-weight:bold}.head .s{font-size:8px;opacity:.85}
          .selo{background:#fde8e8;border:1px solid #e0b4b4;color:#a12;text-align:center;padding:5px;font-weight:bold;font-size:9px}
          .sec{padding:8px 14px;border-top:1px solid #ddd}
          .sec h4{margin:0 0 5px;font-size:9px;color:#0e3a5f;text-transform:uppercase}
          .kv{margin:2px 0}.lbl{color:#666}.muted{color:#777;font-style:italic}
          table.v{width:100%;border-collapse:collapse;margin-top:4px}table.v td{border:1px solid #ccc;padding:6px}
          .big{font-size:16px;font-weight:bold;color:#0e3a5f}
          .chave{font-family:DejaVu Sans Mono,monospace;font-size:9px;word-break:break-all}
        </style>';

        $html .= '<div class="doc"><div class="head"><table style="width:100%"><tr>'
            . '<td><div class="t">NFS-e</div><div class="s">Nota Fiscal de Serviço eletrônica · Padrão Nacional</div></td>'
            . '<td style="text-align:right"><div class="s">Número</div><b style="font-size:16px">' . $this->e($d['nNFSe']) . '</b>'
            . '<div class="s">Emitida em ' . $this->e($d['dhProc']) . '</div></td></tr></table></div>' . $selo;

        $html .= '<div class="sec"><h4>Prestador</h4>'
            . '<div class="kv"><b>' . $this->e($d['emitNome']) . '</b> — ' . $this->e($d['emitDoc']) . '</div>'
            . '<div class="kv">' . $this->e($end) . ($d['emitCep'] ? ' — ' . $this->e($d['emitCep']) : '') . '</div>'
            . '<div class="kv">' . $this->e($d['municipio']) . '/' . $this->e($d['emitUF'])
            . '  ·  ' . $this->e($d['emitFone']) . '  ·  ' . $this->e($d['emitMail']) . '</div></div>';

        $html .= '<div class="sec"><h4>Tomador</h4>' . $tom . '</div>';

        $html .= '<div class="sec"><h4>Discriminação do serviço</h4>'
            . '<table class="v"><tr><td style="width:70%">' . $this->e($d['descServ'])
            . '<div class="lbl" style="margin-top:4px">' . $this->e($d['xTribNac']) . '</div></td>'
            . '<td style="text-align:right">Valor<br><b>R$ ' . $m($d['vServ']) . '</b></td></tr></table>'
            . '<div class="kv" style="margin-top:6px"><span class="lbl">Cód. tributação: </span><b>' . $this->e($d['cTribNac'])
            . '</b><span class="lbl">  ·  Local: </span><b>' . $this->e($d['localPrest'])
            . '</b><span class="lbl">  ·  Competência: </span><b>' . $this->e($d['dCompet']) . '</b></div></div>';

        $html .= '<div class="sec"><h4>Valores</h4><table class="v"><tr>'
            . '<td>' . $regime . '<br><span class="lbl">Optante Simples: ' . $optante . '</span></td>'
            . '<td style="text-align:right">Valor líquido<br><span class="big">R$ ' . $m($d['vLiq']) . '</span></td></tr></table></div>';

        $html .= '<div class="sec"><table style="width:100%"><tr>'
            . '<td style="width:92px">' . ($qr ? '<img src="' . $qr . '" style="width:82px;height:82px">' : '') . '</td>'
            . '<td><div class="lbl">Chave de acesso</div><div class="chave">' . $this->e(trim(chunk_split($d['chave'], 4, ' ')))
            . '</div><div class="lbl" style="margin-top:3px">Consulte em ' . self::URL_CONSULTA . '</div></td>'
            . '</tr></table></div>';

        return $this->pdf($html . '</div>');
    }
}
