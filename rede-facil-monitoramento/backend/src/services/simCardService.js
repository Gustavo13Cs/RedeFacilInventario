const { db } = require('../config/db');

const createDeviceLog = async (deviceId, action, description) => {
    if (!deviceId) return;
    try {
        await db.execute(
            `INSERT INTO device_logs (device_id, action_type, description) VALUES (?, ?, ?)`,
            [deviceId, action, description]
        );
    } catch (err) {
        console.error("Erro ao gerar log de device:", err);
    }
};

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
    const [result] = await db.execute(
        `INSERT INTO sim_cards (phone_number, carrier, status, device_link_id, employee_link_id, notes, whatsapp_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.phone_number, data.carrier, data.status, data.device_link_id || null, data.employee_link_id || null, data.notes, data.whatsapp_type || 'Normal']
    );

    if (data.device_link_id) {
        let desc = `Chip ${data.phone_number} inserido.`;
        if (data.employee_link_id) {
            const [emp] = await db.execute('SELECT name FROM employees WHERE id = ?', [data.employee_link_id]);
            if (emp.length > 0) desc += ` Responsável: ${emp[0].name}.`;
        }
        await createDeviceLog(data.device_link_id, 'Atribuição', desc);
    }

    return { id: result.insertId, message: 'Chip criado' };
};

exports.updateSimCard = async (id, data) => {
    const [oldRows] = await db.execute('SELECT device_link_id, employee_link_id, status, phone_number FROM sim_cards WHERE id = ?', [id]);
    const oldData = oldRows[0];

    await db.execute(
        `UPDATE sim_cards SET phone_number=?, carrier=?, status=?, device_link_id=?, employee_link_id=?, notes=?, whatsapp_type=? WHERE id=?`,
        [data.phone_number, data.carrier, data.status, data.device_link_id || null, data.employee_link_id || null, data.notes, data.whatsapp_type || 'Normal', id]
    );


    if (oldData) {
        const deviceId = data.device_link_id || oldData.device_link_id; 

        if (deviceId) {
            if (oldData.status !== data.status) {
                const actionType = data.status === 'banido' ? 'ALERTA' : 'Status';
                const desc = `O Chip ${data.phone_number} mudou o status de "${oldData.status}" para "${data.status}".`;
                await createDeviceLog(deviceId, actionType, desc);
            }

            if (data.employee_link_id && oldData.employee_link_id != data.employee_link_id) {
                const [emp] = await db.execute('SELECT name FROM employees WHERE id = ?', [data.employee_link_id]);
                const empName = emp[0]?.name || 'Desconhecido';
                await createDeviceLog(deviceId, 'Troca Responsável', `Chip ${data.phone_number} repassado para: ${empName}.`);
            }

            if (data.device_link_id && oldData.device_link_id != data.device_link_id) {
                await createDeviceLog(data.device_link_id, 'Inclusão', `Chip ${data.phone_number} inserido neste aparelho.`);
            }
            
            if (oldData.device_link_id && oldData.device_link_id != data.device_link_id) {
                await createDeviceLog(oldData.device_link_id, 'Remoção', `Chip ${oldData.phone_number} removido deste aparelho.`);
            }
        }
    }

    return { message: 'Chip atualizado' };
};

exports.deleteSimCard = async (id) => {
    const [card] = await db.execute('SELECT device_link_id, phone_number FROM sim_cards WHERE id = ?', [id]);
    if (card.length > 0 && card[0].device_link_id) {
        await createDeviceLog(card[0].device_link_id, 'Exclusão', `Chip ${card[0].phone_number} foi excluído do sistema.`);
    }

    await db.execute('DELETE FROM sim_cards WHERE id = ?', [id]);
    return { message: 'Chip deletado' };
};

exports.listDevices = async () => {
    const [rows] = await db.execute('SELECT * FROM devices ORDER BY name');
    return rows;
};

exports.getDeviceLogs = async (deviceId) => {
    const [rows] = await db.execute('SELECT * FROM device_logs WHERE device_id = ? ORDER BY created_at DESC', [deviceId]);
    return rows;
};

exports.createDevice = async (data) => {
    const [res] = await db.execute('INSERT INTO devices (name, model, status) VALUES (?, ?, ?)', [data.name, data.model, data.status || 'ativo']);
    await createDeviceLog(res.insertId, 'Criação', `Aparelho cadastrado: ${data.model}`);
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