const { db } = require('../config/db');

exports.listSimCards = async () => {
    const [rows] = await db.execute(`
        SELECT 
            s.*, 
            d.name as device_name, 
            e.name as employee_name 
        FROM sim_cards s
        LEFT JOIN devices d ON s.device_link_id = d.id
        LEFT JOIN employees e ON s.employee_link_id = e.id
        ORDER BY s.status DESC
    `);
    return rows;
};

exports.createSimCard = async (data) => {
    await db.execute(
        `INSERT INTO sim_cards (phone_number, carrier, status, device_link_id, employee_link_id, notes) VALUES (?, ?, ?, ?, ?, ?)`,
        [data.phone_number, data.carrier, data.status, data.device_link_id || null, data.employee_link_id || null, data.notes]
    );
    return { message: 'Chip criado' };
};

exports.updateSimCard = async (id, data) => {
    await db.execute(
        `UPDATE sim_cards SET phone_number=?, carrier=?, status=?, device_link_id=?, employee_link_id=?, notes=? WHERE id=?`,
        [data.phone_number, data.carrier, data.status, data.device_link_id || null, data.employee_link_id || null, data.notes, id]
    );
    return { message: 'Chip atualizado' };
};

exports.deleteSimCard = async (id) => {
    await db.execute('DELETE FROM sim_cards WHERE id = ?', [id]);
    return { message: 'Chip deletado' };
};

exports.listDevices = async () => {
    const [rows] = await db.execute('SELECT * FROM devices ORDER BY name');
    return rows;
};

exports.createDevice = async (data) => {
    await db.execute('INSERT INTO devices (name, model, status) VALUES (?, ?, ?)', [data.name, data.model, 'ativo']);
    return { message: 'Aparelho criado' };
};

exports.deleteDevice = async (id) => {
    await db.execute('DELETE FROM devices WHERE id = ?', [id]);
    return { message: 'Aparelho excluído' };
};

exports.listEmployees = async () => {
    const [rows] = await db.execute('SELECT * FROM employees ORDER BY name');
    return rows;
};

exports.createEmployee = async (data) => {
    await db.execute('INSERT INTO employees (name, department) VALUES (?, ?)', [data.name, data.department]);
    return { message: 'Colaborador criado' };
};

exports.updateEmployee = async (id, data) => {
    await db.execute('UPDATE employees SET name=?, department=? WHERE id=?', [data.name, data.department, id]);
    return { message: 'Colaborador atualizado' };
};

exports.deleteEmployee = async (id) => {
    await db.execute('DELETE FROM employees WHERE id = ?', [id]);
    return { message: 'Colaborador excluído' };
};