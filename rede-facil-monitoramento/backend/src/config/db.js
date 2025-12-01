const mysql = require('mysql2/promise');

// Configuração e Conexão com o Banco de Dados
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || 'admin123',
    database: process.env.DB_NAME || 'inventarioredefacil',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificação inicial da conexão
db.getConnection()
    .then(connection => {
        console.log('✅ Conectado ao MySQL com sucesso!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Erro ao conectar no MySQL:', err.message);
        // Não é bom sair do processo se for apenas um erro de log/alerta.
        // Se a aplicação não puder rodar sem DB, descomente: process.exit(1);
    });

// Função Auxiliar: Busca o ID da máquina pelo UUID
// Mantemos aqui pois é uma função de utilidade de DB
async function getMachineId(uuid) {
    const [rows] = await db.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
    return rows.length > 0 ? rows[0].id : null;
}

// Exporta o pool e a função auxiliar
module.exports = { db, getMachineId };