import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import WebSocket from "ws";
import { SocksProxyAgent } from "socks-proxy-agent";
import crypto from "node:crypto";

const PORT = process.env.PORT || 3000;
const JOIN_NAME = "ojct:4";
const ECP_KEY = process.env.ECP_KEY || null;

const MAX_BOTS = 2000; // GÜNCELLENDİ: 2000 bot
const PING_MS = 3000;
const JOIN_DELAY = 250; // 2000 bot için optimize (~10 dk sürer)

function randChars(len) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const PREFIXES = ["A","B","C","D","E","F","G","H","J","K","L","M","N","P","R","S","X","Z"];
const SUFFIXES = ["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15"];

class UniqueNameGenerator {
    constructor() { this.used = new Set(); }
    
    generate() {
        let name;
        do { name = `${PREFIXES[Math.floor(Math.random()*PREFIXES.length)]}${randChars(5)}${SUFFIXES[Math.floor(Math.random()*SUFFIXES.length)]}`; } 
        while (this.used.has(name));
        this.used.add(name);
        return name;
    }
    
    generateFromBase(base) {
        return base.trim().slice(0, 15);
    }
    
    release(name) { this.used.delete(name); }
}
const nameGen = new UniqueNameGenerator();

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
];

const RAW_PROXIES = [
    // Proxy listeni buraya ekle
];

class ProxyManager {
    constructor(proxies) {
        this.proxies = proxies.map(p => {
            try {
                return { url: `socks5://${p}`, agent: new SocksProxyAgent(`socks5://${p}`), healthy: true, failCount: 0, currentUsers: 0 };
            } catch(e) { return { url: `socks5://${p}`, agent: null, healthy: false, failCount: 0, currentUsers: 0 }; }
        });
    }
    get() {
        const healthy = this.proxies.filter(p => p.healthy && p.agent && p.currentUsers < 1);
        if (!healthy.length) return null;
        const best = healthy.sort((a, b) => a.currentUsers - b.currentUsers)[0];
        best.currentUsers++;
        return best;
    }
    success(p) { if(p) { p.failCount = 0; p.healthy = true; } }
    fail(p) { 
        if(!p) return; 
        p.currentUsers = Math.max(0, p.currentUsers - 1);
        if (++p.failCount > 2) {
            p.healthy = false;
            setTimeout(() => { p.healthy = true; p.failCount = 0; }, 30000);
        }
    }
    release(p) { if(p) p.currentUsers = Math.max(0, p.currentUsers - 1); }
}
const proxyMgr = new ProxyManager(RAW_PROXIES);

async function resolveLink(link) {
    const id = Number(String(link).match(/(\d{3,5})/)?.[1] || 0);
    if (!id) throw new Error("Link geçersiz");
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const response = await fetch("https://starblast.io/simstatus.json", { signal: ctrl.signal });
        clearTimeout(t);
        for (const srv of await response.json()) {
            for (const sys of srv.systems || []) {
                if (sys.id === id) return { id, address: srv.address, name: sys.name, mode: sys.mode };
            }
        }
    } catch (e) { console.error("Çözümleme hatası:", e.message); }
    throw new Error("Sunucu bulunamadı.");
}

// GÜNCELLENDİ: Hem Survival hem Team modlarını getiren yeni radar
async function getEUServers() {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const response = await fetch("https://starblast.io/simstatus.json", { signal: ctrl.signal });
        clearTimeout(t);
        const data = await response.json();
        const servers = [];
        for (const srv of data) {
            const loc = (srv.location || "").toLowerCase();
            if (!loc.includes("eu") && !loc.includes("europe")) continue;
            for (const sys of srv.systems || []) {
                const mode = (sys.mode || "").toLowerCase();
                // Sadece survival ve team modlarını al
                if (!mode.includes("survival") && !mode.includes("team")) continue;
                
                servers.push({
                    id: sys.id, 
                    name: sys.name || "Unknown",
                    mode: sys.mode, // Orijinal modu koru (frontend'de etiket olarak gösterilecek)
                    players: sys.players || 0, 
                    max: sys.max_players || sys.max || 64,
                    address: srv.address, 
                    open: sys.open !== false
                });
            }
        }
        console.log(`📡 Radar: ${servers.length} EU sunucusu bulundu (Survival + Team)`);
        return servers.sort((a, b) => b.players - a.players);
    } catch (e) { console.error("Radar hatası:", e.message); return []; }
}

const sessions = new Map();

class Session {
    constructor(target, proxy, botName) {
        this.id = crypto.randomUUID();
        this.target = target;
        this.proxy = proxy;
        this.name = botName;
        this.hue = Math.floor(Math.random() * 360);
        this.ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        this.ws = null; this.isInGame = false; this.shipId = null; this.systemId = null;
        this.ping = 0; this.lastPing = 0; this.createdAt = Date.now();
        this.logs = []; this.manualClose = false;
    }

    log(msg) {
        this.logs.push(`${new Date().toLocaleTimeString()} | ${msg}`);
        if (this.logs.length > 15) this.logs.shift();
    }

    connect() {
        if (this.manualClose) return;
        const [ip, port] = this.target.address.split(":");
        try {
            this.ws = new WebSocket(`wss://${ip.replace(/\./g, "-")}.starblast.io:${port}`, {
                headers: { Origin: "https://starblast.io", 'User-Agent': this.ua },
                agent: this.proxy?.agent, handshakeTimeout: 5000
            });
            this.ws.on('open', () => {
                this.log(`Bağlandı, join (İsim: ${this.name})...`);
                this.send({ name: JOIN_NAME, data: { mode: this.target.mode, spectate: false, player_name: this.name, hue: this.hue, preferred: this.target.id, client_ship_id: crypto.randomBytes(8).toString('hex'), client_tr: 1 }});
                this.pingTimer = setInterval(() => { this.lastPing = Date.now(); this.send("ping"); }, PING_MS);
            });
            this.ws.on('message', (d) => {
                if (d.toString() === "pong") { this.ping = Date.now() - this.lastPing; return; }
                try { this.process(JSON.parse(d)); } catch {}
            });
            this.ws.on('close', (c, r) => this.onClose(c, r?.toString()));
            this.ws.on('error', (e) => { this.log(`Hata: ${e.message}`); proxyMgr.fail(this.proxy); });
        } catch (e) { this.scheduleReconnect(); }
    }

    process(msg) {
        switch (msg.name) {
            case "welcome":
                this.systemId = msg.data.systemid;
                this.send({ name: "enter", data: { spectate: false } });
                break;
            case "entered":
                this.shipId = msg.data.shipid; this.isInGame = true;
                this.log(`✅ Oyunda (ID: ${this.shipId})`);
                proxyMgr.success(this.proxy);
                break;
            case "cannot_join":
                this.log(`Sunucu dolu/reddetti.`);
                this.manualClose = true; proxyMgr.release(this.proxy); sessions.delete(this.id);
                break;
            case "error":
                proxyMgr.fail(this.proxy); this.scheduleReconnect(); break;
        }
    }

    send(d) { if (this.ws?.readyState === 1) this.ws.send(typeof d === 'string' ? d : JSON.stringify(d)); }

    onClose(code, reason) {
        clearInterval(this.pingTimer);
        if (this.manualClose) return;
        this.isInGame = false;
        this.log(`Koptu (Code:${code} ${reason||''})`);
        proxyMgr.fail(this.proxy);
        this.scheduleReconnect();
    }

    scheduleReconnect() {
        if (this.manualClose) return;
        const newP = proxyMgr.get();
        if (newP) { proxyMgr.release(this.proxy); this.proxy = newP; }
        setTimeout(() => this.connect(), 4000 + Math.random() * 3000);
    }

    view() {
        return {
            id: this.id, name: this.name, proxy: this.proxy?.url.split('//')[1] || 'Direct',
            isInGame: this.isInGame, shipId: this.shipId, systemId: this.systemId,
            uptime: Math.round((Date.now() - this.createdAt) / 1000), ping: this.ping,
            status: this.isInGame ? 'oyunda' : this.ws?.readyState === 1 ? 'bağlı' : 'kopuk',
            logs: this.logs.slice(-3)
        };
    }

    close() {
        this.manualClose = true;
        clearInterval(this.pingTimer);
        try { this.ws?.close(); } catch {}
        proxyMgr.release(this.proxy);
        nameGen.release(this.name);
        sessions.delete(this.id);
    }
}

const json = (res, code, data) => { 
    if (res.headersSent) return; 
    res.writeHead(code, { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }); 
    res.end(JSON.stringify(data)); 
};

const readBody = (req) => new Promise(r => { 
    let d=''; req.on('data',c=>d+=c); 
    req.on('end',()=>{ try{r(JSON.parse(d))}catch{r({})} }); 
});

http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    try {
        if (url.pathname === '/') {
            try {
                const html = fs.readFileSync("./index.html", "utf8");
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                return res.end(html);
            } catch (e) {
                console.error("index.html okunamadı:", e.message);
                return json(res, 500, { error: "index.html bulunamadı" });
            }
        }

        if (url.pathname === '/api/radar') {
            const servers = await getEUServers();
            return json(res, 200, { 
                servers, 
                proxyStats: { total: proxyMgr.proxies.length, healthy: proxyMgr.proxies.filter(p=>p.healthy).length }
            });
        }

        if (url.pathname === '/api/test') {
            const results = await Promise.all(proxyMgr.proxies.map(async p => {
                if (!p.agent) return { proxy: p.url.split('//')[1], ok: false };
                try {
                    const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 3000);
                    await fetch("https://api.ipify.org", { agent: p.agent, signal: ctrl.signal });
                    clearTimeout(t); return { proxy: p.url.split('//')[1], ok: true };
                } catch { return { proxy: p.url.split('//')[1], ok: false }; }
            }));
            return json(res, 200, { results });
        }

        if (url.pathname === '/api/start' && req.method === 'POST') {
            const { link, count = 60, nameMode = 'random', customName = '', isCustomRoom = false } = await readBody(req);
            const target = await resolveLink(link);
            
            const finalMode = isCustomRoom ? "team" : target.mode;
            const limit = Math.min(count, MAX_BOTS);
            let started = 0, failed = 0;

            console.log(`\n🚀 ${limit} bot başlatılıyor. Hedef: ${target.address} (Mod: ${finalMode})`);

            for (let i = 0; i < limit; i++) {
                let session = null, tries = 0;
                while (!session && tries < 5) {
                    const p = proxyMgr.get();
                    if (p) {
                        let botName = (nameMode === 'custom' && customName.trim()) ? nameGen.generateFromBase(customName.trim()) : nameGen.generate();
                        session = new Session(target, p, botName);
                    } else {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                    tries++;
                }
                if (session) { sessions.set(session.id, session); setTimeout(()=>session.connect(), Math.random()*1000); started++; }
                else failed++;
                await new Promise(r => setTimeout(r, JOIN_DELAY));
            }
            
            let msg = `${started}/${limit} bot başlatıldı.`;
            if (failed > 0) msg += ` (${failed} bot için proxy yetersiz/ölü).`;
            console.log(`✅ İşlem tamam: ${msg}`);
            return json(res, 200, { ok: true, count: started, msg });
        }

        if (url.pathname === '/api/stop') {
            for (const s of sessions.values()) s.close();
            return json(res, 200, { ok: true });
        }

        if (url.pathname === '/api/state') {
            const bots = [...sessions.values()].map(s => s.view());
            return json(res, 200, { total: sessions.size, inGame: bots.filter(b=>b.isInGame).length, max: MAX_BOTS, bots });
        }
        
        json(res, 404, { error: 'Bulunamadı' });
    } catch (e) { 
        console.error("API Hatası:", e.message);
        json(res, 400, { error: e.message }); 
    }
}).listen(PORT, () => console.log(`🚀 Backend API Hazır: http://localhost:${PORT} | Proxy: ${proxyMgr.proxies.length}`));

process.on('uncaughtException', (err) => console.error('Kritik Hata:', err));
process.on('unhandledRejection', (reason) => console.error('Promise Hatası:', reason));
