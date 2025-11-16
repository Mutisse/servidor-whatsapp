const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
app.use(express.json());

// Configuração melhorada do cliente
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "beautytime-client", // ID único para sessão
        dataPath: "./sessions" // Pasta para salvar sessões
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
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

let isReady = false;
let qrCodeImage = null;
let qrCodeTimestamp = null;
let connectionStatus = 'disconnected'; // disconnected, qr_received, authenticating, connected
const QR_CODE_DURATION = 60000;

// Logs detalhados de conexão
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

client.on('authenticated', () => {
    console.log('\n✅ ========== AUTENTICADO COM SUCESSO ==========');
    console.log('📱 Sessão salva - Reconexão automática habilitada');
    console.log('==============================================\n');
    connectionStatus = 'authenticating';
});

client.on('auth_failure', msg => {
    console.log('\n❌ ========== FALHA NA AUTENTICAÇÃO ==========');
    console.log('Erro:', msg);
    console.log('==========================================\n');
    connectionStatus = 'disconnected';
    qrCodeImage = null;
    qrCodeTimestamp = null;
});

client.on('ready', () => {
    console.log('\n🎉 ========== WHATSAPP CONECTADO! ==========');
    console.log('✅ Pronto para enviar mensagens');
    console.log('⏰ Sessão persistente ativa');
    console.log('🌐 Acesse: https://servidor-whatsapp-mhdo.onrender.com');
    console.log('==========================================\n');
    
    isReady = true;
    connectionStatus = 'connected';
    qrCodeImage = null;
    qrCodeTimestamp = null;
});

client.on('disconnected', (reason) => {
    console.log('\n🔴 ========== WHATSAPP DESCONECTADO ==========');
    console.log('Motivo:', reason);
    console.log('❌ Reconectando automaticamente...');
    console.log('============================================\n');
    
    isReady = false;
    connectionStatus = 'disconnected';
    qrCodeImage = null;
    qrCodeTimestamp = null;
    
    // Tentativa de reconexão automática
    setTimeout(() => {
        console.log('🔄 Tentando reconectar...');
        client.initialize();
    }, 5000);
});

client.on('loading_screen', (percent, message) => {
    console.log(`📱 Carregando: ${percent}% - ${message}`);
    connectionStatus = 'loading';
});

// Rota para obter o QR Code como imagem
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

// Rota para página HTML com o QR Code
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Code WhatsApp - BeautyTime</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 500px;
                    margin: 0 auto;
                    padding: 20px;
                    text-align: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .container {
                    background: rgba(255,255,255,0.1);
                    padding: 30px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                }
                h1 {
                    margin-bottom: 20px;
                }
                #qrcode-container {
                    margin: 20px 0;
                }
                #qrcode img {
                    width: 300px;
                    height: 300px;
                    border: 10px solid white;
                    border-radius: 10px;
                }
                .status {
                    margin: 20px 0;
                    padding: 10px;
                    border-radius: 5px;
                    font-weight: bold;
                }
                .connected { background: #4CAF50; }
                .disconnected { background: #f44336; }
                .waiting { background: #ff9800; }
                .loading { background: #2196F3; }
                .instructions {
                    text-align: left;
                    background: rgba(0,0,0,0.2);
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .instructions ol {
                    padding-left: 20px;
                }
                .instructions li {
                    margin: 8px 0;
                }
                .qr-timer {
                    background: rgba(255,255,255,0.2);
                    padding: 10px;
                    border-radius: 5px;
                    margin: 10px 0;
                    font-size: 14px;
                }
                .connection-steps {
                    display: flex;
                    justify-content: space-between;
                    margin: 20px 0;
                }
                .step {
                    flex: 1;
                    padding: 10px;
                    margin: 0 5px;
                    border-radius: 5px;
                    background: rgba(255,255,255,0.1);
                }
                .step.active {
                    background: #4CAF50;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔗 Conectar WhatsApp - BeautyTime</h1>
                
                <div class="connection-steps">
                    <div class="step" id="step1">1. QR Code</div>
                    <div class="step" id="step2">2. Autenticação</div>
                    <div class="step" id="step3">3. Conectado</div>
                </div>
                
                <div class="status" id="status">
                    Aguardando QR Code...
                </div>
                
                <div class="qr-timer" id="qrTimer">
                    ⏰ QR Code válido por: <span id="timer">60</span> segundos
                </div>
                
                <div id="qrcode-container">
                    <div id="qrcode">
                        <p>⏳ Gerando QR Code...</p>
                    </div>
                </div>
                
                <div class="instructions">
                    <h3>📱 Como conectar:</h3>
                    <ol>
                        <li>Abra o WhatsApp no seu celular</li>
                        <li>Toque em <strong>Menu → Linked Devices</strong></li>
                        <li>Toque em <strong>Link a Device</strong></li>
                        <li>Escaneie o QR Code acima rapidamente</li>
                        <li>Aguarde a confirmação de conexão</li>
                    </ol>
                </div>
                
                <div id="debug-info" style="font-size: 12px; margin-top: 20px; opacity: 0.8;">
                    Status: <span id="debugStatus">-</span>
                </div>
            </div>

            <script>
                let countdown = 60;
                let countdownInterval;

                function startCountdown() {
                    clearInterval(countdownInterval);
                    countdown = 60;
                    updateTimer();
                    
                    countdownInterval = setInterval(() => {
                        countdown--;
                        updateTimer();
                        
                        if (countdown <= 0) {
                            clearInterval(countdownInterval);
                            document.getElementById('qrTimer').innerHTML = '🔄 Atualizando QR Code...';
                            setTimeout(() => {
                                location.reload();
                            }, 2000);
                        }
                    }, 1000);
                }

                function updateTimer() {
                    document.getElementById('timer').textContent = countdown;
                    
                    if (countdown < 10) {
                        document.getElementById('qrTimer').style.background = 'rgba(255,0,0,0.3)';
                    }
                }

                function updateSteps(status) {
                    // Reset all steps
                    document.getElementById('step1').className = 'step';
                    document.getElementById('step2').className = 'step';
                    document.getElementById('step3').className = 'step';
                    
                    switch(status) {
                        case 'qr_received':
                            document.getElementById('step1').className = 'step active';
                            break;
                        case 'authenticating':
                        case 'loading':
                            document.getElementById('step1').className = 'step active';
                            document.getElementById('step2').className = 'step active';
                            break;
                        case 'connected':
                            document.getElementById('step1').className = 'step active';
                            document.getElementById('step2').className = 'step active';
                            document.getElementById('step3').className = 'step active';
                            break;
                    }
                }

                function atualizarStatus() {
                    fetch('/status')
                        .then(response => response.json())
                        .then(data => {
                            const statusElement = document.getElementById('status');
                            const qrTimerElement = document.getElementById('qrTimer');
                            const debugElement = document.getElementById('debugStatus');
                            
                            debugElement.textContent = data.connectionStatus;
                            updateSteps(data.connectionStatus);
                            
                            if (data.connected) {
                                statusElement.innerHTML = '✅ WhatsApp Conectado!';
                                statusElement.className = 'status connected';
                                qrTimerElement.style.display = 'none';
                                document.getElementById('qrcode-container').innerHTML = 
                                    '<p>✅ Conexão estabelecida com sucesso!</p>';
                                clearInterval(countdownInterval);
                            } else {
                                if (data.qrAvailable) {
                                    statusElement.innerHTML = '📱 QR Code Disponível - Escaneie Rapidamente!';
                                    statusElement.className = 'status waiting';
                                    qrTimerElement.style.display = 'block';
                                    atualizarQRCode();
                                    startCountdown();
                                } else if (data.connectionStatus === 'loading') {
                                    statusElement.innerHTML = '⏳ Carregando WhatsApp...';
                                    statusElement.className = 'status loading';
                                    qrTimerElement.style.display = 'none';
                                } else if (data.connectionStatus === 'authenticating') {
                                    statusElement.innerHTML = '🔐 Autenticando...';
                                    statusElement.className = 'status loading';
                                    qrTimerElement.style.display = 'none';
                                } else {
                                    statusElement.innerHTML = '⏳ Aguardando QR Code...';
                                    statusElement.className = 'status disconnected';
                                    qrTimerElement.style.display = 'none';
                                }
                            }
                        })
                        .catch(error => {
                            console.error('Erro ao verificar status:', error);
                        });
                }

                function atualizarQRCode() {
                    const timestamp = new Date().getTime();
                    fetch('/qrcode?' + timestamp)
                        .then(response => {
                            if (response.ok) {
                                return response.blob();
                            }
                            throw new Error('QR Code não disponível');
                        })
                        .then(blob => {
                            const url = URL.createObjectURL(blob);
                            document.getElementById('qrcode').innerHTML = 
                                '<img src="' + url + '" alt="QR Code para escanear">';
                        })
                        .catch(error => {
                            document.getElementById('qrcode').innerHTML = 
                                '<p>⏳ Gerando QR Code... Aguarde.</p>';
                        });
                }

                // Verificar status a cada 3 segundos
                setInterval(atualizarStatus, 3000);
                atualizarStatus();
            </script>
        </body>
        </html>
    `);
});

// Suas rotas existentes
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

app.get('/status', (req, res) => {
    res.json({ 
        connected: isReady,
        qrAvailable: !!qrCodeImage,
        connectionStatus: connectionStatus
    });
});

// Rota para debug
app.get('/debug', (req, res) => {
    res.json({
        connected: isReady,
        qrAvailable: !!qrCodeImage,
        connectionStatus: connectionStatus,
        qrCodeTimestamp: qrCodeTimestamp,
        uptime: process.uptime()
    });
});

// Inicializar cliente
console.log('🚀 Iniciando servidor WhatsApp...');
client.initialize();

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`🌐 Servidor WhatsApp na porta ${PORT}`);
    console.log(`📱 Acesse: https://servidor-whatsapp-mhdo.onrender.com`);
    console.log(`🔍 Debug: https://servidor-whatsapp-mhdo.onrender.com/debug`);
});