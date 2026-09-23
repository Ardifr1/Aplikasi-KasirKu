const express = require('express');
const UserController = require('../controllers/UserController');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

const router = express.Router();

router.use(auth, requireRole('admin'));

router.get('/', UserController.list);
router.get('/:id', UserController.detail);
router.post('/', UserController.create);
router.put('/:id', UserController.update);
router.patch('/:id/password', UserController.resetPassword);
router.delete('/:id', UserController.remove);

module.exports = router;
