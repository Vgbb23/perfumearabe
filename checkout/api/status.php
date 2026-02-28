<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization, Store-Id');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config/hupay.php';

$input = json_decode(file_get_contents("php://input"), true);
$txid = $input['txid'] ?? null;

if (!$txid) {
    echo json_encode(['success' => false, 'message' => 'txid não informado']);
    exit;
}

$url = HUPAY_API_URL . "/charges/status/" . urlencode($txid);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-Access-Key: " . HUPAY_ACCESS_KEY,
    "X-Secret-Key: " . HUPAY_SECRET_KEY,
    "Accept: application/json"
]);

$response = curl_exec($ch);
$err = curl_error($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($err) {
    echo json_encode(['success' => false, 'message' => $err]);
    exit;
}

if (stripos($response, '<!DOCTYPE html>') !== false) {
    echo json_encode([
        'success' => false,
        'message' => 'A API retornou HTML em vez de JSON. Verifique a URL ou as chaves.',
        'body' => $response
    ]);
    exit;
}

$apiData = json_decode($response, true);

if ($http_code === 200 && $apiData) {
    echo json_encode([
        'success' => true,
        'data' => $apiData
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao consultar status do pagamento',
        'http_code' => $http_code,
        'response' => $apiData
    ]);
}
?>