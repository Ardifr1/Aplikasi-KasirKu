// TODO: tambah filter query sesuai Figma.
(function () {
  window.Auth.requireRole('admin');
  document.getElementById('logout').onclick = () => window.Auth.logout();
  window.Store.ActivityLogsApi.list().then((res) => {
    document.getElementById('list').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
  });
})();
