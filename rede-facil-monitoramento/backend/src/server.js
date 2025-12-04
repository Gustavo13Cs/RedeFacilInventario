const express = require('express');
const cors = require('cors');
const http = require('http');

require('./config/db'); 
const monitorRoutes = require('./routes/monitorRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const alertRoutes = require('./routes/alertRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');


const socketHandler = require('./socket/socketHandler'); 
const monitorService = require('./services/monitorServices'); 

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors());


const io = socketHandler.init(server);

if (monitorService.setSocketIo) {
    monitorService.setSocketIo(io);
}

app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});

// Rotas
app.use('/api', monitorRoutes); 
app.use('/api/telemetry', telemetryRoutes); 
app.use('/api/alerts', alertRoutes);
app.use('/api/inventory', inventoryRoutes);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});