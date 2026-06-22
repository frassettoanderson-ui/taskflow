<?php
/**
 * ============================================================================
 *  Autolar Automóveis e Imóveis  —  Configurações gerais do site
 * ============================================================================
 *  >>> AJUSTE AQUI OS DADOS DA EMPRESA. <<<
 *  Estes valores aparecem no site inteiro (header, footer, botão WhatsApp,
 *  links "Tenho interesse", e-mails de contato, etc.).
 * ----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Identidade da empresa
// ---------------------------------------------------------------------------
define('EMPRESA_NOME',     'Autolar');
define('EMPRESA_NOME_FULL', 'Autolar Automóveis e Imóveis');
define('EMPRESA_SLOGAN',   'A Autolar transforma sonhos em conquistas.');
define('EMPRESA_CRECI',    'CRECI 9348-J');

// ---------------------------------------------------------------------------
// Contato
// ---------------------------------------------------------------------------
// WhatsApp no formato internacional, SOMENTE números (DDI+DDD+numero).
// Ex.: 55 48 99999-9999  ->  '5548999999999'
define('WHATSAPP_NUMERO',  '5548999999999');
define('WHATSAPP_TEXTO_PADRAO', 'Olá! Vim pelo site da Autolar e gostaria de mais informações.');

define('CONTATO_EMAIL',    'contato@autolar.com.br'); // recebe os formulários
define('CONTATO_TELEFONE', '(48) 99999-9999');

// Endereço
define('EMPRESA_ENDERECO_LINHA1', 'Rua Exemplo, 123');
define('EMPRESA_ENDERECO_LINHA2', 'Centro – Imbituba/SC');
define('EMPRESA_CEP',             'CEP 88780-000');

// Horário de atendimento
define('HORARIO_SEMANA', 'Segunda a Sexta · 08h30 às 18h00');
define('HORARIO_SABADO', 'Sábado · 08h30 às 12h00');

// Redes sociais (URLs completas)
define('SOCIAL_INSTAGRAM', 'https://instagram.com/autolar.imbituba');
define('SOCIAL_INSTAGRAM_USER', '@autolar.imbituba');
define('SOCIAL_FACEBOOK',  'https://facebook.com/autolarimoveiseautomoveis');
define('SOCIAL_FACEBOOK_USER', '/autolarimoveiseautomoveis');

// ---------------------------------------------------------------------------
// Técnico
// ---------------------------------------------------------------------------
// Caminho base (deixe '' se o site estiver na raiz do domínio /public_html).
// Se estiver numa subpasta, ex.: '/autolar', informe aqui SEM barra final.
define('BASE_URL', '');

define('ITENS_POR_PAGINA', 9);          // paginação dos catálogos
define('UPLOAD_MAX_BYTES', 5 * 1024 * 1024); // 5 MB por imagem
define('UPLOAD_TIPOS_PERMITIDOS', 'jpg,jpeg,png,webp');

// Fuso horário
date_default_timezone_set('America/Sao_Paulo');

// Em produção mantenha display_errors desligado; ligue só p/ depurar.
if (!defined('AUTOLAR_DEBUG')) {
    define('AUTOLAR_DEBUG', false);
}
if (AUTOLAR_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(0);
    ini_set('display_errors', '0');
}

// Caminhos absolutos no servidor (não alterar)
define('ROOT_PATH',    dirname(__DIR__));
define('UPLOADS_PATH', ROOT_PATH . '/uploads');
