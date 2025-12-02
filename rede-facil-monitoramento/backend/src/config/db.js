const mysql = require('mysql2/promise');

// Configuração e Conexão com o Banco de Dados
const db = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'admin',
    // Usar a mesma senha do docker-compose.yml como fallback (melhor prática)
    password: process.env.DB_PASS || 'adminpassword', 
    database: process.env.DB_NAME || 'inventarioredefacil',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// CORREÇÃO: Função Auxiliar definida como 'const' antes de ser usada no exports.
// Isso garante que ela está definida no escopo.
const getMachineId = async (uuid) => {
    const [rows] = await db.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
    return rows.length > 0 ? rows[0].id : null;
};

// Verificação inicial da conexão
db.getConnection()
    .then(connection => {
        console.log('✅ Conectado ao MySQL com sucesso!');
        connection.release();
    })
    .catch(err => {
        // Correção de log para usar a senha definida no compose
        const dbPass = process.env.DB_PASS || 'adminpassword'; 
        if (err.code === 'ER_ACCESS_DENIED_ERROR' && err.message.includes(dbPass)) {
             console.error('❌ Erro de autenticação no MySQL: Verifique a senha e o usuário.');
        } else {
             console.error('❌ Erro ao conectar no MySQL:', err.message);
        }
        
        // Se a aplicação não puder rodar sem DB, descomente: process.exit(1);
    });

// Exporta o pool e a função auxiliar
module.exports = { db, getMachineId };