const db = require('../config/db');

let socketIo;

function setSocketIo(ioInstance) {
    socketIo = ioInstance;
}

async function getMachineId(uuid) {
    const [rows] = await db.execute('SELECT id, hostname FROM machines WHERE uuid = ?', [uuid]);
    if (rows.length > 0) {
        return rows[0];
    }
    return null;
}

async function registerOrUpdateMachine(data) {
    const { 
        uuid, hostname, ip_address, os_name, 
        cpu_model, ram_total_gb, disk_total_gb, mac_address,
        installed_software 
    } = data;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        
        await connection.execute(
            `INSERT INTO machines (uuid, hostname, ip_address, os_name, status, last_seen) 
             VALUES (?, ?, ?, ?, 'online', NOW()) 
             ON DUPLICATE KEY UPDATE 
             hostname=?, ip_address=?, os_name=?, status='online', last_seen=NOW()`,
            [uuid, hostname, ip_address, os_name, hostname, ip_address, os_name]
        );

        const [rows] = await connection.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
        const machine_id = rows[0].id;
        const [specsRows] = await connection.execute('SELECT id FROM hardware_specs WHERE machine_id = ?', [machine_id]);

        if (specsRows.length === 0) {
            await connection.execute(
                `INSERT INTO hardware_specs (machine_id, cpu_model, ram_total_gb, disk_total_gb, mac_address)
                 VALUES (?, ?, ?, ?, ?)`,
                [machine_id, cpu_model, ram_total_gb, disk_total_gb, mac_address]
            );
        } else {
            await connection.execute(
                `UPDATE hardware_specs SET cpu_model=?, ram_total_gb=?, disk_total_gb=?, mac_address=? WHERE machine_id=?`,
                [cpu_model, ram_total_gb, disk_total_gb, mac_address, machine_id]
            );
        }

        await connection.commit();
        console.log(`✅ Máquina ${hostname} (${uuid}) registrada/atualizada.`);
        if (socketIo) {
            socketIo.emit('machine_updated', { uuid, hostname, status: 'online' });
        }

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Erro ao registrar máquina:", error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

async function processTelemetry(data) {
    const { machine_uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius } = data;

    const machineData = await getMachineId(machine_uuid);

    if (!machineData) {
        console.error(`⚠️ Telemetria recebida de máquina desconhecida: ${machine_uuid}`);
        return; 
    }

    const machine_id = machineData.id;
    const hostname = machineData.hostname;

    await db.execute(
        `INSERT INTO telemetry (machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius)
         VALUES (?, ?, ?, ?, ?)`,
        [machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius || null]
    );

    if (cpu_usage_percent > 90) {
        const alert_message = `Uso de CPU crítico (${cpu_usage_percent.toFixed(2)}%) na máquina ${hostname}.`;
        
        const [existingAlerts] = await db.execute(
            `SELECT id FROM alerts WHERE machine_id = ? AND alert_type = 'critical' AND is_resolved = FALSE AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
            [machine_id]
        );

        if (existingAlerts.length === 0) {
            await db.execute(
                `INSERT INTO alerts (machine_id, alert_type, message) VALUES (?, 'critical', ?)`,
                [machine_id, alert_message]
            );
            
            console.log(`🚨 ALERTA GERADO: ${alert_message}`);

            if (socketIo) {
                socketIo.emit('new_alert', { machine_id, hostname, alert_type: 'critical', message: alert_message });
            }
        }
    }
    
    if (socketIo) {
        socketIo.emit('new_telemetry', {
            machine_uuid,
            cpu_usage_percent,
            ram_usage_percent,
            timestamp: new Date()
        });
    }
}

module.exports = {
    setSocketIo,
    registerOrUpdateMachine,
    processTelemetry
};