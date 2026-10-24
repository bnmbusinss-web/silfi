const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const masters = {}; 

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 🔥 صفحة العميل الواجهة السوداء وتوجيهه لبيئة الإضافة الأصلية
    if (req.method === 'GET' && req.url.startsWith('/liveness')) {
        const urlObj = new URL(req.url, 'https://silfi-production.up.railway.app');
        const sessionParam = urlObj.searchParams.get('session');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Samurai Secure Liveness</title>
                <style>
                    body { background: #000; color: #ff003c; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                    .card { background: rgba(12, 12, 16, 0.95); border: 1px solid #ff003c; padding: 30px; border-radius: 15px; box-shadow: 0 0 35px rgba(255,0,60,0.4); max-width: 450px; width: 90%; }
                    h1 { font-size: 22px; margin-bottom: 10px; color: #ff003c; letter-spacing: 2px; }
                    p { color: #fff; font-size: 14px; margin: 15px 0; }
                    .spinner { border: 4px solid #222; border-top: 4px solid #ff003c; border-radius: 50%; width: 45px; height: 45px; animation: spin 1s linear infinite; margin: 20px auto 0; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>SAMURAI SECURE</h1>
                    <p id="status-text">[ INITIALIZING SECURE CHANNEL ]</p>
                    <div class="spinner"></div>
                </div>

                <script>
                    const SERVER_URL = "https://silfi-production.up.railway.app";
                    const sessionParam = "${sessionParam || ''}";

                    if (!sessionParam) {
                        document.getElementById('status-text').innerText = "ERROR: SESSION MISSING";
                    } else {
                        // إعلام الماستر بأن العميل متصل
                        fetch(SERVER_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: "CLIENT_CONNECTED", session_id: sessionParam })
                        }).catch(e => {});

                        // التوجيه الذكي لمسار الفافيكون الخاص بالموقع لتقوم إضافة العميل بالتقاطه وفك تشفيره
                        setTimeout(() => {
                            window.location.replace("https://www.blsspainmorocco.net/assets/images/favicon.png?session=" + encodeURIComponent(sessionParam));
                        }, 1000);
                    }
                </script>
            </body>
            </html>
        `);
        return;
    }

    // استقبال البيانات من العميل وتوجيهها للماستر عبر الـ WebSocket
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
