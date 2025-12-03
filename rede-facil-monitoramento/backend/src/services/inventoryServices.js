const { db } = require('../config/db');


exports.listItems = async () => {
    const [rows] = await db.execute('SELECT * FROM inventory_items ORDER BY created_at DESC');
    return rows;
};

exports.createItem = async ({ type, model, serial, status, assigned_to }) => {
    const [result] = await db.execute(
        `INSERT INTO inventory_items (type, model, serial, status, assigned_to) VALUES (?, ?, ?, ?, ?)`,
        [type, model, serial || '', status || 'disponivel', assigned_to || '']
    );
    return { id: result.insertId, type, model, serial, status, assigned_to };
};

exports.updateItem = async (id, { type, model, serial, status, assigned_to }) => {
    await db.execute(
        `UPDATE inventory_items SET type=?, model=?, serial=?, status=?, assigned_to=? WHERE id=?`,
        [type, model, serial, status, assigned_to, id]
    );
    return { id, type, model, serial, status, assigned_to };
};

exports.deleteItem = async (id) => {
    await db.execute('DELETE FROM inventory_items WHERE id = ?', [id]);
    return { message: 'Item removido com sucesso' };
};