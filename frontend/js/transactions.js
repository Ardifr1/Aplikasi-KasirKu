// TODO: tampilkan invoice, item, payment, kembalian sesuai struk Figma.
(function () {
  window.Auth.requireAuth();
  document.getElementById('logout').onclick = () => window.Auth.logout();
  window.Store.TransactionsApi.list().then((res) => {
    document.getElementById('list').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
  });
})();
