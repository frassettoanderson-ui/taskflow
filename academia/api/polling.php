<?php
date_default_timezone_set('America/Sao_Paulo');
require '../auth.php';
require '../conexao.php';
header('Content-Type: application/json');
header('Cache-Control: no-cache');

$u = usuarioAtual();

// Sessão única: verifica se este token ainda é o ativo
if (isset($_SESSION['session_token'])) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS sessoes_ativas (usuario_id INT PRIMARY KEY, token VARCHAR(64) NOT NULL, atualizado_em DATETIME)");
        $sessStmt = $pdo->prepare("SELECT token FROM sessoes_ativas WHERE usuario_id=?");
        $sessStmt->execute([$u['id']]);
        $sessRow = $sessStmt->fetch();
        if ($sessRow && $sessRow['token'] !== $_SESSION['session_token']) {
            session_destroy();
            echo json_encode(['session_invalida' => true]);
            exit;
        }
    } catch(Exception $e) {}
}

$since      = $_GET['since']        ?? date('Y-m-d H:i:s', strtotime('-5 seconds'));
$lastId     = (int)($_GET['last_id']   ?? 0);
$lastMsgId  = (int)($_GET['last_msg_id']  ?? 0);
$lastHistId = (int)($_GET['last_hist_id'] ?? 0);

$setoresNivel = [
    'gestor'      => ['Direcao','Gerente','Financeiro','Administrativo'],
    'gerente'     => ['Gerente','Financeiro','Administrativo'],
    'colaborador' => ['Administrativo'],
];
$setores = $setoresNivel[$u['nivel']] ?? ['Administrativo'];
$placeholders = implode(',', array_fill(0, count($setores), '?'));

// Notificações não lidas
$notifs = $pdo->prepare("SELECT COUNT(*) FROM notificacoes WHERE usuario_id=? AND lida=0");
$notifs->execute([$u['id']]);
$notifCount = (int)$notifs->fetchColumn();

// Chat geral não lido (via tabela de contagem)
$geralUnread = $pdo->prepare("SELECT COALESCE(SUM(qtd),0) FROM chat_unread WHERE usuario_id=?");
$geralUnread->execute([$u['id']]);
$geralCount = (int)$geralUnread->fetchColumn();

// Chat privado não lido
$privUnread = $pdo->prepare("SELECT COUNT(*) FROM chat_privado WHERE para_id=? AND lida=0");
$privUnread->execute([$u['id']]);
$privCount = (int)$privUnread->fetchColumn();

$chatCount = $geralCount + $privCount;

// Novas tarefas para o setor (por ID)
$novasTarefas = $pdo->prepare("
    SELECT o.*, u.nome as criador_nome, o.prioridade
    FROM ocorrencias o
    JOIN usuarios u ON u.id=o.criador_id
    WHERE o.id > ?
      AND o.setor_responsavel IN ($placeholders)
      AND o.criador_id != ?
      AND o.concluida = 0
");
$novasTarefas->execute(array_merge([$lastId], $setores, [$u['id']]));
$novas = $novasTarefas->fetchAll();

// Maior ID atual
$maxId = (int)$pdo->query("SELECT COALESCE(MAX(id),0) FROM ocorrencias")->fetchColumn();

// Novas mensagens internas — por ID para evitar re-disparo infinito
$novasMsgs = $pdo->prepare("
    SELECT m.*, o.codigo, o.tipo
    FROM ocorrencia_msgs m
    JOIN ocorrencias o ON o.id = m.ocorrencia_id
    WHERE m.id > ?
      AND m.usuario_id != ?
      AND o.criador_id = ?
");
$novasMsgs->execute([$lastMsgId, $u['id'], $u['id']]);
$msgNotifs = $novasMsgs->fetchAll();
$maxMsgId  = $msgNotifs ? (int)max(array_column($msgNotifs, 'id')) : $lastMsgId;

// Tarefas transferidas/devolvidas — usa ID do historico para evitar re-disparo
$transferidas = $pdo->prepare("
    SELECT o.*, u.nome as criador_nome, h.id as hist_id
    FROM ocorrencia_historico h
    JOIN ocorrencias o ON o.id = h.ocorrencia_id
    JOIN usuarios u ON u.id = o.criador_id
    WHERE h.id > ?
      AND h.acao LIKE 'Transferida%'
      AND o.setor_responsavel IN ($placeholders)
      AND o.criador_id != ?
");
$transferidas->execute(array_merge([$lastHistId], $setores, [$u['id']]));
$transferidasArr = $transferidas->fetchAll();

// Tarefas devolvidas para este usuário (ele é o criador)
$devolvidas = $pdo->prepare("
    SELECT o.*, u.nome as criador_nome, h.id as hist_id
    FROM ocorrencia_historico h
    JOIN ocorrencias o ON o.id = h.ocorrencia_id
    JOIN usuarios u ON u.id = o.criador_id
    WHERE h.id > ?
      AND h.acao LIKE 'Devolvida%'
      AND o.criador_id = ?
      AND o.concluida = 0
");
$devolvidas->execute([$lastHistId, $u['id']]);
$devolvidasArr = $devolvidas->fetchAll();

// Maior ID do historico visto
$allHistRows = array_merge($transferidasArr, $devolvidasArr);
$maxHistId = $allHistRows ? (int)max(array_column($allHistRows, 'hist_id')) : $lastHistId;

// Badge setor (unread)
$badgeStmt = $pdo->prepare("
    SELECT COUNT(*) FROM ocorrencia_unread ou
    JOIN ocorrencias o ON o.id = ou.ocorrencia_id
    WHERE ou.usuario_id = ?
      AND o.setor_responsavel IN ($placeholders)
      AND o.criador_id != ?
      AND o.concluida = 0
");
$badgeStmt->execute(array_merge([$u['id']], $setores, [$u['id']]));
$badgeSetor = (int)$badgeStmt->fetchColumn();

// Alta prioridade pendente?
$altaStmt = $pdo->prepare("
    SELECT COUNT(*) FROM ocorrencias
    WHERE setor_responsavel IN ($placeholders)
      AND criador_id != ?
      AND prioridade = 'alta'
      AND status = 'pendente'
      AND concluida = 0
");
$altaStmt->execute(array_merge($setores, [$u['id']]));
$temAlta = (int)$altaStmt->fetchColumn() > 0;

echo json_encode([
    'notif_count'    => $notifCount,
    'chat_count'     => $chatCount,
    'novas_tarefas'  => array_merge($novas, $transferidasArr, $devolvidasArr),
    'max_hist_id'    => $maxHistId,
    'novas_msgs'     => $msgNotifs,
    'max_msg_id'     => $maxMsgId,
    'badge_setor'    => $badgeSetor,
    'tem_alta'       => $temAlta,
    'max_id'         => $maxId,
    'timestamp'      => date('Y-m-d H:i:s'),
]);
