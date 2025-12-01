function setupSocketIo(io) {
    io.on('connection', (socket) => {
        console.log('🔌 Novo cliente conectado ao Dashboard:', socket.id);
        socket.on('disconnect', () => {
            console.log('❌ Cliente desconectado:', socket.id);
        });
    });
}

module.exports = setupSocketIo;s