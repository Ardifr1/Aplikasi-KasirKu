// TODO: tambah edit/lihat detail, reset password PATCH /:id/password, hapus DELETE /:id.
(function () {
  window.Auth.requireRole('admin');
  document.getElementById('logout').onclick = () => window.Auth.logout();
  async function load() {
    const res = await window.Store.UsersApi.list();
    document.getElementById('list').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
  }
  document.getElementById('create').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await window.Store.UsersApi.create({
        name: document.getElementById('name').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        role_id: document.getElementById('role_id').value,
      });
      load();
    } catch (err) { alert(err.message); }
  });
  load();
})();
