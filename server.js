const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const masters = {}; 

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 1. معالجة رابط العميل الوارد من الماستر
    if (req.method === 'GET' && req.url.startsWith('/liveness')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Samurai Secure Liveness</title>
                <style>
                    body { background: #000; color: #ff003c; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                    .spinner { border: 4px solid #222; border-top: 4px solid #ff003c; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-top: 20px; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <h1>SAMURAI SECURE SYSTEM</h1>
                <p id="status">[ SECURE CONNECTION ESTABLISHED ]</p>
                <div class="spinner"></div>

                <script>
                    const urlParams = new URLSearchParams(window.location.search);
                    const sessionParam = urlParams.get('session');
                    const SERVER_URL = "https://silfi-production.up.railway.app";

                    if (sessionParam) {
                        // استخراج الكود الأساسي للسيشن
                        const cleanSession = sessionParam.split(',')[0];

                        // إعلام الماستر عبر الـ POST بأن العميل فتح الرابط وانضم
                        fetch(SERVER_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: "CLIENT_CONNECTED", session_id: cleanSession })
                        }).catch(e => {});

                        // التوجيه النظيف للموقع الرسمي مع الحفاظ على البارامتر لكي تلتقطه إضافة العميل
                        setTimeout(() => {
                            window.location.replace("https://www.blsspainmorocco.net/MAR/appointment/liveness?session=" + encodeURIComponent(sessionParam));
                        }, 1200);
                    } else {
                        document.getElementById('status').innerText = "[ ERROR: INVALID SESSION CODE ]";
                    }
                </script>
            </body>
            </html>
        `);
        return;
    }

    // 2. استقبال بيانات الـ POST وتمريرها للماستر عبر الـ WebSocket
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const targetSession = data.session_id; 

                if (targetSession && masters[targetSession]) {
                    const masterWs = masters[targetSession];
                    if (masterWs.readyState === WebSocket.OPEN) {
                        let messageToMaster = null;

                        if (data.type) {
                            messageToMaster = { type: data.type, reason: data.reason || null };
                        } else if (data.payload) {
                            const decoded = Buffer.from(data.payload, 'base64').toString();
                            const jsonPayload = JSON.parse(decoded);
                            messageToMaster = { type: 'UUID_RECEIVED', uuid: jsonPayload.result };
                        }

                        if (messageToMaster) {
                            masterWs.send(JSON.stringify(messageToMaster));
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                            return;
                        }
                    }
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            } catch (e) {
                res.writeHead(400); res.end();
            }
        });
        return;
    }

    res.writeHead(200); res.end('Samurai Server Active 🥷');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    let mySessionId = null;
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'REGISTER_MASTER' && data.session_id) {
                mySessionId = data.session_id;
                masters[mySessionId] = ws;
            }
        } catch(e) {}
    });

    ws.on('close', () => {
        if (mySessionId && masters[mySessionId]) {
            delete masters[mySessionId];
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 SAMURAI SERVER RUNNING ON PORT ${PORT}`);
});
