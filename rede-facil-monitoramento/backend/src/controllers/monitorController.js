const monitorServices = require('../services/monitorServices');
const socketHandler = require('../socket/socketHandler'); 

exports.registerMachine = async (req, res) => {
    try {
        const data = req.body;
        
        if (!data.uuid || !data.hostname) {
            return res.status(400).json({ message: 'UUID e hostname são obrigatórios para o registro.' });
        }

        const result = await monitorServices.registerMachine(data);

        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Erro no Controller (registerMachine):', error.message);
        res.status(500).json({ 
            message: 'Erro interno ao processar o registro da máquina.', 
            error: error.message 
        });
    }
};

exports.processTelemetry = async (req, res) => { 
    try {
        const data = req.body;
        
        if (!data.uuid || data.cpu_usage_percent === undefined || data.ram_usage_percent === undefined) {
             return res.status(400).json({ message: 'Dados de telemetria incompletos.' });
        }

        const result = await monitorServices.processTelemetry(data);
        
        try {
            const io = socketHandler.getIO();
            
            const telemetryPayload = {
                machine_uuid: data.uuid, 
                cpu_usage_percent: data.cpu_usage_percent,
                ram_usage_percent: data.ram_usage_percent,
                temperature_celsius: data.temperature_celsius,

                disk_free_percent: data.disk_free_percent,
                disk_smart_status: data.disk_smart_status || 'OK'
            };

            io.emit('new_telemetry', telemetryPayload);
        } catch (socketError) {
            console.error('⚠️ Erro ao tentar emitir socket:', socketError.message);
        }


        res.status(200).json(result);
    } catch (error) {
        console.error('❌ Erro no Controller (processTelemetry):', error.message);
        res.status(500).json({ 
            message: 'Erro interno ao processar telemetria. Verifique se a máquina foi registrada.', 
            error: error.message 
        });
    }
};

exports.listMachines = async (req, res) => {
    try {
        const machines = await monitorServices.listMachines();
        res.json(machines);
    } catch (error) {
        console.error('❌ Erro no Controller (listMachines):', error.message);
        res.status(500).json({ message: 'Erro ao buscar lista de máquinas.', error: error.message });
    }
};

exports.getMachineDetails = async (req, res) => {
    const { uuid } = req.params;
    try {
        const details = await monitorServices.getMachineDetails(uuid);
        
        if (!details) {
            return res.status(404).json({ message: 'Máquina não encontrada.' });
        }

        res.json(details);
    } catch (error) {
        console.error('❌ Erro no Controller (getMachineDetails):', error.message);
        res.status(500).json({ message: 'Erro ao buscar detalhes da máquina.', error: error.message });
    }
};

exports.getTelemetryHistory = async (req, res) => {
    const { uuid } = req.params;
    const { limit } = req.query; 

    try {
        const history = await monitorServices.getTelemetryHistory(uuid, limit);
        
        if (!history || history.length === 0) {
            return res.status(404).json({ message: 'Nenhum histórico de telemetria encontrado.' });
        }

        res.json(history);
    } catch (error) {
        console.error('❌ Erro no Controller (getTelemetryHistory):', error.message);
        res.status(500).json({ message: 'Erro ao buscar histórico de telemetria.', error: error.message });
    }
};