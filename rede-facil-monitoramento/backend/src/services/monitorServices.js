const { db, getMachineId } = require('../config/db');

// Esta função agora precisa receber 'io' para emitir alertas em tempo real
let socketIo;
function setSocketIo(ioInstance) {
    socketIo = ioInstance;
}

// Lógica de Registro/Atualização de Máquina (antiga ROTA 1)
async function registerOrUpdateMachine(data) {
    // ... (Use a transação e toda a lógica complexa de DB da ROTA 1)
    
    // (O código da ROTA 1 vai aqui, dentro de uma função)
    const { 
        uuid, hostname, ip_address, os_name, 
        cpu_model, ram_total_gb, disk_total_gb, mac_address,
        installed_software
    } = data;

    // ... (Validação já foi feita no Controller)

    let connection;
    try {
        // 1. Iniciar Transação
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 2. Inserir/Atualizar Máquina (machines)
        await connection.execute(
            `INSERT INTO machines (uuid, hostname, ip_address, os_name, status) 
             VALUES (?, ?, ?, ?, 'online') 
             ON DUPLICATE KEY UPDATE 
             hostname=?, ip_address=?, os_name=?, last_seen=CURRENT_TIMESTAMP, status='online'`,
            [uuid, hostname, ip_address, os_name, hostname, ip_address, os_name]
        );

        // 3. Obter o ID da máquina (novo ou existente)
        const [rows] = await connection.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
        const machine_id = rows[0].id;

        // 4. Inserir/Atualizar Specs de Hardware (hardware_specs)
        const [specsRows] = await connection.execute('SELECT id FROM hardware_specs WHERE machine_id = ?', [machine_id]);

        if (specsRows.length === 0) {
            await connection.execute(
                `INSERT INTO hardware_specs (machine_id, cpu_model, ram_total_gb, disk_total_gb, mac_address)
                 VALUES (?, ?, ?, ?, ?)`,
                [machine_id, cpu_model || null, ram_total_gb || null, disk_total_gb || null, mac_address || null]
            );
        } else {
            await connection.execute(
                `UPDATE hardware_specs SET cpu_model=?, ram_total_gb=?, disk_total_gb=?, mac_address=? WHERE machine_id = ?`,
                [cpu_model || null, ram_total_gb || null, disk_total_gb || null, mac_address || null, machine_id]
            );
        }
        
        // 5. Inserir Software (installed_software)
        await connection.execute('DELETE FROM installed_software WHERE machine_id = ?', [machine_id]);
        
        if (installed_software && Array.isArray(installed_software) && installed_software.length > 0) {
            const softwareValues = installed_software.map(s => [
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

        // 6. Commit
        await connection.commit();
        return machine_id; 

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        throw error; // Propaga o erro para o Controller
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// Lógica de Ingestão de Telemetria (antiga ROTA 2)
async function processTelemetry(data) {
    const { uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius } = data;
    
    const machine_id = await getMachineId(uuid);
    
    if (!machine_id) {
        throw new Error('Máquina não encontrada.');
    }

    // 1. Salvar no Banco de Dados (telemetry_logs)
    await db.execute(
        `INSERT INTO telemetry_logs (machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius)
         VALUES (?, ?, ?, ?, ?)`,
        [machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius || null]
    );

    // 2. Verificação de Alertas (Lógica de Negócio!)
    if (cpu_usage_percent > 90) {
        const hostnameResult = await db.execute('SELECT hostname FROM machines WHERE id = ?', [machine_id]);
        const hostname = hostnameResult[0][0].hostname;
        const alert_message = `Uso de CPU crítico (${cpu_usage_percent.toFixed(2)}%) na máquina ${uuid} (${hostname}).`;
        
        const [existingAlerts] = await db.execute(
            `SELECT id FROM alerts WHERE machine_id = ? AND alert_type = 'critical' AND is_resolved = FALSE AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
            [machine_id]
        );

        if (existingAlerts.length === 0) {
            await db.execute(
                `INSERT INTO alerts (machine_id, alert_type, message) VALUES (?, 'critical', ?)`,
                [machine_id, alert_message]
            );
            // 🛑 EMITE O ALERTA VIA SOCKET.IO (Usando a instância salva)
            if (socketIo) {
                socketIo.emit('new_alert', { machine_id, alert_type: 'critical', message: alert_message });
            }
        }
    }
    
    // 3. Atualizar status da máquina
    await db.execute(
        `UPDATE machines SET status = 'online', last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
        [machine_id]
    );

    // 4. Transmitir em Tempo Real via Socket.io
    if (socketIo) {
        socketIo.emit('new_telemetry', { uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent });
    }
}

module.exports = { 
    setSocketIo, 
    registerOrUpdateMachine, 
    processTelemetry
    // Você também pode exportar aqui as funções de busca (GET)
};