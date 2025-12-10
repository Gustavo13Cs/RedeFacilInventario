let io;

exports.init = (httpServer) => {
    io = require('socket.io')(httpServer, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });
    console.log('✅ Socket.IO inicializado.');
    return io;
};

exports.getIO = () =>{
    if (!io) {
        throw new Error('Socket.io não foi inicializado! Chame .init(server) em server.js.');
    }
    return io;
};