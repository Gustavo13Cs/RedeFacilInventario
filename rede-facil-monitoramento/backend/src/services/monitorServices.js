// monitorServices.js

// Importa o pool de conexão e a função auxiliar de DB
const { db, getMachineId } = require('../config/db');

// Variável interna para armazenar a instância do Socket.io
let globalIo; 

// FUNÇÃO QUE O SERVER.JS CHAMA para injetar o Socket.io 
exports.setSocketIo = (ioInstance) => {
    globalIo = ioInstance;
};

// ----------------------------------------------------
// FUNÇÃO AUXILIAR: VALIDAÇÃO BÁSICA DE SOFTWARE
// ----------------------------------------------------
const isValidSoftware = (s) => {
    // Garante que 's' é um objeto, tem a propriedade 'name' e que 'name' não é vazio.
    return s && typeof s.name === 'string' && s.name.trim().length > 0;
};


// ----------------------------------------------------
// SERVIÇO 1: REGISTRO/ATUALIZAÇÃO DE MÁQUINAS (SQL com Transação)
// ----------------------------------------------------
exports.registerMachine = async ({
    uuid, hostname, ip_address, os_name, 
    cpu_model, ram_total_gb, disk_total_gb, mac_address,
    installed_software // Array
}) => {
    // Validação básica (Melhoria)
    if (!uuid || !hostname || !ip_address || !os_name) {
        throw new Error('Dados essenciais de registro (uuid, hostname, ip_address, os_name) estão faltando.');
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction(); // Inicia transação

        // 1. Inserir/Atualizar Máquina (UPSERT na tabela 'machines')
        await connection.execute(
            `INSERT INTO machines (uuid, hostname, ip_address, os_name, status) 
             VALUES (?, ?, ?, ?, 'online') 
             ON DUPLICATE KEY UPDATE 
             hostname=?, ip_address=?, os_name=?, last_seen=CURRENT_TIMESTAMP, status='online'`,
            [uuid, hostname, ip_address, os_name, hostname, ip_address, os_name]
        );

        // 2. Obter o ID da máquina
        const [rows] = await connection.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
        const machine_id = rows[0].id;

        // 3. Inserir/Atualizar Specs de Hardware (tabela 'hardware_specs')
        const [specsRows] = await connection.execute('SELECT id FROM hardware_specs WHERE machine_id = ?', [machine_id]);
        
        const specsData = [
            cpu_model || null, 
            ram_total_gb || null, 
            disk_total_gb || null, 
            mac_address || null
        ];

        if (specsRows.length === 0) {
            await connection.execute(
                `INSERT INTO hardware_specs (machine_id, cpu_model, ram_total_gb, disk_total_gb, mac_address)
                 VALUES (?, ?, ?, ?, ?)`,
                [machine_id, ...specsData]
            );
        } else {
            await connection.execute(
                `UPDATE hardware_specs SET cpu_model=?, ram_total_gb=?, disk_total_gb=?, mac_address=? WHERE machine_id = ?`,
                [...specsData, machine_id]
            );
        }
        
        // 4. Sincroniza Software (tabela 'installed_software')
        await connection.execute('DELETE FROM installed_software WHERE machine_id = ?', [machine_id]);
        
        const validSoftware = (installed_software || []).filter(isValidSoftware);

        if (validSoftware.length > 0) {
            const softwareValues = validSoftware.map(s => [
                machine_id, 
                s.name, 
                s.version || null, 
                s.install_date || null
            ]);
            await connection.query('INSERT INTO installed_software (machine_id, software_name, version, install_date) VALUES ?', [softwareValues]);
        }

        await connection.commit(); // Confirma transação
        return { message: 'Máquina registrada/atualizada com sucesso', machine_id };

    } catch (error) {
        if (connection) {
            console.error('❌ Transação de Registro/Atualização Desfeita:', error.message);
            await connection.rollback(); // Desfaz em caso de erro
        }
        throw error; 
    } finally {
        if (connection) connection.release();
    }
};

// ----------------------------------------------------
// SERVIÇO 2: INGESTÃO DE TELEMETRIA (SQL e Socket.io)
// ----------------------------------------------------
exports.processTelemetry = async ({
    uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius
}) => {
    // Validação básica (Melhoria)
    if (!uuid) {
        throw new Error('UUID da máquina é obrigatório para telemetria.');
    }
    
    try {
        const machine_id = await getMachineId(uuid);
        
        if (!machine_id) {
            throw new Error('Máquina não encontrada. Registre-a primeiro.');
        }
        
        // Formata os dados para garantir consistência numérica (Melhoria)
        const cpu_usage = parseFloat(cpu_usage_percent).toFixed(2);
        const ram_usage = parseFloat(ram_usage_percent).toFixed(2);
        const disk_free = parseFloat(disk_free_percent).toFixed(2);
        const temperature = temperature_celsius ? parseFloat(temperature_celsius).toFixed(2) : null;


        // 1. Salvar no Banco de Dados (telemetry_logs)
        await db.execute(
            `INSERT INTO telemetry_logs (machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius)
             VALUES (?, ?, ?, ?, ?)`,
            [machine_id, cpu_usage, ram_usage, disk_free, temperature]
        );

        // 2. Verificação de Alertas (Ex: CPU Crítica > 90%)
        if (cpu_usage > 90) {
            const [machineRow] = await db.execute('SELECT hostname FROM machines WHERE id = ?', [machine_id]);
            const hostname = machineRow[0].hostname;
            const alert_message = `Uso de CPU crítico (${cpu_usage}%) na máquina ${hostname} (${uuid}).`;
            
            // Checa por alertas recentes (para evitar spam)
            const [existingAlerts] = await db.execute(
                `SELECT id FROM alerts WHERE machine_id = ? AND alert_type = 'critical' AND is_resolved = FALSE AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
                [machine_id]
            );

            if (existingAlerts.length === 0) { // Cria o alerta
                await db.execute(
                    `INSERT INTO alerts (machine_id, alert_type, message) VALUES (?, 'critical', ?)`,
                    [machine_id, alert_message]
                );
                // 3. Emite para o Dashboard via Socket.io 
                if (globalIo) {
                    globalIo.emit('new_alert', { machine_id, uuid, alert_type: 'critical', message: alert_message, created_at: new Date() });
                }
            }
        }
        
        // 4. Atualizar status da máquina (mantê-la 'online')
        await db.execute(
            `UPDATE machines SET status = 'online', last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
            [machine_id]
        );

        // 5. Transmitir em Tempo Real via Socket.io 
        if (globalIo) {
            globalIo.emit('new_telemetry', { 
                uuid, 
                cpu_usage_percent: cpu_usage, 
                ram_usage_percent: ram_usage, 
                disk_free_percent: disk_free 
            });
        }

        return { message: 'Dados de telemetria recebidos e processados' };
    } catch (error) {
        console.error('❌ Erro no Service (processTelemetry):', error.message);
        throw error;
    }
};

// ----------------------------------------------------
// SERVIÇO 3: CONSULTAS (Listar Máquinas)
// ----------------------------------------------------
exports.listMachines = async () => {
    try { // CORREÇÃO: Envolver a lógica em try/catch corretamente
        // Consulta JOIN para obter dados de inventário e hardware (mantendo a versão limpa)
        const [machines] = await db.execute(
            `SELECT m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, h.cpu_model, h.ram_total_gb, h.disk_total_gb FROM machines m LEFT JOIN hardware_specs h ON m.id = h.machine_id ORDER BY m.status DESC, m.hostname`
        );
        return machines;
    } catch (error) {
        console.error('❌ Erro no Service (listMachines):', error.message);
        throw error;
    }
};


// ----------------------------------------------------
// SERVIÇO 4: DETALHES DE UMA MÁQUINA (GET /api/machines/:uuid)
// ----------------------------------------------------
exports.getMachineDetails = async (uuid) => {
    if (!uuid) return null; // Validação básica
    
    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) {
            return null;
        }

        // 1. Informações Básicas e Hardware (JOIN)
        const [details] = await db.execute(
            `SELECT 
                m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, m.created_at, m.id as machine_id,
                h.cpu_model, h.ram_total_gb, h.disk_total_gb, h.mac_address
             FROM machines m
             LEFT JOIN hardware_specs h ON m.id = h.machine_id
             WHERE m.uuid = ?`,
            [uuid]
        );

        if (details.length === 0) {
            return null;
        }
        
        // 2. Software Instalado (SELECT separado)
        const [software] = await db.execute(
            `SELECT software_name, version, install_date FROM installed_software WHERE machine_id = ? ORDER BY software_name`,
            [machine_id]
        );

        // 3. Última Telemetria 
        const [lastTelemetry] = await db.execute(
            `SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, created_at 
             FROM telemetry_logs 
             WHERE machine_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [machine_id]
        );

        // 4. Últimos Alertas Abertos
        const [openAlerts] = await db.execute(
            `SELECT id, alert_type, message, created_at FROM alerts WHERE machine_id = ? AND is_resolved = FALSE ORDER BY created_at DESC`,
            [machine_id]
        );

        const response = {
            ...details[0],
            installed_software: software,
            last_telemetry: lastTelemetry[0] || null,
            open_alerts: openAlerts
        };

        delete response.machine_id; // Remove o ID interno
        return response;

    } catch (error) {
        console.error('❌ Erro no Service (getMachineDetails):', error.message);
        throw error; 
    }
};

// ----------------------------------------------------
// SERVIÇO 5: HISTÓRICO DE TELEMETRIA (GET /api/telemetry/:uuid/history)
// ----------------------------------------------------
exports.getTelemetryHistory = async (uuid, limit = 100) => {
    if (!uuid) return []; // Validação básica

    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) {
            return [];
        }

        // Garante que limit é um número inteiro positivo (Melhoria)
        const numericLimit = Math.max(1, parseInt(limit, 10));

        // Busca o histórico de logs de telemetria
        const [history] = await db.execute(
            `SELECT 
                cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, created_at
             FROM telemetry_logs
             WHERE machine_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [machine_id, numericLimit]
        );

        return history;
    } catch (error) {
        console.error('❌ Erro no Service (getTelemetryHistory):', error.message);
        throw error;
    }
};