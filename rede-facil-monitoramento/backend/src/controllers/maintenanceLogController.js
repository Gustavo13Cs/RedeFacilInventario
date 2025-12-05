// src/controllers/maintenanceLogController.js
const maintenanceLogService = require('../services/maintenanceLogService');

// 1. CONTROLLER para GET: Buscar Logs
exports.getLogs = async (req, res) => {
    try {
        const { machineId } = req.params;

        const logs = await maintenanceLogService.getLogsByMachineId(machineId);

        res.status(200).json(logs);
    } catch (error) {
        console.error("❌ Erro ao buscar logs de manutenção:", error);
        res.status(500).json({ 
            message: "Erro interno ao buscar o histórico de manutenção." 
        });
    }
};

// 2. CONTROLLER para POST: Criar Novo Log
exports.createLog = async (req, res) => {
    try {
        const { machineId } = req.params;
        const { description, log_date } = req.body;
        
        // Supondo que o ID do técnico (usuário) está no objeto 'req.user' 
        // após a verificação do token (middleware de autenticação).
        const technicianId = req.user.id; 
        
        if (!description) {
            return res.status(400).json({ message: "A descrição do serviço é obrigatória." });
        }

        await maintenanceLogService.createLog(machineId, description, technicianId, log_date);

        res.status(201).json({ 
            message: "Log de manutenção registrado com sucesso!" 
        });

    } catch (error) {
        console.error("❌ Erro ao criar log de manutenção:", error);
        res.status(500).json({ 
            message: "Erro interno ao registrar a manutenção." 
        });
    }
};