// src/services/monitorServices.js
const { db, getMachineId } = require('../config/db');
const moment = require('moment');
const socketHandler = require('../socket/socketHandler');

let globalIo;

exports.setSocketIo = (ioInstance) => {
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
const BACKUP_ALERT_TYPE = 'backup_failure';

const createAlert = async (machine_id, type, message) => {
    const io = socketHandler.getIo() || globalIo;

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

        if (lagHours > MAX_BACKUP_LAG_HOURS) {
            const message = `Falha Crítica de Backup: Nenhum arquivo novo encontrado há ${lagHours} horas. (Limite: ${MAX_BACKUP_LAG_HOURS}h)`;
            await createAlert(machineId, BACKUP_ALERT_TYPE, message);
        } else {
            await resolveAlert(machineId, BACKUP_ALERT_TYPE);
        }
    } catch (error) {
        console.error(`Erro ao processar backup para máquina ${machineId}:`, error);
    }
}

// ==========================================================
// FUNÇÃO registerMachine (COM PLACAS DE REDE)
// ==========================================================
exports.registerMachine = async ({
    uuid, hostname, ip_address, os_name,
    cpu_model,
    cpu_speed_mhz,
    cpu_cores_physical,
    cpu_cores_logical,
    ram_total_gb,
    disk_total_gb,
    mac_address,
    machine_model, serial_number,
    machine_type,
    mb_manufacturer,
    mb_model,
    mb_version,
    gpu_model,
    gpu_vram_mb,
    network_interfaces,
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

        const specsData = [
            cpu_model || null,
            cpu_speed_mhz || null,
            cpu_cores_physical || null,
            cpu_cores_logical || null,
            ram_total_gb || null,
            disk_total_gb || null,
            mac_address || null,
            machine_model || null,
            serial_number || null,
            machine_type || null,
            mb_manufacturer || null,
            mb_model || null,
            mb_version || null,
            gpu_model || null,
            gpu_vram_mb || null
        ];

        if (specsRows.length === 0) {
            await connection.execute(
                `INSERT INTO hardware_specs (
                    machine_id,
                    cpu_model, cpu_speed_mhz, cpu_cores_physical, cpu_cores_logical,
                    ram_total_gb, disk_total_gb, mac_address,
                    machine_model, serial_number, machine_type,
                    mb_manufacturer, mb_model, mb_version,
                    gpu_model, gpu_vram_mb
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [machine_id, ...specsData]
            );
        } else {
            await connection.execute(
                `UPDATE hardware_specs SET 
                    cpu_model=?, cpu_speed_mhz=?, cpu_cores_physical=?, cpu_cores_logical=?,
                    ram_total_gb=?, disk_total_gb=?, mac_address=?,
                    machine_model=?, serial_number=?, machine_type=?,
                    mb_manufacturer=?, mb_model=?, mb_version=?,
                    gpu_model=?, gpu_vram_mb=?
                WHERE machine_id = ?`,
                [...specsData, machine_id]
            );
        }

        if (network_interfaces && network_interfaces.length > 0) {
            await connection.execute('DELETE FROM network_interfaces WHERE machine_id = ?', [machine_id]);

            const interfaceValues = network_interfaces.map(nic => [
                machine_id,
                nic.interface_name || 'N/A',
                nic.mac_address || null,
                nic.is_up || false,
                nic.speed_mbps || null
            ]);

            await connection.query(
                'INSERT INTO network_interfaces (machine_id, interface_name, mac_address, is_up, speed_mbps) VALUES ?',
                [interfaceValues]
            );
        }

        await connection.execute('DELETE FROM installed_software WHERE machine_id = ?', [machine_id]);

        const validSoftware = (installed_software || []).filter(isValidSoftware);

        if (validSoftware.length > 0) {
            const softwareValues = validSoftware.map(s => [
                machine_id,
                s.name,
                s.version || null,
                s.install_date || null
            ]);

            await connection.query(
                'INSERT INTO installed_software (machine_id, software_name, version, install_date) VALUES ?',
                [softwareValues]
            );
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
// FUNÇÃO processTelemetry
// ==========================================================

exports.processTelemetry = async (data) => {
    if (!data) return;

    const {
        uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent,
        temperature_celsius, disk_smart_status, last_backup_timestamp
    } = data;

    if (!uuid) throw new Error('UUID da máquina é obrigatório.');

    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) throw new Error('Máquina não encontrada.');

        const cpu_raw = parseFloat(cpu_usage_percent);
        const ram_raw = parseFloat(ram_usage_percent);
        const disk_raw = parseFloat(disk_free_percent);
        const temp_raw = temperature_celsius ? parseFloat(temperature_celsius) : null;

        const cpu_usage = isNaN(cpu_raw) ? null : parseFloat(cpu_raw.toFixed(2));
        const ram_usage = isNaN(ram_raw) ? null : parseFloat(ram_raw.toFixed(2));
        const disk_free = isNaN(disk_raw) ? null : parseFloat(disk_raw.toFixed(4));
        const temperature = temp_raw === null || isNaN(temp_raw) ? null : parseFloat(temp_raw.toFixed(2));

        const disk_status = disk_smart_status || 'OK';

        await db.execute(
            `INSERT INTO telemetry_logs (
                machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent,
                disk_smart_status, temperature_celsius, last_backup_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [machine_id, cpu_usage, ram_usage, disk_free, disk_status, temperature, last_backup_timestamp]
        );

        if (last_backup_timestamp) {
            await checkBackupHealth(machine_id, last_backup_timestamp);
        }

        const offset = MAX_TELEMETRY_RECORDS - 1;

        const [lastKeepRows] = await db.execute(
            `SELECT id FROM telemetry_logs 
             WHERE machine_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1 OFFSET ${offset}`,
            [machine_id]
        );

        if (lastKeepRows.length > 0) {
            const keep_id = lastKeepRows[0].id;
            await db.execute(
                `DELETE FROM telemetry_logs 
                 WHERE machine_id = ? AND id < ?`,
                [machine_id, keep_id]
            );
        }

        const [machineRow] = await db.execute(
            'SELECT hostname FROM machines WHERE id = ?',
            [machine_id]
        );

        const hostname = machineRow[0].hostname;

        if (cpu_usage !== null && cpu_usage <= 85) {
            await resolveAlert(machine_id, 'critical');
        }
        if (disk_free !== null && disk_free >= 15) {
            await resolveAlert(machine_id, 'warning');
        }

        if (cpu_usage && cpu_usage > 90) {
            await createAlert(
                machine_id,
                'critical',
                `Uso de CPU crítico (${cpu_usage.toFixed(2)}%) na máquina ${hostname} (${uuid}).`
            );
        }

        if (disk_free !== null && disk_free < 10) {
            await createAlert(
                machine_id,
                'warning',
                `Espaço em disco baixo (${disk_free.toFixed(2)}% livre) na máquina ${hostname}.`
            );
        }

        if (disk_status && disk_status.toUpperCase() !== 'OK') {
            await createAlert(
                machine_id,
                'hardware',
                `FALHA S.M.A.R.T DETECTADA no disco da máquina ${hostname}.`
            );
        }

        let newStatus = 'online';

        if (cpu_usage > 90 || ram_usage > 95 || disk_free < 5) {
            newStatus = 'critical';
        } else if (temperature > 85 || cpu_usage > 85 || disk_free < 10) {
            newStatus = 'warning';
        }

        await db.execute(
            `UPDATE machines 
             SET status = ?, last_seen = CURRENT_TIMESTAMP 
             WHERE id = ?`,
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
                last_backup_timestamp,
                status: newStatus
            });
        }

        return { message: 'Telemetria processada' };

    } catch (error) {
        console.error('Erro em processTelemetry:', error.message);
        throw error;
    }
};

// ==========================================================
// OUTRAS FUNÇÕES
// ==========================================================
exports.listMachines = async () => {
    try {
        const [machines] = await db.execute(
            `SELECT m.id, m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, 
                    h.cpu_model, h.cpu_speed_mhz, h.cpu_cores_physical, h.cpu_cores_logical, 
                    h.ram_total_gb, h.disk_total_gb, h.machine_type 
             FROM machines m 
             LEFT JOIN hardware_specs h ON m.id = h.machine_id 
             ORDER BY m.status DESC, m.hostname`
        );
        return machines;
    } catch (error) {
        console.error('Erro em listMachines:', error.message);
        throw error;
    }
};

// ==========================================================
// FUNÇÃO getMachineDetails (BUSCA PLACAS DE REDE)
// ==========================================================
exports.getMachineDetails = async (uuid) => {
    if (!uuid) return null;

    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) return null;

        const [details] = await db.execute(
            `SELECT 
                m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, m.created_at, m.id as machine_id,
                h.cpu_model, h.cpu_speed_mhz, h.cpu_cores_physical, h.cpu_cores_logical,
                h.ram_total_gb, h.disk_total_gb, h.mac_address,
                h.machine_model, h.serial_number, h.machine_type,
                h.mb_manufacturer, h.mb_model, h.mb_version,
                h.gpu_model, h.gpu_vram_mb
             FROM machines m
             LEFT JOIN hardware_specs h ON m.id = h.machine_id
             WHERE m.uuid = ?`,
            [uuid]
        );

        if (details.length === 0) return null;

        const [networkInterfaces] = await db.execute(
            `SELECT interface_name, mac_address, is_up, speed_mbps 
             FROM network_interfaces 
             WHERE machine_id = ?`,
            [machine_id]
        );

        const [software] = await db.execute(
            `SELECT software_name, version, install_date FROM installed_software WHERE machine_id = ? ORDER BY software_name`,
            [machine_id]
        );

        const [lastTelemetry] = await db.execute(
            `SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, disk_smart_status, temperature_celsius, created_at, last_backup_timestamp
             FROM telemetry_logs 
             WHERE machine_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [machine_id]
        );

        const [openAlerts] = await db.execute(
            `SELECT id, alert_type, message, created_at 
             FROM alerts 
             WHERE machine_id = ? AND is_resolved = FALSE 
             ORDER BY created_at DESC`,
            [machine_id]
        );

        return {
            ...details[0],
            network_interfaces: networkInterfaces,
            installed_software: software,
            last_telemetry: lastTelemetry[0] || null,
            open_alerts: openAlerts
        };

    } catch (error) {
        console.error('Erro em getMachineDetails:', error.message);
        throw error;
    }
};

exports.getTelemetryHistory = async (uuid, limit = 100) => {
    if (!uuid) return [];

    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) return [];

        const numericLimit = Math.max(1, parseInt(limit, 10));

        const [history] = await db.execute(
            `SELECT 
                cpu_usage_percent, ram_usage_percent, disk_free_percent, 
                disk_smart_status, temperature_celsius, created_at, 
                last_backup_timestamp
             FROM telemetry_logs
             WHERE machine_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [machine_id, numericLimit]
        );

        return history;

    } catch (error) {
        console.error('Erro em getTelemetryHistory:', error.message);
        throw error;
    }
};
