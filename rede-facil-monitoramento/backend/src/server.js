const express = require('express');
const cors = require('cors');
const http = require('http');

require('./config/db'); 

// Rotas
const maintenanceRoutes = require('./routes/maintenanceRoutes'); 
const monitorRoutes = require('./routes/monitorRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const alertRoutes = require('./routes/alertRoutes');
const authRoutes = require('./routes/authRoutes');
const simCardRoutes = require('./routes/simCardRoutes');
const financialRoutes = require('./routes/financialRoutes'); 
const whatsappRoutes = require('./routes/whatsappRoutes');

// Serviços e Middleware
const authMiddleware = require('./middleware/auth'); 
const socketHandler = require('./socket/socketHandler'); 
const monitorService = require('./services/monitorServices'); 
const whatsappService = require('./services/whatsappService');

const app = express();
const server = http.createServer(app);

app.use(express.json());

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));

const io = socketHandler.init(server);
if (monitorService.setSocketIo) {
    monitorService.setSocketIo(io);
}

app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});

// ==================================================================
// 🟢 ZONA PÚBLICA (Acesso LIBERADO sem senha)
// ==================================================================

app.use('/api', monitorRoutes); 
app.use('/auth', authRoutes);  

// 👇 AQUI! O WhatsApp agora está acessível para você pegar o ID
app.use('/api/whatsapp', whatsappRoutes); 

// ==================================================================
// 🔴 ZONA PRIVADA (Bloqueia tudo abaixo pedindo senha)
// ==================================================================
app.use(authMiddleware); // <--- O Porteiro

app.use('/api', maintenanceRoutes);
app.use('/api/telemetry', telemetryRoutes); 
app.use('/api/alerts', alertRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/chips', simCardRoutes);
app.use('/api/financial', financialRoutes); 

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
    whatsappService.start();
    console.log(`💰 Módulo Financeiro ativo em: http://localhost:${PORT}/api/financial/report`);
});