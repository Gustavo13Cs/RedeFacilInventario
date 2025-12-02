const monitorService = require('../services/monitorServices');
const socketHandler = require('../socket/socketHandler'); 

exports.receiveTelemetry = async (req, res) => {
    try {
        const data = req.body;
        console.log(`📊 Dados recebidos de: ${data.hostname || data.machine_uuid}`);

        if (monitorService.processTelemetry) {
            await monitorService.processTelemetry(data);
        }
        try {
            const io = socketHandler.getIO();
            io.emit('new_telemetry', data); 
            console.log("📡 Evento 'new_telemetry' enviado para o frontend");
        } catch (socketError) {
            console.error("⚠️ Erro ao emitir socket:", socketError.message);
        }

        res.status(200).json({ message: 'ok' });
    } catch (error) {
        console.error("Erro no controller:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
};