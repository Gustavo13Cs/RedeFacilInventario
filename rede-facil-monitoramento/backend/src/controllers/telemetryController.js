const monitorService = require('../services/monitorServices');
const socketHandler = require('../socket/socketHandler'); 
const commandService = require('../services/commandService');
const { db } = require('../config/db'); 

exports.receiveTelemetry = async (req, res) => {
    try {
        const data = req.body;
        
        if (monitorService.processTelemetry) {
            await monitorService.processTelemetry(data);
        }

        try {
            const io = socketHandler.getIO();
            if (io) {
                io.emit('new_telemetry', { 
                    ...data, 
                    machine_uuid: data.machine_uuid || data.uuid 
                }); 
            }
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
            if (io) io.emit('network_update', req.body);
        } catch (e) { console.error("Erro socket network:", e.message); }

        await db.execute(
            `INSERT INTO network_logs (machine_uuid, target, latency_ms, packet_loss) 
             VALUES (?, ?, ?, ?)`,
            [machine_uuid, target, latency_ms, packet_loss]
        );

        await db.execute(`
            DELETE FROM network_logs 
            WHERE machine_uuid = ? 
            AND id NOT IN (
                SELECT id FROM (
                    SELECT id 
                    FROM network_logs 
                    WHERE machine_uuid = ? 
                    ORDER BY created_at DESC 
                    LIMIT 60
                ) AS keep_latest
            )
        `, [machine_uuid, machine_uuid]);

        res.json({ status: 'saved_and_cleaned' });
    } catch (error) {
        console.error("Erro ao salvar log de rede:", error.message);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.getNetworkHistory = async (req, res) => {
    const { uuid } = req.params;
    try {
        const [rows] = await db.execute(
            `SELECT created_at, latency_ms, packet_loss, target 
             FROM network_logs 
             WHERE machine_uuid = ? 
             ORDER BY created_at DESC 
             LIMIT 100`,
            [uuid]
        );
        
        res.json(rows.reverse());
    } catch (error) {
        console.error("Erro ao buscar histórico:", error.message);
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
};