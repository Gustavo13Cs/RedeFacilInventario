const { getMachineId } = require('../config/db');
const commandService = require('../services/commandService');

exports.setWallpaper = async (req, res) => {
    try {
        const { uuid } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'Nenhuma imagem enviada ou formato inválido.' });
        }

        const serverIp = "192.168.50.20"; 
        const imageUrl = `http://${serverIp}:3001/uploads/${req.file.filename}`;

        const machine_id = await getMachineId(uuid);
        if (!machine_id) {
            return res.status(404).json({ error: 'Máquina não encontrada.' });
        }

        commandService.addCommand(uuid, {
            command: 'set_wallpaper',
            payload: imageUrl
        });

        console.log(`🖼️ Wallpaper agendado via commandService: ${req.file.filename} para ${uuid}`);

        return res.json({
            message: 'Papel de parede enviado!',
            url: imageUrl
        });

    } catch (err) {
        console.error('Erro no Controller de Wallpaper:', err);
        return res.status(500).json({ error: 'Erro interno.' });
    }
};