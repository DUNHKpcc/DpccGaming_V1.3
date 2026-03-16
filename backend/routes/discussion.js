const express = require('express');

const router = express.Router();
const discussionController = require('../controllers/discussionController');
const { authenticateToken } = require('../middleware/auth');

// 房间（按游戏查看公开房间）
router.get('/games/:gameId/rooms', authenticateToken, discussionController.listPublicRoomsByGame);

// 房间生命周期
router.post('/rooms', authenticateToken, discussionController.createRoom);
router.get('/rooms/mine', authenticateToken, discussionController.listMyRooms);
router.get('/rooms/:roomId', authenticateToken, discussionController.getRoomDetail);
router.post('/rooms/:roomId/join', authenticateToken, discussionController.joinRoom);
router.post('/rooms/:roomId/leave', authenticateToken, discussionController.leaveRoom);

// 房间消息
router.get('/rooms/:roomId/messages', authenticateToken, discussionController.listRoomMessages);
router.post('/rooms/:roomId/messages', authenticateToken, discussionController.sendRoomMessage);
router.post('/rooms/:roomId/ai-message', authenticateToken, discussionController.sendAiRoomMessage);

// 匹配队列
router.get('/match/queue', authenticateToken, discussionController.getMatchQueueStatus);
router.post('/match/queue', authenticateToken, discussionController.enqueueMatch);
router.delete('/match/queue', authenticateToken, discussionController.cancelMatchQueue);

// 好友系统
router.get('/friends', authenticateToken, discussionController.getFriends);
router.get('/friends/requests', authenticateToken, discussionController.getFriendRequests);
router.get('/friends/search', authenticateToken, discussionController.searchUsersForFriend);
router.post('/friends/request', authenticateToken, discussionController.sendFriendRequest);
router.post('/friends/requests/:requestId/respond', authenticateToken, discussionController.respondFriendRequest);
router.post('/friends/invite-links', authenticateToken, discussionController.createFriendInviteLink);
router.post('/friends/invite-links/redeem', authenticateToken, discussionController.redeemFriendInviteLink);

module.exports = router;
