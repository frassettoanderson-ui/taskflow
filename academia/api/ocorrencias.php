<?php
date_default_timezone_set('America/Sao_Paulo');
require '../auth.php';
require '../conexao.php';

$u = usuarioAtual();
$method = $_SERVER['REQUEST_METHOD'];
header('Content-Type: application/json');

$setoresNivel = [
    'gestor'      => ['Direcao','Gerente','Financeiro','Administrativo'],
    'gerente'     => ['Gerente','Financeiro','Administrativo'],
    'colaborador' => ['Administrativo'],
];
$setoresVis = $setoresNivel[$u['nivel']] ?? ['Administrativo'];
$placeholders = implode(',', array_fill(0, count($setoresVis), '?'));

if ($method === 'GET') {
    $incluirConcluidas = isset($_GET['concluidas']) ? 1 : 0;
    $dataInicio = $_GET['data_inicio'] ?? null;
    $dataFim    = $_GET['data_fim'] ?? null;

    $whereExtra = $incluirConcluidas ? '' : 'AND o.concluida = 0';
    $dateFilter = '';
    $dateParams = [];
    if ($dataInicio && $dataFim) {
        $dateFilter = 'AND DATE(o.atualizado_em) BETWEEN ? AND ?';
        $dateParams = [$dataInicio, $dataFim];
    }

    $stmt = $pdo->prepare("
        SELECT o.*, u.nome AS criador_nome, u.setor AS criador_setor
        FROM ocorrencias o
        JOIN usuarios u ON u.id = o.criador_id
        WHERE (o.criador_id = ? OR o.setor_responsavel IN ($placeholders))
        $whereExtra $dateFilter
        ORDER BY o.criado_em DESC
    ");
    $stmt->execute(array_merge([$u['id']], $setoresVis, $dateParams));
    $tarefas = $stmt->fetchAll();

    foreach ($tarefas as &$t) {
        // Mensagens
        $m = $pdo->prepare("SELECT m.*, u.nome, u.setor FROM ocorrencia_msgs m JOIN usuarios u ON u.id=m.usuario_id WHERE m.ocorrencia_id=? ORDER BY m.criado_em ASC");
        $m->execute([$t['id']]);
        $t['msgs'] = $m->fetchAll();

        // Timeline
        $h = $pdo->prepare("SELECT * FROM ocorrencia_historico WHERE ocorrencia_id=? ORDER BY criado_em ASC");
        $h->execute([$t['id']]);
        $t['timeline'] = array_map(function($r){ return $r['acao'].($r['justificativa']?' — '.$r['justificativa']:''); }, $h->fetchAll());

        // Unread
        $un = $pdo->prepare("SELECT * FROM ocorrencia_unread WHERE ocorrencia_id=? AND usuario_id=?");
        $un->execute([$t['id'], $u['id']]);
        $t['tem_unread'] = (bool)$un->fetch();

        // Vistas (confirmação de leitura)
        $vi = $pdo->prepare("SELECT u.nome, ov.visto_em FROM ocorrencia_vistas ov JOIN usuarios u ON u.id=ov.usuario_id WHERE ov.ocorrencia_id=? ORDER BY ov.visto_em ASC");
        $vi->execute([$t['id']]);
        $t['vistas'] = $vi->fetchAll();

        // Msgs não lidas para o usuário atual
        $t['msgs_unread'] = false;
        foreach ($t['msgs'] as $msg) {
            if ($msg['usuario_id'] != $u['id']) {
                $mun = $pdo->prepare("SELECT 1 FROM ocorrencia_unread WHERE ocorrencia_id=? AND usuario_id=?");
                $mun->execute([$t['id'], $u['id']]);
                if ($mun->fetch()) { $t['msgs_unread'] = true; break; }
            }
        }
    }

    echo json_encode($tarefas);

} elseif ($method === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true);
    $acao = $d['acao'] ?? 'criar';

    if ($acao === 'criar') {
        if (($d['setor'] ?? '') === $u['setor']) {
            echo json_encode(['erro' => 'Não é permitido criar ocorrências para o próprio setor.']);
            exit;
        }
        $pdo->beginTransaction();
        $codigo = 'OC-' . str_pad($pdo->query("SELECT COUNT(*)+1 FROM ocorrencias FOR UPDATE")->fetchColumn(), 3, '0', STR_PAD_LEFT);
        $stmt = $pdo->prepare("INSERT INTO ocorrencias (codigo, tipo, descricao, nome_aluno, id_aluno, setor_responsavel, prioridade, status, criador_id) VALUES (?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$codigo, $d['tipo'], $d['descricao'], $d['nome_aluno']??'', $d['id_aluno']??'', $d['setor'], $d['prioridade'], 'pendente', $u['id']]);
        $ocId = $pdo->lastInsertId();
        $pdo->prepare("INSERT INTO ocorrencia_historico (ocorrencia_id, usuario_id, acao, status_para) VALUES (?,?,?,?)")->execute([$ocId, $u['id'], 'Criada por '.$u['nome'], 'pendente']);

        // Marca unread para usuários do setor
        $setor_users = $pdo->prepare("SELECT id FROM usuarios WHERE setor=? AND ativo=1 AND id!=?");
        $setor_users->execute([$d['setor'], $u['id']]);
        foreach ($setor_users->fetchAll() as $su) {
            $pdo->prepare("INSERT IGNORE INTO ocorrencia_unread (ocorrencia_id, usuario_id) VALUES (?,?)")->execute([$ocId, $su['id']]);
            $pdo->prepare("INSERT INTO notificacoes (usuario_id, mensagem) VALUES (?,?)")->execute([$su['id'], "Nova ocorrência {$codigo}: {$d['tipo']}"]);
        }

        $pdo->commit();
        echo json_encode(['ok'=>true,'codigo'=>$codigo,'id'=>$ocId]);

    } elseif ($acao === 'mover') {
        $stmt = $pdo->prepare("SELECT * FROM ocorrencias WHERE id=?");
        $stmt->execute([$d['id']]);
        $oc = $stmt->fetch();
        $allowBack = isset($d['allowBack']) && $d['allowBack'] === true;
        $statusOrder = ['pendente','aceita','andamento','concluida'];
        $fromIdx = array_search($oc['status'], $statusOrder);
        $toIdx   = array_search($d['status'], $statusOrder);
        if (!$allowBack && $toIdx <= $fromIdx) { echo json_encode(['erro'=>'Movimento inválido.']); exit; }
        $pdo->prepare("UPDATE ocorrencias SET status=?, atualizado_em=NOW() WHERE id=?")->execute([$d['status'], $d['id']]);
        $pdo->prepare("INSERT INTO ocorrencia_historico (ocorrencia_id, usuario_id, acao, status_de, status_para) VALUES (?,?,?,?,?)")->execute([$d['id'], $u['id'], 'Movida para '.ucfirst($d['status']).' por '.$u['nome'], $oc['status'], $d['status']]);
        $pdo->prepare("INSERT INTO notificacoes (usuario_id, mensagem) VALUES (?,?)")->execute([$oc['criador_id'], "Sua tarefa {$oc['codigo']} foi movida para \"{$d['status']}\""]);
        echo json_encode(['ok'=>true]);

    } elseif ($acao === 'devolver') {
        $stmt = $pdo->prepare("SELECT * FROM ocorrencias WHERE id=?");
        $stmt->execute([$d['id']]);
        $oc = $stmt->fetch();
        $justificativa = $d['justificativa'] ?? '';
        if (empty(trim($justificativa))) { echo json_encode(['erro'=>'Justificativa obrigatória ao devolver.']); exit; }
        $pdo->prepare("UPDATE ocorrencias SET status='pendente', atualizado_em=NOW() WHERE id=?")->execute([$d['id']]);
        $pdo->prepare("INSERT INTO ocorrencia_historico (ocorrencia_id, usuario_id, acao, justificativa) VALUES (?,?,?,?)")->execute([$d['id'], $u['id'], 'Devolvida ao criador por '.$u['nome'], $justificativa]);
        $pdo->prepare("INSERT INTO notificacoes (usuario_id, mensagem) VALUES (?,?)")->execute([$oc['criador_id'], "Sua tarefa {$oc['codigo']} foi devolvida: {$justificativa}"]);
        echo json_encode(['ok'=>true]);

    } elseif ($acao === 'concluir') {
        $stmt = $pdo->prepare("SELECT * FROM ocorrencias WHERE id=?");
        $stmt->execute([$d['id']]);
        $oc = $stmt->fetch();
        $pdo->prepare("UPDATE ocorrencias SET concluida=1, status='concluida', atualizado_em=NOW() WHERE id=?")->execute([$d['id']]);
        $pdo->prepare("INSERT INTO ocorrencia_historico (ocorrencia_id, usuario_id, acao) VALUES (?,?,?)")->execute([$d['id'], $u['id'], 'Concluída por '.$u['nome']]);
        $pdo->prepare("INSERT INTO notificacoes (usuario_id, mensagem) VALUES (?,?)")->execute([$oc['criador_id'], "Tarefa {$oc['codigo']} foi concluída!"]);
        echo json_encode(['ok'=>true]);

    } elseif ($acao === 'excluir') {
        $stmt = $pdo->prepare("SELECT criador_id FROM ocorrencias WHERE id=?");
        $stmt->execute([$d['id']]);
        $oc = $stmt->fetch();
        if ($oc['criador_id'] != $u['id']) { echo json_encode(['erro'=>'Sem permissão.']); exit; }
        $pdo->prepare("DELETE FROM ocorrencias WHERE id=?")->execute([$d['id']]);
        echo json_encode(['ok'=>true]);

    } elseif ($acao === 'marcar_lida') {
        $pdo->prepare("DELETE FROM ocorrencia_unread WHERE ocorrencia_id=? AND usuario_id=?")->execute([$d['id'], $u['id']]);
        // Registra visualização
        $pdo->prepare("INSERT IGNORE INTO ocorrencia_vistas (ocorrencia_id, usuario_id) VALUES (?,?)")->execute([$d['id'], $u['id']]);
        echo json_encode(['ok'=>true]);

    } elseif ($acao === 'mensagem') {
        $pdo->prepare("INSERT INTO ocorrencia_msgs (ocorrencia_id, usuario_id, mensagem) VALUES (?,?,?)")->execute([$d['id'], $u['id'], $d['texto']]);
        $stmt = $pdo->prepare("SELECT * FROM ocorrencias WHERE id=?");
        $stmt->execute([$d['id']]);
        $oc = $stmt->fetch();

        // Notifica e marca unread
        if ($oc['criador_id'] == $u['id']) {
            // Criador mandou mensagem → notifica responsáveis do setor
            $resp = $pdo->prepare("SELECT id FROM usuarios WHERE setor=? AND ativo=1 AND id!=?");
            $resp->execute([$oc['setor_responsavel'], $u['id']]);
            foreach ($resp->fetchAll() as $r) {
                $pdo->prepare("INSERT INTO ocorrencia_unread (ocorrencia_id, usuario_id) VALUES (?,?) ON DUPLICATE KEY UPDATE criado_em=NOW()")->execute([$d['id'], $r['id']]);
                $pdo->prepare("INSERT INTO notificacoes (usuario_id, mensagem) VALUES (?,?)")->execute([$r['id'], "Nova mensagem na tarefa {$oc['codigo']}"]);
            }
        } else {
            // Responsável mandou mensagem → notifica criador com som/toast
            $pdo->prepare("INSERT INTO ocorrencia_unread (ocorrencia_id, usuario_id) VALUES (?,?) ON DUPLICATE KEY UPDATE criado_em=NOW()")->execute([$d['id'], $oc['criador_id']]);
            $pdo->prepare("INSERT INTO notificacoes (usuario_id, mensagem) VALUES (?,?)")->execute([$oc['criador_id'], "💬 Nova mensagem na tarefa {$oc['codigo']}"]);
        }
        echo json_encode(['ok'=>true]);
    }
}
