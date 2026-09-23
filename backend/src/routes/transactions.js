const express = require('express');
const TransactionController = require('../controllers/TransactionController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

// NOTE: checkout already creates the payment atomically inside one DB
// transaction. No separate POST /:id/pay endpoint is provided — a second
// payment flow would risk double-charging and stock inconsistency.

// Static /my must be registered BEFORE /:id.
router.get('/my', auth, requireRole('admin', 'kasir'), TransactionController.myTransactions);
router.get('/', auth, TransactionController.list);
router.get('/:id', auth, TransactionController.detail);
router.post('/', auth, requireRole('admin', 'kasir'), TransactionController.create);

module.exports = router;
