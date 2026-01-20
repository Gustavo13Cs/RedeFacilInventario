const express = require('express');
const router = express.Router();

const controller = require('../controllers/telemetryController'); 

router.post('/', controller.receiveTelemetry);
router.post('/network', controller.storeNetworkLog);

router.get('/network/:uuid', controller.getNetworkHistory);


module.exports = router;