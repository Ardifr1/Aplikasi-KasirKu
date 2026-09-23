const express = require('express');
const CategoryController = require('../controllers/CategoryController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

router.get('/', auth, CategoryController.list);
router.get('/:id', auth, CategoryController.detail);
router.post('/', auth, requireRole('admin'), CategoryController.create);
router.put('/:id', auth, requireRole('admin'), CategoryController.update);
router.delete('/:id', auth, requireRole('admin'), CategoryController.remove);

module.exports = router;
