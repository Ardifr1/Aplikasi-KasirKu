// TODO: ganti keranjang sederhana ini dengan UI Figma (qty +/-, hapus item, hitung kembalian).
(function () {
  window.Auth.requireRole('admin', 'kasir');
  document.getElementById('logout').onclick = () => window.Auth.logout();
  const cart = []; // [{product_id, quantity}]

  function render() {
    document.getElementById('cart').innerHTML = '<pre>' + JSON.stringify(cart, null, 2) + '</pre>';
  }

  document.getElementById('barcode').addEventListener('change', async (e) => {
    const code = e.target.value.trim();
    if (!code) return;
    try {
      const res = await window.Store.ProductsApi.byBarcode(code);
      const found = cart.find((i) => i.product_id === res.data.id);
      if (found) found.quantity += 1;
      else cart.push({ product_id: res.data.id, quantity: 1 });
      render();
    } catch (err) { alert(err.message); }
    e.target.value = '';
  });

  document.getElementById('pay').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await window.Store.TransactionsApi.checkout({
        items: cart,
        discount: Number(document.getElementById('discount').value || 0),
        tax: Number(document.getElementById('tax').value || 0),
        payment: {
          method: document.getElementById('method').value,
          amount: Number(document.getElementById('amount').value),
          reference: document.getElementById('reference').value || null,
        },
      });
      document.getElementById('result').innerHTML =
        '<div class="alert success">Sukses ' + res.data.invoice_number + ', kembalian: ' + res.data.change + '</div>';
      cart.length = 0;
      render();
    } catch (err) {
      document.getElementById('result').innerHTML = '<div class="alert error">' + err.message + '</div>';
    }
  });
  render();
})();
