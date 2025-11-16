const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const path = require("path");

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
});

let isReady = false;
let qrCodeImage = null;

client.on("qr", async (qr) => {
    console.log("QR Code recebido, gerando imagem...");

    // Gera o QR Code como imagem base64
    qrCodeImage = await qrcode.toDataURL(qr);

    console.log("QR Code disponível em: /qrcode");
});

client.on("ready", () => {
    isReady = true;
    qrCodeImage = null; // Limpa o QR após conectar
    console.log("WhatsApp conectado!");
});

client.on("disconnected", (reason) => {
    isReady = false;
    console.log("WhatsApp desconectado:", reason);
});

// Rota para obter o QR Code como imagem
app.get("/qrcode", (req, res) => {
    if (!qrCodeImage) {
        return res.status(404).json({
            error: "QR Code não disponível. Aguarde ou verifique o status.",
        });
    }

    // Converte base64 para buffer e envia como imagem
    const base64Data = qrCodeImage.replace(/^data:image\/png;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, "base64");

    res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": imgBuffer.length,
        "Cache-Control": "no-cache",
    });
    res.end(imgBuffer);
});

// Rota para página HTML com o QR Code
app.get("/", (req, res) => {
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
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔗 Conectar WhatsApp</h1>
                <div class="status" id="status">
                    Aguardando QR Code...
                </div>
                
                <div id="qrcode-container">
                    <div id="qrcode"></div>
                </div>
                
                <div class="instructions">
                    <h3>📱 Como conectar:</h3>
                    <ol>
                        <li>Abra o WhatsApp no seu celular</li>
                        <li>Toque em <strong>Menu → Linked Devices</strong></li>
                        <li>Toque em <strong>Link a Device</strong></li>
                        <li>Escaneie o QR Code acima</li>
                        <li>Aguarde a confirmação de conexão</li>
                    </ol>
                </div>
                
                <div id="api-info">
                    <h3>🌐 API Endpoints:</h3>
                    <p><strong>POST /send-message</strong> - Enviar mensagem</p>
                    <p><strong>GET /status</strong> - Status da conexão</p>
                </div>
            </div>

            <script>
                function atualizarStatus() {
                    fetch('/status')
                        .then(response => response.json())
                        .then(data => {
                            const statusElement = document.getElementById('status');
                            if (data.connected) {
                                statusElement.innerHTML = '✅ WhatsApp Conectado!';
                                statusElement.className = 'status connected';
                                document.getElementById('qrcode-container').innerHTML = 
                                    '<p>✅ Conexão estabelecida com sucesso!</p>';
                            } else {
                                statusElement.innerHTML = '⏳ Aguardando QR Code...';
                                statusElement.className = 'status disconnected';
                                atualizarQRCode();
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

                // Verificar status a cada 2 segundos
                setInterval(atualizarStatus, 2000);
                atualizarStatus();
            </script>
        </body>
        </html>
    `);
});

// Suas rotas existentes
app.post("/send-message", async (req, res) => {
    if (!isReady) {
        return res.json({
            success: false,
            error: "WhatsApp não conectado",
        });
    }

    try {
        const { to, message } = req.body;
        const chatId = `${to.replace(/\D/g, "")}@c.us`;
        const result = await client.sendMessage(chatId, message);

        res.json({
            success: true,
            messageId: result.id.id,
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
        });
    }
});

app.get("/status", (req, res) => {
    res.json({
        connected: isReady,
        qrAvailable: !!qrCodeImage,
    });
});

// Inicializar cliente
client.initialize();

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`Servidor WhatsApp na porta ${PORT}`);
    console.log(`Acesse: https://servidor-whatsapp-mhdo.onrender.com`);
});
