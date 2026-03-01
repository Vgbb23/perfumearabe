document.addEventListener('DOMContentLoaded', function() {
  const elValor = document.getElementById('valor');
  const elQtd = document.getElementById('quantidade');
  const elPixBox = document.getElementById('pixCodeBox');
  const elQR = document.getElementById('qrcode');
  const btnCopiar = document.getElementById('btnCopiar');
  const elToast = document.getElementById('toast');
  const elTimer = document.getElementById('timer');
  const elStatusText = document.getElementById('statusText');
  const elStatusDot = document.querySelector('.status-dot');

  const pixData = JSON.parse(localStorage.getItem('pix_data') || '{}');
  const txid = localStorage.getItem('pix_transaction_id') || pixData.txid || '';
  const qtd = Number(localStorage.getItem('checkout_quantidade') || 1);
  const total = Number(localStorage.getItem('checkout_total') || pixData.valor || 0);
  const pixCodeCompleto = String(pixData.codigo || '').trim();

  function resumirCodigoPix(codigo) {
    const clean = String(codigo || '').trim();
    if (!clean) return '';
    if (clean.length <= 48) return clean;
    return `${clean.slice(0, 28)}...${clean.slice(-14)}`;
  }

  // Exibir dados
  elValor.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
  elQtd.textContent = String(qtd);
  elPixBox.textContent = resumirCodigoPix(pixCodeCompleto);
  if (pixData.qrcodeImagem) elQR.src = pixData.qrcodeImagem;

  // Botão copiar
  btnCopiar.addEventListener('click', async () => {
    try {
      if (!pixCodeCompleto) throw new Error('Código PIX indisponível');
      await navigator.clipboard.writeText(pixCodeCompleto);
      elToast.textContent = 'Código PIX copiado!';
      elToast.classList.add('show');
      setTimeout(() => elToast.classList.remove('show'), 2500);
    } catch (e) {
      alert('Copie manualmente o código PIX');
    }
  });

  // Timer regressivo baseado na expiração
  let segundosRestantes = Number(pixData.expiracao || 900);
  const timerId = setInterval(() => {
    segundosRestantes--;
    const m = Math.max(Math.floor(segundosRestantes / 60), 0);
    const s = Math.max(segundosRestantes % 60, 0);
    elTimer.textContent = `Expira em ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (segundosRestantes <= 0) {
      clearInterval(timerId);
      elStatusText.textContent = 'PIX expirado. Gere novamente.';
      elStatusDot.classList.remove('status-paid');
      elStatusDot.classList.add('status-expired');
    }
  }, 1000);

  // Polling de status
  let attempts = 0;
  const maxAttempts = 60; // ~5 minutos se 5s

  async function checkStatus() {
    attempts++;
    if (!txid) return;
    try {
      const resp = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid })
      });
      const data = await resp.json();
      if (!data.success) {
        console.warn('Status não retornou success:', data);
        return;
      }

      // Tentar várias chaves padrões
      const d = data.data || {};
      const status = (d.status || d.payment_status || d.charge_status || '').toString().toLowerCase();
      console.log('Status recebido:', status, d);

      if (['paid', 'approved', 'completed', 'confirmed', 'success'].includes(status)) {
        elStatusText.textContent = 'Pagamento confirmado!';
        elStatusDot.classList.remove('status-expired');
        elStatusDot.classList.add('status-paid');

        // Persistir sucesso
        const cliente = JSON.parse(localStorage.getItem('cliente') || '{}');
        localStorage.setItem('payment_success', JSON.stringify({
          status,
          txid,
          total,
          qtd,
          cliente
        }));

        // Redirecionar para confirmação
        setTimeout(() => {
          const confirmacaoUrl = (typeof window.appendTrackingParams === 'function')
            ? window.appendTrackingParams('confirmacao.html')
            : 'confirmacao.html';
          window.location.href = confirmacaoUrl;
        }, 1500);
      }
    } catch (e) {
      console.error('Erro ao consultar status', e);
    }
  }

  const poller = setInterval(() => {
    if (attempts >= maxAttempts) {
      clearInterval(poller);
      return;
    }
    checkStatus();
  }, 5000);
});