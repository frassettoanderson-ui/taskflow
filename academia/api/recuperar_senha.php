<?php
require '../conexao.php';
header('Content-Type: application/json');

$d = json_decode(file_get_contents('php://input'), true);
$email = strtolower(trim($d['email'] ?? ''));

$stmt = $pdo->prepare("SELECT * FROM usuarios WHERE LOWER(email) = ? AND ativo = 1");
$stmt->execute([$email]);
$u = $stmt->fetch();

if (!$u) { echo json_encode(['erro' => 'E-mail não encontrado.']); exit; }

// Gera token
$token = bin2hex(random_bytes(32));
$expira = date('Y-m-d H:i:s', strtotime('+1 hour'));

// Salva token (cria tabela se não existir)
$pdo->exec("CREATE TABLE IF NOT EXISTS reset_tokens (id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT NOT NULL, token VARCHAR(64) NOT NULL UNIQUE, expira DATETIME NOT NULL, usado TINYINT DEFAULT 0, INDEX idx_token (token), INDEX idx_usuario (usuario_id))");
$pdo->prepare("INSERT INTO reset_tokens (usuario_id, token, expira) VALUES (?,?,?)")->execute([$u['id'], $token, $expira]);

// Envia e-mail
$link = (isset($_SERVER['HTTPS'])?'https':'http').'://'.$_SERVER['HTTP_HOST'].dirname($_SERVER['REQUEST_URI'], 2).'/redefinir_senha.php?token='.$token;
$assunto = 'Taskflow — Redefinição de senha';
$corpo = "Olá {$u['nome']},\n\nClique no link abaixo para redefinir sua senha (válido por 1 hora):\n\n$link\n\nSe você não solicitou isso, ignore este e-mail.\n\nTaskflow";
$headers = "From: noreply@taskflow.com.br\r\nContent-Type: text/plain; charset=UTF-8";

if (mail($u['email'], $assunto, $corpo, $headers)) {
    echo json_encode(['ok' => true]);
} else {
    echo json_encode(['erro' => 'Falha ao enviar e-mail. Contate o administrador.']);
}
