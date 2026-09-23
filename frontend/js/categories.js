// TODO: tambah edit/hapus sesuai Figma.
(function () {
  window.Auth.requireAuth();
  document.getElementById('logout').onclick = () => window.Auth.logout();
  async function load() {
    const res = await window.Store.CategoriesApi.list();
    document.getElementById('list').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
  }
  document.getElementById('create').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await window.Store.CategoriesApi.create({
        name: document.getElementById('name').value,
        description: document.getElementById('description').value || null,
      });
      load();
    } catch (err) { alert(err.message); }
  });
  load();
})();
