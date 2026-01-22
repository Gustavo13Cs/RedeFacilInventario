const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth'); 
const agentAuth = require('../middleware/agentAuth'); 
const monitorController = require('../controllers/monitorController');


router.post('/register', agentAuth, monitorController.registerMachine);
router.post('/telemetry', agentAuth, monitorController.processTelemetry);
router.post('/machines/:uuid/command-result', agentAuth, monitorController.receiveCommandResult);

router.use(authMiddleware); 

router.put('/machines/:uuid/sector', monitorController.updateSector);
router.get('/machines', monitorController.listMachines);
router.get('/machines/:uuid', monitorController.getMachineDetails);
router.get('/telemetry/:uuid/history', monitorController.getTelemetryHistory);
router.get('/topology', monitorController.getTopology);
router.post('/machines/:uuid/command', monitorController.sendCommand);

module.exports = router;