// src/socket/socketHandler.js
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

exports.getIo = () => {
    if (!io) {
        throw new Error('Socket.io não foi inicializado! Chame .init(server) em server.js.');
    }
    return io;
};