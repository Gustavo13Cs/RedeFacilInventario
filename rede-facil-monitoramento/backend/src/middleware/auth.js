const jwt = require('jsonwebtoken');

const SECRET_KEY = 'SEGREDO_SUPER_SECRETO_REDE_FACIL'; 

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        
        req.user = decoded; 
        
        next();
    } catch (error) {
        res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
};