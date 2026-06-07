<?php
require '../auth.php';
require '../conexao.php';
header('Content-Type: application/json');
$u = usuarioAtual();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM usuario_config WHERE usuario_id=?");
    $stmt->execute([$u['id']]);
    $cfg = $stmt->fetch();
    if (!$cfg) {
        $pdo->prepare("INSERT INTO usuario_config (usuario_id) VALUES (?)")->execute([$u['id']]);
        $cfg = ['usuario_id'=>$u['id'],'som_ativo'=>1,'notif_ativa'=>1];
    }
    echo json_encode($cfg);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true);
    $pdo->prepare("INSERT INTO usuario_config (usuario_id, som_ativo, notif_ativa) VALUES (?,?,?) ON DUPLICATE KEY UPDATE som_ativo=?, notif_ativa=?")
        ->execute([$u['id'], $d['som_ativo'], $d['notif_ativa'], $d['som_ativo'], $d['notif_ativa']]);
    echo json_encode(['ok'=>true]);
}
