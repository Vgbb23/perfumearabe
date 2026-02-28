<?php
// Configurações da API Fruitfy (PIX)
// Em produção, defina via variáveis de ambiente.

function load_env_file(string $envPath): void
{
    if (!is_readable($envPath)) {
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0) {
            continue;
        }

        $parts = explode('=', $trimmed, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $value = trim($parts[1]);

        // Remove aspas opcionais
        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
            (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
    }
}

$projectEnvPath = dirname(__DIR__, 2) . '/.env';
load_env_file($projectEnvPath);

$defaultApiUrl = 'https://api.fruitfy.io';
$defaultProductId = 'a0e4d86d-a036-4f87-8c3f-b6d9c6abffd3';

define('FRUITFY_API_URL', rtrim(getenv('FRUITFY_API_URL') ?: $defaultApiUrl, '/'));
define('FRUITFY_API_TOKEN', getenv('FRUITFY_API_TOKEN') ?: '');
define('FRUITFY_STORE_ID', getenv('FRUITFY_STORE_ID') ?: '');
define('FRUITFY_PRODUCT_ID', getenv('FRUITFY_PRODUCT_ID') ?: $defaultProductId);
