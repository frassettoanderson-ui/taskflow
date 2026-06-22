<?php
/**
 * Funções específicas do painel administrativo.
 */

/** Extensões/MIME permitidos para upload de imagem. */
function upload_tipos(): array
{
    return [
        'image/jpeg' => 'jpg',
        'image/pjpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];
}

/**
 * Processa um campo de upload MÚLTIPLO ($_FILES[$campo]) e move as imagens
 * válidas para uploads/<$tipo>/. Retorna os nomes de arquivo salvos.
 *
 * @param string $tipo 'veiculos' | 'imoveis'
 * @return array{salvos: string[], erros: string[]}
 */
function processar_uploads(string $campo, string $tipo): array
{
    $salvos = [];
    $erros  = [];
    if (empty($_FILES[$campo]) || !is_array($_FILES[$campo]['name'])) {
        return ['salvos' => $salvos, 'erros' => $erros];
    }

    $dir = UPLOADS_PATH . '/' . $tipo;
    if (!is_dir($dir)) @mkdir($dir, 0755, true);

    $permitidos = upload_tipos();
    $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : null;

    $arquivos = $_FILES[$campo];
    $qtd = count($arquivos['name']);

    for ($i = 0; $i < $qtd; $i++) {
        if (($arquivos['error'][$i] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) continue;
        if ($arquivos['error'][$i] !== UPLOAD_ERR_OK) { $erros[] = 'Falha no upload de um arquivo.'; continue; }

        $tmp  = $arquivos['tmp_name'][$i];
        $nome = $arquivos['name'][$i];
        $tam  = (int)$arquivos['size'][$i];

        if ($tam > UPLOAD_MAX_BYTES) { $erros[] = "\"$nome\" excede o tamanho máximo."; continue; }
        if (!is_uploaded_file($tmp)) { continue; }

        $mime = $finfo ? finfo_file($finfo, $tmp) : ($arquivos['type'][$i] ?? '');
        if (!isset($permitidos[$mime])) { $erros[] = "\"$nome\" não é uma imagem válida (use JPG, PNG ou WEBP)."; continue; }

        $ext = $permitidos[$mime];
        $novo = $tipo . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(5)) . '.' . $ext;
        $destino = $dir . '/' . $novo;

        if (move_uploaded_file($tmp, $destino)) {
            @chmod($destino, 0644);
            $salvos[] = $novo;
        } else {
            $erros[] = "Não foi possível salvar \"$nome\".";
        }
    }
    if ($finfo) finfo_close($finfo);

    return ['salvos' => $salvos, 'erros' => $erros];
}

/** Apaga um arquivo de imagem do disco (se for arquivo local). */
function excluir_arquivo_imagem(?string $arquivo, string $tipo): void
{
    if (!$arquivo || preg_match('#^https?://#i', $arquivo)) return;
    $caminho = UPLOADS_PATH . '/' . $tipo . '/' . basename($arquivo);
    if (is_file($caminho)) @unlink($caminho);
}

/** Garante que pelo menos uma imagem do registro esteja marcada como capa. */
function garantir_capa(PDO $pdo, string $tabela, string $fk, int $id): void
{
    $st = $pdo->prepare("SELECT COUNT(*) FROM $tabela WHERE $fk=? AND capa=1");
    $st->execute([$id]);
    if ((int)$st->fetchColumn() === 0) {
        $st = $pdo->prepare("SELECT id FROM $tabela WHERE $fk=? ORDER BY ordem ASC, id ASC LIMIT 1");
        $st->execute([$id]);
        $primeiro = $st->fetchColumn();
        if ($primeiro) {
            $pdo->prepare("UPDATE $tabela SET capa=1 WHERE id=?")->execute([(int)$primeiro]);
        }
    }
}

/** Conta simples para o dashboard. */
function contar(PDO $pdo, string $sql): int
{
    return (int)$pdo->query($sql)->fetchColumn();
}

/** Renderiza a paginação no estilo do admin. */
function adm_pager(array $pag, string $chave = 'pg'): string
{
    if ($pag['total_paginas'] <= 1) return '';
    $a = $pag['pagina']; $t = $pag['total_paginas'];
    $h = '<div class="adm-pag">';
    if ($a > 1) $h .= '<a href="' . e(qs_merge([$chave => $a - 1])) . '">‹</a>';
    for ($i = max(1, $a - 2); $i <= min($t, $a + 2); $i++) {
        $h .= $i === $a
            ? '<span class="on">' . $i . '</span>'
            : '<a href="' . e(qs_merge([$chave => $i])) . '">' . $i . '</a>';
    }
    if ($a < $t) $h .= '<a href="' . e(qs_merge([$chave => $a + 1])) . '">›</a>';
    return $h . '</div>';
}

/** Pill de status pronto (HTML). */
function pill_status(string $status): string
{
    $map = [
        'disponivel' => ['pill-green', 'Disponível'],
        'reservado'  => ['pill-amber', 'Reservado'],
        'vendido'    => ['pill-gray', 'Vendido'],
        'alugado'    => ['pill-blue', 'Alugado'],
    ];
    [$cls, $txt] = $map[$status] ?? ['pill-gray', ucfirst($status)];
    return '<span class="pill ' . $cls . '">' . e($txt) . '</span>';
}
