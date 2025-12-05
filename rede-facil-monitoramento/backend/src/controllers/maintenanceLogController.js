const maintenanceLogService = require('../services/maintenanceLogService');

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

exports.createLog = async (req, res) => {
    try {
        const { machineId } = req.params;
        const { description, log_date } = req.body;
        
        const technicianId = (req.user && (req.user.id || req.user.userId || req.user.sub)) || null;
        console.log("📝 Tentando criar log:", { machineId, description, technicianId }); 
        
        if (!description) {
            return res.status(400).json({ message: "A descrição do serviço é obrigatória." });
        }

        if (!technicianId) {
             console.warn("⚠️ Aviso: ID do técnico não identificado no token.");
        }

        await maintenanceLogService.createLog(machineId, description, technicianId, log_date);

        res.status(201).json({ 
            message: "Log de manutenção registrado com sucesso!" 
        });

    } catch (error) {
        console.error("❌ Erro ao criar log de manutenção:", error);
        res.status(500).json({ 
            message: "Erro interno ao registrar a manutenção.",
            error: error.message 
        });
    }
};