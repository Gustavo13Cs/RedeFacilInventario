const { db } = require('../config/db');
const fs = require('fs');
const path = require('path');

const RETENTION_HOURS = 24; 

const startCleanupTask = () => {
    console.log(`🧹 Serviço de Limpeza Automática iniciado`);

    setInterval(async () => {
        try {
            console.log('🧹 Executando limpeza de logs antigos...');

            const [resTele] = await db.execute(`
                DELETE FROM telemetry_logs 
                WHERE created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
            `, [RETENTION_HOURS]);

            const [resNet] = await db.execute(`
                DELETE FROM network_logs 
                WHERE created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
            `, [RETENTION_HOURS]);

            console.log(`✅ Limpeza concluída! Logs removidos: ${resTele.affectedRows}, Rede removida: ${resNet.affectedRows}`);

        } catch (error) {
            console.error('❌ Erro durante a limpeza automática:', error.message);
        }
    }, 1000 * 60 * 60); 
};

const cleanOldWallpapers = (directory, hours) => {
    fs.readdir(directory, (err, files) => {
        if (err) return console.error('Erro ao ler pasta uploads:', err);

        files.forEach(file => {
            const filePath = path.join(directory, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                const now = Date.now();
                const endTime = new Date(stats.mtime).getTime() + (hours * 60 * 60 * 1000);

                if (now > endTime) {
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Erro ao deletar:', filePath);
                    });
                }
            });
        });
    });
};

module.exports = { startCleanupTask, cleanOldWallpapers };