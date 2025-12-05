// src/services/maintenanceLogService.js
const db = require('../config/db'); // Supondo que você tem um módulo de conexão com o banco

// 1. SERVICE para buscar todos os logs
exports.getLogsByMachineId = async (machineId) => {
    const query = `
        SELECT 
            ml.id, 
            ml.log_date, 
            ml.description, 
            u.name as technician_name,
            u.id as technician_id
        FROM 
            maintenance_logs ml
        LEFT JOIN 
            users u ON ml.technician_id = u.id
        WHERE 
            ml.machine_id = ?
        ORDER BY 
            ml.log_date DESC;
    `;
    const [rows] = await db.execute(query, [machineId]);
    return rows;
};

// 2. SERVICE para criar um novo log
exports.createLog = async (machineId, description, technicianId, logDate) => {
    const query = `
        INSERT INTO maintenance_logs 
            (machine_id, description, technician_id, log_date)
        VALUES 
            (?, ?, ?, ?);
    `;
    // Nota: Se logDate for null/undefined, MySQL pode usar a data atual dependendo da configuração da coluna.
    // Recomendo forçar a data atual caso não seja fornecida no payload.
    const dateToInsert = logDate || new Date(); 
    
    const [result] = await db.execute(query, [machineId, description, technicianId, dateToInsert]);
    return result; // Retorna o resultado da inserção
};