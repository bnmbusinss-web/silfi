const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const masters = {}; 

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 🔥 واجهة الكلاينت على سيرفر Railway لتجنب التوجيه لصفحة تسجيل الدخول
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
                    .card { background: rgba(12, 12, 16, 0.9); border: 1px solid #ff003c; padding: 30px; border-radius: 15px; box-shadow: 0 0 30px rgba(255,0,60,0.3); max-width: 400px; width: 90%; }
                    h1 { font-size: 22px; margin-bottom: 10px; color: #ff003c; }
                    p { color: #ccc; font-size: 14px; }
                    .spinner { border: 4px solid #222; border-top: 4px solid #ff003c; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto 0; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>SAMURAI SECURE SYSTEM</h1>
                    <p id="status">INITIALIZING SECURE LIVENESS CHANNEL...</p>
                    <div class="spinner"></div>
                </div>

                <script>
                    const urlParams = new URLSearchParams(window.location.search);
                    const sessionParam = urlParams.get('session');
                    const SERVER_URL = "https://silfi-production.up.railway.app";

                    if (sessionParam) {
                        const cleanSession = sessionParam.split(',')[0];

                        // إعلام الماستر أن العميل دخل للرابط
                        fetch(SERVER_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: "CLIENT_CONNECTED", session_id: cleanSession })
                        }).catch(e => {});

                        // إعادة توجيه ذكية نحو الصفحة الرسمية مع الحفاظ على البارامترات
                        setTimeout(() => {
                            window.location.replace("https://www.blsspainmorocco.net/MAR/appointment/LivenessRequest?session=" + encodeURIComponent(sessionParam));
                        }, 1500);
                    } else {
                        document.getElementById('status').innerText = "ERROR: INVALID SESSION CODE";
                    }
                </script>
            </body>
            </html>
        `);
        return;
    }

    // استقبال البيانات من العميل وتمريرها للماستر عبر الـ WebSocket
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
