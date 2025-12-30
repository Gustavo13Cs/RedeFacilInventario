const { db } = require('../config/db');

exports.listAlerts = async (resolved = 'false', limit = 55) => {
    try {

        const safeLimit = parseInt(limit) || 50;

        const query = `
            SELECT 
                a.id, a.alert_type, a.message, a.is_resolved, a.created_at,
                m.uuid, m.hostname
            FROM alerts a
            JOIN machines m ON a.machine_id = m.id
            WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY a.created_at DESC
            LIMIT ${safeLimit}
        `;

        const [alerts] = await db.execute(query);
        return alerts;
    } catch (error) {
        console.error('❌ Erro no Service (listAlerts):', error.message);
        throw error;
    }
};

exports.resolveAlert = async (id) => {
    try {
        const [result] = await db.execute(
            `UPDATE alerts SET is_resolved = TRUE WHERE id = ?`,
            [id]
        );
        return result;
    } catch (error) {
        console.error('❌ Erro no Service (resolveAlert):', error.message);
        throw error;
    }
};