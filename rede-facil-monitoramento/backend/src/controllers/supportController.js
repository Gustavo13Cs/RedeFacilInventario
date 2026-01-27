const { db } = require('../config/db');
const socketHandler = require('../socket/socketHandler');

exports.requestSupport = async (req, res) => {
    try {
        const { uuid } = req.body; 
        const [machines] = await db.execute('SELECT id, hostname, ip_address FROM machines WHERE uuid = ?', [uuid]);
        
        if (machines.length === 0) {
            return res.status(404).json({ error: 'Máquina não encontrada' });
        }

        const machine = machines[0];
        const [existing] = await db.execute(
            "SELECT id FROM support_requests WHERE machine_id = ? AND status != 'resolved'", 
            [machine.id]
        );

        if (existing.length > 0) {
            return res.status(200).json({ message: 'Já existe um chamado aberto.' });
        }

        const [result] = await db.execute(
            "INSERT INTO support_requests (machine_id) VALUES (?)",
            [machine.id]
        );

        const io = socketHandler.getIO();
        if (io) {
            io.emit('support_alert', {
                id: result.insertId,
                machine_name: machine.hostname,
                ip: machine.ip_address,
                created_at: new Date()
            });
        }

        res.json({ success: true });

    } catch (error) {
        console.error("Erro no suporte:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.listRequests = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT s.*, m.hostname, m.ip_address, m.sector 
            FROM support_requests s
            JOIN machines m ON s.machine_id = m.id
            ORDER BY s.status ASC, s.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar' });
    }
};

exports.resolveRequest = async (req, res) => {
    const { id } = req.params;
    await db.execute("UPDATE support_requests SET status = 'resolved', resolved_at = NOW() WHERE id = ?", [id]);
    res.json({ success: true });
};