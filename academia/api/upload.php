<?php
require '../auth.php';
require '../conexao.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $ocorrencia_id = $_POST['ocorrencia_id'] ?? null;
    if (!$ocorrencia_id || !isset($_FILES['imagem'])) {
        echo json_encode(['erro' => 'Dados inválidos.']); exit;
    }
    $u = usuarioAtual();
    $stmt_oc = $pdo->prepare("SELECT criador_id, setor_responsavel FROM ocorrencias WHERE id=?");
    $stmt_oc->execute([$ocorrencia_id]);
    $oc = $stmt_oc->fetch();
    if (!$oc || ($oc['criador_id'] != $u['id'] && $oc['setor_responsavel'] != $u['setor'])) {
        echo json_encode(['erro' => 'Sem permissão.']); exit;
    }

    $file = $_FILES['imagem'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg','jpeg','png','webp','gif'];
    if (!in_array($ext, $allowed)) { echo json_encode(['erro' => 'Formato não permitido.']); exit; }
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    $allowed_mimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!in_array($mime, $allowed_mimes)) { echo json_encode(['erro' => 'Tipo de arquivo não permitido.']); exit; }
    if ($file['size'] > 5 * 1024 * 1024) { echo json_encode(['erro' => 'Arquivo muito grande (max 5MB).']); exit; }

    $dir = '../uploads/ocorrencias/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $nome = uniqid('oc_') . '.' . $ext;
    if (move_uploaded_file($file['tmp_name'], $dir . $nome)) {
        $pdo->prepare("UPDATE ocorrencias SET imagem = ? WHERE id = ?")->execute([$nome, $ocorrencia_id]);
        echo json_encode(['ok' => true, 'imagem' => $nome]);
    } else {
        echo json_encode(['erro' => 'Falha ao salvar arquivo.']);
    }
}
