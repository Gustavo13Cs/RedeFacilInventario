const monitorService = require('../services/monitorService');
const { db, getMachineId } = require('../config/db'); // db só para consultas diretas

// ROTA 1: REGISTRO/ATUALIZAÇÃO DE MÁQUINAS
exports.registerMachine = async (req, res) => {
    const data = req.body;
    
    // Validação (deve ficar no Controller ou Middleware)
    if (!data.uuid || !data.hostname) {
        return res.status(400).json({ message: 'UUID e hostname são obrigatórios.' });
    }

    try {
        const machine_id = await monitorService.registerOrUpdateMachine(data);
        res.status(201).json({ message: 'Máquina registrada/atualizada com sucesso', machine_id });
    } catch (error) {
        console.error('❌ Erro no registro/atualização da máquina:', error.message);
        res.status(500).json({ message: 'Erro ao processar o registro da máquina.', error: error.message });
    }
};

// ROTA 2: INGESTÃO E PROCESSAMENTO DE TELEMETRIA
exports.ingestTelemetry = async (req, res) => {
    const data = req.body;

    // Validação
    if (!data.uuid || data.cpu_usage_percent === undefined || data.ram_usage_percent === undefined || data.disk_free_percent === undefined) {
        return res.status(400).json({ message: 'Dados de telemetria incompletos.' });
    }

    try {
        await monitorService.processTelemetry(data);
        res.status(200).send('Dados de telemetria recebidos e processados');
    } catch (error) {
        if (error.message.includes('Máquina não encontrada')) {
             return res.status(404).json({ message: 'Máquina não encontrada. Registre-a primeiro.' });
        }
        console.error('❌ Erro ao processar telemetria:', error.message);
        res.status(500).json({ message: 'Erro interno ao processar os dados de telemetria.', error: error.message });
    }
};

// ROTA 3: LISTAR TODAS AS MÁQUINAS (GET /api/machines)
exports.listMachines = async (req, res) => {
    // ... (A lógica de DB da ROTA 3 vai aqui)
    try {
        const [machines] = await db.execute(
            `SELECT m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, m.created_at, h.cpu_model, h.ram_total_gb, h.disk_total_gb
             FROM machines m
             LEFT JOIN hardware_specs h ON m.id = h.machine_id
             ORDER BY m.status DESC, m.hostname`
        );
        res.json(machines);
    } catch (error) {
        console.error('❌ Erro ao buscar máquinas:', error.message);
        res.status(500).json({ message: 'Erro ao buscar lista de máquinas.', error: error.message });
    }
};

// ROTA 4: DETALHES DE UMA MÁQUINA (GET /api/machines/:uuid)
exports.getMachineDetails = async (req, res) => {
    // ... (A lógica de DB da ROTA 4 vai aqui)
    const { uuid } = req.params;
    try {
        // Lógica de 4 partes (DB)
        // ... (todo o bloco de código da ROTA 4)
        
        // 1. Informações Básicas e Hardware
        const [details] = await db.execute(
            // ... (consulta SQL completa)
            `SELECT m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, m.created_at, m.id as machine_id, h.cpu_model, h.ram_total_gb, h.disk_total_gb, h.mac_address
             FROM machines m
             LEFT JOIN hardware_specs h ON m.id = h.machine_id
             WHERE m.uuid = ?`,
            [uuid]
        );

        if (details.length === 0) {
            return res.status(404).json({ message: 'Máquina não encontrada.' });
        }

        const machine_id = details[0].machine_id;

        // 2. Software Instalado
        const [software] = await db.execute(
            `SELECT software_name, version, install_date FROM installed_software WHERE machine_id = ? ORDER BY software_name`,
            [machine_id]
        );

        // 3. Última Telemetria
        const [lastTelemetry] = await db.execute(
            `SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, created_at FROM telemetry_logs WHERE machine_id = ? ORDER BY created_at DESC LIMIT 1`,
            [machine_id]
        );

        // 4. Últimos Alertas Abertos
        const [openAlerts] = await db.execute(
            `SELECT alert_type, message, created_at FROM alerts WHERE machine_id = ? AND is_resolved = FALSE ORDER BY created_at DESC`,
            [machine_id]
        );

        const response = {
            ...details[0],
            installed_software: software,
            last_telemetry: lastTelemetry[0] || null,
            open_alerts: openAlerts
        };

        delete response.machine_id;
        res.json(response);

    } catch (error) {
        console.error('❌ Erro ao buscar detalhes da máquina:', error.message);
        res.status(500).json({ message: 'Erro ao buscar detalhes da máquina.', error: error.message });
    }
};

// ROTA 5: HISTÓRICO DE TELEMETRIA
exports.getTelemetryHistory = async (req, res) => {
    // ... (A lógica de DB da ROTA 5 vai aqui)
    const { uuid } = req.params;
    const { limit = 100 } = req.query; 

    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) {
            return res.status(404).json({ message: 'Máquina não encontrada.' });
        }

        const [history] = await db.execute(
            `SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, created_at
             FROM telemetry_logs
             WHERE machine_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [machine_id, parseInt(limit)]
        );

        res.json(history);
    } catch (error) {
        console.error('❌ Erro ao buscar histórico de telemetria:', error.message);
        res.status(500).json({ message: 'Erro ao buscar histórico de telemetria.', error: error.message });
    }
};