const { db } = require('../config/db');

// ----------------------------------------------------
// SERVIÇO 1: LISTAR ALERTAS (GET /api/alerts)
// ----------------------------------------------------
exports.listAlerts = async (resolved = 'false', limit = 55) => {
    try {
        const is_resolved_bool = resolved.toLowerCase() === 'true';
        
        // Consulta SQL para listar alertas ativos ou resolvidos, unindo com os dados da máquina
        const [alerts] = await db.execute(
            `SELECT 
                a.id, a.alert_type, a.message, a.is_resolved, a.created_at,
                m.uuid, m.hostname
             FROM alerts a
             JOIN machines m ON a.machine_id = m.id
             WHERE a.is_resolved = ?
             ORDER BY a.created_at DESC
             LIMIT ?`,
            [is_resolved_bool, parseInt(limit)]
        );

        return alerts;
    } catch (error) {
        // Loga o erro, mas o Controller lida com o 500
        console.error('❌ Erro no Service (listAlerts):', error.message);
        throw error;
    }
};

// ----------------------------------------------------
// SERVIÇO 2: RESOLVER ALERTA (PUT /api/alerts/:id/resolve)
// ----------------------------------------------------
exports.resolveAlert = async (id) => {
    try {
        // Atualiza a flag is_resolved na tabela alerts
        const [result] = await db.execute(
            `UPDATE alerts SET is_resolved = TRUE WHERE id = ? AND is_resolved = FALSE`,
            [id]
        );

        // Retorna o objeto de resultado com o número de linhas afetadas
        return result;
    } catch (error) {
        console.error('❌ Erro no Service (resolveAlert):', error.message);
        throw error;
    }
};