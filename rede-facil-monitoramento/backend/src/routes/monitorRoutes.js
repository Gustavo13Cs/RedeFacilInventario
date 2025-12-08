const express = require('express');
const router = express.Router();


const monitorController = require('../controllers/monitorController');


router.post('/register', monitorController.registerMachine);

router.post('/telemetry', monitorController.processTelemetry);


router.get('/machines', monitorController.listMachines);

router.get('/machines/:uuid', monitorController.getMachineDetails);

router.get('/telemetry/:uuid/history', monitorController.getTelemetryHistory);

module.exports = router;