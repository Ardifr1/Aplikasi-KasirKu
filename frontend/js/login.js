// TODO: validasi tambahan & redirect sesuai role bila perlu.
document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msg');
  msg.innerHTML = '';
  try {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const res = await window.Store.AuthApi.login(username, password);
    window.Auth.saveSession(res.data.token, res.data.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    msg.innerHTML = '<div class="alert error">' + (err.message || 'Login gagal') + '</div>';
  }
});
