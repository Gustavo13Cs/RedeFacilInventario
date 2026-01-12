const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

router.get('/status', whatsappController.getStatus); 

router.get('/groups', whatsappController.getGroups);
router.post('/test', whatsappController.sendMessageTest);

module.exports = router;