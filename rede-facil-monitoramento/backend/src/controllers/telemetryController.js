const monitorServices = require('../services/monitorServices');

exports.receiveTelemetry = async (req, res) => {
    try {
        const data = req.body;
        await monitorServices.processTelemetry(data);
        res.status(200).json({ message: 'Dados recebidos com sucesso' });
    } catch (error) {
        console.error('Erro ao processar telemetria:', error);
        res.status(500).json({ message: 'Erro interno ao processar dados' });
    }
};