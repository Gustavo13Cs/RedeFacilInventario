const monitorServices = require('../services/monitorServices');

exports.receiveTelemetry = async (req, res) => {
    const data = req.body;
    console.log("📊 Telemetria:", data);
    
    if (monitorServices.processTelemetry) {
        await monitorServices.processTelemetry(data);
    }
    res.status(200).json({ message: 'ok' });
};