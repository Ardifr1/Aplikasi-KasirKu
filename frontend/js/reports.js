// TODO: tambah tab laporan produk/kasir + tabel rapi sesuai Figma.
(function () {
  window.Auth.requireRole('admin', 'pemilik');
  document.getElementById('logout').onclick = () => window.Auth.logout();
  function q() {
    return { date_from: document.getElementById('date_from').value, date_to: document.getElementById('date_to').value };
  }
  document.getElementById('filter').addEventListener('submit', async (e) => {
    e.preventDefault();
    const [sales, summary] = await Promise.all([
      window.Store.ReportsApi.sales(q()),
      window.Store.ReportsApi.salesSummary(q()),
    ]);
    document.getElementById('sales').innerHTML = '<pre>' + JSON.stringify(sales.data, null, 2) + '</pre>';
    document.getElementById('summary').innerHTML = '<pre>' + JSON.stringify(summary.data, null, 2) + '</pre>';
  });
  document.getElementById('export').onclick = () => window.Store.ReportsApi.exportSalesCsv(q());
})();
