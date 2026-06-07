<?php
require '../auth.php';
require '../conexao.php';
requerNivel(['gestor','gerente']);

$u = usuarioAtual();
$method = $_SERVER['REQUEST_METHOD'];
header('Content-Type: application/json');

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, nome, email, whatsapp, nivel, setor FROM usuarios WHERE ativo = 1 ORDER BY nome");
    echo json_encode($stmt->fetchAll());

} elseif ($method === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true);
    $acao = $d['acao'] ?? '';

    if ($acao === 'criar') {
        $check = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
        $check->execute([$d['email']]);
        if ($check->fetch()) { echo json_encode(['erro' => 'E-mail já cadastrado.']); exit; }
        if (empty($d['senha'])) { echo json_encode(['erro' => 'Senha é obrigatória.']); exit; }
        $senha = password_hash($d['senha'], PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $pdo->prepare("INSERT INTO usuarios (nome, email, whatsapp, senha, nivel, setor) VALUES (?,?,?,?,?,?)");
        $stmt->execute([$d['nome'], $d['email'], $d['whatsapp'] ?? '', $senha, $d['nivel'], $d['setor']]);
        echo json_encode(['ok' => true]);

    } elseif ($acao === 'editar') {
        // Verifica e-mail duplicado (exceto o próprio)
        $check = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? AND id != ?");
        $check->execute([$d['email'], $d['id']]);
        if ($check->fetch()) { echo json_encode(['erro' => 'E-mail já cadastrado por outro usuário.']); exit; }
        
        if (!empty($d['senha'])) {
            $senha = password_hash($d['senha'], PASSWORD_BCRYPT, ['cost' => 12]);
            $stmt = $pdo->prepare("UPDATE usuarios SET nome=?, email=?, whatsapp=?, nivel=?, setor=?, senha=? WHERE id=?");
            $stmt->execute([$d['nome'], $d['email'], $d['whatsapp'] ?? '', $d['nivel'], $d['setor'], $senha, $d['id']]);
        } else {
            $stmt = $pdo->prepare("UPDATE usuarios SET nome=?, email=?, whatsapp=?, nivel=?, setor=? WHERE id=?");
            $stmt->execute([$d['nome'], $d['email'], $d['whatsapp'] ?? '', $d['nivel'], $d['setor'], $d['id']]);
        }
        echo json_encode(['ok' => true]);

    } elseif ($acao === 'excluir') {
        if ($d['id'] == $u['id']) { echo json_encode(['erro' => 'Não pode excluir a si mesmo.']); exit; }
        
        // Transfere tarefas abertas para o gerente
        $gerente = $pdo->query("SELECT id FROM usuarios WHERE nivel='gerente' AND ativo=1 LIMIT 1")->fetch();
        if ($gerente) {
            $pdo->prepare("UPDATE ocorrencias SET criador_id=? WHERE criador_id=? AND concluida=0")->execute([$gerente['id'], $d['id']]);
            $pdo->prepare("INSERT INTO ocorrencia_historico (ocorrencia_id, usuario_id, acao) 
                SELECT id, ?, 'Tarefa transferida — usuário excluído' FROM ocorrencias WHERE criador_id=? AND concluida=0"
            )->execute([$gerente['id'], $d['id']]);
        }
        
        $pdo->prepare("UPDATE usuarios SET ativo=0 WHERE id=?")->execute([$d['id']]);
        echo json_encode(['ok' => true]);

    } elseif ($acao === 'transferir_tarefa') {
        // Gerente transfere tarefa para outro usuário
        $stmt = $pdo->prepare("SELECT * FROM ocorrencias WHERE id=?");
        $stmt->execute([$d['ocorrencia_id']]);
        $oc = $stmt->fetch();
        
        // Atualiza setor responsável
        $novoUsuario = $pdo->prepare("SELECT * FROM usuarios WHERE id=?");
        $novoUsuario->execute([$d['usuario_id']]);
        $novoU = $novoUsuario->fetch();
        
        $pdo->prepare("UPDATE ocorrencias SET setor_responsavel=? WHERE id=?")->execute([$novoU['setor'], $d['ocorrencia_id']]);
        $motivo = isset($d['motivo']) ? ' — '.$d['motivo'] : '';
        $pdo->prepare("INSERT INTO ocorrencia_historico (ocorrencia_id, usuario_id, acao, justificativa) VALUES (?,?,?,?)")->execute([
            $d['ocorrencia_id'], $u['id'],
            "Transferida para {$novoU['nome']} por {$u['nome']}",
            $d['motivo'] ?? null
        ]);
        $pdo->prepare("INSERT INTO notificacoes (usuario_id, mensagem) VALUES (?,?)")->execute([
            $d['usuario_id'],
            "Tarefa {$oc['codigo']} foi transferida para você"
        ]);
        echo json_encode(['ok' => true]);
    }
}
