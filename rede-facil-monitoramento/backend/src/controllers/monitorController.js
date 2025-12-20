const monitorServices = require('../services/monitorServices');
const socketHandler = require('../socket/socketHandler'); 
const commandService = require('../services/commandService');

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
        
        if (!data.uuid || data.cpu_usage_percent === undefined) {
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
                disk_smart_status: data.disk_smart_status || 'OK',
                status: result.calculatedStatus || 'online'
            };
            io.emit('new_telemetry', telemetryPayload);
        } catch (socketError) {
            console.error('⚠️ Erro ao tentar emitir socket:', socketError.message);
        }

        const pendingCommand = commandService.getCommand(data.uuid);
        
        if (pendingCommand) {
            console.log(`📤 ENVIANDO COMANDO [${pendingCommand}] PARA O AGENTE: ${data.uuid}`);
        }
        res.status(200).json({
            message: 'Telemetria processada com sucesso.',
            command: pendingCommand || null 
        });

    } catch (error) {
        console.error('❌ Erro no Controller (processTelemetry):', error.message);
        res.status(500).json({ 
            message: 'Erro interno ao processar telemetria.', 
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

exports.sendCommand = async (req, res) => {
    const { uuid } = req.params;
    const { command } = req.body;

    if (!command) return res.status(400).json({ message: 'Comando obrigatório.' });

    try {

        console.log(`📥 RECEBIDO PEDIDO DE COMANDO:`);
        console.log(`   - Alvo (UUID): [${uuid}]`);
        console.log(`   - Ação: ${command}`);
        
        commandService.addCommand(uuid, command);
        const io = socketHandler.getIO();
        io.emit('command_queued', { machine_uuid: uuid, command });

        console.log(`🔌 Comando [${command}] agendado para ${uuid}`);
        res.json({ message: `Comando enviado! Aguardando agente sincronizar...` });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao processar comando.' });
    }
};

