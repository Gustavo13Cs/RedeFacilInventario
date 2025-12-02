// ./routes/monitorRoutes.js

const express = require('express');
const router = express.Router();

// A ÚNICA CONDIÇÃO PARA FUNCIONAR: monitorController.js PRECISA existir
// e exportar as funções necessárias.
const monitorController = require('../controllers/monitorController');

// -----------------------------------------------------------------
// ENDPOINTS DE API
// -----------------------------------------------------------------

// Rota de Registro/Atualização de Máquinas (POST)
router.post('/register', monitorController.registerMachine);

// Rota de Ingestão de Telemetria (POST)
router.post('/telemetry', monitorController.processTelemetry);

// Rota de Consulta de Máquinas (GET)
router.get('/machines', monitorController.listMachines);

// Rota de Detalhes de uma Máquina Específica (GET)
router.get('/machines/:uuid', monitorController.getMachineDetails);

// Rota de Histórico de Telemetria (GET)
router.get('/telemetry/:uuid/history', monitorController.getTelemetryHistory);

module.exports = router;