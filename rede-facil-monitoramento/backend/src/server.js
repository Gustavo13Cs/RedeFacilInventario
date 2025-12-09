const express = require('express');
const cors = require('cors');
const http = require('http');

require('./config/db'); 

// Importações (mantidas)
const authMiddleware = require('./middleware/auth'); 
const maintenanceRoutes = require('./routes/maintenanceRoutes'); 
const monitorRoutes = require('./routes/monitorRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const alertRoutes = require('./routes/alertRoutes');
const authRoutes = require('./routes/authRoutes');
const simCardRoutes = require('./routes/simCardRoutes');
const socketHandler = require('./socket/socketHandler'); 
const monitorService = require('./services/monitorServices'); 

const app = express();
const server = http.createServer(app); // Cria o servidor HTTP

app.use(express.json());
app.use(cors());


// 🚨 REMOVENDO A DUPLA INICIALIZAÇÃO. A INICIALIZAÇÃO REAL VAI PARA server.listen()
// const io = socketHandler.init(server); 
// if (monitorService.setSocketIo) {
//     monitorService.setSocketIo(io);
// }


app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});


// =================================================================
// 1. ROTAS PÚBLICAS (AGENTE GO E AUTENTICAÇÃO DE USUÁRIO)
// =================================================================

// Rotas de Monitoramento/Registro (Públicas - Agente Go, contém /register e /telemetry)
app.use('/api', monitorRoutes); 

// Rotas de Autenticação (Login/Registro de Usuário - Públicas)
app.use('/auth', authRoutes);


// =================================================================
// 2. APLICAÇÃO DA AUTENTICAÇÃO (PROTEGE O DASHBOARD)
// =================================================================

// 🚨 APLICA O MIDDLEWARE DE AUTENTICAÇÃO A TODAS AS ROTAS ABAIXO
app.use(authMiddleware); 


// =================================================================
// 3. ROTAS PROTEGIDAS (DASHBOARD)
// =================================================================
app.use('/api/telemetry', telemetryRoutes); 
app.use('/api/alerts', alertRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/chips', simCardRoutes);
app.use('/api', maintenanceRoutes); 


const PORT = process.env.PORT || 3001;
// 🚨 CORREÇÃO: Inicializa o Socket.IO APÓS o servidor HTTP começar a ouvir
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
    
    // Inicialização ÚNICA do Socket.IO AQUI:
    const io = socketHandler.init(server);
    
    // Passa a instância do Socket.IO para o Service
    if (monitorService.setSocketIo) {
        monitorService.setSocketIo(io);
    }
});