const express = require('express');
const router = express.Router();
const controller = require('../controllers/supportController');
const auth = require('../middleware/auth'); 
const agentAuth = require('../middleware/agentAuth'); 

router.post('/request', agentAuth, controller.requestSupport);

router.get('/', auth, controller.listRequests);
router.put('/:id/resolve', auth, controller.resolveRequest);

module.exports = router;