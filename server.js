const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const masters = {}; 

// دالة فك تشفير السيشن (لتوليد بيانات الكاميرا مباشرة)
function parse_silfi_session(sessionstring) {
  try {
    return JSON.parse(
      Buffer.from(
        Buffer.from(Buffer.from(sessionstring).toString('utf8').replace(/b-/g, "=").split("").reverse().join(""), 'base64').toString('utf8'),
        'base64'
      ).toString('utf8')
    );
  } catch (e) {
    try {
      // محاولة فك التشفير بالخوارزمية القياسية للإضافة
      let decoded = sessionstring.replace(/b-/g, "=").split("").reverse().join("");
      let b1 = Buffer.from(decoded, 'base64').toString('utf8');
      let b2 = Buffer.from(b1, 'base64').toString('utf8');
      let mapped = b2.split("").reverse().map(e => String.fromCharCode(e.charCodeAt(0) + 9)).join("");
      return JSON.parse(mapped);
    } catch(err) {
      console.error("Parse Error:", err);
      return null;
    }
  }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 🔥 صفحة العميل المباشرة التي تحمل الكاميرا وتفتحها تلقائياً
    if (req.method === 'GET' && req.url.startsWith('/liveness')) {
        const urlObj = new URL(req.url, 'https://silfi-production.up.railway.app');
        const sessionParam = urlObj.searchParams.get('session');
        
        let sessionData = null;
        if (sessionParam) {
            sessionData = parse_silfi_session(sessionParam);
        }

        const pluginUrl = sessionData ? sessionData.plugin_liveness_url : "https://www.blsspainmorocco.net/Scripts/OzLiveness.js";
        const userId = sessionData ? sessionData.user_id : "";
        const transId = sessionData ? sessionData.transaction_id : "";
        const checkId = sessionData ? sessionData.check_id : "";

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
                    <p id="status-text">[ INITIALIZING CAMERA INTERFACE ]</p>
                    <div class="spinner" id="loader"></div>
                </div>

                <script>
                    const SERVER_URL = "https://silfi-production.up.railway.app";
                    const sessionId = "${sessionParam || ''}";
                    const userId = "${userId}";
                    const transId = "${transId}";
                    const checkId = "${checkId}";
                    const sdkUrl = "${pluginUrl}";

                    function updateStatus(text) {
                        document.getElementById('status-text').innerText = text;
                    }

                    if (!sessionId) {
                        updateStatus("ERROR: INVALID SESSION");
                    } else {
                        // 1. إعلام الماستر بأن العميل اتصل
                        fetch(SERVER_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: "CLIENT_CONNECTED", session_id: sessionId })
                        }).catch(e => {});

                        // 2. حقن مكتبة الكاميرا الأصلية
                        const script = document.createElement('script');
                        script.src = sdkUrl;
                        script.onload = () => {
                            updateStatus("SYSTEM READY - OPENING CAMERA");
                            
                            // إعلام الماستر أن الكاميرا بدأت
                            fetch(SERVER_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ type: "CLIENT_STARTED_LIVENESS", session_id: sessionId })
                            }).catch(e => {});

                            // إخفاء اللودر وتفعيل الكاميرا
                            setTimeout(() => {
                                document.getElementById('loader').style.display = 'none';
                                
                                if (typeof window.OzLiveness !== 'undefined') {
                                    window.OzLiveness.open({
                                        lang: 'en',
                                        meta: { user_id: userId, transaction_id: transId },
                                        overlay_options: false,
                                        action: ['video_selfie_blank'],
                                        result_mode: 'safe',
                                        on_complete: function(result) {
                                            const uuid = result.event_session_id;
                                            updateStatus("VERIFICATION SUCCESSFUL - SENDING DATA...");

                                            const encodedPayload = btoa(JSON.stringify({ check_id: checkId, result: uuid }));
                                            fetch(SERVER_URL, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ session_id: sessionId, payload: encodedPayload })
                                            })
                                            .then(res => res.json())
                                            .then(data => {
                                                updateStatus("DONE ✔ - YOU CAN CLOSE THIS WINDOW");
                                            }).catch(err => {
                                                updateStatus("ERROR SENDING UUID");
                                            });
                                        },
                                        on_error: function(err) {
                                            updateStatus("CAMERA ERROR: " + (err.message || "Permission Denied"));
                                            fetch(SERVER_URL, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ type: "CLIENT_ERROR", session_id: sessionId, reason: err.message })
                                            }).catch(e => {});
                                        }
                                    });
                                } else {
                                    updateStatus("ERROR: SDK LOAD FAILED");
                                }
                            }, 1000);
                        };
                        script.onerror = () => {
                            updateStatus("ERROR: FAILED TO LOAD SDK SCRIPT");
                        };
                        document.head.appendChild(script);
                    }
                </script>
            </body>
            </html>
        `);
        return;
    }

    // استقبال البيانات من العميل وإرسالها للماستر عبر الـ WebSocket
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
