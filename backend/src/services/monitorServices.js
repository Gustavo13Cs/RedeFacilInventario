const { db, getMachineId } = require('../config/db');
const moment = require('moment');
const socketHandler = require('../socket/socketHandler');
const whatsappService = require('./whatsappService');

let globalIo;

const NOTIFICATION_TARGET = '120363420551985100@g.us'
const CPU_THRESHOLD = 95; // Consideramos "100%" qualquer coisa acima de 95% para garantir
const CPU_TIME_WINDOW = 2; // Minutos
const OFFLINE_THRESHOLD_SECONDS = 10;

exports.setSocketIo = (ioInstance) => {
    globalIo = ioInstance;
};

const isValidSoftware = (s) => {
    return s && typeof s.name === 'string' && s.name.trim().length > 0;
};

const createAlert = async (machine_id, type, message) => {
    const io = socketHandler.getIO() || globalIo;

    const [existingAlerts] = await db.execute(
        `SELECT id FROM alerts WHERE machine_id = ? AND alert_type = ? AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
        [machine_id, type]
    );

    if (existingAlerts.length === 0) {
        const [result] = await db.execute(
            `INSERT INTO alerts (machine_id, alert_type, message, is_resolved) VALUES (?, ?, ?, FALSE)`,
            [machine_id, type, message]
        );

        const whatsappMsg = `🚨 *ALERTA REDE FÁCIL*\n\n⚠️ *Tipo:* ${type}\n📝 *Mensagem:* ${message}`;
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


async function checkCpuHealth(machineId, currentCpu) {
    if (currentCpu < CPU_THRESHOLD) return;
    const [logs] = await db.execute(`
        SELECT AVG(cpu_usage) as avg_cpu, COUNT(*) as count 
        FROM telemetry_logs 
        WHERE machine_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `, [machineId, CPU_TIME_WINDOW]);

    if (logs[0].count > 5 && logs[0].avg_cpu >= CPU_THRESHOLD) {
        
        const [machineRows] = await db.execute('SELECT hostname FROM machines WHERE id = ?', [machineId]);
        const machineName = machineRows.length > 0 ? machineRows[0].hostname : 'Máquina';

        const msg = `🔥 CPU CRÍTICA: ${machineName} está operando acima de ${CPU_THRESHOLD}% há mais de ${CPU_TIME_WINDOW} minutos!`;
        
        await createAlert(machineId, 'HIGH_CPU', msg);
    }
}

exports.checkOfflineMachines = async () => {
    try {
        const now = moment().utcOffset(-3); 
        
        const currentMinutes = (now.hours() * 60) + now.minutes();
        const startWork = (8 * 60) + 30; 
        const endWork = (18 * 60) + 15;  
        const isWeekDay = (now.day() >= 1 && now.day() <= 5);
        const isBusinessHours = isWeekDay && (currentMinutes >= startWork && currentMinutes <= endWork);

        const [offlineMachines] = await db.execute(`
            SELECT id, uuid, hostname, last_seen, TIMESTAMPDIFF(SECOND, last_seen, NOW()) as seconds_offline
            FROM machines 
            WHERE status = 'online' 
            AND last_seen < DATE_SUB(NOW(), INTERVAL ? SECOND)
        `, [OFFLINE_THRESHOLD_SECONDS]);

        for (const machine of offlineMachines) {
            
            await db.execute(`UPDATE machines SET status = 'offline' WHERE id = ?`, [machine.id]);
            const io = globalIo || socketHandler.getIO();
            if (io) io.emit('machine_status_change', { uuid: machine.uuid, status: 'offline' });

            if (isBusinessHours) {
                const msg = `🔌 ${machine.hostname} parou de responder. (Offline há ${machine.seconds_offline} segs)`;
                await createAlert(machine.id, 'OFFLINE', msg);
            }
        }
    } catch (error) {
        console.error('Erro checar offline:', error);
    }
};

exports.registerMachine = async (data) => {
    const {
        uuid, hostname, ip_address, os_name,
        default_gateway, subnet_mask,
        cpu_model, cpu_speed_mhz, cpu_cores_physical, cpu_cores_logical,
        ram_total_gb, mem_slots_total, mem_slots_used, disk_total_gb,
        mac_address, machine_model, serial_number, machine_type,
        mb_manufacturer, mb_model, mb_version,
        gpu_model, gpu_vram_mb, last_boot_time, last_restore_point,
        network_interfaces, installed_software
    } = data;

    if (!uuid || !hostname) throw new Error('Dados essenciais (UUID/Hostname) faltando.');

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        await connection.execute(
            `INSERT INTO machines (uuid, hostname, ip_address, default_gateway, subnet_mask, os_name, status, last_seen) 
             VALUES (?, ?, ?, ?, ?, ?, 'online', NOW()) 
             ON DUPLICATE KEY UPDATE 
             hostname=?, ip_address=?, default_gateway=?, subnet_mask=?, os_name=?, last_seen=NOW(), status='online'`,
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
        const { machine_uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius } = data;

        if (!machine_uuid) return;

        const cpu = parseFloat(cpu_usage_percent) || 0;
        const ram = parseFloat(ram_usage_percent) || 0;
        const diskFree = parseFloat(disk_free_percent) || 0;
        const temp = parseFloat(temperature_celsius) || 0;

        await db.execute(`
            UPDATE machines SET 
                cpu_usage = ?, ram_usage = ?, disk_usage = ?, temperature = ?, 
                last_seen = NOW(), status = 'online'
            WHERE uuid = ?
        `, [cpu, ram, diskFree, temp, machine_uuid]);

        let machineId = null;
        try {
            const [rows] = await db.execute('SELECT id FROM machines WHERE uuid = ?', [machine_uuid]);
            
            if (rows.length > 0) {
                machineId = rows[0].id;

                await db.execute(`
                    INSERT INTO telemetry_logs (machine_id, cpu_usage, ram_usage, disk_usage, temperature)
                    VALUES (?, ?, ?, ?, ?)
                `, [machineId, cpu, ram, diskFree, temp]);
                
                await db.execute(`
                    DELETE FROM telemetry_logs 
                    WHERE machine_id = ? 
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id 
                            FROM telemetry_logs 
                            WHERE machine_id = ? 
                            ORDER BY created_at DESC 
                            LIMIT 10
                        ) as keep_latest
                    )
                `, [machineId, machineId]);

                await checkCpuHealth(machineId, cpu);
            }
        } catch (dbErr) {
            console.error("Erro ao salvar log/limpar:", dbErr.message);
        }

        const socketData = { uuid: machine_uuid, cpu, ram, disk: diskFree, temp, last_seen: new Date() };
        const io = globalIo || socketHandler.getIO(); 
        
        if (io) {
            io.emit('machine_update', socketData); 
            io.emit(`machine_${machine_uuid}`, socketData);
        }

        return { message: "Telemetria processada e histórico limpo" };
    } catch (error) {
        console.error("Erro no processTelemetry:", error);
    }
};

exports.listMachines = async () => {
    const [machines] = await db.execute(`
        SELECT m.id, m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, 
               m.sector, 
               h.cpu_model, h.ram_total_gb, h.disk_total_gb, h.machine_type
        FROM machines m 
        LEFT JOIN hardware_specs h ON m.id = h.machine_id 
        ORDER BY m.sector ASC, m.status DESC, m.hostname ASC /* Ordena por setor primeiro */
    `);
    return machines;
};


exports.updateMachineSector = async (uuid, sector) => {
    try {
        const [result] = await db.execute(
            `UPDATE machines SET sector = ? WHERE uuid = ?`,
            [sector, uuid]
        );
        return result.affectedRows > 0;
    } catch (error) {
        console.error("Erro no Service updateMachineSector:", error);
        throw error;
    }
};

exports.getMachineDetails = async (uuid) => {
    const machine_id = await getMachineId(uuid);
    if (!machine_id) return null;

    const [details] = await db.execute(`
        SELECT m.*, h.* FROM machines m 
        LEFT JOIN hardware_specs h ON m.id = h.machine_id 
        WHERE m.uuid = ?
    `, [uuid]);

    const [network] = await db.execute('SELECT * FROM network_interfaces WHERE machine_id = ?', [machine_id]);
    const [software] = await db.execute('SELECT * FROM installed_software WHERE machine_id = ?', [machine_id]);


    const [telemetryHistory] = await db.execute(`
        SELECT cpu_usage, ram_usage, disk_usage, temperature, created_at 
        FROM telemetry_logs 
        WHERE machine_id = ? 
        ORDER BY created_at DESC 
        LIMIT 20
    `, [machine_id]);

    const [alerts] = await db.execute('SELECT * FROM alerts WHERE machine_id = ? AND is_resolved = FALSE', [machine_id]);

    return {
        ...details[0],
        network_interfaces: network,
        installed_software: software,
        telemetry_history: telemetryHistory.reverse(), 
        last_telemetry: telemetryHistory.length > 0 ? telemetryHistory[telemetryHistory.length - 1] : null,
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
            topology[gw] = { gateway: gw, subnet: m.subnet_mask || 'N/A', machines: [] };
        }
        topology[gw].machines.push(m);
    });

    return Object.values(topology);
};