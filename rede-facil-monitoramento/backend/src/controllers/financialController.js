const financialService = require('../services/financialService');

exports.getReport = async (req, res) => {
    try {
        const report = await financialService.getAssetReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: "Erro ao gerar relatório." });
    }
};

exports.updatePrice = async (req, res) => {
    try {
        const { model, price, category } = req.body;
        await financialService.updateAssetPrice(model, price, category);
        res.json({ message: "Preço atualizado!" });
    } catch (error) {
        res.status(500).json({ message: "Erro ao atualizar preço." });
    }
};