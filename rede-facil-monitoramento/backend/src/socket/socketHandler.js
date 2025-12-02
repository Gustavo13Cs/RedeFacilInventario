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
            console.log('🔌 Front-end conectado:', socket.id);
            socket.on('disconnect', () => console.log('❌ Front-end desconectado:', socket.id));
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io não inicializado!");
        }
        return io;
    }
};