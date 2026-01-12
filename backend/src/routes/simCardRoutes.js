const express = require('express');
const router = express.Router();
const controller = require('../controllers/simCardController');

router.get('/', controller.listSimCards);
router.post('/', controller.createSimCard);
router.put('/:id', controller.updateSimCard);
router.delete('/:id', controller.deleteSimCard);

router.get('/devices', controller.listDevices);
router.get('/devices/:id/logs', controller.getDeviceLogs);
router.post('/devices', controller.createDevice);
router.delete('/devices/:id', controller.deleteDevice);

router.get('/employees', controller.listEmployees);
router.post('/employees', controller.createEmployee);
router.put('/employees/:id', controller.updateEmployee);
router.delete('/employees/:id', controller.deleteEmployee);

module.exports = router;