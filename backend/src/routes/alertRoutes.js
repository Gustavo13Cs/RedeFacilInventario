const express = require('express');
const router = express.Router();

const alertController = require('../controllers/alertController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);


router.get('/', alertController.listAlerts);

router.put('/:id/resolve', alertController.resolveAlert);

module.exports = router;