<?php
date_default_timezone_set('America/Sao_Paulo');
require '../auth.php';
require '../conexao.php';
header('Content-Type: application/json');
$u = usuarioAtual();

// Limpa mensagens privadas com mais de 24h
$pdo->exec("DELETE FROM chat_privado WHERE criado_em < DATE_SUB(NOW(), INTERVAL 24 HOUR)");

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $com = (int)$_GET['com'];
    $since = $_GET['since'] ?? null;
    
    if ($since) {
        $stmt = $pdo->prepare("SELECT cp.*, u.nome, u.setor FROM chat_privado cp JOIN usuarios u ON u.id=cp.de_id WHERE criado_em > ? AND ((de_id=? AND para_id=?) OR (de_id=? AND para_id=?)) ORDER BY criado_em ASC");
        $stmt->execute([$since, $u['id'], $com, $com, $u['id']]);
    } else {
        $stmt = $pdo->prepare("SELECT cp.*, u.nome, u.setor FROM chat_privado cp JOIN usuarios u ON u.id=cp.de_id WHERE (de_id=? AND para_id=?) OR (de_id=? AND para_id=?) ORDER BY criado_em ASC LIMIT 100");
        $stmt->execute([$u['id'], $com, $com, $u['id']]);
    }
    $msgs = $stmt->fetchAll();
    
    // Marca como lidas
    $pdo->prepare("UPDATE chat_privado SET lida=1 WHERE para_id=? AND de_id=?")->execute([$u['id'], $com]);
    
    echo json_encode($msgs);

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true);
    
    if (($d['acao']??'') === 'unread_counts') {
        // Retorna contagem de não lidas por remetente
        $stmt = $pdo->prepare("SELECT de_id, COUNT(*) as total FROM chat_privado WHERE para_id=? AND lida=0 GROUP BY de_id");
        $stmt->execute([$u['id']]);
        $counts = [];
        foreach ($stmt->fetchAll() as $row) {
            $counts[$row['de_id']] = (int)$row['total'];
        }
        echo json_encode($counts);
        exit;
    }
    
    $pdo->prepare("INSERT INTO chat_privado (de_id, para_id, mensagem) VALUES (?,?,?)")->execute([$u['id'], $d['para_id'], $d['mensagem']]);
    
    // Notifica destinatário
    $pdo->prepare("INSERT INTO notificacoes (usuario_id, mensagem) VALUES (?,?)")->execute([$d['para_id'], "💬 Mensagem privada de ".$u['nome'].": ".$d['mensagem']]);
    
    echo json_encode(['ok' => true, 'timestamp' => date('Y-m-d H:i:s')]);
}
