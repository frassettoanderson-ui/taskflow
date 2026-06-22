<?php
/**
 * ============================================================================
 *  Conexão com o banco de dados (PDO)
 * ============================================================================
 *  >>> PREENCHA AS CREDENCIAIS DO SEU BANCO MySQL DA HOSTINGER. <<<
 *  Você encontra esses dados no hPanel > Bancos de Dados MySQL, depois de
 *  criar o banco e o usuário.
 * ----------------------------------------------------------------------------
 */

// --- CREDENCIAIS DO BANCO (ajuste) -----------------------------------------
$DB_HOST = 'localhost';            // geralmente 'localhost' na Hostinger
$DB_NAME = 'u000000000_autolar';   // nome do banco criado no hPanel
$DB_USER = 'u000000000_autolar';   // usuário do banco
$DB_PASS = 'TROQUE_ESTA_SENHA';    // senha do usuário do banco
$DB_CHARSET = 'utf8mb4';
// ---------------------------------------------------------------------------

$dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset={$DB_CHARSET}";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $options);
} catch (PDOException $e) {
    // Não exibe detalhes técnicos ao visitante.
    http_response_code(500);
    if (defined('AUTOLAR_DEBUG') && AUTOLAR_DEBUG) {
        die('Erro de conexão: ' . htmlspecialchars($e->getMessage()));
    }
    die('Não foi possível conectar ao banco de dados. Tente novamente mais tarde.');
}
