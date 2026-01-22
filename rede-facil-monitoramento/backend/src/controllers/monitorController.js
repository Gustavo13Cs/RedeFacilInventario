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
        res.status(500).json({ 
            message: 'Erro interno ao processar o registro da máquina.', 
            error: error.message 
        });
    }
};

exports.processTelemetry = async (req, res) => { 
    try {
        const data = req.body;
        const machineUuid = data.machine_uuid || data.uuid;

        if (!data.machine_uuid || data.cpu_usage_percent === undefined) {
             return res.status(400).json({ message: 'Dados de telemetria incompletos.' });
        }


        const result = await monitorServices.processTelemetry(data);
        
       try {
            const io = socketHandler.getIO();
            const telemetryPayload = { ...data, machine_uuid: machineUuid, status: 'online' };
            io.emit('new_telemetry', telemetryPayload);
        } catch (socketError) {
            console.error('⚠️ Erro Socket:', socketError.message);
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
        }

        res.status(200).json({
            message: 'Telemetria processada.',
            command: commandToSend || null,
            payload: payloadToSend || null 
        });

    } catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.listMachines = async (req, res) => {
    try {
        const machines = await monitorServices.listMachines();
        res.json(machines);
    } catch (error) {
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
        res.status(500).json({ message: 'Erro ao buscar histórico de telemetria.', error: error.message });
    }
};

exports.sendCommand = async (req, res) => {
    const { uuid } = req.params;
    const { command, payload } = req.body; 

    try {
       if (command === 'enable_auto_shutdown' || command === 'disable_auto_shutdown') {
    const isEnabled = command === 'enable_auto_shutdown';
    
    // 1. Salva no Banco de Dados
    await monitorServices.updateAutoShutdownStatus(uuid, isEnabled);
    
    // 2. Avisa o Frontend para mudar a cor do botão na hora
    const io = socketHandler.getIO();
    io.emit('machine_status_update', { 
        machine_uuid: uuid, 
        auto_shutdown_enabled: isEnabled 
    });
}

        commandService.addCommand(uuid, { command, payload });
        res.json({ message: `Comando enviado com sucesso!` });
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


exports.updateSector = async (req, res) => {
    const { uuid } = req.params;
    const { sector } = req.body;

    try {
        console.log(`📝 Atualizando setor da máquina ${uuid} para: ${sector}`);

        const updated = await monitorServices.updateMachineSector(uuid, sector);

        if (!updated) {
            return res.status(404).json({ message: 'Máquina não encontrada ou setor já é o mesmo.' });
        }

        return res.status(200).json({ message: 'Setor atualizado com sucesso!' });

    } catch (error) {
        console.error('❌ Erro no Controller (updateSector):', error.message);
        return res.status(500).json({ message: 'Erro interno ao atualizar setor.' });
    }
};