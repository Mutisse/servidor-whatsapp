const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true
    }
});

let isReady = false;

client.on('qr', (qr) => {
    console.log('QR Code:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isReady = true;
    console.log('WhatsApp conectado!');
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
        connected: isReady
    });
});

client.initialize();

app.listen(3005, () => {
    console.log('Servidor WhatsApp na porta 3005');
});