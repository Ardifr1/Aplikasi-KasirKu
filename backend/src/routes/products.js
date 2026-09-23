const express = require('express');
const ProductController = require('../controllers/ProductController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

// Barcode lookup must be registered BEFORE /:id so "barcode" is not
// captured as a product id.
router.get('/barcode/:barcode', auth, ProductController.lookupByBarcode);
router.get('/', auth, ProductController.list);
router.get('/:id', auth, ProductController.detail);
router.post('/', auth, requireRole('admin'), ProductController.create);
router.put('/:id', auth, requireRole('admin'), ProductController.update);
router.delete('/:id', auth, requireRole('admin'), ProductController.remove);

module.exports = router;
