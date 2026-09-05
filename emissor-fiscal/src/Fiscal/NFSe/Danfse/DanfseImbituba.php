<?php

declare(strict_types=1);

namespace App\Fiscal\NFSe\Danfse;

/**
 * Layout do DANFSE no padrão da Prefeitura Municipal de Imbituba/SC.
 * A nota é emitida pelo Padrão Nacional; aqui só reproduzimos a "cara" do
 * município. Campos exclusivos do sistema municipal (código de verificação,
 * nº de RPS) são mapeados para chave de acesso / nº da DPS.
 */
final class DanfseImbituba extends BaseDanfse
{
    public function nome(): string
    {
        return 'imbituba';
    }

    public function render(string $xmlNfse, array $extra = []): string
    {
        $d = $this->extrair($xmlNfse, $extra);
        $m = fn (float $v) => $this->moeda($v);
        $qr = $this->qr(self::URL_CONSULTA);
        $selo = $d['tpAmb'] === '1' ? '' :
            '<div class="selo">DOCUMENTO EMITIDO EM AMBIENTE DE TESTE — SEM VALOR FISCAL</div>';

        $codVerif = strtoupper(substr($d['chave'], -9)); // aproximação do "código de verificação"
        $endPrest = "{$d['emitLgr']}, {$d['emitNro']} - {$d['emitBairro']} - CEP {$d['emitCep']}";
        $optISS = $d['pTribSN'] > 0 ? $d['pTribSN'] : $d['pAliq'];

        $tomLinhas = ($d['tomaNome'] || $d['tomaDoc'])
            ? $this->kv('Nome/Razão social', $d['tomaNome'])
              . $this->kv('CPF/CNPJ', $d['tomaDoc'])
              . ($d['tomaLgr'] ? $this->kv('Endereço', trim("{$d['tomaLgr']}, {$d['tomaNro']} - {$d['tomaBairro']}")) : '')
              . (($d['tomaMun'] || $d['tomaUF']) ? $this->kv('Município', trim($d['tomaMun'] . ' - ' . $d['tomaUF'])) : '')
              . ($d['tomaMail'] ? $this->kv('E-mail', $d['tomaMail']) : '')
            : '<div class="muted">Tomador não identificado</div>';

        $css = '<style>
          *{font-family:DejaVu Sans,sans-serif;font-size:8.5px;color:#000}
          .doc{border:1px solid #000}
          .head td{border-bottom:1px solid #000;padding:5px 7px;vertical-align:top}
          .muni{font-size:11px;font-weight:bold}
          .sub{font-size:8px}
          .tit{font-size:12px;font-weight:bold}
          .rbox div{font-size:8px}.rbox b{font-size:9px}
          .selo{background:#fde8e8;border-bottom:1px solid #000;color:#a12;text-align:center;padding:4px;font-weight:bold}
          .band{background:#e9eef3;font-weight:bold;font-size:8.5px;padding:3px 7px;border-bottom:1px solid #000;border-top:1px solid #000}
          .body{padding:5px 7px;border-bottom:1px solid #000}
          .kv{margin:1px 0}.kl{font-weight:bold}
          .muted{color:#555;font-style:italic}
          table.t{width:100%;border-collapse:collapse}
          table.srv td{border:0.6px solid #999;padding:4px 5px}
          table.srv th{border:0.6px solid #999;padding:4px 5px;background:#f0f0f0;font-size:7.5px;text-align:right}
          .disc{min-height:120px}
          table.grid td{border:0.6px solid #999;padding:4px 6px;width:20%;vertical-align:top}
          .gl{font-weight:bold;font-size:7px;display:block;color:#333}
          .r{text-align:right}
          .foot{padding:5px 7px;font-size:8px}
          .qr{width:70px;height:70px}
        </style>';

        $html = $css . '<div class="doc">';

        // Cabeçalho
        $html .= '<table class="t head"><tr>'
            . '<td style="width:58%"><div class="tit">Nota Fiscal de Serviço eletrônica - NFS-e</div>'
            . '<div class="sub">SECRETARIA MUNICIPAL DA FAZENDA</div>'
            . '<div class="muni">PREFEITURA MUNICIPAL DE ' . strtoupper($this->e($d['municipio'])) . '</div></td>'
            . '<td class="rbox"><b>Nº da nota:</b> ' . $this->e($d['nNFSe'])
            . '<div><b>Nº do RPS/DPS:</b> ' . $this->e($d['nDPS']) . ' série ' . $this->e($d['serie']) . '</div>'
            . '<div><b>Emissão:</b> ' . $this->e($d['dhProc']) . '</div>'
            . '<div><b>Competência:</b> ' . $this->e($d['dCompet']) . '</div>'
            . '<div><b>Cód. verificação:</b> ' . $this->e($codVerif) . '</div></td>'
            . '<td style="width:78px" class="r">' . ($qr ? '<img class="qr" src="' . $qr . '">' : '') . '</td>'
            . '</tr></table>' . $selo;

        // Prestador
        $html .= '<div class="band">PRESTADOR DE SERVIÇOS</div><div class="body">'
            . $this->kv('Nome/Razão social', $d['emitNome'])
            . ($d['emitFant'] ? $this->kv('Nome fantasia', $d['emitFant']) : '')
            . $this->kv('CPF/CNPJ', $d['emitDoc'])
            . $this->kv('Inscrição municipal', $d['emitIM'] ?: '—')
            . $this->kv('Endereço', $endPrest)
            . $this->kv('Município', trim($d['municipio'] . ' - ' . $d['emitUF']))
            . $this->kv('E-mail', $d['emitMail']) . $this->kv('Telefone', $d['emitFone'])
            . '</div>';

        // Tomador
        $html .= '<div class="band">TOMADOR DE SERVIÇOS</div><div class="body">' . $tomLinhas . '</div>';

        // Discriminação
        $html .= '<div class="band">DISCRIMINAÇÃO DOS SERVIÇOS</div>'
            . '<div class="body disc">' . nl2br($this->e($d['descServ'])) . '</div>';

        // Tabela de valores do serviço
        $html .= '<table class="t srv"><tr>'
            . '<th style="text-align:left;width:40%">Serviço</th><th>Qtd</th><th>Valor unitário</th>'
            . '<th>Valor do serviço</th><th>Base de cálculo</th><th>(%)</th><th>ISS</th></tr>'
            . '<tr><td>' . $this->e($d['descServ']) . '</td>'
            . '<td class="r">1,0000</td><td class="r">' . $m($d['vServ']) . '</td>'
            . '<td class="r">' . $m($d['vServ']) . '</td><td class="r">' . $m($d['vServ']) . '</td>'
            . '<td class="r">' . $m($optISS) . '</td><td class="r">' . $m($d['vISS']) . '</td></tr></table>';

        // Códigos dos serviços
        $html .= '<div class="body"><span class="kl">Códigos dos serviços:</span> '
            . $this->e($d['cTribNac']) . ' - ' . $this->e($d['xTribNac']) . '</div>';

        // Retenções federais
        $html .= '<div class="band">RETENÇÕES FEDERAIS</div><table class="t grid"><tr>'
            . $this->cel('PIS/PASEP', 'R$ ' . $m(0)) . $this->cel('COFINS', 'R$ ' . $m(0))
            . $this->cel('INSS', 'R$ ' . $m(0)) . $this->cel('IR', 'R$ ' . $m(0))
            . $this->cel('CSLL', 'R$ ' . $m(0)) . '</tr></table>';

        // Valores / base de cálculo
        $html .= '<table class="t grid"><tr>'
            . $this->cel('Deduções (R$)', $m(0)) . $this->cel('Desc. incondicionado (R$)', $m(0))
            . $this->cel('Desc. condicionado (R$)', $m(0)) . $this->cel('Base de cálculo (R$)', $m($d['vServ']))
            . $this->cel('Valor ISS (R$)', $m($d['vISS'])) . '</tr><tr>'
            . $this->cel('Valor bruto (R$)', $m($d['vServ'])) . $this->cel('Outras retenções (R$)', $m(0))
            . $this->cel('Situação', 'Normal') . $this->cel('Natureza da operação', 'Tributação no município')
            . $this->cel('Valor líquido (R$)', $m($d['vLiq'])) . '</tr></table>';

        // Outras informações
        $html .= '<div class="band">OUTRAS INFORMAÇÕES</div><div class="foot">'
            . 'Local da prestação do serviço: ' . $this->e($d['localPrest']) . '.<br>'
            . 'Prestador optante pelo Simples Nacional. Alíquota aproximada do ISS: ' . $m($optISS) . '%.<br>'
            . 'Chave de acesso: <span style="font-family:DejaVu Sans Mono">' . $this->e(trim(chunk_split($d['chave'], 4, ' '))) . '</span><br>'
            . 'Verificar autenticidade em ' . self::URL_CONSULTA . '.'
            . '</div>';

        return $this->pdf($html . '</div>');
    }

    private function kv(string $k, string $v): string
    {
        return '<div class="kv"><span class="kl">' . $this->e($k) . ': </span>' . $this->e($v) . '</div>';
    }

    private function cel(string $label, string $val): string
    {
        return '<td><span class="gl">' . $this->e($label) . '</span>' . $this->e($val) . '</td>';
    }
}
