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
        throw new Error('Dados essenciais de registro (uuid, hostname, ip_address, os_name) estão faltando.');
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

       await connection.commit(); 
        return { message: 'Máquina registrada/atualizada com sucesso', machine_id, ip_address };

    } catch (error) {
        if (connection) {
            console.error('❌ Transação de Registro/Atualização Desfeita:', error.message);
            await connection.rollback(); 
        }
        throw error; 
    } finally {
        if (connection) connection.release();
    }
};

const MAX_TELEMETRY_RECORDS = 5;


exports.processTelemetry = async (data) => {
    if (!data) return;
    
    const {
        uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, disk_smart_status
    } = data;
    
    if (!uuid) throw new Error('UUID da máquina é obrigatório para telemetria.');
    
    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) throw new Error('Máquina não encontrada. Registre-a primeiro.');
        
        const cpu_raw = parseFloat(cpu_usage_percent);
        const ram_raw = parseFloat(ram_usage_percent);
        const disk_raw = parseFloat(disk_free_percent);
        const temp_raw = temperature_celsius ? parseFloat(temperature_celsius) : null;
        
        const cpu_usage = isNaN(cpu_raw) ? null : parseFloat(cpu_raw.toFixed(2));
        const ram_usage = isNaN(ram_raw) ? null : parseFloat(ram_raw.toFixed(2));
        const disk_free = isNaN(disk_raw) ? null : parseFloat(disk_raw.toFixed(4)); 
        const temperature = (temp_raw === null || isNaN(temp_raw)) ? null : parseFloat(temp_raw.toFixed(2));
        
        const disk_status = disk_smart_status || 'OK';
        
        await db.execute(
            `INSERT INTO telemetry_logs (machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, disk_smart_status, temperature_celsius)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [machine_id, cpu_usage, ram_usage, disk_free, disk_status, temperature]
        );

        const offset = MAX_TELEMETRY_RECORDS - 1; 
        const [lastKeepRows] = await db.execute(
            `SELECT id FROM telemetry_logs WHERE machine_id = ? ORDER BY created_at DESC LIMIT 1 OFFSET ${offset}`,
            [machine_id]
        );
        
        if (lastKeepRows.length > 0) {
            const keep_id = lastKeepRows[0].id;
            const [result] = await db.execute(
                `DELETE FROM telemetry_logs WHERE machine_id = ? AND id < ?`,
                [machine_id, keep_id]
            );
            if (result && result.affectedRows > 0) {
            }
        }
        
        const [machineRow] = await db.execute('SELECT hostname FROM machines WHERE id = ?', [machine_id]);
        const hostname = machineRow[0].hostname;

        const createAlert = async (type, message) => {
            const [existingAlerts] = await db.execute(
                `SELECT id FROM alerts WHERE machine_id = ? AND alert_type = ? AND is_resolved = FALSE AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
                [machine_id, type]
            );

            if (existingAlerts.length === 0) { 
                await db.execute(
                    `INSERT INTO alerts (machine_id, alert_type, message) VALUES (?, ?, ?)`,
                    [machine_id, type, message]
                );
    
                if (globalIo) {
                    globalIo.emit('new_alert', { machine_id, uuid, alert_type: type, message: message, created_at: new Date() });
                }
            }
        };

        if (cpu_usage && cpu_usage > 90) { 
            await createAlert('critical', `Uso de CPU crítico (${cpu_usage.toFixed(2)}%) na máquina ${hostname} (${uuid}).`);
        }

        if (disk_free !== null && disk_free < 10) {
            await createAlert('warning', `Espaço em disco baixo (${disk_free.toFixed(2)}% livre) na máquina ${hostname}.`);
        }

        if (disk_status && disk_status.toUpperCase() !== 'OK') {
            await createAlert('hardware', `FALHA S.M.A.R.T DETECTADA no disco da máquina ${hostname}. Backup urgente!`);
        }
        await db.execute(
            `UPDATE machines SET status = 'online', last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
            [machine_id]
        );

        if (globalIo) {
            globalIo.emit('new_telemetry', { 
                machine_uuid: uuid, 
                cpu_usage_percent: cpu_usage ? cpu_usage.toFixed(2) : 'N/A', 
                ram_usage_percent: ram_usage ? ram_usage.toFixed(2) : 'N/A', 
                disk_free_percent: disk_free ? disk_free.toFixed(2) : 'N/A',
                disk_smart_status: disk_status, // Enviando status novo para o front
                temperature_celsius: temperature ? temperature.toFixed(2) : 'N/A'
            });
        }

        return { message: 'Dados de telemetria recebidos e processados' };
    } catch (error) {
        console.error('❌ Erro no Service (processTelemetry):', error); 
        throw error;
    }
};

exports.listMachines = async () => {
    try { 
        const [machines] = await db.execute(
            `SELECT m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, h.cpu_model, h.ram_total_gb, h.disk_total_gb FROM machines m LEFT JOIN hardware_specs h ON m.id = h.machine_id ORDER BY m.status DESC, m.hostname`
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

        const [lastTelemetry] = await db.execute(
            `SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, disk_smart_status, temperature_celsius, created_at 
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

        delete response.machine_id; 
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

        const [history] = await db.execute(
            `SELECT 
                cpu_usage_percent, ram_usage_percent, disk_free_percent, disk_smart_status, temperature_celsius, created_at
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