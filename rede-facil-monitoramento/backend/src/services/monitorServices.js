// src/services/monitorServices.js
const { db, getMachineId } = require('../config/db');
const moment = require('moment'); // 🚨 Adicionado para manipulação de datas
const socketHandler = require('../socket/socketHandler'); // Importa o módulo inteiro

let globalIo; 

exports.setSocketIo = (ioInstance) => {
    // Mantido para compatibilidade. A lógica de alerta agora usa socketHandler.getIo()
    globalIo = ioInstance; 
};

const isValidSoftware = (s) => {
    return s && typeof s.name === 'string' && s.name.trim().length > 0;
};

// ==========================================================
// CONSTANTES E FUNÇÕES AUXILIARES DE ALERTA
// ==========================================================
const MAX_TELEMETRY_RECORDS = 5;
const MAX_BACKUP_LAG_HOURS = 48;
const BACKUP_ALERT_TYPE = 'backup_failure'; // Tipo de alerta para falha de backup

const createAlert = async (machine_id, type, message) => {
    // ✅ CORREÇÃO: Usando socketHandler.getIo()
    const io = socketHandler.getIo() || globalIo;
    
    // Busca alertas ativos do mesmo tipo, criados na última hora, para evitar spam
    const [existingAlerts] = await db.execute(
        `SELECT id FROM alerts WHERE machine_id = ? AND alert_type = ? AND is_resolved = FALSE AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
        [machine_id, type]
    );

    if (existingAlerts.length === 0) { 
        const [result] = await db.execute(
            `INSERT INTO alerts (machine_id, alert_type, message, is_resolved) VALUES (?, ?, ?, FALSE)`,
            [machine_id, type, message]
        );

        if (io) {
            io.emit('new_alert', { 
                id: result.insertId,
                machine_id, 
                alert_type: type, 
                message: message, 
                created_at: new Date() 
            });
        }
    }
};

const resolveAlert = async (machine_id, type) => {
    await db.execute(
        `UPDATE alerts SET is_resolved = TRUE, resolved_at = CURRENT_TIMESTAMP 
         WHERE machine_id = ? AND alert_type = ? AND is_resolved = FALSE`,
        [machine_id, type]
    );
};

async function checkBackupHealth(machineId, lastBackupTimestamp) {
    if (!lastBackupTimestamp) return; 

    try {
        const now = moment();
        const lastBackup = moment(lastBackupTimestamp);
        
        if (!lastBackup.isValid()) return;

        const lagHours = now.diff(lastBackup, 'hours'); 

        // Condição: Atraso maior que 48 horas (2 dias)
        if (lagHours > MAX_BACKUP_LAG_HOURS) {
            
            const message = `Falha Crítica de Backup: Nenhum arquivo novo encontrado na pasta de backup há ${lagHours} horas. Limite: ${MAX_BACKUP_LAG_HOURS}h.`;
            
            await createAlert(machineId, BACKUP_ALERT_TYPE, message);
        
        } else {
            // Backup OK: Resolve o alerta se ele estiver ativo
            await resolveAlert(machineId, BACKUP_ALERT_TYPE);
        }

    } catch (error) {
        console.error(`Erro ao processar o status do backup para máquina ${machineId}:`, error);
    }
}


// ==========================================================
// FUNÇÃO registerMachine (Inalterada)
// ==========================================================

exports.registerMachine = async ({
    uuid, hostname, ip_address, os_name, 
    cpu_model, ram_total_gb, disk_total_gb, mac_address,
    installed_software 
}) => {
    if (!uuid || !hostname || !ip_address || !os_name) {
        throw new Error('Dados essenciais faltando.');
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction(); 
        await connection.execute(
            `INSERT INTO machines (uuid, hostname, ip_address, os_name, status) 
             VALUES (?, ?, ?, ?, 'online') 
             ON DUPLICATE KEY UPDATE 
             hostname=?, ip_address=?, os_name=?, last_seen=CURRENT_TIMESTAMP, status='online'`,
            [uuid, hostname, ip_address, os_name, hostname, ip_address, os_name]
        );

        const [rows] = await connection.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
        const machine_id = rows[0].id;
        
        const [specsRows] = await connection.execute('SELECT id FROM hardware_specs WHERE machine_id = ?', [machine_id]);
        const specsData = [cpu_model || null, ram_total_gb || null, disk_total_gb || null, mac_address || null];

        if (specsRows.length === 0) {
            await connection.execute(`INSERT INTO hardware_specs (machine_id, cpu_model, ram_total_gb, disk_total_gb, mac_address) VALUES (?, ?, ?, ?, ?)`, [machine_id, ...specsData]);
        } else {
            await connection.execute(`UPDATE hardware_specs SET cpu_model=?, ram_total_gb=?, disk_total_gb=?, mac_address=? WHERE machine_id = ?`, [...specsData, machine_id]);
        }
        
        await connection.execute('DELETE FROM installed_software WHERE machine_id = ?', [machine_id]);
        const validSoftware = (installed_software || []).filter(isValidSoftware);
        if (validSoftware.length > 0) {
            const softwareValues = validSoftware.map(s => [machine_id, s.name, s.version || null, s.install_date || null]);
            await connection.query('INSERT INTO installed_software (machine_id, software_name, version, install_date) VALUES ?', [softwareValues]);
        }

        await connection.commit(); 
        return { message: 'Máquina registrada com sucesso', machine_id };

    } catch (error) {
        if (connection) await connection.rollback(); 
        throw error; 
    } finally {
        if (connection) connection.release();
    }
};


// ==========================================================
// FUNÇÃO processTelemetry (Corrigida e Unificada)
// ==========================================================

exports.processTelemetry = async (data) => {
    if (!data) return;
    
    const {
        uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, disk_smart_status,
        last_backup_timestamp 
    } = data;
    
    if (!uuid) throw new Error('UUID da máquina é obrigatório para telemetria.');
    
    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) throw new Error('Máquina não encontrada.');
        
        // --- 1. Sanitização e Conversão de Dados (Unificado) ---
        
        const cpu_raw = parseFloat(cpu_usage_percent);
        const ram_raw = parseFloat(ram_usage_percent);
        const disk_raw = parseFloat(disk_free_percent);
        const temp_raw = temperature_celsius ? parseFloat(temperature_celsius) : null;
        
        const cpu_usage = isNaN(cpu_raw) ? null : parseFloat(cpu_raw.toFixed(2));
        const ram_usage = isNaN(ram_raw) ? null : parseFloat(ram_raw.toFixed(2));
        // Mantive a formatação da versão mais nova
        const disk_free = isNaN(disk_raw) ? null : parseFloat(disk_raw.toFixed(4)); 
        const temperature = (temp_raw === null || isNaN(temp_raw)) ? null : parseFloat(temp_raw.toFixed(2));
        
        const disk_status = disk_smart_status || 'OK';

        // --- 2. Inserção na Tabela de Telemetria (Incluindo Backup) ---
        
        await db.execute(
            `INSERT INTO telemetry_logs (machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, disk_smart_status, temperature_celsius, last_backup_timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [machine_id, cpu_usage, ram_usage, disk_free, disk_status, temperature, last_backup_timestamp]
        );

        // --- 3. Lógica de Alerta de Backup ---
        
        if (last_backup_timestamp) {
            await checkBackupHealth(machine_id, last_backup_timestamp);
        }
        
        // --- 4. Limpeza de Registros Antigos ---

        const offset = MAX_TELEMETRY_RECORDS - 1; 
        const [lastKeepRows] = await db.execute(
            `SELECT id FROM telemetry_logs WHERE machine_id = ? ORDER BY created_at DESC LIMIT 1 OFFSET ${offset}`,
            [machine_id]
        );
        
        if (lastKeepRows.length > 0) {
            const keep_id = lastKeepRows[0].id;
            await db.execute(
                `DELETE FROM telemetry_logs WHERE machine_id = ? AND id < ?`,
                [machine_id, keep_id]
            );
        }
        
        const [machineRow] = await db.execute('SELECT hostname FROM machines WHERE id = ?', [machine_id]);
        const hostname = machineRow[0].hostname;

        // --- 5. CRIAÇÃO E RESOLUÇÃO DE ALERTAS (Unificado) ---

        // Resolução de Alertas existentes (Se o problema melhorou)
        if (cpu_usage !== null && cpu_usage <= 85) {
            await resolveAlert(machine_id, 'critical'); 
        }
        if (disk_free !== null && disk_free >= 15) { 
            await resolveAlert(machine_id, 'warning'); 
        }
        
        // Criação de Alertas
        if (cpu_usage && cpu_usage > 90) { 
            await createAlert(machine_id, 'critical', `Uso de CPU crítico (${cpu_usage.toFixed(2)}%) na máquina ${hostname} (${uuid}).`);
        }

        if (disk_free !== null && disk_free < 10) {
            await createAlert(machine_id, 'warning', `Espaço em disco baixo (${disk_free.toFixed(2)}% livre) na máquina ${hostname}.`);
        }

        if (disk_status && disk_status.toUpperCase() !== 'OK') {
            await createAlert(machine_id, 'hardware', `FALHA S.M.A.R.T DETECTADA no disco da máquina ${hostname}. Backup urgente!`);
        }
        
        // --- 6. ATUALIZAÇÃO DE STATUS E EMISSÃO DE TELEMETRIA ---
        
        // Determina o status final para atualização da máquina
        let newStatus = 'online';
        if (cpu_usage > 90 || ram_usage > 95 || disk_free < 5) {
             newStatus = 'critical'; // Lógica baseada nos alertas mais graves
        } else if (temperature > 85 || cpu_usage > 85 || disk_free < 10) {
             newStatus = 'warning';
        }

        await db.execute(
            `UPDATE machines SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
            [newStatus, machine_id]
        );
        
        if (globalIo) {
            globalIo.emit('new_telemetry', { 
                machine_uuid: uuid, 
                cpu_usage_percent: cpu_usage, 
                ram_usage_percent: ram_usage, 
                disk_free_percent: disk_free,
                disk_smart_status: disk_status,
                temperature_celsius: temperature,
                last_backup_timestamp: last_backup_timestamp,
                status: newStatus 
            });
        }

        return { message: 'Telemetria processada' };

    } catch (error) {
        console.error('❌ Erro no Service (processTelemetry):', error.message);
        throw error;
    }
};

// ==========================================================
// OUTRAS FUNÇÕES (Correção do SQL)
// ==========================================================

exports.listMachines = async () => {
    try { 
        const [machines] = await db.execute(
            `SELECT m.id, m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, h.cpu_model, h.ram_total_gb, h.disk_total_gb 
             FROM machines m 
             LEFT JOIN hardware_specs h ON m.id = h.machine_id 
             ORDER BY m.status DESC, m.hostname`
        );
        return machines;
    } catch (error) {
        console.error('❌ Erro no Service (listMachines):', error.message);
        throw error;
    }
};

exports.getMachineDetails = async (uuid) => {
    if (!uuid) return null; 
    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) return null;
        
        // ✅ SQL Unificado e Limpo
        const [details] = await db.execute(
            `SELECT 
                 m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, m.created_at, m.id as machine_id,
                 h.cpu_model, h.ram_total_gb, h.disk_total_gb, h.mac_address
             FROM machines m
             LEFT JOIN hardware_specs h ON m.id = h.machine_id
             WHERE m.uuid = ?`,
            [uuid]
        );

        if (details.length === 0) return null;
        
        const [software] = await db.execute(
            `SELECT software_name, version, install_date FROM installed_software WHERE machine_id = ? ORDER BY software_name`,
            [machine_id]
        );

        // ✅ SQL Telemetria (Incluindo backup e status)
        const [lastTelemetry] = await db.execute(
            `SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, disk_smart_status, temperature_celsius, created_at, last_backup_timestamp
             FROM telemetry_logs 
             WHERE machine_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [machine_id]
        );

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
        return response;
    } catch (error) { 
        console.error('❌ Erro no Service (getMachineDetails):', error.message);
        throw error; 
    }
};

exports.getTelemetryHistory = async (uuid, limit = 100) => {
    if (!uuid) return []; 
    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) return [];
        const numericLimit = Math.max(1, parseInt(limit, 10));

        // ✅ SQL Histórico de Telemetria (Incluindo backup e status)
        const [history] = await db.execute(
            `SELECT 
                 cpu_usage_percent, ram_usage_percent, disk_free_percent, disk_smart_status, temperature_celsius, created_at, last_backup_timestamp
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