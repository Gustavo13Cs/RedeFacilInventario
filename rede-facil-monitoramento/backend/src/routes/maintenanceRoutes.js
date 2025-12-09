const express = require('express');
const router = express.Router();
const maintenanceLogController = require('../controllers/maintenanceLogController');
// const authMiddleware = require('../middleware/auth'); <--- REMOVIDO!

// router.use(authMiddleware); <--- REMOVIDO!

router.route('/machines/:machineId/logs')
    .get(maintenanceLogController.getLogs) 
    .post(maintenanceLogController.createLog); 

module.exports = router;