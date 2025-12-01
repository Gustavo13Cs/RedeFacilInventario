function setupSocketIo(io) {
    io.on('connection', (socket) => {
        console.log('🔌 Novo cliente conectado ao Dashboard:', socket.id);
        
        // Você pode adicionar mais lógica aqui, como juntar o socket a salas (rooms)
        
        socket.on('disconnect', () => {
            console.log('❌ Cliente desconectado:', socket.id);
        });
    });
}

module.exports = setupSocketIo;s