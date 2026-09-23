// TODO: isi nilai awal form dari GET /api/profile.
(function () {
  window.Auth.requireAuth();
  document.getElementById('logout').onclick = () => window.Auth.logout();
  window.Store.ProfileApi.get().then((res) => {
    document.getElementById('me').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
  });
  document.getElementById('update').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await window.Store.ProfileApi.update({ name: document.getElementById('name').value, username: document.getElementById('username').value });
      alert('Profil diperbarui');
    } catch (err) { alert(err.message); }
  });
  document.getElementById('pw').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await window.Store.ProfileApi.changePassword({ current_password: document.getElementById('current_password').value, new_password: document.getElementById('new_password').value });
      alert('Password diubah');
    } catch (err) { alert(err.message); }
  });
})();
