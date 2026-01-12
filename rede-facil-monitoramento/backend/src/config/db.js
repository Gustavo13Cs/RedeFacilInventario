const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost', 
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || 'adminpassword', 
    database: process.env.DB_NAME || 'inventarioredefacil',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,      
    keepAliveInitialDelay: 0,
    connectTimeout: 30000        
};

const db = mysql.createPool(dbConfig);

const getMachineId = async (uuid) => {
    try {
        const [rows] = await db.execute('SELECT id FROM machines WHERE uuid = ?', [uuid]);
        return rows.length > 0 ? rows[0].id : null;
    } catch (error) {
        return null;
    }
};

(async () => {
    try {
        const connection = await db.getConnection();
        connection.release();
    } catch (err) {
        if (err.code === 'ETIMEDOUT') {
            console.error('   DICA: O backend não alcançou o banco. Verifique se o container "db" está rodando.');
        }
    }
})();

module.exports = { db, getMachineId };