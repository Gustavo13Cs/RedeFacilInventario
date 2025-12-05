// src/routes/maintenanceRoutes.js (Exemplo)
const express = require('express');
const router = express.Router();
const maintenanceLogController = require('../controllers/maintenanceLogController');
const authMiddleware = require('../middleware/auth'); // Middleware de autenticação

// Aplica autenticação a todas as rotas de manutenção
router.use(authMiddleware);

// Rota para GET e POST no logbook da máquina
router.route('/machines/:machineId/logs')
    .get(maintenanceLogController.getLogs)     // Busca todos os logs
    .post(maintenanceLogController.createLog);  // Cria um novo log

module.exports = router;

// Lembre-se de importar e usar este router no seu 'src/server.js'
// app.use('/api', maintenanceRoutes);