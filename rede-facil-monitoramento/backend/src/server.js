const express = require('express');
const mysql = require('mysql2/promise'); // Usando a API promise para async/await
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Configuração do Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", // Permite conexão de qualquer origem (ajuste em produção!)
        methods: ["GET", "POST"]
    }
});

// Configuração e Conexão com o Banco de Dados (usando pool de conexões promise)
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || 'admin123',
    database: process.env.DB_NAME || 'inventarioredefacil',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificação inicial da conexão
db.getConnection()
    .then(connection => {
        console.log('✅ Conectado ao MySQL com sucesso!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Erro ao conectar no MySQL:', err.message);
        // Em um ambiente de produção, você pode querer sair do processo aqui
    });

// Função Auxiliar: Busca o ID da máquina pelo UUID
async function getMachineId(uuid) {
    const [rows] = await db.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
    return rows.length > 0 ? rows[0].id : null;
}

// ----------------------------------------------------
// ROTAS BASE
// ----------------------------------------------------

app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});

// ----------------------------------------------------
// ROTA 1: REGISTRO/ATUALIZAÇÃO DE MÁQUINAS (INVENTÁRIO)
// ----------------------------------------------------
app.post('/api/machines/register', async (req, res) => {
    const { 
        uuid, hostname, ip_address, os_name, 
        cpu_model, ram_total_gb, disk_total_gb, mac_address,
        installed_software // Array: [{ name: 'Software Name', version: '1.0', install_date: '2023-01-01' }]
    } = req.body;

    if (!uuid || !hostname) {
        return res.status(400).json({ message: 'UUID e hostname são obrigatórios.' });
    }

    let connection;
    try {
        // 1. Iniciar Transação
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 2. Inserir/Atualizar Máquina (tabela machines)
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

        // 4. Inserir/Atualizar Specs de Hardware (tabela hardware_specs)
        const [specsRows] = await connection.execute('SELECT id FROM hardware_specs WHERE machine_id = ?', [machine_id]);

        if (specsRows.length === 0) {
            // Inserir
            await connection.execute(
                `INSERT INTO hardware_specs (machine_id, cpu_model, ram_total_gb, disk_total_gb, mac_address)
                 VALUES (?, ?, ?, ?, ?)`,
                [machine_id, cpu_model || null, ram_total_gb || null, disk_total_gb || null, mac_address || null]
            );
        } else {
            // Atualizar
            await connection.execute(
                `UPDATE hardware_specs SET cpu_model=?, ram_total_gb=?, disk_total_gb=?, mac_address=? WHERE machine_id = ?`,
                [cpu_model || null, ram_total_gb || null, disk_total_gb || null, mac_address || null, machine_id]
            );
        }
        
        // 5. Inserir Software (tabela installed_software)
        // Limpar softwares antigos e inserir novos (sincronização)
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

        // 6. Commit e Resposta
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

// ----------------------------------------------------
// ROTA 2: INGESTÃO E PROCESSAMENTO DE TELEMETRIA
// ----------------------------------------------------
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

        // 1. Salvar no Banco de Dados (telemetry_logs)
        await db.execute(
            `INSERT INTO telemetry_logs (machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius)
             VALUES (?, ?, ?, ?, ?)`,
            [machine_id, cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius || null]
        );

        // 2. Verificação de Alertas (Ex: CPU Crítica > 90%)
        if (cpu_usage_percent > 90) {
            const alert_message = `Uso de CPU crítico (${cpu_usage_percent.toFixed(2)}%) na máquina ${uuid} (${(await db.execute('SELECT hostname FROM machines WHERE id = ?', [machine_id]))[0][0].hostname}).`;
            
            // Verifica se já existe um alerta similar e não resolvido na última hora para evitar spam
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
        
        // 3. Atualizar status da máquina (mantê-la 'online')
        await db.execute(
            `UPDATE machines SET status = 'online', last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
            [machine_id]
        );

        // 4. Transmitir em Tempo Real via Socket.io
        io.emit('new_telemetry', { uuid, cpu_usage_percent, ram_usage_percent, disk_free_percent });


        res.status(200).send('Dados de telemetria recebidos e processados');
    } catch (error) {
        console.error('❌ Erro ao processar telemetria:', error.message);
        res.status(500).json({ message: 'Erro interno ao processar os dados de telemetria.', error: error.message });
    }
});

// ----------------------------------------------------
// ROTAS DE CONSULTA PARA O DASHBOARD
// ----------------------------------------------------

// ROTA 3: LISTAR TODAS AS MÁQUINAS (GET /api/machines)
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

// ROTA 4: DETALHES DE UMA MÁQUINA (GET /api/machines/:uuid)
app.get('/api/machines/:uuid', async (req, res) => {
    const { uuid } = req.params;
    try {
        // 1. Informações Básicas e Hardware
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

        // 2. Software Instalado
        const [software] = await db.execute(
            `SELECT software_name, version, install_date FROM installed_software WHERE machine_id = ? ORDER BY software_name`,
            [machine_id]
        );

        // 3. Última Telemetria
        const [lastTelemetry] = await db.execute(
            `SELECT cpu_usage_percent, ram_usage_percent, disk_free_percent, temperature_celsius, created_at 
             FROM telemetry_logs 
             WHERE machine_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [machine_id]
        );

        // 4. Últimos Alertas Abertos
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

        delete response.machine_id; // Remove o ID interno da resposta
        res.json(response);

    } catch (error) {
        console.error('❌ Erro ao buscar detalhes da máquina:', error.message);
        res.status(500).json({ message: 'Erro ao buscar detalhes da máquina.', error: error.message });
    }
});


// ROTA 5: HISTÓRICO DE TELEMETRIA (GET /api/telemetry/:uuid/history)
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


// ROTA 6: LISTAR ALERTAS (GET /api/alerts)
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


// ROTA 7: RESOLVER ALERTA (PUT /api/alerts/:id/resolve)
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

// ----------------------------------------------------
// SOCKET.IO (Tempo Real)
// ----------------------------------------------------

io.on('connection', (socket) => {
    console.log('🔌 Novo cliente conectado ao Dashboard:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
    });
});

// ----------------------------------------------------
// INICIALIZAÇÃO DO SERVIDOR
// ----------------------------------------------------

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});