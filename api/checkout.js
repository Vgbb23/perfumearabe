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
  const defaultProductId = process.env.FRUITFY_PRODUCT_ID || 'a0e4d86d-a036-4f87-8c3f-b6d9c6abffd3';

  if (!apiToken || !storeId) {
    return res.status(500).json({
      success: false,
      message: 'Credenciais da Fruitfy não configuradas no ambiente da Vercel.'
    });
  }

  const body = typeof req.body === 'string' ? safeJsonParse(req.body) : (req.body || {});
  const name = String(body.name || '').trim();
  const cpf = String(body.cpf || body.document || '').replace(/\D/g, '');
  let phone = String(body.phone || '').replace(/\D/g, '');
  const email = String(body.email || '').trim() || `cliente_${Date.now()}@checkout.local`;
  const amount = Number(body.amount || 0);
  const amountCents = Math.round(amount * 100);
  const quantity = Math.max(1, Number(body.quantity || 1));
  const productId = String(body.product_id || defaultProductId).trim() || defaultProductId;

  if (!name) return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
  if (cpf.length !== 11) return res.status(400).json({ success: false, message: 'CPF inválido' });
  if (phone.length < 10) return res.status(400).json({ success: false, message: 'Telefone inválido' });
  if (!phone.startsWith('55')) phone = `55${phone}`;
  if (amountCents < 100) return res.status(400).json({ success: false, message: 'Valor mínimo é R$ 1,00' });

  const payload = {
    name,
    email,
    phone,
    cpf,
    items: [{ id: productId, value: amountCents, quantity }]
  };

  try {
    const fruitfyResp = await fetch(`${apiUrl}/api/pix/charge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Store-Id': storeId,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
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

    const normalized = (apiResponse && typeof apiResponse.data === 'object' && apiResponse.data) ? apiResponse.data : apiResponse;
    const pix = (normalized && typeof normalized.pix === 'object' && normalized.pix) ? normalized.pix : {};
    const pixCode = pix.code || normalized.code || '';
    let qrImage = pix.qr_code_base64 || normalized.qr_code_base64 || '';

    if (qrImage && !String(qrImage).startsWith('data:') && !String(qrImage).startsWith('http')) {
      qrImage = `data:image/png;base64,${qrImage}`;
    }

    let expiresIn = 900;
    if (pix.expires_at) {
      const expiresAt = Date.parse(String(pix.expires_at).replace(' ', 'T'));
      if (!Number.isNaN(expiresAt)) {
        expiresIn = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      }
    }

    const success = fruitfyResp.ok && Boolean(pixCode || qrImage);
    return res.status(fruitfyResp.status).json({
      success,
      http_code: fruitfyResp.status,
      message: apiResponse.message || (success ? 'PIX gerado com sucesso' : 'Falha ao gerar PIX'),
      data: {
        txid: normalized.order_id || normalized.id || null,
        status: normalized.status || null,
        codigo: pixCode,
        qrcodeImagem: qrImage,
        expiracao: expiresIn,
        valor: amount
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
