<?php
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization, Store-Id');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config/fruitfy.php';

function response_json(array $data): void
{
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response_json(['success' => false, 'message' => 'Method not allowed']);
}

if (!FRUITFY_API_TOKEN || !FRUITFY_STORE_ID) {
    response_json([
        'success' => false,
        'message' => 'Credenciais da Fruitfy não configuradas. Defina FRUITFY_API_TOKEN e FRUITFY_STORE_ID.'
    ]);
}

$input = json_decode(file_get_contents('php://input'), true);
$txid = trim((string)($input['txid'] ?? ''));

if ($txid === '') {
    response_json(['success' => false, 'message' => 'txid não informado']);
}

// Endpoint oficial para consultar o pedido pelo UUID retornado em order_id.
$url = FRUITFY_API_URL . '/api/order/' . rawurlencode($txid);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
curl_setopt($ch, CURLOPT_PROXY, '');
curl_setopt($ch, CURLOPT_NOPROXY, '*');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . FRUITFY_API_TOKEN,
    'Store-Id: ' . FRUITFY_STORE_ID,
    'Accept: application/json'
]);

$response = curl_exec($ch);
$curlError = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($curlError) {
    response_json(['success' => false, 'message' => $curlError]);
}

$apiData = json_decode((string)$response, true);
if (!is_array($apiData)) {
    response_json([
        'success' => false,
        'message' => 'Resposta inválida da API Fruitfy',
        'http_code' => $httpCode
    ]);
}

$order = isset($apiData['data']) && is_array($apiData['data']) ? $apiData['data'] : $apiData;
$status = (string)($order['status'] ?? '');

response_json([
    'success' => ($httpCode >= 200 && $httpCode < 300 && $status !== ''),
    'http_code' => $httpCode,
    'data' => [
        'status' => $status,
        'order_id' => $order['uuid'] ?? $txid
    ],
    'raw' => $apiData
]);