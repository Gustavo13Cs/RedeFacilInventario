const express = require('express');
const router = express.Router();
const CredentialController = require('../controllers/CredentialController');
const authMiddleware = require('../middleware/auth'); 
const adminMiddleware = require('../middleware/admin'); 

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', CredentialController.index);
router.post('/', CredentialController.store);
router.get('/:id/reveal', CredentialController.reveal); 
router.delete('/:id', CredentialController.delete);

module.exports = router;