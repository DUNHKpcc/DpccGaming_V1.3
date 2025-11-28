const express = require('express');
const router = express.Router();

// 导入控制器
const aiController = require('../controllers/aiController');

// AI代码助手路由
router.post('/code-assistant', aiController.codeAssistant);

module.exports = router;