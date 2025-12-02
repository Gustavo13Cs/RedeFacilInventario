const monitorService = require('../services/monitorServices');
const socketHandler = require('../socket/socketHandler'); 

exports.receiveTelemetry = async (req, res) => {
    try {
        const data = req.body;
        
        console.log(`📥 Recebido HTTP [${data.hostname}]: CPU ${data.cpu_usage_percent}%`);

        if (monitorService.processTelemetry) {
            await monitorService.processTelemetry(data);
        }

        try {
            const io = socketHandler.getIO();
            const socketPayload = {
                ...data, 
                machine_uuid: data.uuid, 
                timestamp: new Date()
            };

            io.emit('new_telemetry', socketPayload); 
        } catch (socketError) {
            console.error("⚠️ Erro ao emitir socket:", socketError.message);
        }

        res.status(200).json({ message: 'ok' });
    } catch (error) {
        console.error("❌ Erro no controller:", error.message);
        res.status(500).json({ error: 'Erro interno' });
    }
};