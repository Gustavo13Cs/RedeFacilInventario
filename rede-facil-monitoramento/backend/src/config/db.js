const mysql = require('mysql2/promise');


const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || 'adminpassword', 
    database: process.env.DB_NAME || 'inventarioredefacil',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


const getMachineId = async (uuid) => {
    const [rows] = await db.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
    return rows.length > 0 ? rows[0].id : null;
};


db.getConnection()
    .then(connection => {
        console.log('✅ Conectado ao MySQL com sucesso!');
        connection.release();
    })
    .catch(err => {
        const dbPass = process.env.DB_PASS || 'adminpassword'; 
        if (err.code === 'ER_ACCESS_DENIED_ERROR' && err.message.includes(dbPass)) {
             console.error('❌ Erro de autenticação no MySQL: Verifique a senha e o usuário.');
        } else {
             console.error('❌ Erro ao conectar no MySQL:', err.message);
        }
        
    });

module.exports = { db, getMachineId };