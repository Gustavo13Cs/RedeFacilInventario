let io;

module.exports = {
    init: (httpServer) => {
        const { Server } = require("socket.io");
        io = new Server(httpServer, {
            cors: {
                origin: "*", 
                methods: ["GET", "POST"]
            }
        });

        io.on('connection', (socket) => {
            console.log('🔌 Novo cliente conectado ao Dashboard:', socket.id);
            
            socket.on('disconnect', () => {
                console.log('❌ Cliente desconectado:', socket.id);
            });
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io não foi inicializado!");
        }
        return io;
    }
};