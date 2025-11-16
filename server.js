const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let isReady = false;
let qrCodeImage = null;
let qrCodeTimestamp = null;
const QR_CODE_DURATION = 60000; // 60 segundos (aumentei o tempo)

client.on('qr', async (qr) => {
    const now = Date.now();
    
    // Só gera novo QR Code se o anterior tiver mais de 60 segundos
    if (!qrCodeTimestamp || (now - qrCodeTimestamp) > QR_CODE_DURATION) {
        console.log('🔄 Gerando NOVO QR Code...');
        qrCodeTimestamp = now;
        
        // Gera o QR Code como imagem base64
        qrCodeImage = await qrcode.toDataURL(qr);
        
        console.log('✅ QR Code disponível em: /qrcode');
        console.log('⏰ Este QR Code será válido por 60 segundos');
    } else {
        console.log('⏳ QR Code atual ainda é válido...');
    }
});

client.on('ready', () => {
    isReady = true;
    qrCodeImage = null;
    qrCodeTimestamp = null;
    console.log('✅ WhatsApp conectado!');
});

client.on('disconnected', (reason) => {
    isReady = false;
    qrCodeImage = null;
    qrCodeTimestamp = null;
    console.log('❌ WhatsApp desconectado:', reason);
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
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔗 Conectar WhatsApp</h1>
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

                function atualizarStatus() {
                    fetch('/status')
                        .then(response => response.json())
                        .then(data => {
                            const statusElement = document.getElementById('status');
                            const qrTimerElement = document.getElementById('qrTimer');
                            
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
                                } else {
                                    statusElement.innerHTML = '⏳ Gerando QR Code...';
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

                // Verificar status a cada 3 segundos (reduzido)
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
        
        res.json({ 
            success: true, 
            messageId: result.id.id
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/status', (req, res) => {
    res.json({ 
        connected: isReady,
        qrAvailable: !!qrCodeImage
    });
});

// Inicializar cliente
client.initialize();

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`Servidor WhatsApp na porta ${PORT}`);
    console.log(`Acesse: https://servidor-whatsapp-mhdo.onrender.com`);
});