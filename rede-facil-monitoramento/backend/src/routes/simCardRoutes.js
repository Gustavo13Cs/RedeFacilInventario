const express = require('express');
const router = express.Router();
const controller = require('../controllers/simCardController');

router.get('/', controller.listSimCards);
router.post('/', controller.createSimCard);
router.put('/:id', controller.updateSimCard);
router.delete('/:id', controller.deleteSimCard);

module.exports = router;