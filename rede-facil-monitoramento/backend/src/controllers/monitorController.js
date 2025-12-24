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
        
        if (!data.machine_uuid || data.cpu_usage_percent === undefined) {
             return res.status(400).json({ message: 'Dados de telemetria incompletos.' });
        }

        const result = await monitorServices.processTelemetry(data);
        
        try {
            const io = socketHandler.getIO();
            
            const telemetryPayload = {
                ...data, 
                status: 'online'
            };
            
            console.log(`📡 Socket enviado para ${data.machine_uuid} | CPU: ${data.cpu_usage_percent}%`);
            
            io.emit('new_telemetry', telemetryPayload);
            
        } catch (socketError) {
            console.error('⚠️ Erro ao tentar emitir socket:', socketError.message);
        }

        const pendingData = commandService.getCommand(data.machine_uuid);
        let commandToSend = null;
        let payloadToSend = null;
        
        if (pendingData) {
            if (typeof pendingData === 'object') {
                commandToSend = pendingData.command;
                payloadToSend = pendingData.payload || null;
            } else {
                commandToSend = pendingData;
            }
            console.log(`📤 ENVIANDO COMANDO [${commandToSend}] PARA O AGENTE: ${data.machine_uuid}`);
        }

        res.status(200).json({
            message: 'Telemetria processada.',
            command: commandToSend || null,
            payload: payloadToSend || null 
        });

    } catch (error) {
        console.error('❌ Erro no processTelemetry:', error.message);
        res.status(500).json({ error: 'Erro interno' });
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
    const { command, payload } = req.body; 

    if (!command) return res.status(400).json({ message: 'Comando obrigatório.' });

    try {
        console.log(`📥 RECEBIDO PEDIDO DE COMANDO PARA [${uuid}]: ${command}`);
        commandService.addCommand(uuid, { command, payload });
        
        const io = socketHandler.getIO();
        io.emit('command_queued', { machine_uuid: uuid, command });

        res.json({ message: `Comando enviado! Aguardando agente...` });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao processar comando.' });
    }
};

exports.getTopology = async (req, res) => {
    try {
        const map = await monitorServices.getTopology();
        res.json(map);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao gerar topologia' });
    }
};


exports.receiveCommandResult = async (req, res) => {
    try {
        const { uuid } = req.params; 
        const { output, error } = req.body; 

        console.log(`📝 RESPOSTA DO AGENTE [${uuid}]:`);
        
        const cleanOutput = output || "Comando executado sem retorno de texto.";
        const cleanError = error || null;

        const io = socketHandler.getIO();
        
        io.emit('command_output', { 
            machine_uuid: uuid, 
            output: cleanOutput, 
            error: cleanError 
        });

        res.status(200).json({ message: 'Output recebido e processado' });
    } catch (err) {
        console.error("Erro ao processar output:", err);
        res.status(500).json({ message: 'Erro interno' });
    }
};