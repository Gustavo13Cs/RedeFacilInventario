const db = require('../config/db'); 

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

exports.createLog = async (machineId, description, technicianId, logDate) => {
    const query = `
        INSERT INTO maintenance_logs 
            (machine_id, description, technician_id, log_date)
        VALUES 
            (?, ?, ?, ?);
    `;
    const dateToInsert = logDate || new Date(); 
    
    const [result] = await db.execute(query, [machineId, description, technicianId, dateToInsert]);
    return result; 
};