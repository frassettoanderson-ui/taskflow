<?php
require '../auth.php';
require '../conexao.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $ocorrencia_id = $_POST['ocorrencia_id'] ?? null;
    if (!$ocorrencia_id || !isset($_FILES['imagem'])) {
        echo json_encode(['erro' => 'Dados inválidos.']); exit;
    }
    $file = $_FILES['imagem'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg','jpeg','png','webp','gif'];
    if (!in_array($ext, $allowed)) { echo json_encode(['erro' => 'Formato não permitido.']); exit; }
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
