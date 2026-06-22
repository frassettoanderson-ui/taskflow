<?php
/**
 * ============================================================================
 *  Autolar — Funções auxiliares (helpers)
 * ============================================================================
 *  Carregado por TODAS as páginas. Não imprime nada por conta própria.
 * ----------------------------------------------------------------------------
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/* ---------------------------------------------------------------------------
 *  Saída segura
 * ------------------------------------------------------------------------- */

/** Escapa para HTML (use SEMPRE ao imprimir conteúdo dinâmico). */
function e($valor): string
{
    return htmlspecialchars((string)$valor, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** URL com a BASE_URL na frente (para funcionar em subpastas). */
function url(string $caminho = ''): string
{
    $base = defined('BASE_URL') ? BASE_URL : '';
    return $base . '/' . ltrim($caminho, '/');
}

/* ---------------------------------------------------------------------------
 *  Entrada / sanitização
 * ------------------------------------------------------------------------- */

function input_str(string $chave, $default = ''): string
{
    $v = $_GET[$chave] ?? $_POST[$chave] ?? $default;
    if (is_array($v)) return $default;
    return trim((string)$v);
}

function input_int(string $chave, ?int $default = null): ?int
{
    $v = $_GET[$chave] ?? $_POST[$chave] ?? null;
    if ($v === null || $v === '' || is_array($v)) return $default;
    return (int)$v;
}

/** Número decimal "puro" (ponto OU vírgula como separador decimal). Ex.: área m². */
function input_float(string $chave, ?float $default = null): ?float
{
    $v = $_GET[$chave] ?? $_POST[$chave] ?? null;
    if ($v === null || $v === '' || is_array($v)) return $default;
    $v = str_replace([' ', ','], ['', '.'], trim((string)$v));
    return is_numeric($v) ? (float)$v : $default;
}

/** Valor monetário no formato BR ("139.900" ou "139.900,50"): ponto = milhar. */
function input_moeda(string $chave, ?float $default = null): ?float
{
    $v = $_GET[$chave] ?? $_POST[$chave] ?? null;
    if ($v === null || $v === '' || is_array($v)) return $default;
    $v = str_replace(['.', ' '], '', (string)$v); // remove separador de milhar
    $v = str_replace(',', '.', $v);               // vírgula decimal -> ponto
    return is_numeric($v) ? (float)$v : $default;
}

/** Garante que um valor está numa lista permitida (whitelist). */
function input_enum(string $chave, array $permitidos, string $default = ''): string
{
    $v = input_str($chave, $default);
    return in_array($v, $permitidos, true) ? $v : $default;
}

/* ---------------------------------------------------------------------------
 *  CSRF
 * ------------------------------------------------------------------------- */

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function csrf_validar(): bool
{
    $enviado = $_POST['csrf'] ?? '';
    return is_string($enviado)
        && !empty($_SESSION['csrf'])
        && hash_equals($_SESSION['csrf'], $enviado);
}

/* ---------------------------------------------------------------------------
 *  Formatação (pt-BR)
 * ------------------------------------------------------------------------- */

function fmt_moeda($valor): string
{
    return 'R$ ' . number_format((float)$valor, 0, ',', '.');
}

function fmt_moeda_dec($valor): string
{
    return 'R$ ' . number_format((float)$valor, 2, ',', '.');
}

function fmt_km($valor): string
{
    return number_format((float)$valor, 0, ',', '.') . ' km';
}

function fmt_area($valor): string
{
    if ($valor === null || $valor === '') return '—';
    $n = (float)$valor;
    $casas = ($n == floor($n)) ? 0 : 2;
    return number_format($n, $casas, ',', '.') . ' m²';
}

function fmt_data($datetime): string
{
    $ts = strtotime((string)$datetime);
    return $ts ? date('d/m/Y H:i', $ts) : '—';
}

/* ---------------------------------------------------------------------------
 *  Rótulos legíveis (enum -> texto)
 * ------------------------------------------------------------------------- */

function rotulo_cambio(string $v): string
{
    return [
        'manual' => 'Manual', 'automatico' => 'Automático',
        'automatizado' => 'Automatizado', 'cvt' => 'CVT',
    ][$v] ?? ucfirst($v);
}

function rotulo_combustivel(string $v): string
{
    return [
        'flex' => 'Flex', 'gasolina' => 'Gasolina', 'diesel' => 'Diesel',
        'eletrico' => 'Elétrico', 'hibrido' => 'Híbrido', 'gnv' => 'GNV',
    ][$v] ?? ucfirst($v);
}

function rotulo_categoria_veic(string $v): string
{
    return [
        'hatch' => 'Hatch', 'sedan' => 'Sedan', 'suv' => 'SUV',
        'picape' => 'Picape', 'eletrico' => 'Carro elétrico',
        'utilitario' => 'Utilitário', 'cupe' => 'Cupê', 'outro' => 'Outro',
    ][$v] ?? ucfirst($v);
}

function rotulo_tipo_imovel(string $v): string
{
    return [
        'casa' => 'Casa', 'apartamento' => 'Apartamento', 'terreno' => 'Terreno',
        'comercial' => 'Comercial', 'sitio' => 'Sítio', 'sobrado' => 'Sobrado',
    ][$v] ?? ucfirst($v);
}

function rotulo_status_veic(string $v): string
{
    return ['disponivel' => 'Disponível', 'reservado' => 'Reservado', 'vendido' => 'Vendido'][$v] ?? ucfirst($v);
}

function rotulo_status_imovel(string $v): string
{
    return ['disponivel' => 'Disponível', 'reservado' => 'Reservado', 'vendido' => 'Vendido', 'alugado' => 'Alugado'][$v] ?? ucfirst($v);
}

/* ---------------------------------------------------------------------------
 *  Imagens
 * ------------------------------------------------------------------------- */

/**
 * Resolve a URL de uma imagem armazenada no banco.
 *  - se vier vazia -> placeholder
 *  - se começar com http -> usa como está
 *  - senão -> /uploads/<tipo>/<arquivo> (se existir), com fallback p/ placeholder
 *
 * @param string $tipo  'veiculos' ou 'imoveis'
 */
function imagem_url(?string $arquivo, string $tipo): string
{
    $placeholder = url('assets/img/placeholder-' . ($tipo === 'imoveis' ? 'imovel' : 'veiculo') . '.svg');
    if (!$arquivo) return $placeholder;
    if (preg_match('#^https?://#i', $arquivo)) return $arquivo;

    $rel = 'uploads/' . $tipo . '/' . $arquivo;
    $abs = ROOT_PATH . '/' . $rel;
    return is_file($abs) ? url($rel) : $placeholder;
}

/** Retorna a imagem de capa (array completo de imagens já carregado). */
function imagem_capa(array $imagens, string $tipo): string
{
    if (empty($imagens)) return imagem_url(null, $tipo);
    foreach ($imagens as $img) {
        if (!empty($img['capa'])) return imagem_url($img['arquivo'], $tipo);
    }
    return imagem_url($imagens[0]['arquivo'], $tipo);
}

/* ---------------------------------------------------------------------------
 *  WhatsApp
 * ------------------------------------------------------------------------- */

function whatsapp_link(?string $mensagem = null): string
{
    $msg = $mensagem ?? WHATSAPP_TEXTO_PADRAO;
    return 'https://wa.me/' . WHATSAPP_NUMERO . '?text=' . rawurlencode($msg);
}

/* ---------------------------------------------------------------------------
 *  Filtros / query string
 * ------------------------------------------------------------------------- */

/** Reconstrói a query string preservando filtros e trocando/mesclando chaves. */
function qs_merge(array $novos): string
{
    $base = $_GET;
    foreach ($novos as $k => $v) {
        if ($v === null || $v === '') unset($base[$k]);
        else $base[$k] = $v;
    }
    return $base ? '?' . http_build_query($base) : '';
}

/* ---------------------------------------------------------------------------
 *  Paginação
 * ------------------------------------------------------------------------- */

/**
 * Gera os dados de paginação.
 * @return array{pagina:int, total_paginas:int, offset:int, por_pagina:int}
 */
function paginacao(int $totalItens, ?int $porPagina = null, string $chave = 'pg'): array
{
    $porPagina = $porPagina ?: (defined('ITENS_POR_PAGINA') ? ITENS_POR_PAGINA : 9);
    $totalPaginas = max(1, (int)ceil($totalItens / $porPagina));
    $pagina = max(1, min($totalPaginas, input_int($chave, 1)));
    return [
        'pagina'        => $pagina,
        'total_paginas' => $totalPaginas,
        'offset'        => ($pagina - 1) * $porPagina,
        'por_pagina'    => $porPagina,
    ];
}

/** Renderiza os links de paginação (HTML). */
function render_paginacao(array $pag, string $chave = 'pg'): string
{
    if ($pag['total_paginas'] <= 1) return '';
    $atual = $pag['pagina'];
    $total = $pag['total_paginas'];

    $html = '<nav class="paginacao" aria-label="Paginação">';

    // anterior
    if ($atual > 1) {
        $html .= '<a class="pg-link" href="' . e(qs_merge([$chave => $atual - 1])) . '">‹</a>';
    }

    $ini = max(1, $atual - 2);
    $fim = min($total, $atual + 2);
    if ($ini > 1) {
        $html .= '<a class="pg-link" href="' . e(qs_merge([$chave => 1])) . '">1</a>';
        if ($ini > 2) $html .= '<span class="pg-gap">…</span>';
    }
    for ($i = $ini; $i <= $fim; $i++) {
        $cls = $i === $atual ? 'pg-link is-active' : 'pg-link';
        $html .= '<a class="' . $cls . '" href="' . e(qs_merge([$chave => $i])) . '">' . $i . '</a>';
    }
    if ($fim < $total) {
        if ($fim < $total - 1) $html .= '<span class="pg-gap">…</span>';
        $html .= '<a class="pg-link" href="' . e(qs_merge([$chave => $total])) . '">' . $total . '</a>';
    }

    if ($atual < $total) {
        $html .= '<a class="pg-link" href="' . e(qs_merge([$chave => $atual + 1])) . '">›</a>';
    }
    $html .= '</nav>';
    return $html;
}

/* ---------------------------------------------------------------------------
 *  Diversos
 * ------------------------------------------------------------------------- */

function redirecionar(string $caminho): void
{
    header('Location: ' . url($caminho));
    exit;
}

/** Mensagem flash (sobrevive a 1 redirecionamento). */
function flash_set(string $tipo, string $msg): void
{
    $_SESSION['flash'][] = ['tipo' => $tipo, 'msg' => $msg];
}

function flash_get(): array
{
    $f = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $f;
}

/* ---------------------------------------------------------------------------
 *  Acesso a dados — reutilizável por catálogos e admin
 * ------------------------------------------------------------------------- */

/**
 * Retorna a imagem de capa de vários registros de uma vez.
 * @return array<int,string>  [registro_id => arquivo]
 */
function capas_por_ids(PDO $pdo, string $tabelaImg, string $fk, array $ids): array
{
    $ids = array_values(array_filter(array_map('intval', $ids)));
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $sql = "SELECT $fk AS rid, arquivo, capa, ordem
            FROM $tabelaImg WHERE $fk IN ($in)
            ORDER BY capa DESC, ordem ASC, id ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($ids);
    $map = [];
    foreach ($stmt->fetchAll() as $r) {
        $rid = (int)$r['rid'];
        if (!isset($map[$rid])) $map[$rid] = $r['arquivo']; // primeiro = capa/ordem
    }
    return $map;
}

/** Todas as imagens de UM registro (para galeria/detalhe). */
function imagens_do_registro(PDO $pdo, string $tabelaImg, string $fk, int $id): array
{
    $stmt = $pdo->prepare("SELECT * FROM $tabelaImg WHERE $fk = ? ORDER BY capa DESC, ordem ASC, id ASC");
    $stmt->execute([$id]);
    return $stmt->fetchAll();
}

/** Diferenciais (lista de nomes) de UM registro. */
function diferenciais_do_registro(PDO $pdo, string $tabelaDif, string $fk, int $id): array
{
    $stmt = $pdo->prepare("SELECT nome FROM $tabelaDif WHERE $fk = ? ORDER BY nome");
    $stmt->execute([$id]);
    return array_column($stmt->fetchAll(), 'nome');
}

/** Lista de valores distintos (para popular selects de filtro). */
function valores_distintos(PDO $pdo, string $tabela, string $coluna, string $where = 'ativo = 1'): array
{
    $sql = "SELECT DISTINCT $coluna AS v FROM $tabela WHERE $where AND $coluna IS NOT NULL AND $coluna <> '' ORDER BY $coluna";
    $rows = $pdo->query($sql)->fetchAll();
    return array_column($rows, 'v');
}
