const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');

let clientSession = null;
let currentQRCode = null;
let connectionStatus = 'DISCONNECTED'; 

const start = async () => {
    console.log('🚀 Iniciando serviço do WhatsApp...');

    try {
        await wppconnect.create({
            session: 'rede-facil-bot',
            folderNameToken: 'tokens', 
            autoClose: 0, 
            authTimeout: 0,
            catchQR: (base64Qr, asciiQR) => {
                console.log('⚠️ NOVO QR CODE - Escaneie se necessário');
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
            console.log('✅ WhatsApp Conectado!');

            client.onMessage((message) => {
                if (message.isGroupMsg) {
                    console.log('\n🔔 MENSAGEM DE GRUPO RECEBIDA!');
                    console.log(`📌 NOME DO GRUPO: ${message.chatId}`);
                    console.log(`🆔 ID DO GRUPO (COPIE ESTE): ${message.from}`);
                    console.log(`👤 QUEM MANDOU: ${message.notifyName}`);
                    console.log(`📄 TEXTO: ${message.body}`);
                    console.log('------------------------------------------------\n');
                }
            });
        });
    } catch (error) {
        console.error('❌ Erro fatal:', error);
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
    try {
        const groups = await clientSession.getAllGroups();
        return groups.map(g => ({ name: g.name, id: g.id._serialized }));
    } catch (error) { return []; }
};

module.exports = { start, getStatus, sendMessage, listGroups };