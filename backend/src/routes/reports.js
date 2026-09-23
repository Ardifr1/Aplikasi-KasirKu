const express = require('express');
const ReportController = require('../controllers/ReportController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

// Reports: admin + pemilik only. Static routes before any dynamic ones.
router.get(
    '/sales/export',
    auth,
    requireRole('admin', 'pemilik'),
    ReportController.salesExport
);
router.get(
    '/sales/summary',
    auth,
    requireRole('admin', 'pemilik'),
    ReportController.salesSummary
);
router.get('/sales', auth, requireRole('admin', 'pemilik'), ReportController.sales);
router.get('/products', auth, requireRole('admin', 'pemilik'), ReportController.products);
router.get('/cashiers', auth, requireRole('admin', 'pemilik'), ReportController.cashiers);

module.exports = router;
