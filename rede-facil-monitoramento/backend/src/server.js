const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

require('./config/db'); 
// CORREÇÃO: Usar os nomes corretos dos arquivos de rotas
const monitorRoutes = require('./routes/monitorRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const alertRoutes = require('./routes/alertRoutes');
const setupSocketIo = require('./socket/socketHandler');
const monitorService = require('./services/monitorServices'); 


const app = express();
const server = http.createServer(app);


app.use(express.json());
app.use(cors());

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

monitorService.setSocketIo(io);
setupSocketIo(io);


app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});

// USO CORRETO DAS ROTAS:

// 1. Rotas de Ingestão do Agente: /api/register e /api/telemetry (o agente espera /api/telemetry)
// Montamos monitorRoutes no root, mas PRECISAMOS REMOVER O CONFLITO.
// Vamos montar as máquinas em /api/machines e a ingestão de telemetria no root /api/telemetry.

// Monta todas as rotas de consulta (Listar Máquinas, Detalhes, Histórico de Telemetria)
app.use('/api', monitorRoutes); 

// Monta a rota de Ingestão de Telemetria (POST /api/telemetry) - Cuidado para não duplicar com monitorRoutes
app.use('/api/telemetry', telemetryRoutes); 

// Monta as rotas de Alerta
app.use('/api/alerts', alertRoutes);


const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});