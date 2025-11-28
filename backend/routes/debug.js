const express = require('express');
const router = express.Router();

const debugController = require('../controllers/debugController');
const { authenticateToken, checkAdminPermission } = require('../middleware/auth');

router.get('/fix-code-urls', authenticateToken, checkAdminPermission, debugController.fixCodePackageUrls);
router.get('/games', debugController.listRecentGames);

module.exports = router;
