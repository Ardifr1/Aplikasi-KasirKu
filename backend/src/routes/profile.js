const express = require('express');
const ProfileController = require('../controllers/ProfileController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, ProfileController.getProfile);
router.put('/', auth, ProfileController.updateProfile);
router.patch('/password', auth, ProfileController.changePassword);

module.exports = router;
