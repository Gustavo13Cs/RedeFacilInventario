const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || 'admin123',
    database: process.env.DB_NAME || 'inventarioredefacil',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection()
    .then(connection => {
        console.log('✅ Conectado ao MySQL com sucesso!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Erro ao conectar no MySQL:', err.message);
    });

async function getMachineId(uuid) {
    const [rows] = await db.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
    return rows.length > 0 ? rows[0].id : null;
}


app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});

app.post('/api/machines/register', async (req, res) => {
    const { 
        uuid, hostname, ip_address, os_name, 
        cpu_model, ram_total_gb, disk_total_gb, mac_address,
        installed_software 
    } = req.body;

    if (!uuid || !hostname) {
        return res.status(400).json({ message: 'UUID e hostname são obrigatórios.' });
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

        await connection.commit();
        res.status(201).json({ message: 'Máquina registrada/atualizada com sucesso', machine_id });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('❌ Erro no registro/atualização da máquina:', error.message);
        res.status(500).json({ message: 'Erro ao processar o registro da máquina.', error: error.message });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

app.post('/api/telemetry', async (req, res) => {
    const { uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius } = req.body;
    
    if (!uuid || cpu_usage_percent === undefined || ram_usage_percent === undefined || disk_free_percent === undefined) {
        return res.status(400).json({ message: 'Dados de telemetria incompletos.' });
    }

    try {
        const machine_id = await getMachineId(uuid);
        
        if (!machine_id) {
            return res.status(404).json({ message: 'Máquina não encontrada. Registre-a primeiro.' });
        }

        await db.execute(
            `INSERT INTO telemetry_logs (machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius)
             VALUES (?, ?, ?, ?, ?)`,
            [machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius || null]
        );

        if (cpu_usage_percent > 90) {
            const alert_message = `Uso de CPU crítico (${cpu_usage_percent.toFixed(2)}%) na máquina ${uuid} (${(await db.execute('SELECT hostname FROM machines WHERE id = ?', [machine_id]))[0][0].hostname}).`;
            
            const [existingAlerts] = await db.execute(
                `SELECT id FROM alerts WHERE machine_id = ? AND alert_type = 'critical' AND is_resolved = FALSE AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
                [machine_id]
            );

            if (existingAlerts.length === 0) {
                await db.execute(
                    `INSERT INTO alerts (machine_id, alert_type, message) VALUES (?, 'critical', ?)`,
                    [machine_id, alert_message]
                );
                io.emit('new_alert', { machine_id, alert_type: 'critical', message: alert_message });
            }
        }
        
        await db.execute(
            `UPDATE machines SET status = 'online', last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
            [machine_id]
        );
        io.emit('new_telemetry', { uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent });


        res.status(200).send('Dados de telemetria recebidos e processados');
    } catch (error) {
        console.error('❌ Erro ao processar telemetria:', error.message);
        res.status(500).json({ message: 'Erro interno ao processar os dados de telemetria.', error: error.message });
    }
});


app.get('/api/machines', async (req, res) => {
    try {
        const [machines] = await db.execute(
            `SELECT 
                m.uuid, m.hostname, m.ip_address, m.os_name, m.status, m.last_seen, m.created_at,
                h.cpu_model, h.ram_total_gb, h.disk_total_gb
             FROM machines m
             LEFT JOIN hardware_specs h ON m.id = h.machine_id
             ORDER BY m.status DESC, m.hostname`
        );
        res.json(machines);
    } catch (error) {
        console.error('❌ Erro ao buscar máquinas:', error.message);
        res.status(500).json({ message: 'Erro ao buscar lista de máquinas.', error: error.message });
    }
});

app.get('/api/machines/:uuid', async (req, res) => {
    const { uuid } = req.params;
    try {
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
            return res.status(404).json({ message: 'Máquina não encontrada.' });
        }

        const machine_id = details[0].machine_id;

        const [software] = await db.execute(
            `SELECT software_name, version, install_date FROM installed_software WHERE machine_id = ? ORDER BY software_name`,
            [machine_id]
        );

        const [lastTelemetry] = await db.execute(
            `SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, created_at 
             FROM telemetry_logs 
             WHERE machine_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [machine_id]
        );

         const [openAlerts] = await db.execute(
            `SELECT alert_type, message, created_at FROM alerts WHERE machine_id = ? AND is_resolved = FALSE ORDER BY created_at DESC`,
            [machine_id]
        );


        const response = {
            ...details[0],
            installed_software: software,
            last_telemetry: lastTelemetry[0] || null,
            open_alerts: openAlerts
        };

        delete response.machine_id; 
        res.json(response);

    } catch (error) {
        console.error('❌ Erro ao buscar detalhes da máquina:', error.message);
        res.status(500).json({ message: 'Erro ao buscar detalhes da máquina.', error: error.message });
    }
});


app.get('/api/telemetry/:uuid/history', async (req, res) => {
    const { uuid } = req.params;
    const { limit = 100 } = req.query; 

    try {
        const machine_id = await getMachineId(uuid);
        if (!machine_id) {
            return res.status(404).json({ message: 'Máquina não encontrada.' });
        }

        const [history] = await db.execute(
            `SELECT 
                cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, created_at
             FROM telemetry_logs
             WHERE machine_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [machine_id, parseInt(limit)]
        );

        res.json(history);
    } catch (error) {
        console.error('❌ Erro ao buscar histórico de telemetria:', error.message);
        res.status(500).json({ message: 'Erro ao buscar histórico de telemetria.', error: error.message });
    }
});


app.get('/api/alerts', async (req, res) => {
    const { resolved = 'false', limit = 55 } = req.query; 

    try {
        const is_resolved_bool = resolved.toLowerCase() === 'true';
        const [alerts] = await db.execute(
            `SELECT 
                a.id, a.alert_type, a.message, a.is_resolved, a.created_at,
                m.uuid, m.hostname
             FROM alerts a
             JOIN machines m ON a.machine_id = m.id
             WHERE a.is_resolved = ?
             ORDER BY a.created_at DESC
             LIMIT ?`,
            [is_resolved_bool, parseInt(limit)]
        );

        res.json(alerts);
    } catch (error) {
        console.error('❌ Erro ao buscar alertas:', error.message);
        res.status(500).json({ message: 'Erro ao buscar lista de alertas.', error: error.message });
    }
});



app.put('/api/alerts/:id/resolve', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute(
            `UPDATE alerts SET is_resolved = TRUE WHERE id = ? AND is_resolved = FALSE`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Alerta não encontrado ou já resolvido.' });
        }

        res.json({ message: `Alerta ${id} resolvido com sucesso.` });
    } catch (error) {
        console.error('❌ Erro ao resolver alerta:', error.message);
        res.status(500).json({ message: 'Erro ao tentar resolver o alerta.', error: error.message });
    }
});


io.on('connection', (socket) => {
    console.log('🔌 Novo cliente conectado ao Dashboard:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});