const fs = require('fs');
const path = require('path');

/**
 * @param {string} directory - Caminho da pasta (src/uploads)
 * @param {number} maxAgeHours - Tempo máximo de vida do arquivo em horas
 */
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