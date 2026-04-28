const express = require('express');
const router = express.Router();

// 导入控制器和中间件
const commentController = require('../controllers/commentController');
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/auth');

// 公共路由 - 获取游戏评论（不需要认证）
router.get('/games/:gameId/comments', commentController.getGameComments);

// 认证路由 - 提交评论（需要登录）
router.post('/games/:gameId/comments', authenticateToken, commentController.submitComment);

// 认证路由 - 回复评论（需要登录）
router.post('/games/:gameId/comments/:commentId/reply', authenticateToken, commentController.replyToComment);

// 文档评论区
router.get('/docs/:docId/comments', commentController.getDocComments);
router.post('/docs/:docId/comments', authenticateToken, commentController.submitDocComment);
router.post('/docs/:docId/comments/:commentId/reply', authenticateToken, commentController.replyToDocComment);
router.get('/docs/:docId/star', optionalAuthenticateToken, commentController.getDocStarStatus);
router.put('/docs/:docId/star', authenticateToken, commentController.starDoc);
router.delete('/docs/:docId/star', authenticateToken, commentController.unstarDoc);
router.get('/user/doc-stars', authenticateToken, commentController.getUserDocStars);

module.exports = router;
