const { db } = require('../config/db');

// ROTA 6: LISTAR ALERTAS (GET /api/alerts)
exports.listAlerts = async (req, res) => {
    // ... (A lógica de DB da ROTA 6 vai aqui)
    const { resolved = 'false', limit = 55 } = req.query; 

    try {
        const is_resolved_bool = resolved.toLowerCase() === 'true';
        const [alerts] = await db.execute(
            `SELECT a.id, a.alert_type, a.message, a.is_resolved, a.created_at, m.uuid, m.hostname
             FROM alerts a
             JOIN machines m ON a.machine_id = m.id
             WHERE a.is_resolved = ?
             ORDER BY a.created_at DESC
             LIMIT ?`,
            [is_resolved_bool, parseInt(limit)]
        );

        res.json(alerts);
    } catch (error) {
        console.error('❌ Erro ao buscar alertas:', error.message);
        res.status(500).json({ message: 'Erro ao buscar lista de alertas.', error: error.message });
    }
};

// ROTA 7: RESOLVER ALERTA (PUT /api/alerts/:id/resolve)
exports.resolveAlert = async (req, res) => {
    // ... (A lógica de DB da ROTA 7 vai aqui)
    const { id } = req.params;

    try {
        const [result] = await db.execute(
            `UPDATE alerts SET is_resolved = TRUE WHERE id = ? AND is_resolved = FALSE`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Alerta não encontrado ou já resolvido.' });
        }

        res.json({ message: `Alerta ${id} resolvido com sucesso.` });
    } catch (error) {
        console.error('❌ Erro ao resolver alerta:', error.message);
        res.status(500).json({ message: 'Erro ao tentar resolver o alerta.', error: error.message });
    }
};