const express = require('express');
const blueprintController = require('../controllers/blueprintController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, blueprintController.createBlueprint);
router.get('/:seed', authenticateToken, blueprintController.getBlueprintBySeed);
router.put('/:seed', authenticateToken, blueprintController.saveBlueprintBySeed);

module.exports = router;
