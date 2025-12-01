const express = require('express');
const router = express.Router();
const machineController = require('../controllers/machineController');
const alertController = require('../controllers/alertController');

// ROTA 1: Registro/Atualização de Máquinas
router.post('/machines/register', machineController.registerMachine);

// ROTA 2: Ingestão de Telemetria
router.post('/telemetry', machineController.ingestTelemetry);

// ROTA 3: Listar Máquinas
router.get('/machines', machineController.listMachines);

// ROTA 4: Detalhes da Máquina
router.get('/machines/:uuid', machineController.getMachineDetails);

// ROTA 5: Histórico de Telemetria
router.get('/telemetry/:uuid/history', machineController.getTelemetryHistory);

// ROTA 6: Listar Alertas
router.get('/alerts', alertController.listAlerts);

// ROTA 7: Resolver Alerta
router.put('/alerts/:id/resolve', alertController.resolveAlert);

module.exports = router;