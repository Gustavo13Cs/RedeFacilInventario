const inventoryServices = require('../services/inventoryServices');

exports.listItems = async (req, res) => {
    try {
        const filters = {
            page: req.query.page,
            limit: req.query.limit,
            search: req.query.search,
            type: req.query.type,
            status: req.query.status,
            location: req.query.location 
        };

        const result = await inventoryServices.listItems(filters);
        res.json(result); 
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

exports.getCategories = async (req, res) => {
    try {
        const categories = await inventoryServices.getAllCategories();
        res.json(categories);
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(500).json({ error: 'Erro ao buscar categorias' });
    }
};

exports.addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
        
        const id = await inventoryServices.createCategory(name);
        res.status(201).json({ id, name, message: 'Categoria criada' });
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        res.status(500).json({ error: 'Erro ao criar categoria' });
    }
};

exports.removeCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await inventoryServices.deleteCategory(id);
        res.json({ message: 'Categoria removida' });
    } catch (error) {
        console.error('Erro ao remover categoria:', error);
        res.status(500).json({ error: 'Erro ao remover categoria' });
    }
};