const express = require('express');
const router = express.Router();

const controller = require('../controllers/telemetryController'); 

router.post('/', controller.receiveTelemetry);

module.exports = router;