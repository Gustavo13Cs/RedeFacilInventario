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

const MAX_TELEMETRY_RECORDS = 5;
const MAX_BACKUP_LAG_HOURS = 48;
const BACKUP_ALERT_TYPE = 'backup_failure';

// --- Funções de Alerta ---

const createAlert = async (machine_id, type, message) => {
    const io = socketHandler.getIO() || globalIo;

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
    if (!lastBackupTimestamp || lastBackupTimestamp === "NÃO EXECUTADO" || lastBackupTimestamp === "N/A") return;

    try {
        const now = moment();
        const lastBackup = moment(lastBackupTimestamp, "YYYY-MM-DD HH:mm:ss");

        if (!lastBackup.isValid()) return;

        const lagHours = now.diff(lastBackup, 'hours');

        if (lagHours > MAX_BACKUP_LAG_HOURS) {
            const message = `Falha Crítica de Backup: Nenhum ponto de restauração encontrado há ${lagHours} horas. (Limite: ${MAX_BACKUP_LAG_HOURS}h)`;
            await createAlert(machineId, BACKUP_ALERT_TYPE, message);
        } else {
            await resolveAlert(machineId, BACKUP_ALERT_TYPE);
        }
    } catch (error) {
        console.error(`Erro ao processar backup para máquina ${machineId}:`, error);
    }
}

// --- Registro de Máquina (Inventário) ---

exports.registerMachine = async (data) => {
    const {
        uuid, hostname, ip_address, os_name,
        cpu_model, cpu_speed_mhz, cpu_cores_physical, cpu_cores_logical,
        ram_total_gb, mem_slots_total, mem_slots_used, disk_total_gb,
        mac_address, machine_model, serial_number, machine_type,
        mb_manufacturer, mb_model, mb_version,
        gpu_model, gpu_vram_mb, last_boot_time,
        network_interfaces, installed_software
    } = data;

    if (!uuid || !hostname) {
        throw new Error('Dados essenciais (UUID/Hostname) faltando.');
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

        const specsData = [
            cpu_model || null, cpu_speed_mhz || null, cpu_cores_physical || null, cpu_cores_logical || null,
            ram_total_gb || null, mem_slots_total || null, mem_slots_used || null, disk_total_gb || null,
            mac_address || null, machine_model || null, serial_number || null, machine_type || null,
            mb_manufacturer || null, mb_model || null, mb_version || null,
            gpu_model || null, gpu_vram_mb || null, last_boot_time || null
        ];

        const [specsRows] = await connection.execute('SELECT id FROM hardware_specs WHERE machine_id = ?', [machine_id]);

        if (specsRows.length === 0) {
            await connection.execute(
                `INSERT INTO hardware_specs (
                    machine_id, cpu_model, cpu_speed_mhz, cpu_cores_physical, cpu_cores_logical,
                    ram_total_gb, mem_slots_total, mem_slots_used, disk_total_gb, mac_address,
                    machine_model, serial_number, machine_type, mb_manufacturer, mb_model, mb_version,
                    gpu_model, gpu_vram_mb, last_boot_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [machine_id, ...specsData]
            );
        } else {
            await connection.execute(
                `UPDATE hardware_specs SET 
                    cpu_model=?, cpu_speed_mhz=?, cpu_cores_physical=?, cpu_cores_logical=?,
                    ram_total_gb=?, mem_slots_total=?, mem_slots_used=?, disk_total_gb=?, mac_address=?,
                    machine_model=?, serial_number=?, machine_type=?, mb_manufacturer=?, mb_model=?, mb_version=?,
                    gpu_model=?, gpu_vram_mb=?, last_boot_time=?
                WHERE machine_id = ?`,
                [...specsData, machine_id]
            );
        }

        await connection.execute('DELETE FROM network_interfaces WHERE machine_id = ?', [machine_id]);
        if (network_interfaces?.length > 0) {
            const values = network_interfaces.map(n => [machine_id, n.interface_name, n.mac_address, n.is_up, n.speed_mbps]);
            await connection.query('INSERT INTO network_interfaces (machine_id, interface_name, mac_address, is_up, speed_mbps) VALUES ?', [values]);
        }

        await connection.execute('DELETE FROM installed_software WHERE machine_id = ?', [machine_id]);
        const validSoftware = (installed_software || []).filter(isValidSoftware);
        if (validSoftware.length > 0) {
            const values = validSoftware.map(s => [machine_id, s.name, s.version, null]);
            await connection.query('INSERT INTO installed_software (machine_id, software_name, version, install_date) VALUES ?', [values]);
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

// --- Processamento de Telemetria (AJUSTADO PARA REDE E BACKUP) ---

exports.processTelemetry = async (data) => {
    if (!data || !data.uuid) throw new Error('Dados inválidos.');

    const machine_id = await getMachineId(data.uuid);
    if (!machine_id) throw new Error('Máquina não encontrada.');

    const cleanNum = (val) => (val === null || isNaN(parseFloat(val))) ? null : parseFloat(parseFloat(val).toFixed(2));

    const telemetry = {
        cpu: cleanNum(data.cpu_usage_percent),
        ram: cleanNum(data.ram_usage_percent),
        disk: cleanNum(data.disk_free_percent),
        temp: cleanNum(data.temperature_celsius),
        smart: data.disk_smart_status || 'OK',
        backup: (data.last_backup_timestamp && data.last_backup_timestamp !== "NÃO EXECUTADO" && data.last_backup_timestamp !== "N/A") ? data.last_backup_timestamp : null,
        // --- NOVOS CAMPOS DO AGENTE ---
        backup_status: data.backup_status || 'OK',
        net_latency: cleanNum(data.network_latency_ms),
        net_loss: cleanNum(data.packet_loss_percent)
    };

    try {
        // 1. Salvar Log com as novas colunas
     await db.execute(
    `INSERT INTO telemetry_logs (
        machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, 
        disk_smart_status, temperature_celsius, last_backup_timestamp, 
        backup_status, network_latency_ms, packet_loss_percent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        machine_id, telemetry.cpu, telemetry.ram, telemetry.disk, 
        telemetry.smart, telemetry.temp, telemetry.backup,
        telemetry.backup_status, telemetry.net_latency, telemetry.net_loss
    ]
);

        // 2. Checar Saúde do Backup (Lógica de alertas 48h)
        if (telemetry.backup) await checkBackupHealth(machine_id, telemetry.backup);

        // 3. Atualizar Status e Alertas baseados na telemetria
        let newStatus = 'online';
        const [machine] = await db.execute('SELECT hostname FROM machines WHERE id = ?', [machine_id]);
        const hostname = machine[0]?.hostname || 'PC';

        if (telemetry.cpu > 90) {
            await createAlert(machine_id, 'critical', `Uso de CPU crítico (${telemetry.cpu}%) em ${hostname}`);
            newStatus = 'critical';
        } else if (telemetry.cpu <= 85) {
            await resolveAlert(machine_id, 'critical');
        }

        if (telemetry.disk < 10) {
            await createAlert(machine_id, 'warning', `Espaço em disco baixo (${telemetry.disk}%) em ${hostname}`);
            if (newStatus !== 'critical') newStatus = 'warning';
        } else if (telemetry.disk >= 15) {
            await resolveAlert(machine_id, 'warning');
        }

        // Alerta opcional para latência alta (> 200ms)
        if (telemetry.net_latency > 200) {
            await createAlert(machine_id, 'network_delay', `Latência alta detectada (${telemetry.net_latency}ms) em ${hostname}`);
        } else {
            await resolveAlert(machine_id, 'network_delay');
        }

        await db.execute('UPDATE machines SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, machine_id]);

        // 4. Socket.io Real-time
        if (globalIo) {
            globalIo.emit('new_telemetry', { ...telemetry, machine_uuid: data.uuid, status: newStatus });
        }

        return { message: 'Telemetria processada' };
    } catch (error) {
        console.error('Erro no processTelemetry:', error.message);
        throw error;
    }
};

// --- Consultas MANTIDAS ---

exports.listMachines = async () => {
    const [machines] = await db.execute(`
        SELECT m.id, m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, 
                h.cpu_model, h.ram_total_gb, h.disk_total_gb, h.machine_type
        FROM machines m 
        LEFT JOIN hardware_specs h ON m.id = h.machine_id 
        ORDER BY m.status DESC, m.hostname
    `);
    return machines;
};

exports.getMachineDetails = async (uuid) => {
    const machine_id = await getMachineId(uuid);
    if (!machine_id) return null;

    const [details] = await db.execute('SELECT m.*, h.* FROM machines m LEFT JOIN hardware_specs h ON m.id = h.machine_id WHERE m.uuid = ?', [uuid]);
    const [network] = await db.execute('SELECT * FROM network_interfaces WHERE machine_id = ?', [machine_id]);
    const [software] = await db.execute('SELECT * FROM installed_software WHERE machine_id = ?', [machine_id]);
    const [telemetry] = await db.execute('SELECT * FROM telemetry_logs WHERE machine_id = ? ORDER BY created_at DESC LIMIT 1', [machine_id]);
    const [alerts] = await db.execute('SELECT * FROM alerts WHERE machine_id = ? AND is_resolved = FALSE', [machine_id]);

    return {
        ...details[0],
        network_interfaces: network,
        installed_software: software,
        last_telemetry: telemetry[0] || null,
        open_alerts: alerts
    };
};