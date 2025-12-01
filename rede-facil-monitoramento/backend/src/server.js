const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// 1. IMPORTAÇÕES DA ESTRUTURA
require('./config/db'); // 👈 Apenas carrega a conexão inicial
const machineRoutes = require('./routes/machineRoutes');
const setupSocketIo = require('./socket/socketHandler');
const monitorService = require('./services/monitorService');


const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// 2. Configuração do Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// 3. CONFIGURAÇÃO DE DEPENDÊNCIA CRUZADA (Service precisa do IO)
monitorService.setSocketIo(io);
setupSocketIo(io);


// 4. ROTAS BASE E ROTAS DA API
app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});

// Todas as rotas da API agora começam com /api
app.use('/api', machineRoutes);


// 5. INICIALIZAÇÃO DO SERVIDOR
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});