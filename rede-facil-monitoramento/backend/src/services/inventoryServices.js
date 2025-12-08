const { db } = require('../config/db');

exports.listItems = async () => {
    const [rows] = await db.execute('SELECT * FROM inventory_items ORDER BY created_at DESC');
    return rows;
};

exports.createItem = async ({ type, model, serial, status, assigned_to, quantity }) => {
    const qty = quantity && parseInt(quantity) > 0 ? parseInt(quantity) : 1;
    
    if (qty === 1) {
        const [result] = await db.execute(
            `INSERT INTO inventory_items (type, model, serial, status, assigned_to) VALUES (?, ?, ?, ?, ?)`,
            [type, model, serial || '', status || 'disponivel', assigned_to || '']
        );
        return { id: result.insertId, message: 'Item criado com sucesso' };
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction(); 
        
        for (let i = 0; i < qty; i++) {
            await connection.execute(
                `INSERT INTO inventory_items (type, model, serial, status, assigned_to) VALUES (?, ?, ?, ?, ?)`,
                [type, model, serial || '', status || 'disponivel', assigned_to || '']
            );
        }

        await connection.commit(); 
        return { message: `${qty} itens criados com sucesso` };

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release(); 
    }
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