const express = require('express');
const AuthController = require('../controllers/AuthController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/login', AuthController.login);
router.get('/me', auth, AuthController.me);
router.post('/logout', auth, AuthController.logout);

module.exports = router;
