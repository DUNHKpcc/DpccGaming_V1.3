const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

router.get('/verify-token', authenticateToken, authController.verifyTokenEndpoint);
router.get('/user/profile', authenticateToken, authController.getUserProfile);

// 兼容新旧路由
router.get('/auth/me', authenticateToken, authController.getCurrentUser);
router.get('/me', authenticateToken, authController.getCurrentUser);

module.exports = router;
