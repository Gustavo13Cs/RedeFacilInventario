const { db } = require('../config/db');

exports.getAssetReport = async () => {
    try {
        // 1. Busca modelos de PCs (Trata NULL como 'PC Genérico')
        const [pcModels] = await db.execute(`
            SELECT 
                COALESCE(NULLIF(h.system_model, ''), 'PC Genérico') as model, 
                'Computador' as type, 
                COUNT(*) as quantity 
            FROM hardware_specs h
            JOIN machines m ON h.machine_id = m.id
            GROUP BY COALESCE(NULLIF(h.system_model, ''), 'PC Genérico')
        `);

        // 2. Busca modelos do Inventário (Trata NULL como 'Item sem Modelo')
        const [invModels] = await db.execute(`
            SELECT 
                COALESCE(NULLIF(model, ''), 'Item sem Modelo') as model, 
                type, 
                COUNT(*) as quantity 
            FROM inventory_items
            GROUP BY COALESCE(NULLIF(model, ''), 'Item sem Modelo'), type
        `);

        // 3. Busca tabela de preços. Se der erro (tabela não existe), retorna array vazio.
        let catalog = [];
        try {
            const [rows] = await db.execute('SELECT model_name, unit_price FROM asset_catalog');
            catalog = rows;
        } catch (dbError) {
            console.warn("Aviso: Tabela asset_catalog ainda não existe ou está vazia.");
        }
        
        const priceMap = {};
        catalog.forEach(item => {
            if (item.model_name) {
                priceMap[item.model_name.toLowerCase()] = parseFloat(item.unit_price) || 0;
            }
        });

        const combined = [];

        // Função auxiliar para processar listas com segurança
        const processItems = (list, sourceName, defaultType) => {
            if (!Array.isArray(list)) return;
            
            list.forEach(item => {
                const modelName = item.model || "Desconhecido";
                const qty = parseInt(item.quantity) || 0;
                
                // Verifica se já adicionamos este modelo na lista combinada
                const existing = combined.find(x => x.model.toLowerCase() === modelName.toLowerCase());
                
                if (existing) {
                    existing.quantity += qty;
                    existing.total_value = existing.quantity * existing.unit_price;
                    if (!existing.source.includes(sourceName)) {
                        existing.source += ` + ${sourceName}`;
                    }
                } else {
                    const price = priceMap[modelName.toLowerCase()] || 0;
                    combined.push({
                        model: modelName,
                        type: item.type || defaultType, 
                        quantity: qty,
                        unit_price: price,
                        total_value: qty * price,
                        source: sourceName
                    });
                }
            });
        };

        processItems(pcModels, 'Agente', 'Computador');
        processItems(invModels, 'Inventário', 'Outro');

        const grandTotal = combined.reduce((acc, item) => acc + (item.total_value || 0), 0);
        const totalItems = combined.reduce((acc, item) => acc + (item.quantity || 0), 0);

        return { 
            assets: combined.sort((a,b) => b.total_value - a.total_value),
            grandTotal,
            totalItems
        };

    } catch (e) {
        console.error("Erro CRÍTICO no serviço financeiro:", e);
        // Retorna objeto vazio para não quebrar o front
        return { assets: [], grandTotal: 0, totalItems: 0 };
    }
};

exports.updateAssetPrice = async (model, price, cat) => {
    // Garante que a tabela existe antes de inserir
    await db.execute(`
        CREATE TABLE IF NOT EXISTS asset_catalog (
            id INT AUTO_INCREMENT PRIMARY KEY,
            model_name VARCHAR(150) NOT NULL UNIQUE,
            category VARCHAR(50),
            unit_price DECIMAL(10, 2) DEFAULT 0.00,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    await db.execute(`
        INSERT INTO asset_catalog (model_name, unit_price, category) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE unit_price = ?, category = ?
    `, [model, price, cat, price, cat]);
    
    return true;
};