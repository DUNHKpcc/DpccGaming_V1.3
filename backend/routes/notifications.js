const express = require('express');
const router = express.Router();

// 导入控制器和中间件
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

// 所有通知路由都需要认证
router.get('/', authenticateToken, notificationController.getNotifications);
router.get('/unread-status', authenticateToken, notificationController.getUnreadStatus);
router.post('/:id/read', authenticateToken, notificationController.markNotificationAsRead);
router.post('/mark-all-read', authenticateToken, notificationController.markAllNotificationsAsRead);

module.exports = router;
