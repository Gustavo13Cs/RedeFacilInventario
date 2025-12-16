const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financialController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/report', financialController.getReport);
router.post('/price', financialController.updatePrice);

module.exports = router;