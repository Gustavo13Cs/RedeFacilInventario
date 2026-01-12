const whatsappService = require('../services/whatsappService');

exports.getStatus = (req, res) => {
    const data = whatsappService.getStatus();
    res.json(data);
};

exports.getGroups = async (req, res) => {
    try {
        const groups = await whatsappService.listGroups();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.sendMessageTest = async (req, res) => {
    const { target, message } = req.body;
    await whatsappService.sendMessage(target, message);
    res.json({ message: 'Enviado' });
};