const express = require('express');
const router = express.Router();

// 导入控制器和中间件
const commentController = require('../controllers/commentController');
const { authenticateToken } = require('../middleware/auth');

// 公共路由 - 获取游戏评论（不需要认证）
router.get('/games/:gameId/comments', commentController.getGameComments);

// 认证路由 - 提交评论（需要登录）
router.post('/games/:gameId/comments', authenticateToken, commentController.submitComment);

// 认证路由 - 回复评论（需要登录）
router.post('/games/:gameId/comments/:commentId/reply', authenticateToken, commentController.replyToComment);

module.exports = router;