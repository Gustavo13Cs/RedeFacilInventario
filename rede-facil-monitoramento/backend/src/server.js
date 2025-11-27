const express = require('express');
const mysql = require('mysql2');
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
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || 'adminpassword',
    database: process.env.DB_NAME || 'inventarioredefacil',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Erro ao conectar no MySQL:', err.message);
    } else {
        console.log('✅ Conectado ao MySQL com sucesso!');
        connection.release();
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});

app.post('/api/telemetry', (req, res) => {
    const data = req.body;
    console.log('📡 Dados recebidos:', data);
    io.emit('new_telemetry', data);

    res.status(200).send('Dados recebidos');
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