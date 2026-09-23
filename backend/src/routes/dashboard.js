const express = require('express');
const DashboardController = require('../controllers/DashboardController');
const auth = require('../middleware/auth');

const router = express.Router();

// All dashboard endpoints: admin, kasir, pemilik (auth only, no role gate).
router.get('/', auth, DashboardController.summary);
router.get('/sales-summary', auth, DashboardController.salesSummary);
router.get('/top-products', auth, DashboardController.topProducts);
router.get('/payment-summary', auth, DashboardController.paymentSummary);
router.get('/low-stock', auth, DashboardController.lowStock);

module.exports = router;
