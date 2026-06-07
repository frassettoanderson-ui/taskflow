<?php
date_default_timezone_set('America/Sao_Paulo');
require '../auth.php';
require '../conexao.php';
header('Content-Type: application/json');
header('Cache-Control: no-cache');

$u = usuarioAtual();
$since = $_GET['since'] ?? date('Y-m-d H:i:s', strtotime('-5 seconds'));
$lastId = (int)($_GET['last_id'] ?? 0);

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

// Novas mensagens no chat
$chat = $pdo->prepare("SELECT COUNT(*) FROM chat_geral WHERE criado_em > ? AND usuario_id != ?");
$chat->execute([$since, $u['id']]);
$chatCount = (int)$chat->fetchColumn();

// Novas tarefas para o setor (por ID — mais confiável que timestamp)
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

// Novas mensagens internas em tarefas (para toast/som ao criador)
$novasMsgs = $pdo->prepare("
    SELECT m.*, o.codigo, o.tipo
    FROM ocorrencia_msgs m
    JOIN ocorrencias o ON o.id = m.ocorrencia_id
    WHERE m.criado_em > ?
      AND m.usuario_id != ?
      AND o.criador_id = ?
");
$novasMsgs->execute([$since, $u['id'], $u['id']]);
$msgNotifs = $novasMsgs->fetchAll();

// Tarefas transferidas para o setor
$transferidas = $pdo->prepare("
    SELECT o.*, u.nome as criador_nome
    FROM ocorrencia_historico h
    JOIN ocorrencias o ON o.id = h.ocorrencia_id
    JOIN usuarios u ON u.id = o.criador_id
    WHERE h.criado_em > ?
      AND h.acao LIKE 'Transferida%'
      AND o.setor_responsavel IN ($placeholders)
      AND o.criador_id != ?
");
$transferidas->execute(array_merge([$since], $setores, [$u['id']]));
$transferidasArr = $transferidas->fetchAll();

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
    'novas_tarefas'  => array_merge($novas, $transferidasArr),
    'novas_msgs'     => $msgNotifs,
    'badge_setor'    => $badgeSetor,
    'tem_alta'       => $temAlta,
    'max_id'         => $maxId,
    'timestamp'      => date('Y-m-d H:i:s'),
]);
