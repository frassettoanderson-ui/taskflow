<?php
// auth.php — inclua no topo de toda página protegida
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['usuario_id'])) {
    header("Location: ../login.php");
    exit;
}
function usuarioAtual() {
    return [
        'id'     => $_SESSION['usuario_id'],
        'nome'   => $_SESSION['nome'],
        'nivel'  => $_SESSION['nivel'],
        'setor'  => $_SESSION['setor'],
        'ini'    => $_SESSION['ini'],
    ];
}
function requerNivel($niveis) {
    if (!in_array($_SESSION['nivel'], (array)$niveis)) {
        http_response_code(403);
        die(json_encode(['erro' => 'Acesso negado.']));
    }
}
