export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Store-Id');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const apiUrl = (process.env.FRUITFY_API_URL || 'https://api.fruitfy.io').replace(/\/$/, '');
  const apiToken = process.env.FRUITFY_API_TOKEN || '';
  const storeId = process.env.FRUITFY_STORE_ID || '';

  if (!apiToken || !storeId) {
    return res.status(500).json({
      success: false,
      message: 'Credenciais da Fruitfy não configuradas no ambiente da Vercel.'
    });
  }

  const body = typeof req.body === 'string' ? safeJsonParse(req.body) : (req.body || {});
  const txid = String(body.txid || '').trim();

  if (!txid) {
    return res.status(400).json({ success: false, message: 'txid não informado' });
  }

  try {
    const fruitfyResp = await fetch(`${apiUrl}/api/order/${encodeURIComponent(txid)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Store-Id': storeId,
        Accept: 'application/json'
      }
    });

    const rawText = await fruitfyResp.text();
    const apiResponse = safeJsonParse(rawText);

    if (!apiResponse) {
      return res.status(502).json({
        success: false,
        message: 'Resposta inválida da API Fruitfy',
        http_code: fruitfyResp.status
      });
    }

    const order = (apiResponse && typeof apiResponse.data === 'object' && apiResponse.data) ? apiResponse.data : apiResponse;
    const status = String(order.status || '');

    return res.status(fruitfyResp.status).json({
      success: fruitfyResp.ok && Boolean(status),
      http_code: fruitfyResp.status,
      data: {
        status,
        order_id: order.uuid || txid
      },
      raw: apiResponse
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: `Erro ao conectar com Fruitfy: ${error.message || 'desconhecido'}`
    });
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}
