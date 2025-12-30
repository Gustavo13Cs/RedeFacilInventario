const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');

let clientSession = null;
let currentQRCode = null;
let connectionStatus = 'DISCONNECTED'; 

const start = async () => {
    console.log('🚀 Iniciando serviço do WhatsApp...');
    
    // Verificação de segurança para não recriar sessão se já existe
    if (clientSession) {
        console.log('✅ Sessão já está ativa na memória.');
        return;
    }

    try {
        await wppconnect.create({
            session: 'rede-facil-bot',
            folderNameToken: 'tokens', 
            autoClose: 0, 
            authTimeout: 0,
            
            catchQR: (base64Qr, asciiQR) => {
                console.log('⚠️ QR CODE GERADO (Escaneie apenas se não estiver conectado)');
                currentQRCode = base64Qr; 
                connectionStatus = 'SCAN_QR';
            },
            statusFind: (statusSession, session) => {
                console.log('📊 Status Conexão:', statusSession);
                
                if (statusSession === 'isLogged' || statusSession === 'inChat') {
                    connectionStatus = 'CONNECTED';
                    currentQRCode = null; 
                }
                
                if (statusSession === 'browserClose' || statusSession === 'qrReadFail') {
                    connectionStatus = 'DISCONNECTED';
                }
            },
            
            headless: true,
            useChrome: false,
            browserArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', 
                '--disable-gpu'
            ],
            puppeteerOptions: {
                executablePath: '/usr/bin/chromium-browser',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
            }
        })
        .then((client) => {
            clientSession = client;
            connectionStatus = 'CONNECTED';
            console.log('✅ WhatsApp Conectado e Sessão Salva!');
        });
    } catch (error) {
        console.error('❌ Erro fatal ao iniciar WhatsApp:', error);
    }
};

const getStatus = () => {
    return { status: connectionStatus, qrCode: currentQRCode };
};

const sendMessage = async (phoneOrGroupId, message) => {
    if (!clientSession) return;
    await clientSession.sendText(phoneOrGroupId, message);
};

const listGroups = async () => {
    if (!clientSession) return [];
    const groups = await clientSession.getAllGroups();
    return groups.map(g => ({ name: g.name, id: g.id._serialized }));
};

module.exports = { start, getStatus, sendMessage, listGroups };