/* Kumpulan fungsi API per modul backend.
 * TODO: panggil dari file halaman masing-masing (products.js, pos.js, ...).
 */
(function () {
  // ---- AUTH: POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout
  // TODO: picks: login({username,password}) -> data {user,token}
  const AuthApi = {
    login: (username, password) => window.Api.request('/auth/login', { method: 'POST', body: { username, password } }),
    me: () => window.Api.request('/auth/me'),
    logout: () => window.Api.request('/auth/logout', { method: 'POST' }),
  };

  // ---- PROFILE: GET/PUT /api/profile, PATCH /api/profile/password
  // TODO: updateProfile({name,username}), changePassword({current_password,new_password})
  const ProfileApi = {
    get: () => window.Api.request('/profile'),
    update: (body) => window.Api.request('/profile', { method: 'PUT', body }),
    changePassword: (body) => window.Api.request('/profile/password', { method: 'PATCH', body }),
  };

  // ---- USERS (admin): GET/POST /api/users, GET/PUT/DELETE /api/users/:id, PATCH /:id/password
  // TODO: list({role,status,search})
  const UsersApi = {
    list: (q) => window.Api.request('/users', { query: q }),
    detail: (id) => window.Api.request('/users/' + id),
    create: (body) => window.Api.request('/users', { method: 'POST', body }),
    update: (id, body) => window.Api.request('/users/' + id, { method: 'PUT', body }),
    resetPassword: (id, new_password) => window.Api.request('/users/' + id + '/password', { method: 'PATCH', body: { new_password } }),
    remove: (id) => window.Api.request('/users/' + id, { method: 'DELETE' }),
  };

  // ---- CATEGORIES: GET /api/categories, POST/PUT/DELETE (admin)
  // TODO: create({name,description})
  const CategoriesApi = {
    list: () => window.Api.request('/categories'),
    detail: (id) => window.Api.request('/categories/' + id),
    create: (body) => window.Api.request('/categories', { method: 'POST', body }),
    update: (id, body) => window.Api.request('/categories/' + id, { method: 'PUT', body }),
    remove: (id) => window.Api.request('/categories/' + id, { method: 'DELETE' }),
  };

  // ---- PRODUCTS: GET /api/products?search=&category_id=&barcode=, GET /barcode/:barcode
  // TODO: create butuh {category_id,name,price,stock?,barcode?,image?}; update TANPA field stock
  const ProductsApi = {
    list: (q) => window.Api.request('/products', { query: q }),
    detail: (id) => window.Api.request('/products/' + id),
    byBarcode: (barcode) => window.Api.request('/products/barcode/' + encodeURIComponent(barcode)),
    create: (body) => window.Api.request('/products', { method: 'POST', body }),
    update: (id, body) => window.Api.request('/products/' + id, { method: 'PUT', body }),
    remove: (id) => window.Api.request('/products/' + id, { method: 'DELETE' }),
  };

  // ---- STOCKS: GET /api/stocks, GET /:productId, GET /movements, POST /adjustment (admin)
  // TODO: adjustment({product_id,quantity,type:'in'|'out',description?}); quantity bulat positif
  const StocksApi = {
    list: (q) => window.Api.request('/stocks', { query: q }),
    detail: (productId) => window.Api.request('/stocks/' + productId),
    movements: (q) => window.Api.request('/stocks/movements', { query: q }),
    adjust: (body) => window.Api.request('/stocks/adjustment', { method: 'POST', body }),
  };

  // ---- TRANSACTIONS (kasir/admin): POST /api/transactions, GET /, GET /my, GET /:id
  // TODO: checkout({items:[{product_id,quantity}],discount?,tax?,payment:{method,amount,reference?}})
  // TODO: method: cash|qris|transfer|debit|credit|ewallet (alias e_wallet diterima); response.data.change untuk cash
  const TransactionsApi = {
    list: (q) => window.Api.request('/transactions', { query: q }),
    my: (q) => window.Api.request('/transactions/my', { query: q }),
    detail: (id) => window.Api.request('/transactions/' + id),
    checkout: (body) => window.Api.request('/transactions', { method: 'POST', body }),
  };

  // ---- DASHBOARD (semua role): GET /api/dashboard, /sales-summary, /top-products, /payment-summary, /low-stock
  // TODO: query date_from & date_to format YYYY-MM-DD; top-products dukung limit
  const DashboardApi = {
    summary: (q) => window.Api.request('/dashboard', { query: q }),
    salesSummary: (q) => window.Api.request('/dashboard/sales-summary', { query: q }),
    topProducts: (q) => window.Api.request('/dashboard/top-products', { query: q }),
    paymentSummary: (q) => window.Api.request('/dashboard/payment-summary', { query: q }),
    lowStock: () => window.Api.request('/dashboard/low-stock'),
  };

  // ---- REPORTS (admin,pemilik): GET /api/reports/sales, /sales/summary, /products, /cashiers + /sales/export (CSV)
  // TODO: filter date_from,date_to,cashier_id,payment_method,status,category_id
  const ReportsApi = {
    sales: (q) => window.Api.request('/reports/sales', { query: q }),
    salesSummary: (q) => window.Api.request('/reports/sales/summary', { query: q }),
    products: (q) => window.Api.request('/reports/products', { query: q }),
    cashiers: (q) => window.Api.request('/reports/cashiers', { query: q }),
    exportSalesCsv: (q) => window.Api.downloadCsv('/reports/sales/export', q, 'sales-report.csv'),
  };

  // ---- ACTIVITY LOGS (admin): GET /api/activity-logs?user_id=&action=&module=&date_from=&date_to=&search=
  const ActivityLogsApi = {
    list: (q) => window.Api.request('/activity-logs', { query: q }),
  };

  // ---- NOTIFICATIONS: GET /api/notifications, GET /unread-count, PATCH /:id/read, PATCH /read-all
  const NotificationsApi = {
    list: (q) => window.Api.request('/notifications', { query: q }),
    unreadCount: () => window.Api.request('/notifications/unread-count'),
    markRead: (id) => window.Api.request('/notifications/' + id + '/read', { method: 'PATCH' }),
    markAllRead: () => window.Api.request('/notifications/read-all', { method: 'PATCH' }),
  };

  // ---- SETTINGS: GET /api/settings (semua role), PUT /api/settings (admin)
  // TODO: field {store_name,address,business_number,email,logo}
  const SettingsApi = {
    get: () => window.Api.request('/settings'),
    update: (body) => window.Api.request('/settings', { method: 'PUT', body }),
  };

  // ---- HEALTH: GET /api/health (tanpa token)
  const HealthApi = { check: () => window.Api.request('/health') };

  window.Store = {
    AuthApi, ProfileApi, UsersApi, CategoriesApi, ProductsApi, StocksApi,
    TransactionsApi, DashboardApi, ReportsApi, ActivityLogsApi, NotificationsApi,
    SettingsApi, HealthApi,
  };
})();
