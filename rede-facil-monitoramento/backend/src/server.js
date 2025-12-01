const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

require('./config/db'); 
const machineRoutes = require('./routes/machineRoutes');
const setupSocketIo = require('./socket/socketHandler');
const monitorService = require('./services/monitorService');


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

app.use('/api', machineRoutes);


const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});