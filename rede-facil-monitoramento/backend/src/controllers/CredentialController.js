const pool = require('../config/db'); 
const { encrypt, decrypt } = require('../utils/crypto');


exports.index = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, category, name_identifier, login_user, related_asset_id, notes 
            FROM credentials 
            ORDER BY id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao buscar credenciais" });
    }
};

exports.store = async (req, res) => {
    let { category, name_identifier, login_user, password, related_asset_id, notes } = req.body;

    if (!password || !name_identifier) {
        return res.status(400).json({ error: "Dados incompletos" });
    }

    if (related_asset_id === "" || related_asset_id === "undefined") {
        related_asset_id = null;
    }

    try {
        const { iv, encryptedData } = encrypt(password);

        const result = await pool.query(
            `INSERT INTO credentials 
            (category, name_identifier, login_user, encrypted_password, iv, related_asset_id, notes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [category, name_identifier, login_user, encryptedData, iv, related_asset_id, notes]
        );

        res.status(201).json({ message: "Salvo com segurança", id: result.rows[0].id });
    } catch (err) {
        console.error("Erro detalhado no BACKEND:", err); 
        res.status(500).json({ error: "Erro ao salvar credencial. Verifique o terminal do servidor." });
    }
};
exports.reveal = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            "SELECT encrypted_password, iv FROM credentials WHERE id = $1", 
            [id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: "Não encontrado" });

        const cred = result.rows[0];

        const decryptedPassword = decrypt({
            iv: cred.iv,
            encryptedData: cred.encrypted_password
        });

        console.log(`[AUDIT] Usuário Admin visualizou a senha do ID ${id}`);

        res.json({ password: decryptedPassword });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao descriptografar" });
    }
};


exports.delete = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM credentials WHERE id = $1", [id]);
        res.json({ message: "Deletado com sucesso" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao deletar" });
    }
};