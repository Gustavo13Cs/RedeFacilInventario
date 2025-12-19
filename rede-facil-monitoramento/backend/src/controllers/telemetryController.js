const monitorService = require('../services/monitorServices');
const socketHandler = require('../socket/socketHandler'); 
const commandService = require('../services/commandService');

exports.receiveTelemetry = async (req, res) => {
    try {
        const data = req.body;
        
        if (monitorService.processTelemetry) {
            await monitorService.processTelemetry(data);
        }

        try {
            const io = socketHandler.getIO();
            io.emit('new_telemetry', { ...data, machine_uuid: data.uuid }); 
        } catch (e) { console.error("Erro socket:", e.message); }

        const pendingCommand = commandService.getCommand(data.uuid);
        
        if (pendingCommand) {
            console.log(`🚀 ENVIANDO COMANDO ['${pendingCommand}'] PARA O AGENTE: ${data.uuid}`);
            console.log(`🚀 ENTREGANDO COMANDO PARA O AGENTE:`);
            console.log(`   - Agente solicitante: [${data.uuid}]`);
            console.log(`   - Comando enviado: ${pendingCommand}`);
        } 
        res.status(200).json({ 
            message: 'ok', 
            command: pendingCommand || null 
        });

    } catch (error) {
        console.error("Erro no controller:", error.message);
        res.status(500).json({ error: 'Erro interno' });
    }
};