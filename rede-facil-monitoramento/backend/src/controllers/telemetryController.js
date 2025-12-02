const monitorService = require('../services/monitorServices');
const socketHandler = require('../socket/socketHandler'); 
exports.receiveTelemetry = async (req, res) => {
    try {
        const data = req.body;
        
        console.log(`📊 Dados recebidos da máquina: ${data.hostname} (${data.cpu_usage_percent}%)`);

        if (monitorService.processTelemetry) {
            await monitorService.processTelemetry(data);
        }

        const io = socketHandler.getIO();
        io.emit('new_telemetry', data); 

        res.status(200).json({ message: 'Dados recebidos e sincronizados' });
    } catch (error) {
        console.error("Erro ao processar telemetria:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
};