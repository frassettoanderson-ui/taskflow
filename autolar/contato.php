<?php
/**
 * Processa o formulário de contato.
 *  - valida CSRF e campos
 *  - grava em `mensagens` (fallback garantido)
 *  - tenta enviar e-mail via mail() (padrão Hostinger)
 *  - redireciona de volta com mensagem flash
 */
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirecionar('index.php#contato');
}

if (!csrf_validar()) {
    flash_set('err', 'Sessão expirada. Recarregue a página e tente novamente.');
    redirecionar('index.php#contato');
}

$nome     = input_str('nome');
$contato  = input_str('contato');
$assunto  = input_str('assunto');
$mensagem = input_str('mensagem');

$erros = [];
if (mb_strlen($nome) < 2)      $erros[] = 'Informe seu nome.';
if (mb_strlen($contato) < 5)   $erros[] = 'Informe um e-mail ou telefone para contato.';
if (mb_strlen($mensagem) < 5)  $erros[] = 'Escreva sua mensagem.';

if ($erros) {
    flash_set('err', implode(' ', $erros));
    redirecionar('index.php#contato');
}

// 1) Grava no banco (sempre)
try {
    $stmt = $pdo->prepare(
        'INSERT INTO mensagens (nome, contato, assunto, mensagem) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$nome, $contato, $assunto ?: null, $mensagem]);
} catch (Throwable $e) {
    // Mesmo se falhar o insert, tentamos o e-mail abaixo.
}

// 2) Tenta enviar e-mail (não bloqueia o sucesso se o servidor não enviar)
$assuntoMail = 'Contato pelo site — ' . ($assunto ?: 'Mensagem');
$corpo  = "Novo contato pelo site da " . EMPRESA_NOME_FULL . "\n\n";
$corpo .= "Nome: {$nome}\n";
$corpo .= "Contato: {$contato}\n";
$corpo .= "Assunto: " . ($assunto ?: '—') . "\n\n";
$corpo .= "Mensagem:\n{$mensagem}\n";

$headers  = 'From: ' . EMPRESA_NOME . ' <no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ">\r\n";
$headers .= 'Reply-To: ' . (filter_var($contato, FILTER_VALIDATE_EMAIL) ? $contato : CONTATO_EMAIL) . "\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

@mail(CONTATO_EMAIL, $assuntoMail, $corpo, $headers);

flash_set('ok', 'Mensagem enviada com sucesso! Em breve entraremos em contato.');
redirecionar('index.php#contato');
