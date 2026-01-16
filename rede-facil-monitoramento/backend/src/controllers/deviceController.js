const { db } = require('../config/db');

exports.getAllDevices = async (req, res) => {
    try {
        const [devices] = await db.execute('SELECT * FROM devices ORDER BY name ASC');
        res.json(devices);
    } catch (error) {
        console.error("Erro ao buscar devices:", error);
        res.status(500).json({ error: "Erro ao listar celulares" });
    }
};

exports.index = async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT id, name, model FROM devices WHERE status = 'ativo'");
        res.json(rows);
    } catch (error) {
        console.error("Erro ao listar devices:", error);
        res.status(500).json({ error: "Erro ao buscar dispositivos" });
    }
};