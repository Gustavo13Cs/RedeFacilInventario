const { db } = require('../config/db');


exports.listItems = async (filters = {}) => {

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 15; 
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM inventory_items WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM inventory_items WHERE 1=1';
    const params = [];
    if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        const searchClause = ' AND (name LIKE ? OR model LIKE ? OR serial LIKE ? OR patrimony_code LIKE ?)';
        query += searchClause;
        countQuery += searchClause;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.type && filters.type !== 'Todos') {
        query += ' AND type = ?';
        countQuery += ' AND type = ?';
        params.push(filters.type);
    }


    if (filters.status && filters.status !== 'Todos') {
        query += ' AND status = ?';
        countQuery += ' AND status = ?';
        params.push(filters.status);
    }


    if (filters.location) {
        query += ' AND location LIKE ?';
        countQuery += ' AND location LIKE ?';
        params.push(`%${filters.location}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    
    const queryParams = [...params, limit.toString(), offset.toString()]; 
    const [rows] = await db.execute(query, queryParams);
    const [countResult] = await db.execute(countQuery, params);
    const totalItems = countResult[0].total;

    return {
        data: rows,
        meta: {
            total: totalItems,
            page,
            limit,
            totalPages: Math.ceil(totalItems / limit)
        }
    };
};

exports.createItem = async (data) => {
    const { 
        name, type, patrimony_code, brand, model, 
        serial_number, status, condition, location, 
        assigned_to, quantity 
    } = data;

    const qty = quantity && parseInt(quantity) > 0 ? parseInt(quantity) : 1;
    
    const serialToSave = serial_number || ''; 
    const conditionToSave = condition || 'novo';

    if (qty === 1) {
        const [result] = await db.execute(
            `INSERT INTO inventory_items 
            (name, type, patrimony_code, brand, model, serial, status, condition_status, location, assigned_to) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name || '', type, patrimony_code || '', brand || '', model || '', serialToSave, status || 'disponivel', conditionToSave, location || '', assigned_to || '']
        );
        return { id: result.insertId, message: 'Item criado com sucesso' };
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction(); 
        
        for (let i = 0; i < qty; i++) {
            await connection.execute(
                `INSERT INTO inventory_items 
                (name, type, patrimony_code, brand, model, serial, status, condition_status, location, assigned_to) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name || '', type, patrimony_code || '', brand || '', model || '', serialToSave, status || 'disponivel', conditionToSave, location || '', assigned_to || '']
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

exports.updateItem = async (id, data) => {
    const { 
        name, type, patrimony_code, brand, model, 
        serial_number, status, condition, location, 
        assigned_to 
    } = data;

    const serialToSave = serial_number || '';
    const conditionToSave = condition || 'bom';

    await db.execute(
        `UPDATE inventory_items SET 
        name=?, type=?, patrimony_code=?, brand=?, model=?, 
        serial=?, status=?, condition_status=?, location=?, assigned_to=? 
        WHERE id=?`,
        [name, type, patrimony_code, brand, model, serialToSave, status, conditionToSave, location, assigned_to, id]
    );
    return { id, ...data };
};

exports.deleteItem = async (id) => {
    await db.execute('DELETE FROM inventory_items WHERE id = ?', [id]);
    return { message: 'Item removido com sucesso' };
};


exports.getAllCategories = async () => {
    const [rows] = await db.execute('SELECT * FROM inventory_categories ORDER BY name ASC');
    return rows;
};

exports.createCategory = async (name) => {
    const [exists] = await db.execute('SELECT id FROM inventory_categories WHERE name = ?', [name]);
    if (exists.length > 0) return exists[0].id;

    const [result] = await db.execute('INSERT INTO inventory_categories (name) VALUES (?)', [name]);
    return result.insertId;
};

exports.deleteCategory = async (id) => {
    await db.execute('DELETE FROM inventory_categories WHERE id = ?', [id]);
    return true;
};