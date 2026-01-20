const monitorService = require('../services/monitorServices');
const socketHandler = require('../socket/socketHandler'); 
const commandService = require('../services/commandService');
const pool = require('../config/db');

exports.receiveTelemetry = async (req, res) => {
    try {
        const data = req.body;
        
        if (monitorService.processTelemetry) {
            await monitorService.processTelemetry(data);
        }

        try {
            const io = socketHandler.getIO();
            
            io.emit('new_telemetry', { 
                ...data, 
                machine_uuid: data.machine_uuid || data.uuid 
            }); 
            
        } catch (e) { console.error("Erro socket:", e.message); }

        const pendingCommand = commandService.getCommand(data.machine_uuid || data.uuid);
        
        if (pendingCommand) {
            console.log(`🚀 COMANDO ENVIADO PARA AGENTE: ${data.machine_uuid}`);
        } 
        
        res.status(200).json({ 
            message: 'ok', 
            command: pendingCommand ? pendingCommand.command : null,
            payload: pendingCommand ? pendingCommand.payload : null
        });

    } catch (error) {
        console.error("Erro no controller:", error.message);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.storeNetworkLog = async (req, res) => {
    const { machine_uuid, target, latency_ms, packet_loss } = req.body;

    if (!machine_uuid) {
        return res.status(400).json({ error: 'UUID faltando' });
    }

    try {
        try {
            const io = socketHandler.getIO();
            io.emit('network_update', req.body);
        } catch (e) { console.error("Erro socket network:", e.message); }

        await pool.query(
            `INSERT INTO network_logs (machine_uuid, target, latency_ms, packet_loss) 
             VALUES ($1, $2, $3, $4)`,
            [machine_uuid, target, latency_ms, packet_loss]
        );

        res.json({ status: 'saved' });
    } catch (error) {
        console.error("Erro ao salvar log de rede:", error.message);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.getNetworkHistory = async (req, res) => {
    const { uuid } = req.params;
    try {
        const result = await pool.query(
            `SELECT created_at, latency_ms, packet_loss, target 
             FROM network_logs 
             WHERE machine_uuid = $1 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [uuid]
        );
        res.json(result.rows.reverse());
    } catch (error) {
        console.error("Erro ao buscar histórico:", error.message);
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
};