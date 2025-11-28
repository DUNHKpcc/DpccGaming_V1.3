const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const gameController = require('../controllers/gameController');
const { authenticateToken } = require('../middleware/auth');

const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 400 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype || '';

    if (file.fieldname === 'gameFile') {
      if (ext === '.zip' || mime === 'application/zip' || mime === 'application/x-zip-compressed') {
        return cb(null, true);
      }
      return cb(new Error('只允许上传ZIP游戏文件'), false);
    }

    if (file.fieldname === 'video') {
      if (mime.startsWith('video/')) {
        return cb(null, true);
      }
      return cb(new Error('只允许上传视频文件'), false);
    }

    if (file.fieldname === 'codeArchive') {
      const allowedExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tar.gz'];
      const allowedMimes = [
        'application/zip',
        'application/x-zip-compressed',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/x-tar',
        'application/gzip'
      ];

      const originalName = (file.originalname || '').toLowerCase();
      const isTarGz = originalName.endsWith('.tar.gz');

      if (allowedExts.includes(ext) || allowedMimes.includes(mime) || isTarGz) {
        return cb(null, true);
      }
      return cb(new Error('只允许上传ZIP/TAR/RAR源码压缩包'), false);
    }

    return cb(null, false);
  }
});

router.get('/', gameController.getGamesList);
router.get('/:gameId', gameController.getGameDetail);
router.post('/:gameId/play', gameController.recordGamePlay);

router.get('/:gameId/code', authenticateToken, gameController.getGameCode);
router.get('/:gameId/code.zip', authenticateToken, gameController.downloadGameCode);

router.post(
  '/',
  authenticateToken,
  upload.fields([
    { name: 'gameFile', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'codeArchive', maxCount: 1 }
  ]),
  gameController.uploadGame
);

module.exports = router;
