const { getMachineId } = require('../config/db');
const commandService = require('../services/commandService');

exports.setWallpaper = async (req, res) => {
    try {
        const { uuid } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
        }

        const protocol = req.protocol; 
        const host = req.get('host'); 
        const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

        const machine_id = await getMachineId(uuid);
        if (!machine_id) return res.status(404).json({ error: 'Máquina offline ou não cadastrada.' });

        commandService.addCommand(uuid, {
            command: 'set_wallpaper',
    payload: imageUrl 
});

        return res.json({ message: 'Comando enviado ao PC!', url: imageUrl });
    } catch (err) {
        return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};