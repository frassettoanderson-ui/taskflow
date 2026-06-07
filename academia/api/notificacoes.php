<?php
require '../auth.php';
require '../conexao.php';

$u = usuarioAtual();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM notificacoes WHERE usuario_id = ? AND lida = 0 ORDER BY criado_em DESC LIMIT 20");
    $stmt->execute([$u['id']]);
    echo json_encode($stmt->fetchAll());

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo->prepare("UPDATE notificacoes SET lida = 1 WHERE usuario_id = ?")->execute([$u['id']]);
    echo json_encode(['ok' => true]);
}
