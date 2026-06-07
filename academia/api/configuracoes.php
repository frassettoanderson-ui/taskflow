<?php
require '../auth.php';
require '../conexao.php';
requerNivel(['gestor','gerente']);
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['tipo']) && $_GET['tipo'] === 'setores') {
        $pdo->exec("CREATE TABLE IF NOT EXISTS setores (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) NOT NULL UNIQUE, criado_em DATETIME DEFAULT CURRENT_TIMESTAMP)");
        echo json_encode($pdo->query("SELECT * FROM setores ORDER BY nome")->fetchAll());
        exit;
    }
    echo json_encode($pdo->query("SELECT * FROM tipos_ocorrencia ORDER BY nome")->fetchAll());

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true);
    
    if ($d['acao'] === 'criar') {
        $check = $pdo->prepare("SELECT id FROM tipos_ocorrencia WHERE LOWER(nome)=LOWER(?)");
        $check->execute([$d['nome']]);
        if ($check->fetch()) { echo json_encode(['erro' => 'Tipo já existe.']); exit; }
        $pdo->prepare("INSERT INTO tipos_ocorrencia (nome, setor) VALUES (?,?)")->execute([$d['nome'], $d['setor']]);
        echo json_encode(['ok' => true]);

    } elseif ($d['acao'] === 'excluir') {
        $em_uso = $pdo->prepare("SELECT COUNT(*) FROM ocorrencias WHERE tipo = (SELECT nome FROM tipos_ocorrencia WHERE id=?)");
        $em_uso->execute([$d['id']]);
        if ($em_uso->fetchColumn() > 0) { echo json_encode(['erro' => 'Este tipo está em uso e não pode ser excluído.']); exit; }
        $pdo->prepare("DELETE FROM tipos_ocorrencia WHERE id=?")->execute([$d['id']]);
        echo json_encode(['ok' => true]);

    } elseif ($d['acao'] === 'criar_setor') {
        $pdo->exec("CREATE TABLE IF NOT EXISTS setores (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(100) NOT NULL UNIQUE, criado_em DATETIME DEFAULT CURRENT_TIMESTAMP)");
        $check = $pdo->prepare("SELECT id FROM setores WHERE LOWER(nome)=LOWER(?)");
        $check->execute([$d['nome']]);
        if ($check->fetch()) { echo json_encode(['erro' => 'Setor já existe.']); exit; }
        $pdo->prepare("INSERT INTO setores (nome) VALUES (?)")->execute([trim($d['nome'])]);
        echo json_encode(['ok' => true]);

    } elseif ($d['acao'] === 'excluir_setor') {
        $pdo->prepare("DELETE FROM setores WHERE id=?")->execute([$d['id']]);
        echo json_encode(['ok' => true]);
    }
}
