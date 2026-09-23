// TODO: render daftar + tombol "tandai dibaca" per item (PATCH /:id/read).
(function () {
  window.Auth.requireAuth();
  document.getElementById('logout').onclick = () => window.Auth.logout();
  async function load() {
    const res = await window.Store.NotificationsApi.list();
    document.getElementById('list').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
  }
  document.getElementById('readAll').onclick = async () => {
    await window.Store.NotificationsApi.markAllRead();
    load();
  };
  load();
})();
