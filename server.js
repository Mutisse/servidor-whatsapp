const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(express.json());

// Configuração melhorada com timeout
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "beautytime-client",
        dataPath: "./sessions"
    }),
    puppeteer: { 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        timeout: 60000 // 60 segundos timeout
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

let isReady = false;
let qrCodeImage = null;
let qrCodeTimestamp = null;
let connectionStatus = 'disconnected';
const QR_CODE_DURATION = 60000;
let loadingTimeout = null;

// Limpar timeout quando desconectar
client.on('disconnected', (reason) => {
    console.log('\n🔴 ========== WHATSAPP DESCONECTADO ==========');
    console.log('Motivo:', reason);
    
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
    
    isReady = false;
    connectionStatus = 'disconnected';
    qrCodeImage = null;
    qrCodeTimestamp = null;
    
    // Reconexão mais rápida
    setTimeout(() => {
        console.log('🔄 Tentando reconectar...');
        client.initialize();
    }, 3000);
});

client.on('loading_screen', (percent, message) => {
    console.log(`📱 Carregando: ${percent}% - ${message}`);
    connectionStatus = 'loading';
    
    // Se chegou a 100% mas não completou em 30 segundos, reinicia
    if (percent === 100) {
        console.log('⏳ WhatsApp carregado 100% - Aguardando finalização...');
        
        loadingTimeout = setTimeout(() => {
            console.log('❌ Timeout no carregamento - Reiniciando...');
            client.destroy();
            setTimeout(() => client.initialize(), 5000);
        }, 30000); // 30 segundos timeout
    }
});

client.on('authenticated', () => {
    console.log('\n✅ ========== AUTENTICADO COM SUCESSO ==========');
    console.log('📱 Sessão salva - Aguardando carregamento completo');
    console.log('==============================================\n');
    
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
    
    connectionStatus = 'authenticating';
});

client.on('ready', () => {
    console.log('\n🎉 ========== WHATSAPP CONECTADO! ==========');
    console.log('✅ Pronto para enviar mensagens');
    console.log('⏰ Sessão persistente ativa');
    console.log('🌐 Acesse: https://servidor-whatsapp-mhdo.onrender.com');
    console.log('==========================================\n');
    
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
    
    isReady = true;
    connectionStatus = 'connected';
    qrCodeImage = null;
    qrCodeTimestamp = null;
});

// Resto do código permanece igual...
client.on('qr', async (qr) => {
    const now = Date.now();
    
    if (!qrCodeTimestamp || (now - qrCodeTimestamp) > QR_CODE_DURATION) {
        console.log('\n🔄 ========== NOVO QR CODE GERADO ==========');
        console.log('⏰ Este QR Code será válido por 60 segundos');
        console.log('📱 Escaneie rapidamente no WhatsApp');
        console.log('==========================================\n');
        
        connectionStatus = 'qr_received';
        qrCodeTimestamp = now;
        qrCodeImage = await qrcode.toDataURL(qr);
        
    } else {
        console.log('⏳ QR Code atual ainda é válido...');
    }
});

client.on('auth_failure', msg => {
    console.log('\n❌ ========== FALHA NA AUTENTICAÇÃO ==========');
    console.log('Erro:', msg);
    console.log('==========================================\n');
    
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
    
    connectionStatus = 'disconnected';
    qrCodeImage = null;
    qrCodeTimestamp = null;
});

// ... (rotas permanecem iguais)

app.get('/qrcode', (req, res) => {
    if (!qrCodeImage) {
        return res.status(404).json({ 
            error: 'QR Code não disponível. Aguarde...' 
        });
    }
    
    const base64Data = qrCodeImage.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');
    
    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': imgBuffer.length,
        'Cache-Control': 'no-cache'
    });
    res.end(imgBuffer);
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Code WhatsApp - BeautyTime</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; }
                .container { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px); }
                .status { margin: 20px 0; padding: 10px; border-radius: 5px; font-weight: bold; }
                .connected { background: #4CAF50; }
                .disconnected { background: #f44336; }
                .waiting { background: #ff9800; }
                .loading { background: #2196F3; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔗 Conectar WhatsApp - BeautyTime</h1>
                
                <div class="status" id="status">
                    Aguardando QR Code...
                </div>
                
                <div id="qrcode-container">
                    <div id="qrcode">
                        <p>⏳ Gerando QR Code...</p>
                    </div>
                </div>
                
                <div id="loadingInfo" style="display: none;">
                    <p>📱 <strong>WhatsApp Carregando...</strong></p>
                    <p>⏳ Isto pode levar alguns segundos</p>
                </div>
            </div>

            <script>
                function atualizarStatus() {
                    fetch('/status')
                        .then(response => response.json())
                        .then(data => {
                            const statusElement = document.getElementById('status');
                            const loadingInfo = document.getElementById('loadingInfo');
                            
                            if (data.connected) {
                                statusElement.innerHTML = '✅ WhatsApp Conectado!';
                                statusElement.className = 'status connected';
                                loadingInfo.style.display = 'none';
                                document.getElementById('qrcode-container').innerHTML = 
                                    '<p>✅ Conexão estabelecida com sucesso!</p>';
                            } else if (data.connectionStatus === 'loading') {
                                statusElement.innerHTML = '📱 WhatsApp Carregando...';
                                statusElement.className = 'status loading';
                                loadingInfo.style.display = 'block';
                                document.getElementById('qrcode-container').innerHTML = 
                                    '<p>⏳ Aguarde, carregando WhatsApp...</p>';
                            } else if (data.qrAvailable) {
                                statusElement.innerHTML = '📱 QR Code Disponível';
                                statusElement.className = 'status waiting';
                                loadingInfo.style.display = 'none';
                                atualizarQRCode();
                            } else {
                                statusElement.innerHTML = '⏳ Aguardando QR Code...';
                                statusElement.className = 'status disconnected';
                                loadingInfo.style.display = 'none';
                            }
                        })
                        .catch(error => {
                            console.error('Erro:', error);
                        });
                }

                function atualizarQRCode() {
                    const timestamp = new Date().getTime();
                    fetch('/qrcode?' + timestamp)
                        .then(response => response.blob())
                        .then(blob => {
                            const url = URL.createObjectURL(blob);
                            document.getElementById('qrcode').innerHTML = 
                                '<img src="' + url + '" alt="QR Code" style="width: 300px; height: 300px; border: 10px solid white; border-radius: 10px;">';
                        })
                        .catch(error => {
                            document.getElementById('qrcode').innerHTML = '<p>⏳ Gerando QR Code...</p>';
                        });
                }

                setInterval(atualizarStatus, 3000);
                atualizarStatus();
            </script>
        </body>
        </html>
    `);
});

app.get('/status', (req, res) => {
    res.json({ 
        connected: isReady,
        qrAvailable: !!qrCodeImage,
        connectionStatus: connectionStatus
    });
});

app.post('/send-message', async (req, res) => {
    if (!isReady) {
        return res.json({ 
            success: false, 
            error: 'WhatsApp não conectado' 
        });
    }

    try {
        const { to, message } = req.body;
        const chatId = `${to.replace(/\D/g, '')}@c.us`;
        const result = await client.sendMessage(chatId, message);
        
        console.log(`📤 Mensagem enviada para ${to}: ${message}`);
        
        res.json({ 
            success: true, 
            messageId: result.id.id
        });
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem: ${error.message}`);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Inicializar
console.log('🚀 Iniciando servidor WhatsApp...');
client.initialize();

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`🌐 Servidor rodando na porta ${PORT}`);
});