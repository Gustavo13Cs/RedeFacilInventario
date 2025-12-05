const { db } = require('../config/db');

exports.listSimCards = async () => {
    const [rows] = await db.execute('SELECT * FROM sim_cards ORDER BY status DESC, created_at DESC');
    return rows;
};

exports.createSimCard = async ({ phone_number, carrier, status, device_id, notes }) => {
    const [result] = await db.execute(
        `INSERT INTO sim_cards (phone_number, carrier, status, device_id, notes) VALUES (?, ?, ?, ?, ?)`,
        [phone_number, carrier, status || 'livre', device_id || '', notes || '']
    );
    return { id: result.insertId, message: 'Chip cadastrado com sucesso' };
};

exports.updateSimCard = async (id, { phone_number, carrier, status, device_id, notes }) => {
    await db.execute(
        `UPDATE sim_cards SET phone_number=?, carrier=?, status=?, device_id=?, notes=? WHERE id=?`,
        [phone_number, carrier, status, device_id, notes, id]
    );
    return { message: 'Chip atualizado com sucesso' };
};

exports.deleteSimCard = async (id) => {
    await db.execute('DELETE FROM sim_cards WHERE id = ?', [id]);
    return { message: 'Chip removido com sucesso' };
};