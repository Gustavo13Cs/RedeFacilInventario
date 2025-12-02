const express = require('express');
const cors = require('cors');
const http = require('http');


require('./config/db'); 
const monitorRoutes = require('./routes/monitorRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const alertRoutes = require('./routes/alertRoutes');

const socketHandler = require('./socket/socketHandler'); 
const monitorService = require('./services/monitorServices'); 

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors());


socketHandler.init(server);


app.get('/', (req, res) => {
    res.json({ message: 'API Rede Fácil Financeira - Online 🚀' });
});


app.use('/api', monitorRoutes); 
app.use('/api/telemetry', telemetryRoutes); 
app.use('/api/alerts', alertRoutes);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});