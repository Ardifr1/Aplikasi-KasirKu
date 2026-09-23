// TODO: filter search/category_id/low_stock/out_of_stock + detail GET /api/stocks/:productId.
(function () {
  window.Auth.requireAuth();
  document.getElementById('logout').onclick = () => window.Auth.logout();
  async function load() {
    const res = await window.Store.StocksApi.list();
    document.getElementById('list').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
  }
  document.getElementById('adjust').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await window.Store.StocksApi.adjust({
        product_id: document.getElementById('product_id').value,
        quantity: Number(document.getElementById('quantity').value),
        type: document.getElementById('type').value,
        description: document.getElementById('description').value || null,
      });
      load();
    } catch (err) { alert(err.message); }
  });
  load();
})();
