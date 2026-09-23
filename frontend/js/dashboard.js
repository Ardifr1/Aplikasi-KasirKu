// TODO: render kartu/grafik sesuai Figma; endpoint: DashboardApi.summary/salesSummary/topProducts/paymentSummary/lowStock.
(function () {
  window.Auth.requireAuth();
  document.getElementById('logout').onclick = () => window.Auth.logout();

  async function load(q) {
    const [s, daily, top, pay, low] = await Promise.all([
      window.Store.DashboardApi.summary(q),
      window.Store.DashboardApi.salesSummary(q),
      window.Store.DashboardApi.topProducts(Object.assign({ limit: 5 }, q)),
      window.Store.DashboardApi.paymentSummary(q),
      window.Store.DashboardApi.lowStock(),
    ]);
    document.getElementById('summary').innerHTML = '<pre>' + JSON.stringify(s.data, null, 2) + '</pre>';
    document.getElementById('daily').innerHTML = '<pre>' + JSON.stringify(daily.data, null, 2) + '</pre>';
    document.getElementById('top').innerHTML = '<pre>' + JSON.stringify(top.data, null, 2) + '</pre>';
    document.getElementById('pay').innerHTML = '<pre>' + JSON.stringify(pay.data, null, 2) + '</pre>';
    document.getElementById('low').innerHTML = '<pre>' + JSON.stringify(low.data, null, 2) + '</pre>';
  }

  document.getElementById('filter').addEventListener('submit', (e) => {
    e.preventDefault();
    load({ date_from: document.getElementById('date_from').value, date_to: document.getElementById('date_to').value });
  });
  load({});
})();
