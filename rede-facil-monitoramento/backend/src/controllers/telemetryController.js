const monitorService = require('../services/monitorServices');

exports.receiveTelemetry = async (req, res) => {
    const data = req.body;
    console.log("📊 Telemetria:", data);
    
    if (monitorService.processTelemetry) {
        await monitorService.processTelemetry(data);
    }
    res.status(200).json({ message: 'ok' });
};