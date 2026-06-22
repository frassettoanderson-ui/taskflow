<?php
/**
 * Inclua NO TOPO de toda página protegida do admin:
 *   require __DIR__ . '/auth-check.php';
 * Redireciona ao login se não houver sessão de administrador.
 */
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/config/db.php';
require_once dirname(__DIR__) . '/includes/functions.php';
require_once __DIR__ . '/includes/admin-functions.php';

if (empty($_SESSION['admin_id'])) {
    redirecionar('admin/login.php');
}

// Carrega o admin logado (uma vez por requisição)
if (!isset($GLOBALS['ADMIN'])) {
    $stmt = $pdo->prepare('SELECT id, nome, email FROM admins WHERE id = ?');
    $stmt->execute([$_SESSION['admin_id']]);
    $GLOBALS['ADMIN'] = $stmt->fetch();
    if (!$GLOBALS['ADMIN']) {
        session_destroy();
        redirecionar('admin/login.php');
    }
}
