const { getMachineId } = require('../config/db');
const commandService = require('../services/commandService');

exports.setWallpaper = async (req, res) => {
    try {
        const { uuid } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
        }

        // Torna a URL dinâmica baseada em quem chamou a API
        const protocol = req.protocol; 
        const host = req.get('host'); 
        const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

        const machine_id = await getMachineId(uuid);
        if (!machine_id) return res.status(404).json({ error: 'Máquina offline ou não cadastrada.' });

        // Adiciona o comando para o Agente buscar
        commandService.addCommand(uuid, {
            command: 'set_wallpaper',
            payload: {
                url: imageUrl,
                filename: req.file.filename
            }
        });

        return res.json({ message: 'Comando enviado ao PC!', url: imageUrl });
    } catch (err) {
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};