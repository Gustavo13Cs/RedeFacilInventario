const { db } = require('../config/db');
const { encrypt, decrypt } = require('../utils/crypto');

exports.listCredentials = async () => {
    const [rows] = await db.execute(`
        SELECT id, category, name_identifier, login_user, related_asset_id, notes 
        FROM credentials 
        ORDER BY id DESC
    `);
    return rows;
};

exports.createCredential = async (data) => {
    let { category, name_identifier, login_user, password, related_asset_id, notes } = data;

    if (!related_asset_id || related_asset_id === "" || related_asset_id === "undefined") {
        related_asset_id = null;
    }

    const { iv, encryptedData } = encrypt(password);

    const [result] = await db.execute(
        `INSERT INTO credentials 
        (category, name_identifier, login_user, encrypted_password, iv, related_asset_id, notes) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [category, name_identifier, login_user, encryptedData, iv, related_asset_id, notes]
    );

    return result.insertId;
};

exports.revealPassword = async (id) => {
    const [rows] = await db.execute(
        "SELECT encrypted_password, iv FROM credentials WHERE id = ?", 
        [id]
    );

    if (rows.length === 0) return null;

    const cred = rows[0];
    return decrypt({
        iv: cred.iv,
        encryptedData: cred.encrypted_password
    });
};

exports.deleteCredential = async (id) => {
    await db.execute("DELETE FROM credentials WHERE id = ?", [id]);
};