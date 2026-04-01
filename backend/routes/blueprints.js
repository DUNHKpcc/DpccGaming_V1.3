const express = require('express');
const blueprintController = require('../controllers/blueprintController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, blueprintController.createBlueprint);
router.post('/plan', authenticateToken, blueprintController.planBlueprintWorkflow);
router.post('/execute', authenticateToken, blueprintController.executeBlueprintWorkflow);
router.get('/recent', authenticateToken, blueprintController.listRecentBlueprints);
router.get('/runs', authenticateToken, blueprintController.listBlueprintRuns);
router.get('/runs/:runId', authenticateToken, blueprintController.getBlueprintRunDetail);
router.post('/runs/:runId/cancel', authenticateToken, blueprintController.cancelBlueprintRun);
router.get('/:seed', authenticateToken, blueprintController.getBlueprintBySeed);
router.put('/:seed', authenticateToken, blueprintController.saveBlueprintBySeed);

module.exports = router;
