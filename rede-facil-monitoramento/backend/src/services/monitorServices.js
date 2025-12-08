const { db, getMachineId } = require('../config/db');

let globalIo; 

exports.setSocketIo = (ioInstance) => {
    globalIo = ioInstance;
};

const isValidSoftware = (s) => {
    return s && typeof s.name === 'string' && s.name.trim().length > 0;
};

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

exports.processTelemetry = async ({
    uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, disk_smart_status
}) => {
    if (!uuid) throw new Error('UUID obrigatório.');
    
    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) throw new Error('Máquina não encontrada.');
        
        const cpu = parseFloat(cpu_usage_percent || 0);
        const ram = parseFloat(ram_usage_percent || 0);
        const disk = parseFloat(disk_free_percent || 0);
        const temp = temperature_celsius ? parseFloat(temperature_celsius) : null;
        
        await db.execute(
            `INSERT INTO telemetry_logs (machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius)
             VALUES (?, ?, ?, ?, ?)`,
            [machine_id, cpu.toFixed(2), ram.toFixed(2), disk.toFixed(2), temp]
        );

        let newStatus = 'online';
        let alertType = null;
        let alertMessage = null;

        if (cpu > 90) {
            newStatus = 'critical';
            alertType = 'critical';
            alertMessage = `CPU Crítica (${cpu.toFixed(1)}%)`;
        } else if (ram > 95) {
            newStatus = 'critical';
            alertType = 'critical';
            alertMessage = `Memória Cheia (${ram.toFixed(1)}%)`;
        } else if (disk < 5) { 
            newStatus = 'critical';
            alertType = 'critical';
            alertMessage = `Disco Cheio (${disk.toFixed(1)}% livre)`;
        } else if (temp && temp > 85) {
            newStatus = 'warning';
            alertType = 'warning';
            alertMessage = `Superaquecimento (${temp.toFixed(1)}°C)`;
        }


        if (alertType) {
            const [recent] = await db.execute(
                `SELECT id FROM alerts WHERE machine_id = ? AND alert_type = ? AND is_resolved = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
                [machine_id, alertType]
            );

            if (recent.length === 0) {
                await db.execute(
                    `INSERT INTO alerts (machine_id, alert_type, message) VALUES (?, ?, ?)`,
                    [machine_id, alertType, alertMessage]
                );
                
                if (globalIo) {
                    globalIo.emit('new_alert', { machine_id, uuid, alert_type: alertType, message: alertMessage, created_at: new Date() });
                }
            }
        }
        await db.execute(
            `UPDATE machines SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
            [newStatus, machine_id]
        );
        if (globalIo) {
            globalIo.emit('new_telemetry', { 
                machine_uuid: uuid, 
                cpu_usage_percent: cpu, 
                ram_usage_percent: ram, 
                disk_free_percent: disk,
                temperature_celsius: temp,
                status: newStatus 
            });
        }

        return { message: 'Telemetria processada' };

    } catch (error) {
        console.error('❌ Erro no Service (processTelemetry):', error.message);
        throw error;
    }
};

exports.listMachines = async () => {
    const [machines] = await db.execute(
        `SELECT m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, h.cpu_model, h.ram_total_gb, h.disk_total_gb FROM machines m LEFT JOIN hardware_specs h ON m.id = h.machine_id ORDER BY m.status DESC, m.hostname`
    );
    return machines;
};

exports.getMachineDetails = async (uuid) => {
    if (!uuid) return null; 
    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) return null;
        const [details] = await db.execute(
            `SELECT m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, m.created_at, m.id as machine_id,
                h.cpu_model, h.ram_total_gb, h.disk_total_gb, h.mac_address
             FROM machines m LEFT JOIN hardware_specs h ON m.id = h.machine_id WHERE m.uuid = ?`, [uuid]);
        if (details.length === 0) return null;
        const [software] = await db.execute(`SELECT software_name, version, install_date FROM installed_software WHERE machine_id = ? ORDER BY software_name`, [machine_id]);
        const [lastTelemetry] = await db.execute(`SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, created_at FROM telemetry_logs WHERE machine_id = ? ORDER BY created_at DESC LIMIT 1`, [machine_id]);
        const [openAlerts] = await db.execute(`SELECT id, alert_type, message, created_at FROM alerts WHERE machine_id = ? AND is_resolved = FALSE ORDER BY created_at DESC`, [machine_id]);
        const response = { ...details[0], installed_software: software, last_telemetry: lastTelemetry[0] || null, open_alerts: openAlerts };
        return response;
    } catch (error) { throw error; }
};

exports.getTelemetryHistory = async (uuid, limit = 100) => {
    if (!uuid) return [];
    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) return [];
        const numericLimit = Math.max(1, parseInt(limit, 10));
        const [history] = await db.execute(`SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, created_at FROM telemetry_logs WHERE machine_id = ? ORDER BY created_at DESC LIMIT ?`, [machine_id, numericLimit]);
        return history;
    } catch (error) { throw error; }
};