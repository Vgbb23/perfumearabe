<?php
// Configurações do Gateway Hupay
// Use variáveis de ambiente em produção. Estes valores são defaults locais.
$defaultAccessKey = 'DFNICF0HKXWVEEBWL7136EVLIN3JBGZI';
$defaultSecretKey = 'bizhQMGthOLlNNLkT097v6eAd1fpTKNKl3f4cltOKxIqzuZmckO7xSAuylxBZ3iA';
$defaultApiUrl    = 'https://hupay.pro/api/v1';

define('HUPAY_ACCESS_KEY', getenv('HUPAY_ACCESS_KEY') ?: $defaultAccessKey);
define('HUPAY_SECRET_KEY', getenv('HUPAY_SECRET_KEY') ?: $defaultSecretKey);
define('HUPAY_API_URL', getenv('HUPAY_API_URL') ?: $defaultApiUrl);

// Configurações auxiliares
$proto = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$host  = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$defaultSiteUrl = $proto . $host;
define('SITE_URL', getenv('SITE_URL') ?: $defaultSiteUrl);
define('WEBHOOK_URL', getenv('WEBHOOK_URL') ?: (SITE_URL . '/webhook.php'));

// Opcional: acquirer/provider pode ser exigido pela conta Hupay
define('HUPAY_ACQUIRER', getenv('HUPAY_ACQUIRER') ?: '');