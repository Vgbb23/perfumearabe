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

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$rawBody = file_get_contents('php://input');
$input = (strpos($contentType, 'application/json') !== false)
    ? json_decode($rawBody, true)
    : $_POST;

if (!$input || !is_array($input)) {
    response_json(['success' => false, 'message' => 'Nenhum dado foi enviado']);
}

$name = trim((string)($input['name'] ?? ''));
$cpf = preg_replace('/\D/', '', (string)($input['cpf'] ?? $input['document'] ?? ''));
$phone = preg_replace('/\D/', '', (string)($input['phone'] ?? ''));
$email = trim((string)($input['email'] ?? ''));
$amount = round((float)($input['amount'] ?? 0), 2);
$amountCents = (int)round($amount * 100);
$quantity = max(1, (int)($input['quantity'] ?? 1));

if ($name === '') {
    response_json(['success' => false, 'message' => 'Nome é obrigatório']);
}
if (strlen($cpf) !== 11) {
    response_json(['success' => false, 'message' => 'CPF inválido. Informe 11 dígitos.']);
}
if (strlen($phone) < 10) {
    response_json(['success' => false, 'message' => 'Telefone inválido.']);
}
if (strpos($phone, '55') !== 0) {
    $phone = '55' . $phone;
}
if ($amountCents < 100) {
    response_json(['success' => false, 'message' => 'Valor mínimo é R$ 1,00.']);
}
if ($email === '') {
    $email = 'cliente_' . uniqid() . '@checkout.local';
}

$itemId = trim((string)($input['product_id'] ?? FRUITFY_PRODUCT_ID));
$items = [
    [
        'id' => $itemId,
        'value' => $amountCents,
        'quantity' => $quantity
    ]
];

$payload = [
    'name' => $name,
    'email' => $email,
    'phone' => $phone,
    'cpf' => $cpf,
    'items' => $items
];

$fruitfyUrl = FRUITFY_API_URL . '/api/pix/charge';
$payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

$ch = curl_init($fruitfyUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadJson);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
curl_setopt($ch, CURLOPT_PROXY, '');
curl_setopt($ch, CURLOPT_NOPROXY, '*');

$apiHost = parse_url(FRUITFY_API_URL, PHP_URL_HOST);
if (is_string($apiHost) && $apiHost !== '') {
    $resolvedIp = gethostbyname($apiHost);
    if ($resolvedIp && $resolvedIp !== $apiHost) {
        curl_setopt($ch, CURLOPT_RESOLVE, [$apiHost . ':443:' . $resolvedIp]);
    }
}

curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . FRUITFY_API_TOKEN,
    'Store-Id: ' . FRUITFY_STORE_ID,
    'Content-Type: application/json',
    'Accept: application/json'
]);

$response = curl_exec($ch);
$curlError = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

// Fallback para ambientes onde o cURL do PHP falha na resolução DNS/SSL.
if (($curlError || !$response || $httpCode === 0) && function_exists('shell_exec')) {
    $cmd = 'curl -sS --max-time 25 -X POST ' . escapeshellarg($fruitfyUrl)
        . ' -H ' . escapeshellarg('Authorization: Bearer ' . FRUITFY_API_TOKEN)
        . ' -H ' . escapeshellarg('Store-Id: ' . FRUITFY_STORE_ID)
        . ' -H ' . escapeshellarg('Content-Type: application/json')
        . ' -H ' . escapeshellarg('Accept: application/json')
        . ' -d ' . escapeshellarg($payloadJson);
    $fallbackResponse = shell_exec($cmd);
    if (is_string($fallbackResponse) && trim($fallbackResponse) !== '') {
        $response = $fallbackResponse;
        $curlError = '';
        $httpCode = 201;
    }
}

if ($curlError) {
    response_json(['success' => false, 'message' => $curlError]);
}

$apiResponse = json_decode((string)$response, true);
if (!$apiResponse) {
    response_json([
        'success' => false,
        'message' => 'Resposta inválida da API Fruitfy',
        'http_code' => $httpCode
    ]);
}

$normalized = isset($apiResponse['data']) && is_array($apiResponse['data'])
    ? $apiResponse['data']
    : $apiResponse;

$pix = isset($normalized['pix']) && is_array($normalized['pix']) ? $normalized['pix'] : [];
$pixCode = $pix['code'] ?? $normalized['code'] ?? '';
$qrImage = $pix['qr_code_base64'] ?? $normalized['qr_code_base64'] ?? '';

if ($qrImage && strpos($qrImage, 'data:') !== 0 && strpos($qrImage, 'http') !== 0) {
    $qrImage = 'data:image/png;base64,' . $qrImage;
}

$expiresIn = 900;
if (!empty($pix['expires_at'])) {
    $expiresAtTs = strtotime((string)$pix['expires_at']);
    if ($expiresAtTs !== false) {
        $expiresIn = max(0, $expiresAtTs - time());
    }
}

$isSuccess = ($httpCode >= 200 && $httpCode < 300) && ($pixCode !== '' || $qrImage !== '');

response_json([
    'success' => $isSuccess,
    'http_code' => $httpCode,
    'message' => $apiResponse['message'] ?? ($isSuccess ? 'PIX gerado com sucesso' : 'Falha ao gerar PIX'),
    'data' => [
        'txid' => $normalized['order_id'] ?? ($normalized['id'] ?? null),
        'status' => $normalized['status'] ?? null,
        'codigo' => $pixCode,
        'qrcodeImagem' => $qrImage,
        'expiracao' => $expiresIn,
        'valor' => $amount
    ],
    'raw' => $apiResponse
]);