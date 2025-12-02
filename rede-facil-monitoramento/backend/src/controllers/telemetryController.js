const monitorService = require('../services/monitorServices');
const socketHandler = require('../socket/socketHandler'); 

exports.receiveTelemetry = async (req, res) => {
    try {
        const data = req.body;
        
        if (monitorService.processTelemetry) {
            await monitorService.processTelemetry(data);
        }
        try {
            const io = socketHandler.getIO();
            
            const socketPayload = {
                ...data, 
                machine_uuid: data.uuid || data.machine_uuid, 
                timestamp: new Date()
            };

            io.emit('new_telemetry', socketPayload); 
            console.log(`📡 Socket emitido para máquina: ${socketPayload.machine_uuid}`);
        } catch (socketError) {
            console.error("⚠️ Erro ao emitir socket:", socketError.message);
        }

        res.status(200).json({ message: 'ok' });
    } catch (error) {
        console.error("Erro no controller de telemetria:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
};