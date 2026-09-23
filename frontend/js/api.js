/* HTTP client untuk backend Express.
 * Backend response: { success, message, data } atau { success, message, errors }.
 * TODO: tambah loading spinner / toast global di sini bila perlu.
 */
(function () {
  function getBaseUrl() {
    return (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || 'http://localhost:3000/api';
  }

  function getToken() {
    try {
      return localStorage.getItem(window.APP_CONFIG.TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function buildQuery(params) {
    if (!params) return '';
    const qs = new URLSearchParams();
    Object.keys(params).forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    const s = qs.toString();
    return s ? '?' + s : '';
  }

  async function request(path, options) {
    options = options || {};
    const res = await fetch(getBaseUrl() + path + buildQuery(options.query), {
      method: options.method || 'GET',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        getToken() ? { Authorization: 'Bearer ' + getToken() } : {},
        options.headers || {}
      ),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = { success: false, message: text }; }
    if (!res.ok) {
      const err = new Error((json && json.message) || 'Request gagal (' + res.status + ')');
      err.status = res.status;
      err.payload = json;
      throw err;
    }
    return json;
  }

  async function downloadCsv(path, query, filename) {
    const res = await fetch(getBaseUrl() + path + buildQuery(query), {
      headers: getToken() ? { Authorization: 'Bearer ' + getToken() } : {},
    });
    if (!res.ok) throw new Error('Export gagal (' + res.status + ')');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'sales-report.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.Api = { request, downloadCsv, getToken, buildQuery };
})();
