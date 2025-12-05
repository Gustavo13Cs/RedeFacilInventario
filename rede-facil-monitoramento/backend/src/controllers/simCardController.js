const simCardService = require('../services/simCardService');

exports.listSimCards = async (req, res) => {
    try {
        const list = await simCardService.listSimCards();
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSimCard = async (req, res) => {
    try {
        await simCardService.createSimCard(req.body);
        res.status(201).json({ message: 'Chip criado!' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateSimCard = async (req, res) => {
    try {
        await simCardService.updateSimCard(req.params.id, req.body);
        res.json({ message: 'Atualizado!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteSimCard = async (req, res) => {
    try {
        await simCardService.deleteSimCard(req.params.id);
        res.json({ message: 'Deletado!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};