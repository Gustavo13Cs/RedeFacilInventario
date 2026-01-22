
const AGENT_SECRET = process.env.AGENT_SECRET || 'REDE_FACIL_AGENTE_SECRETO_2026'; 

module.exports = (req, res, next) => {
    const secret = req.headers['x-agent-secret'];

    if (!secret || secret !== AGENT_SECRET) {
        console.warn(`⛔ Tentativa de acesso não autorizado do IP: ${req.ip}`);
        return res.status(403).json({ message: 'Acesso negado. Segredo do agente inválido.' });
    }

    next();
};