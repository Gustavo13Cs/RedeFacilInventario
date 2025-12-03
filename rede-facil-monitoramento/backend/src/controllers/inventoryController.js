const inventoryServices = require('../services/inventoryServices');

exports.listItems = async (req, res) => {
    try {
        const items = await inventoryServices.listItems();
        res.json(items);
    } catch (error) {
        console.error('Erro ao listar inventário:', error);
        res.status(500).json({ error: 'Erro interno ao buscar inventário' });
    }
};

exports.createItem = async (req, res) => {
    try {
        const newItem = await inventoryServices.createItem(req.body);
        res.status(201).json(newItem);
    } catch (error) {
        console.error('Erro ao criar item:', error);
        res.status(500).json({ error: 'Erro ao cadastrar equipamento' });
    }
};

exports.updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedItem = await inventoryServices.updateItem(id, req.body);
        res.json(updatedItem);
    } catch (error) {
        console.error('Erro ao atualizar item:', error);
        res.status(500).json({ error: 'Erro ao atualizar equipamento' });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        await inventoryServices.deleteItem(id);
        res.json({ message: 'Deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar item:', error);
        res.status(500).json({ error: 'Erro ao remover equipamento' });
    }
};