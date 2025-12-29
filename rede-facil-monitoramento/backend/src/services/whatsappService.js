const wppconnect = require('@wppconnect-team/wppconnect');

let clientSession = null;
let currentQRCode = null;
let connectionStatus = 'DISCONNECTED'; 


const start = async () => {
    console.log('🚀 Iniciando serviço do WhatsApp...');
    try {
        await wppconnect.create({
            session: 'rede-facil-bot',
            autoClose: 0, 
            authTimeout: 0,
            catchQR: (base64Qr, asciiQR) => {
                console.log('⚠️  NOVO QR CODE GERADO NO TERMINAL');
                currentQRCode = base64Qr; 
                connectionStatus = 'SCAN_QR';
            },
            statusFind: (statusSession, session) => {
                console.log('📊 Status WhatsApp:', statusSession);
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
        .then(async (client) => {
            clientSession = client;
            connectionStatus = 'CONNECTED';
            console.log('✅ WhatsApp Conectado!');

            console.log('🔎 Buscando seus grupos...');
            try {
                const groups = await client.getAllGroups();
                console.log('\n\n================ LISTA DE GRUPOS ================');
                groups.forEach(g => {
                    console.log(`📌 NOME: ${g.name}  |  ID: ${g.id._serialized}`);
                });
                console.log('=================================================\n\n');
            } catch (err) {
                console.error('Erro ao listar grupos:', err);
            }
            // ----------------------------------------------
        });
    } catch (error) {
        console.error('❌ Erro fatal ao iniciar WhatsApp:', error);
    }
};

const getStatus = () => {
    return { status: connectionStatus, qrCode: currentQRCode };
};

const sendMessage = async (phoneOrGroupId, message) => {
    if (!clientSession || connectionStatus !== 'CONNECTED') {
        console.warn('⚠️ Tentativa de envio sem conexão.');
        return;
    }
    await clientSession.sendText(phoneOrGroupId, message);
};

const listGroups = async () => {
    if (!clientSession) return [];
    try {
        const groups = await clientSession.getAllGroups();
        return groups.map(g => ({ name: g.name, id: g.id._serialized }));
    } catch (error) {
        return [];
    }
};

module.exports = { start, getStatus, sendMessage, listGroups };