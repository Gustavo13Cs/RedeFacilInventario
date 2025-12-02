const monitorServices = require('../services/monitorServices');

// ----------------------------------------------------
// ROTAS DO AGENTE (INGESTÃO)
// ----------------------------------------------------

// ROTA 1: Registro/Atualização de Máquinas (POST /api/machines/register)
// Recebe os dados de inventário do Agente Go
exports.registerMachine = async (req, res) => {
    try {
        const data = req.body;
        
        // Validação de entrada básica (UUID e hostname são cruciais)
        if (!data.uuid || !data.hostname) {
            return res.status(400).json({ message: 'UUID e hostname são obrigatórios para o registro.' });
        }

        // Chama o Service para persistir os dados (incluindo transações)
        const result = await monitorServices.registerMachine(data);

        // Retorna 201 Created se o registro/atualização foi bem-sucedido
        res.status(201).json(result);
    } catch (error) {
        // Loga o erro detalhado e retorna 500
        console.error('❌ Erro no Controller (registerMachine):', error.message);
        res.status(500).json({ 
            message: 'Erro interno ao processar o registro da máquina.', 
            error: error.message 
        });
    }
};

// ROTA 2: Ingestão de Telemetria (POST /api/telemetry)
// O nome da exportação foi CORRIGIDO para processTelemetry
exports.processTelemetry = async (req, res) => { // <-- CORRIGIDO AQUI
    try {
        const data = req.body;
        
        // Validação de entrada básica
        if (!data.uuid || data.cpu_usage_percent === undefined || data.ram_usage_percent === undefined) {
             return res.status(400).json({ message: 'Dados de telemetria incompletos.' });
        }

        // Chama o Service para salvar no DB, verificar alertas e emitir via Socket.io
        const result = await monitorServices.processTelemetry(data);
        
        // Retorna 200 OK
        res.status(200).json(result);
    } catch (error) {
        // Se a máquina não existir, o service deve lançar um erro capturável (como 404),
        // mas tratamos o erro genérico como 500 aqui para robustez.
        console.error('❌ Erro no Controller (processTelemetry):', error.message);
        res.status(500).json({ 
            message: 'Erro interno ao processar telemetria. Verifique se a máquina foi registrada.', 
            error: error.message 
        });
    }
};

// ----------------------------------------------------
// ROTAS DO DASHBOARD (CONSULTA)
// ----------------------------------------------------

// ROTA 3: Listar Máquinas (GET /api/machines)
// Retorna a lista de inventário básica para o dashboard
exports.listMachines = async (req, res) => {
    try {
        const machines = await monitorServices.listMachines();
        res.json(machines);
    } catch (error) {
        console.error('❌ Erro no Controller (listMachines):', error.message);
        res.status(500).json({ message: 'Erro ao buscar lista de máquinas.', error: error.message });
    }
};

// ROTA 4: Detalhes da Máquina (GET /api/machines/:uuid)
// Retorna detalhes completos: hardware, software, última telemetria, e alertas abertos
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

// ROTA 5: Histórico de Telemetria (GET /api/telemetry/:uuid/history)
// Retorna o histórico de performance (usado para gráficos)
exports.getTelemetryHistory = async (req, res) => {
    const { uuid } = req.params;
    const { limit } = req.query; // Permite que o Dashboard defina o limite de registros

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