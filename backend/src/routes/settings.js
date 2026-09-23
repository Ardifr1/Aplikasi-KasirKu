const express = require('express');
const SettingsController = require('../controllers/SettingsController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

router.get('/', auth, SettingsController.get);
router.put('/', auth, requireRole('admin'), SettingsController.update);

module.exports = router;
