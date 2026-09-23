const express = require('express');
const ActivityLogController = require('../controllers/ActivityLogController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

router.get('/', auth, requireRole('admin'), ActivityLogController.list);

module.exports = router;
