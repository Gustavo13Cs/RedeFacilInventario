const express = require('express');
const router = express.Router();

// Importa o middleware de autenticação
const authMiddleware = require('../middleware/auth'); 

const monitorController = require('../controllers/monitorController');


// ===============================================
// 1. ROTAS PÚBLICAS (AGENTE GO) 🔓
//    Estas rotas são acessíveis sem token de autenticação.
// ===============================================

// Rota de Registro de Máquina (PÚBLICA) - O Agente precisa dela para obter o token.
router.post('/register', monitorController.registerMachine);

// Rota de Telemetria (PÚBLICA) - O Agente envia dados brutos aqui.
router.post('/telemetry', monitorController.processTelemetry);


// ===============================================
// 2. ROTAS PROTEGIDAS (DASHBOARD) 🔒
//    Tudo a partir daqui requer autenticação (JWT).
// ===============================================

// 🚨 Aplica o middleware de autenticação SOMENTE a partir deste ponto.
router.use(authMiddleware); 


// Rotas de listagem e detalhes (PROTEGIDAS - Dashboard)
router.get('/machines', monitorController.listMachines);

router.get('/machines/:uuid', monitorController.getMachineDetails);

router.get('/telemetry/:uuid/history', monitorController.getTelemetryHistory);

module.exports = router;