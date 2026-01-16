const CredentialService = require('../services/credentialService'); 

exports.index = async (req, res) => {
    try {
        const credentials = await CredentialService.listCredentials();
        res.json(credentials);
    } catch (err) {
        console.error("Erro ao buscar credenciais:", err);
        res.status(500).json({ error: "Erro interno ao buscar credenciais" });
    }
};

exports.store = async (req, res) => {
    const { category, name_identifier, password } = req.body;

    if (!password || !name_identifier) {
        return res.status(400).json({ error: "Dados incompletos" });
    }

    try {
        const id = await CredentialService.createCredential(req.body);
        res.status(201).json({ message: "Salvo com segurança", id });
    } catch (err) {
        console.error("Erro no Controller:", err);
        res.status(500).json({ error: "Erro ao salvar credencial." });
    }
};

exports.reveal = async (req, res) => {
    const { id } = req.params;
    try {
        const password = await CredentialService.revealPassword(id);
        
        if (!password) return res.status(404).json({ error: "Credencial não encontrada" });

        console.log(`[AUDIT] Usuário Admin visualizou a senha do ID ${id}`);
        res.json({ password });

    } catch (err) {
        console.error("Erro decrypt:", err);
        res.status(500).json({ error: "Erro ao descriptografar" });
    }
};

exports.delete = async (req, res) => {
    const { id } = req.params;
    try {
        await CredentialService.deleteCredential(id);
        res.json({ message: "Deletado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao deletar" });
    }
};