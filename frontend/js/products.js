// TODO: tambah tombol edit/hapus per baris + modal form sesuai Figma.
(function () {
  window.Auth.requireAuth();
  document.getElementById('logout').onclick = () => window.Auth.logout();

  async function load(q) {
    const res = await window.Store.ProductsApi.list(q);
    document.getElementById('list').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
  }
  document.getElementById('filter').addEventListener('submit', (e) => {
    e.preventDefault();
    load({ search: document.getElementById('search').value, category_id: document.getElementById('category_id').value });
  });
  document.getElementById('create').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await window.Store.ProductsApi.create({
        name: document.getElementById('name').value,
        category_id: document.getElementById('category').value,
        price: Number(document.getElementById('price').value),
        stock: Number(document.getElementById('stock').value || 0),
        barcode: document.getElementById('barcode').value || null,
      });
      load({});
    } catch (err) { alert(err.message); }
  });
  load({});
})();
