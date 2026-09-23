const express = require('express');
const NotificationController = require('../controllers/NotificationController');
const auth = require('../middleware/auth');

const router = express.Router();

// Static routes must be registered BEFORE /:id.
router.get('/unread-count', auth, NotificationController.unreadCount);
router.patch('/read-all', auth, NotificationController.markAllRead);
router.get('/', auth, NotificationController.list);
router.patch('/:id/read', auth, NotificationController.markRead);

module.exports = router;
