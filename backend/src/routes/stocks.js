const express = require('express');
const StockController = require('../controllers/StockController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

// Static route must be registered BEFORE /:productId.
router.get('/movements', auth, StockController.movementList);
router.get('/', auth, StockController.stockList);
router.get('/:productId', auth, StockController.stockDetail);
router.post('/adjustment', auth, requireRole('admin'), StockController.adjustment);

module.exports = router;
