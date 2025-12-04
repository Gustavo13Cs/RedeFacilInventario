const authService = require('../services/authService');

exports.login = async (req, res) => {
    try {
        const result = await authService.login(req.body.email, req.body.password);
        res.json(result);
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
};

exports.listUsers = async (req, res) => {
    try {
        const users = await authService.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        await authService.createUser(req.body);
        res.status(201).json({ message: 'Usuário criado!' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        await authService.deleteUser(req.params.id);
        res.json({ message: 'Deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};