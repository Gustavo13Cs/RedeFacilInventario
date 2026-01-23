const fs = require('fs');
const path = require('path');

const RETENTION_HOURS = 24;

/**
 * @param {string} directory - Caminho da pasta (src/uploads)
 * @param {number} maxAgeHours - Tempo máximo de vida do arquivo em horas
 */

const startCleanupTask = () => {
    console.log(`🧹 Serviço de Limpeza Automática iniciado (Rodando a cada 1h)`);

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

module.exports = { startCleanupTask };

exports.cleanOldWallpapers = (directory, maxAgeHours = 24) => {
    const now = Date.now();
    const msPerHour = 60 * 60 * 1000;
    const threshold = now - (maxAgeHours * msPerHour);

    if (!fs.existsSync(directory)) {
        console.log(`⚠️ Pasta ${directory} não encontrada para limpeza.`);
        return;
    }

    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error("❌ Erro ao ler diretório de uploads:", err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(directory, file);
            
            if (!file.startsWith('wallpaper-')) return;

            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`❌ Erro ao ler status de ${file}:`, err);
                    return;
                }

                if (stats.mtimeMs < threshold) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error(`❌ Erro ao deletar arquivo antigo ${file}:`, err);
                        } else {
                            console.log(`🧹 Limpeza: Arquivo antigo removido: ${file}`);
                        }
                    });
                }
            });
        });
    });
};