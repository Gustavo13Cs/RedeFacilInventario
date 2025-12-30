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
                console.log('⚠️  NOVO QR CODE GERADO NO TERMINAL - ESCANEIE AGORA!');
                currentQRCode = base64Qr; 
                connectionStatus = 'SCAN_QR';
            },
            statusFind: (statusSession, session) => {
                console.log('📊 Status:', statusSession);
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

            console.log('⏳ Aguardando 5 segundos para sincronizar grupos...');
            setTimeout(async () => {
                try {
                    console.log('🔎 LENDO GRUPOS AGORA...');
                    const groups = await client.getAllGroups();
                    
                    console.log('\n\n👇👇👇 COPIE O ID ABAIXO 👇👇👇');
                    console.log('=========================================');
                    if (groups.length === 0) {
                        console.log('⚠️ NENHUM GRUPO ENCONTRADO. MANDE UM "OI" NO GRUPO E REINICIE.');
                    }
                    groups.forEach(g => {
                        console.log(`📌 GRUPO: ${g.name}`);
                        console.log(`🆔 ID: ${g.id._serialized}`); 
                        console.log('-----------------------------------------');
                    });
                    console.log('=========================================\n\n');
                } catch (err) {
                    console.error('❌ Erro ao ler grupos:', err);
                }
            }, 5000); 
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
    const groups = await clientSession.getAllGroups();
    return groups.map(g => ({ name: g.name, id: g.id._serialized }));
};

module.exports = { start, getStatus, sendMessage, listGroups };