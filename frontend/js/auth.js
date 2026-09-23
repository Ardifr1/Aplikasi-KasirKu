/* Helper auth: simpan token+user, guard halaman, logout.
 * TODO: isi redirect setelah login sesuai halaman utama (dashboard.html).
 */
(function () {
  function saveSession(token, user) {
    localStorage.setItem(window.APP_CONFIG.TOKEN_KEY, token);
    localStorage.setItem(window.APP_CONFIG.USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(window.APP_CONFIG.TOKEN_KEY);
    localStorage.removeItem(window.APP_CONFIG.USER_KEY);
  }

  function currentUser() {
    try { return JSON.parse(localStorage.getItem(window.APP_CONFIG.USER_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function requireAuth() {
    if (!window.Api.getToken()) {
      window.location.href = 'login.html';
      return null;
    }
    return currentUser();
  }

  function requireRole() {
    const user = requireAuth();
    if (!user) return null;
    const allowed = Array.prototype.slice.call(arguments);
    if (allowed.length && allowed.indexOf(user.role) === -1) {
      alert('Akses ditolak untuk role: ' + user.role);
      window.location.href = 'dashboard.html';
      return null;
    }
    return user;
  }

  async function logout() {
    try { await window.Api.request('/auth/logout', { method: 'POST' }); }
    catch (e) { /* token dibuang di klien walau server gagal */ }
    clearSession();
    window.location.href = 'login.html';
  }

  window.Auth = { saveSession, clearSession, currentUser, requireAuth, requireRole, logout };
})();
