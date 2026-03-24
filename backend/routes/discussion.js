const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const discussionController = require('../controllers/discussionController');
const { authenticateToken } = require('../middleware/auth');

const DISCUSSION_ATTACHMENT_DIR = path.join(process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads'), 'discussion');
const DISCUSSION_DOCUMENT_DIR = path.join(DISCUSSION_ATTACHMENT_DIR, 'document');
const DISCUSSION_AVATAR_DIR = path.join(DISCUSSION_ATTACHMENT_DIR, 'avatar');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const normalizeKind = (value = '') => String(value || '').trim().toLowerCase();

const kindToDir = (kind) => {
  if (kind === 'image') return 'image';
  if (kind === 'video') return 'video';
  if (kind === 'code') return 'code';
  return '';
};

const createAttachmentUploader = (kind) => {
  const destinationDirName = kindToDir(kind);
  const destinationDir = path.join(DISCUSSION_ATTACHMENT_DIR, destinationDirName);
  ensureDir(destinationDir);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destinationDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${kind}-${suffix}${ext}`);
    }
  });

  const maxSizeByKind = {
    image: 12 * 1024 * 1024,
    video: 220 * 1024 * 1024,
    code: 220 * 1024 * 1024
  };

  const upload = multer({
    storage,
    limits: { fileSize: maxSizeByKind[kind] || (20 * 1024 * 1024) },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const lowerName = String(file.originalname || '').toLowerCase();
      const mime = String(file.mimetype || '').toLowerCase();

      if (kind === 'image') {
        if (mime.startsWith('image/')) return cb(null, true);
        return cb(new Error('仅支持上传图片文件'));
      }

      if (kind === 'video') {
        if (mime.startsWith('video/')) return cb(null, true);
        return cb(new Error('仅支持上传视频文件'));
      }

      const allowCodeExts = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz']);
      const allowCodeMimes = new Set([
        'application/zip',
        'application/x-zip-compressed',
        'application/x-rar-compressed',
        'application/vnd.rar',
        'application/x-7z-compressed',
        'application/x-tar',
        'application/gzip',
        'application/x-gzip',
        'application/octet-stream'
      ]);
      const isTarGz = lowerName.endsWith('.tar.gz');

      if (allowCodeExts.has(ext) || allowCodeMimes.has(mime) || isTarGz) return cb(null, true);
      return cb(new Error('仅支持 ZIP/RAR/7Z/TAR/GZ 代码文件'));
    }
  }).single('file');

  return upload;
};

const uploadDiscussionAttachment = (req, res, next) => {
  const kind = normalizeKind(req.params.kind);
  if (!['image', 'video', 'code'].includes(kind)) {
    return res.status(400).json({ error: '不支持的附件类型' });
  }

  const uploader = createAttachmentUploader(kind);
  uploader(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超出限制' });
    }
    if (error) {
      return res.status(400).json({ error: error.message || '附件上传失败' });
    }
    next();
  });
};

const createDocumentUploader = () => {
  ensureDir(DISCUSSION_DOCUMENT_DIR);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DISCUSSION_DOCUMENT_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `document-${suffix}${ext}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: 60 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = String(file.mimetype || '').toLowerCase();

      const allowExts = new Set(['.pdf', '.md', '.txt', '.doc', '.docx']);
      const allowMimes = new Set([
        'application/pdf',
        'text/markdown',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/octet-stream'
      ]);

      if (allowExts.has(ext) || allowMimes.has(mime)) return cb(null, true);
      return cb(new Error('仅支持 PDF/MD/TXT/DOC/DOCX 文档'));
    }
  }).single('file');
};

const uploadDiscussionDocument = (req, res, next) => {
  const uploader = createDocumentUploader();
  uploader(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超出限制（最大 60MB）' });
    }
    if (error) {
      return res.status(400).json({ error: error.message || '文档上传失败' });
    }
    next();
  });
};

const createDiscussionAvatarUploader = () => {
  ensureDir(DISCUSSION_AVATAR_DIR);

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, DISCUSSION_AVATAR_DIR),
      filename: (req, file, cb) => {
        const roomId = String(req.params?.roomId || 'room').replace(/[^a-zA-Z0-9_-]/g, '') || 'room';
        const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `room-avatar-${roomId}-${suffix}${path.extname(file.originalname || '').toLowerCase()}`);
      }
    }),
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const mime = String(file.mimetype || '').toLowerCase();
      if (mime.startsWith('image/')) return cb(null, true);
      return cb(new Error('仅支持上传图片文件'));
    }
  }).single('avatar');
};

const uploadDiscussionAvatar = (req, res, next) => {
  const uploader = createDiscussionAvatarUploader();
  uploader(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '头像文件大小超出限制（最大 6MB）' });
    }
    if (error) {
      return res.status(400).json({ error: error.message || '群头像上传失败' });
    }
    next();
  });
};

// 房间（按游戏查看公开房间）
router.get('/games/:gameId/rooms', authenticateToken, discussionController.listPublicRoomsByGame);

// 房间生命周期
router.post('/rooms', authenticateToken, discussionController.createRoom);
router.get('/rooms/mine', authenticateToken, discussionController.listMyRooms);
router.get('/rooms/:roomId', authenticateToken, discussionController.getRoomDetail);
router.post('/rooms/:roomId/join', authenticateToken, discussionController.joinRoom);
router.post('/rooms/:roomId/leave', authenticateToken, discussionController.leaveRoom);
router.post('/rooms/:roomId/members/invite', authenticateToken, discussionController.inviteFriendToRoom);
router.post('/rooms/:roomId/invite-links', authenticateToken, discussionController.createRoomInviteLink);
router.post('/rooms/:roomId/invite-links/redeem', authenticateToken, discussionController.redeemRoomInviteLink);
router.post('/rooms/:roomId/avatar', authenticateToken, uploadDiscussionAvatar, discussionController.uploadRoomAvatar);

// 房间消息
router.get('/rooms/:roomId/messages', authenticateToken, discussionController.listRoomMessages);
router.post('/rooms/:roomId/messages', authenticateToken, discussionController.sendRoomMessage);
router.delete('/rooms/:roomId/messages/history', authenticateToken, discussionController.clearRoomMessages);
router.post('/rooms/:roomId/messages/:messageId/revoke', authenticateToken, discussionController.revokeRoomMessage);
router.get('/rooms/:roomId/settings', authenticateToken, discussionController.getRoomSettings);
router.patch('/rooms/:roomId/settings', authenticateToken, discussionController.updateRoomSettings);
router.get('/rooms/:roomId/memory', authenticateToken, discussionController.getRoomMemory);
router.post('/rooms/:roomId/memory/refresh', authenticateToken, discussionController.refreshRoomMemory);
router.post('/rooms/:roomId/ai-loop/turn', authenticateToken, discussionController.triggerRoomAiLoopTurn);
router.post('/rooms/:roomId/attachments/:kind', authenticateToken, uploadDiscussionAttachment, discussionController.uploadRoomAttachment);
router.post('/rooms/:roomId/ai-message', authenticateToken, discussionController.sendAiRoomMessage);
router.get('/rooms/:roomId/documents', authenticateToken, discussionController.listRoomDocuments);
router.post('/rooms/:roomId/documents', authenticateToken, uploadDiscussionDocument, discussionController.uploadRoomDocument);
router.delete('/rooms/:roomId/documents/:documentId', authenticateToken, discussionController.deleteRoomDocument);
router.patch('/rooms/:roomId/documents/current', authenticateToken, discussionController.setCurrentRoomDocument);
router.get('/rooms/:roomId/tasks', authenticateToken, discussionController.listRoomTasks);
router.post('/rooms/:roomId/tasks', authenticateToken, discussionController.createRoomTask);
router.patch('/rooms/:roomId/tasks/:taskId', authenticateToken, discussionController.updateRoomTask);
router.delete('/rooms/:roomId/tasks/:taskId', authenticateToken, discussionController.deleteRoomTask);

// 匹配队列
router.get('/match/queue', authenticateToken, discussionController.getMatchQueueStatus);
router.post('/match/queue', authenticateToken, discussionController.enqueueMatch);
router.delete('/match/queue', authenticateToken, discussionController.cancelMatchQueue);

// 好友系统
router.get('/friends', authenticateToken, discussionController.getFriends);
router.delete('/friends/:friendUserId', authenticateToken, discussionController.deleteFriend);
router.post('/friends/:friendUserId/direct-room', authenticateToken, discussionController.getOrCreateFriendDirectRoom);
router.get('/friends/requests', authenticateToken, discussionController.getFriendRequests);
router.get('/friends/search', authenticateToken, discussionController.searchUsersForFriend);
router.post('/friends/request', authenticateToken, discussionController.sendFriendRequest);
router.post('/friends/requests/:requestId/respond', authenticateToken, discussionController.respondFriendRequest);
router.post('/friends/invite-links', authenticateToken, discussionController.createFriendInviteLink);
router.post('/friends/invite-links/redeem', authenticateToken, discussionController.redeemFriendInviteLink);

module.exports = router;
