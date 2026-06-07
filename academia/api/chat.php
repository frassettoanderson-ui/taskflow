<?php
date_default_timezone_set('America/Sao_Paulo');
require '../auth.php';
require '../conexao.php';
header('Content-Type: application/json');
$u = usuarioAtual();

// Limpeza automática de mensagens com mais de 24h
$pdo->exec("DELETE FROM chat_geral WHERE criado_em < DATE_SUB(NOW(), INTERVAL 24 HOUR)");

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $since = $_GET['since'] ?? null;
    if ($since) {
        $stmt = $pdo->prepare("SELECT c.*, u.nome, u.setor FROM chat_geral c JOIN usuarios u ON u.id=c.usuario_id WHERE c.criado_em > ? ORDER BY c.criado_em ASC");
        $stmt->execute([$since]);
    } else {
        $stmt = $pdo->query("SELECT c.*, u.nome, u.setor FROM chat_geral c JOIN usuarios u ON u.id=c.usuario_id ORDER BY c.criado_em ASC LIMIT 100");
    }
    echo json_encode($stmt->fetchAll());

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true);
    $pdo->prepare("INSERT INTO chat_geral (usuario_id, mensagem) VALUES (?,?)")->execute([$u['id'], $d['mensagem']]);
    $stmt_outros = $pdo->prepare("SELECT id FROM usuarios WHERE id != ? AND ativo = 1");
    $stmt_outros->execute([$u['id']]);
    $outros = $stmt_outros->fetchAll();
    foreach ($outros as $o) {
        $pdo->prepare("INSERT INTO chat_unread (usuario_id, qtd) VALUES (?,1) ON DUPLICATE KEY UPDATE qtd=qtd+1")->execute([$o['id']]);
    }
    echo json_encode(['ok' => true, 'timestamp' => date('Y-m-d H:i:s')]);
}
