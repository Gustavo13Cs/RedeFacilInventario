const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'SEGREDO_SUPER_SECRETO_REDE_FACIL'; 

module.exports = (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
    }

    try {
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Token mal formatado.' });
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        
        req.user = decoded; 
        
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
};