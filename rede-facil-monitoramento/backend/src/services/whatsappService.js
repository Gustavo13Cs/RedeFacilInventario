const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');

let clientSession = null;
let currentQRCode = null;
let connectionStatus = 'DISCONNECTED'; 

const limparArquivosDeTrava = () => {
    const tokenFolder = path.resolve(__dirname, '../../tokens/rede-facil-bot');
    

    if (fs.existsSync(tokenFolder)) {
        const files = fs.readdirSync(tokenFolder);
        
        const travadores = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];

        files.forEach(file => {
            if (travadores.some(t => file.includes(t))) {
                try {
                    const filePath = path.join(tokenFolder, file);
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.error(`⚠️ Não foi possível remover ${file}:`, err.message);
                }
            }
        });
    } else {
        console.log('📂 Pasta de tokens ainda não existe (Primeira execução).');
    }
};

const start = async () => {

    limparArquivosDeTrava();
    try {
        await wppconnect.create({
            session: 'rede-facil-bot',
            folderNameToken: 'tokens', 
            autoClose: 0, 
            authTimeout: 0,
            catchQR: (base64Qr, asciiQR) => {
                currentQRCode = base64Qr; 
                connectionStatus = 'SCAN_QR';
            },
            statusFind: (statusSession, session) => {
                if (statusSession === 'isLogged' || statusSession === 'inChat') {
                    connectionStatus = 'CONNECTED';
                    currentQRCode = null; 
                }
            },
            headless: true,
            useChrome: false,
            browserArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu'],
            puppeteerOptions: { executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] }
        })
        .then((client) => {
            clientSession = client;
            connectionStatus = 'CONNECTED';
        });
    } catch (error) {
        console.error('❌ Erro fatal:', error);
    }
};

const getStatus = () => {
    return { status: connectionStatus, qrCode: currentQRCode };
};

const sendMessage = async (phoneOrGroupId, message) => {
    if (!clientSession) {
        console.log('❌ Erro Zap: Sessão não existe (Bot desconectado?)');
        return;
    }
    try {
        const result = await clientSession.sendText(phoneOrGroupId, message);
    } catch (error) {
        console.error('❌ ERRO AO ENVIAR ZAP:', error);
    }
};

const listGroups = async () => {
    if (!clientSession) return [];
    try {
        const groups = await clientSession.getAllGroups();
        return groups.map(g => ({ name: g.name, id: g.id._serialized }));
    } catch (error) { return []; }
};


const logout = async () => {
    console.log("🔄 Solicitando reinício de sessão...");
    try {
        if (clientSession) {
            await clientSession.logout(); 
            await clientSession.close();  
        }
    } catch (error) {
        console.error("⚠️ Erro ao tentar fechar sessão antiga:", error.message);
    }

    clientSession = null;
    currentQRCode = null;
    connectionStatus = 'DISCONNECTED';

    const tokenFolder = path.resolve(__dirname, '../../tokens/rede-facil-bot');
    try {
        if (fs.existsSync(tokenFolder)) {
            fs.rmSync(tokenFolder, { recursive: true, force: true });
            console.log("🗑️ Tokens antigos removidos.");
        }
    } catch (err) {
        console.error("Erro ao limpar tokens:", err);
    }
    setTimeout(() => {
        start();
    }, 2000);
    
    return { message: "Sessão reiniciada. Aguarde o novo QR Code." };
};

module.exports = { start, getStatus, sendMessage, listGroups, logout };