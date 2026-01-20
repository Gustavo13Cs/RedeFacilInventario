const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('./config/db'); 

const cleanupService = require('./services/cleanupService');
const wallpaperRoutes = require('./routes/wallpaperRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes'); 
const monitorRoutes = require('./routes/monitorRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const alertRoutes = require('./routes/alertRoutes');
const authRoutes = require('./routes/authRoutes');
const simCardRoutes = require('./routes/simCardRoutes');
const financialRoutes = require('./routes/financialRoutes'); 
const whatsappRoutes = require('./routes/whatsappRoutes');

const authMiddleware = require('./middleware/auth'); 
const socketHandler = require('./socket/socketHandler'); 
const monitorService = require('./services/monitorServices'); 
const whatsappService = require('./services/whatsappService');
const deviceRoutes = require('./routes/deviceRoutes');

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

const uploadsPath = path.resolve(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});


app.use('/updates', express.static(path.join(__dirname, '../updates')));
app.use('/api/credentials', require('./routes/credentialRoutes'));
app.use('/api', monitorRoutes); 
app.use('/auth', authRoutes);  


app.use(authMiddleware); 

app.use('/api', wallpaperRoutes)
app.use('/api/devices', deviceRoutes);
app.use('/api/whatsapp', whatsappRoutes); 
app.use('/api', maintenanceRoutes);
app.use('/api/telemetry', telemetryRoutes); 
app.use('/api/alerts', alertRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/chips', simCardRoutes);
app.use('/api/financial', financialRoutes); 
app.use('/api', wallpaperRoutes);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    whatsappService.start();
    
    cleanupService.cleanOldWallpapers(uploadsPath, 24);

    setInterval(() => {
        console.log("♻️ Iniciando rotina periódica de limpeza de uploads...");
        cleanupService.cleanOldWallpapers(uploadsPath, 1);
    }, 12 * 60 * 60 * 1000);

    setInterval(() => { monitorService.checkOfflineMachines(); }, 5000);
    
    console.log(`Servidor rodando na porta ${PORT}`);
});
