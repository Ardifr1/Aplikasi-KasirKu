const express = require('express');
const router = express.Router();
const KasirController = require('../controllers/KasirController');

router.get('/', KasirController.getAll);
router.get('/:id', KasirController.getById);
router.post('/', KasirController.create);
router.put('/:id', KasirController.update);
router.delete('/:id', KasirController.delete);

module.exports = router;
