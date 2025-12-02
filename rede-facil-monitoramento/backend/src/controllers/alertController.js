const alertServices = require('../services/alertServices'); // Crie este Service

// ROTA 6: Listar Alertas (GET /api/alerts)
exports.listAlerts = async (req, res) => {
    const { resolved = 'false', limit = 55 } = req.query; 

    try {
        const alerts = await alertServices.listAlerts(resolved, limit);
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar lista de alertas.', error: error.message });
    }
};

// ROTA 7: Resolver Alerta (PUT /api/alerts/:id/resolve)
exports.resolveAlert = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await alertServices.resolveAlert(id);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Alerta não encontrado ou já resolvido.' });
        }
        res.json({ message: `Alerta ${id} resolvido com sucesso.` });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao tentar resolver o alerta.', error: error.message });
    }
};