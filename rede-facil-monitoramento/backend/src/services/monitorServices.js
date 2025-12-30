const { db, getMachineId } = require('../config/db');
const moment = require('moment');
const socketHandler = require('../socket/socketHandler');
const whatsappService = require('./whatsappService')

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
const NOTIFICATION_TARGET = '120363420551985100@g.us';


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

        const whatsappMsg = `🚨 *ALERTA REDE FÁCIL*\n\n🖥️ *Máquina:* ${machine_id}\n⚠️ *Tipo:* ${type}\n📝 *Mensagem:* ${message}`;
        whatsappService.sendMessage(NOTIFICATION_TARGET, whatsappMsg);

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
    if (!lastBackupTimestamp || lastBackupTimestamp === "NÃO EXECUTADO") return;

    try {
        const now = moment();
        const lastBackup = moment(lastBackupTimestamp);

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



exports.registerMachine = async (data) => {
    const {
        uuid, hostname, ip_address, os_name,
        default_gateway, subnet_mask,
        cpu_model, cpu_speed_mhz, cpu_cores_physical, cpu_cores_logical,
        ram_total_gb, mem_slots_total, mem_slots_used, disk_total_gb,
        mac_address, machine_model, serial_number, machine_type,
        mb_manufacturer, mb_model, mb_version,
        gpu_model, gpu_vram_mb, last_boot_time,last_restore_point,
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
        `INSERT INTO machines (uuid, hostname, ip_address, default_gateway, subnet_mask, os_name, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'online') 
         ON DUPLICATE KEY UPDATE 
         hostname=?, ip_address=?, default_gateway=?, subnet_mask=?, os_name=?, last_seen=CURRENT_TIMESTAMP, status='online'`,
        [
            uuid, hostname, ip_address, default_gateway || null, subnet_mask || null, os_name, 
            hostname, ip_address, default_gateway || null, subnet_mask || null, os_name 
        ]
    );

        const [rows] = await connection.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
        const machine_id = rows[0].id;

        const specsData = [
        cpu_model || null, cpu_speed_mhz || null, cpu_cores_physical || null, cpu_cores_logical || null,
        ram_total_gb || null, mem_slots_total || null, mem_slots_used || null, disk_total_gb || null,
        mac_address || null, machine_model || null, serial_number || null, machine_type || null,
        mb_manufacturer || null, mb_model || null, mb_version || null,
        gpu_model || null, gpu_vram_mb || null, last_boot_time || null,
        last_restore_point || null 
    ];

       const [specsRows] = await connection.execute('SELECT id FROM hardware_specs WHERE machine_id = ?', [machine_id]);

        if (specsRows.length === 0) {
        await connection.execute(
            `INSERT INTO hardware_specs (
                machine_id, cpu_model, cpu_speed_mhz, cpu_cores_physical, cpu_cores_logical,
                ram_total_gb, mem_slots_total, mem_slots_used, disk_total_gb, mac_address,
                machine_model, serial_number, machine_type, mb_manufacturer, mb_model, mb_version,
                gpu_model, gpu_vram_mb, last_boot_time, last_restore_point
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [machine_id, ...specsData]
        );
    } else {
        await connection.execute(
            `UPDATE hardware_specs SET 
                cpu_model=?, cpu_speed_mhz=?, cpu_cores_physical=?, cpu_cores_logical=?,
                ram_total_gb=?, mem_slots_total=?, mem_slots_used=?, disk_total_gb=?, mac_address=?,
                machine_model=?, serial_number=?, machine_type=?, mb_manufacturer=?, mb_model=?, mb_version=?,
                gpu_model=?, gpu_vram_mb=?, last_boot_time=?, last_restore_point=?
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

exports.processTelemetry = async (data) => {
    try {
        const { 
            machine_uuid, 
            cpu_usage_percent, 
            ram_usage_percent, 
            disk_free_percent, 
            temperature_celsius 
        } = data;

        if (!machine_uuid) return;

        const cpu = parseFloat(cpu_usage_percent) || 0;
        const ram = parseFloat(ram_usage_percent) || 0;
        const diskFree = parseFloat(disk_free_percent) || 0;
        const temp = parseFloat(temperature_celsius) || 0;

        await db.execute(`
            UPDATE machines SET 
                cpu_usage = ?, 
                ram_usage = ?, 
                disk_usage = ?, 
                temperature = ?, 
                last_seen = NOW(), 
                status = 'online'
            WHERE uuid = ?
        `, [cpu, ram, diskFree, temp, machine_uuid]);

        try {
            const [rows] = await db.execute('SELECT id FROM machines WHERE uuid = ?', [machine_uuid]);
            if (rows.length > 0) {
                const machineId = rows[0].id;
                await db.execute(`
                    INSERT INTO telemetry_logs (machine_id, cpu_usage, ram_usage, disk_usage, temperature)
                    VALUES (?, ?, ?, ?, ?)
                `, [machineId, cpu, ram, diskFree, temp]);
            }
        } catch (dbErr) {
            console.error("Erro ao salvar log de telemetria (ignorado):", dbErr.message);
        }

        const socketData = {
            uuid: machine_uuid,
            cpu: cpu,
            ram: ram,
            disk: diskFree,
            temp: temp,
            last_seen: new Date()
        };

        const io = globalIo || socketHandler.getIO(); 
        
        if (io) {
            io.emit('machine_update', socketData); 
            io.emit(`machine_${machine_uuid}`, socketData);
            console.log(`📡 Socket emitido para: machine_${machine_uuid}`);
        } else {
            console.warn("⚠️ Socket.IO não disponível para enviar atualizações.");
        }

        return { message: "Telemetria processada" };
    } catch (error) {
        console.error("Erro crítico no processTelemetry:", error);
    }
};

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

exports.getTopology = async () => {
    const [machines] = await db.execute(`
        SELECT id, uuid, hostname, ip_address, default_gateway, subnet_mask, status, os_name 
        FROM machines 
        ORDER BY default_gateway, ip_address
    `);

    const topology = {};
    
    machines.forEach(m => {
        const gw = m.default_gateway || 'Sem Gateway / Desconhecido';
        if (!topology[gw]) {
            topology[gw] = {
                gateway: gw,
                subnet: m.subnet_mask || 'N/A',
                machines: []
            };
        }
        topology[gw].machines.push(m);
    });

    return Object.values(topology);
};

