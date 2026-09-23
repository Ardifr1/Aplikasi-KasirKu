// TODO: sembunyikan form bila role bukan admin.
(function () {
  window.Auth.requireAuth();
  document.getElementById('logout').onclick = () => window.Auth.logout();
  window.Store.SettingsApi.get().then((res) => {
    document.getElementById('current').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
  });
  document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await window.Store.SettingsApi.update({
        store_name: document.getElementById('store_name').value || undefined,
        address: document.getElementById('address').value || undefined,
        business_number: document.getElementById('business_number').value || undefined,
        email: document.getElementById('email').value || undefined,
        logo: document.getElementById('logo').value || undefined,
      });
      document.getElementById('current').innerHTML = '<pre>' + JSON.stringify(res.data, null, 2) + '</pre>';
    } catch (err) { alert(err.message); }
  });
})();
