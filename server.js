import "dotenv/config";
import http from "node:http";
import WebSocket from "ws";
import { SocksProxyAgent } from "socks-proxy-agent";
import crypto from "node:crypto";

const PORT = process.env.PORT || 3000;
const JOIN_NAME = "ojct:4";
const ECP_KEY = process.env.ECP_KEY || null;

const MAX_BOTS = 1100;
const PING_MS = 3000;
const JOIN_DELAY = 400;

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
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
    
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.68',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.2651.74',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:128.0) Gecko/20100101 Firefox/128.0',
'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.113',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.2651.86',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.52',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',

    // Chrome macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Chrome Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Firefox Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:117.0) Gecko/20100101 Firefox/117.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:116.0) Gecko/20100101 Firefox/116.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',


"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:77.0) Gecko/20190101 Firefox/77.0",
"Mozilla/5.0 (Windows NT 10.0; WOW64; rv:77.0) Gecko/20100101 Firefox/77.0",
"Mozilla/5.0 (X11; Linux ppc64le; rv:75.0) Gecko/20100101 Firefox/75.0",
"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:39.0) Gecko/20100101 Firefox/75.0",
"Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.10; rv:75.0) Gecko/20100101 Firefox/75.0",
"Mozilla/5.0 (X11; Linux; rv:74.0) Gecko/20100101 Firefox/74.0",
"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:61.0) Gecko/20100101 Firefox/73.0",
"Mozilla/5.0 (X11; OpenBSD i386; rv:72.0) Gecko/20100101 Firefox/72.0",
"Mozilla/5.0 (Windows NT 6.3; WOW64; rv:71.0) Gecko/20100101 Firefox/71.0",
"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:70.0) Gecko/20191022 Firefox/70.0",
"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:70.0) Gecko/20190101 Firefox/70.0",
"Mozilla/5.0 (Windows; U; Windows NT 9.1; en-US; rv:12.9.1.11) Gecko/20100821 Firefox/70",
"Mozilla/5.0 (Windows NT 10.0; WOW64; rv:69.2.1) Gecko/20100101 Firefox/69.2",
"Mozilla/5.0 (Windows NT 6.1; rv:68.7) Gecko/20100101 Firefox/68.7",
"Mozilla/5.0 (X11; Linux i686; rv:64.0) Gecko/20100101 Firefox/64.0",
"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:64.0) Gecko/20100101 Firefox/64.0",
"Mozilla/5.0 (X11; Linux i586; rv:63.0) Gecko/20100101 Firefox/63.0",
"Mozilla/5.0 (Windows NT 6.2; WOW64; rv:63.0) Gecko/20100101 Firefox/63.0",
"Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.10; rv:62.0) Gecko/20100101 Firefox/62.0",
"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:10.0) Gecko/20100101 Firefox/62.0",
"Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.13; ko; rv:1.9.1b2) Gecko/20081201 Firefox/60.0",
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/58.0.1",
"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/58.0",
"Mozilla/5.0 (Windows NT 5.0; Windows NT 5.1; Windows NT 6.0; Windows NT 6.1; Linux; es-VE; rv:52.9.0) Gecko/20100101 Firefox/52.9.0",
"Mozilla/5.0 (Windows NT 6.3; WOW64; rv:52.59.12) Gecko/20160044 Firefox/52.59.12",
"Mozilla/5.0 (X11; Ubuntu i686; rv:52.0) Gecko/20100101 Firefox/52.0",
"Mozilla/5.0 (X11;  Ubuntu; Linux i686; rv:52.0) Gecko/20100101 Firefox/52.0",
"Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.9a1) Gecko/20060814 Firefox/51.0",
"Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.10; rv:62.0) Gecko/20100101 Firefox/49.0",
"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:46.0) Gecko/20120121 Firefox/46.0",
"Mozilla/5.0 (Windows NT 10.0; WOW64; rv:45.66.18) Gecko/20177177 Firefox/45.66.18",
"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1",
"Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0",
"Mozilla/5.0 (Windows ME 4.9; rv:35.0) Gecko/20100101 Firefox/35.0",
"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10; rv:33.0) Gecko/20100101 Firefox/33.0",
"Mozilla/5.0 (Windows ME 4.9; rv:31.0) Gecko/20100101 Firefox/31.7",
"Mozilla/5.0 (X11; Linux i586; rv:31.0) Gecko/20100101 Firefox/31.0",
"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:31.0) Gecko/20130401 Firefox/31.0",
"Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:28.0) Gecko/20100101 Firefox/31.0",
"Mozilla/5.0 (Windows NT 5.1; rv:31.0) Gecko/20100101 Firefox/31.0",
"Mozilla/5.0 (Windows NT 6.1; WOW64; rv:29.0) Gecko/20120101 Firefox/29.0",
"Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:25.0) Gecko/20100101 Firefox/29.0",
"Mozilla/5.0 (X11; OpenBSD amd64; rv:28.0) Gecko/20100101 Firefox/28.0",
"Mozilla/5.0 (X11; Linux x86_64; rv:28.0) Gecko/20100101  Firefox/28.0",
"Mozilla/5.0 (Windows NT 6.1; rv:27.3) Gecko/20130101 Firefox/27.3",
"Mozilla/5.0 (Windows NT 6.2; Win64; x64; rv:27.0) Gecko/20121011 Firefox/27.0",
"Mozilla/5.0 (Windows NT 6.2; rv:20.0) Gecko/20121202 Firefox/26.0",
"Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:25.0) Gecko/20100101 Firefox/25.0",
"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.6; rv:25.0) Gecko/20100101 Firefox/25.0",
"Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:24.0) Gecko/20100101 Firefox/24.0",

    
    // Firefox Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:119.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13.0; rv:121.0) Gecko/20100101 Firefox/121.0',
    
    // Firefox Linux
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    
    // Edge Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    
    // Safari macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    
    // Safari iOS
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0.3 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 16_7_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    
    // Android Chrome
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; RMX3700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; ASUS_AI2401) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; 23116PN5BG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; 2211133C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    
    // Opera
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 OPR/104.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
"Opera/9.80 (X11; Linux i686; Ubuntu/14.10) Presto/2.12.388 Version/12.16.2",
"Opera/9.80 (X11; Linux i686; Ubuntu/14.10) Presto/2.12.388 Version/12.16",
"Opera/9.80 (Macintosh; Intel Mac OS X 10.14.1) Presto/2.12.388 Version/12.16",
"Opera/9.80 (Windows NT 6.0) Presto/2.12.388 Version/12.14",
"Mozilla/5.0 (Windows NT 6.0; rv:2.0) Gecko/20100101 Firefox/4.0 Opera 12.14",
"Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.0) Opera 12.14",
"Opera/12.80 (Windows NT 5.1; U; en) Presto/2.10.289 Version/12.02",
"Opera/9.80 (Windows NT 6.1; U; es-ES) Presto/2.9.181 Version/12.00",
"Opera/9.80 (Windows NT 5.1; U; zh-sg) Presto/2.9.181 Version/12.00",
"Opera/12.0(Windows NT 5.2;U;en)Presto/22.9.168 Version/12.00",
"Opera/12.0(Windows NT 5.1;U;en)Presto/22.9.168 Version/12.00",
"Mozilla/5.0 (Windows NT 5.1) Gecko/20100101 Firefox/14.0 Opera/12.0",
"Opera/9.80 (Windows NT 6.1; WOW64; U; pt) Presto/2.10.229 Version/11.62",
"Opera/9.80 (Windows NT 6.0; U; pl) Presto/2.10.229 Version/11.62",
"Opera/9.80 (Macintosh; Intel Mac OS X 10.6.8; U; fr) Presto/2.9.168 Version/11.52",
"Opera/9.80 (Macintosh; Intel Mac OS X 10.6.8; U; de) Presto/2.9.168 Version/11.52",
"Opera/9.80 (Windows NT 5.1; U; en) Presto/2.9.168 Version/11.51",
"Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; de) Opera 11.51",
"Opera/9.80 (X11; Linux x86_64; U; fr) Presto/2.9.168 Version/11.50",
"Opera/9.80 (X11; Linux i686; U; hu) Presto/2.9.168 Version/11.50",
"Opera/9.80 (X11; Linux i686; U; ru) Presto/2.8.131 Version/11.11",
"Opera/9.80 (X11; Linux i686; U; es-ES) Presto/2.8.131 Version/11.11",
"Mozilla/5.0 (Windows NT 5.1; U; en; rv:1.8.1) Gecko/20061208 Firefox/5.0 Opera 11.11",
"Opera/9.80 (X11; Linux x86_64; U; bg) Presto/2.8.131 Version/11.10",
"Opera/9.80 (Windows NT 6.0; U; en) Presto/2.8.99 Version/11.10",
"Opera/9.80 (Windows NT 5.1; U; zh-tw) Presto/2.8.131 Version/11.10",
"Opera/9.80 (Windows NT 6.1; Opera Tablet/15165; U; en) Presto/2.8.149 Version/11.1",
"Opera/9.80 (X11; Linux x86_64; U; Ubuntu/10.10 (maverick); pl) Presto/2.7.62 Version/11.01",
"Opera/9.80 (X11; Linux i686; U; ja) Presto/2.7.62 Version/11.01",
"Opera/9.80 (X11; Linux i686; U; fr) Presto/2.7.62 Version/11.01",
"Opera/9.80 (Windows NT 6.1; U; zh-tw) Presto/2.7.62 Version/11.01",
"Opera/9.80 (Windows NT 6.1; U; zh-cn) Presto/2.7.62 Version/11.01",
"Opera/9.80 (Windows NT 6.1; U; sv) Presto/2.7.62 Version/11.01",
"Opera/9.80 (Windows NT 6.1; U; en-US) Presto/2.7.62 Version/11.01",
"Opera/9.80 (Windows NT 6.1; U; cs) Presto/2.7.62 Version/11.01",
"Opera/9.80 (Windows NT 6.0; U; pl) Presto/2.7.62 Version/11.01",
"Opera/9.80 (Windows NT 5.2; U; ru) Presto/2.7.62 Version/11.01",
"Opera/9.80 (Windows NT 5.1; U;) Presto/2.7.62 Version/11.01",
"Opera/9.80 (Windows NT 5.1; U; cs) Presto/2.7.62 Version/11.01",
"Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US; rv:1.9.2.13) Gecko/20101213 Opera/9.80 (Windows NT 6.1; U; zh-tw) Presto/2.7.62 Version/11.01",
"Mozilla/5.0 (Windows NT 6.1; U; nl; rv:1.9.1.6) Gecko/20091201 Firefox/3.5.6 Opera 11.01",
"Mozilla/5.0 (Windows NT 6.1; U; de; rv:1.9.1.6) Gecko/20091201 Firefox/3.5.6 Opera 11.01",
"Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; de) Opera 11.01",
"Opera/9.80 (X11; Linux x86_64; U; pl) Presto/2.7.62 Version/11.00",
"Opera/9.80 (X11; Linux i686; U; it) Presto/2.7.62 Version/11.00",
"Opera/9.80 (Windows NT 6.1; U; zh-cn) Presto/2.6.37 Version/11.00",
"Opera/9.80 (Windows NT 6.1; U; pl) Presto/2.7.62 Version/11.00",
"Opera/9.80 (Windows NT 6.1; U; ko) Presto/2.7.62 Version/11.00",
"Opera/9.80 (Windows NT 6.1; U; fi) Presto/2.7.62 Version/11.00",
"Opera/9.80 (Windows NT 6.1; U; en-GB) Presto/2.7.62 Version/11.00",
"Opera/9.80 (Windows NT 6.1 x64; U; en) Presto/2.7.62 Version/11.00",
"Opera/9.80 (Windows NT 6.0; U; en) Presto/2.7.39 Version/11.00",
"Opera/9.80 (Windows NT 5.1; U; ru) Presto/2.7.39 Version/11.00",
"Opera/9.80 (Windows NT 5.1; U; MRA 5.5 (build 02842); ru) Presto/2.7.62 Version/11.00",
"Opera/9.80 (Windows NT 5.1; U; it) Presto/2.7.62 Version/11.00",
"Mozilla/5.0 (Windows NT 6.0; U; ja; rv:1.9.1.6) Gecko/20091201 Firefox/3.5.6 Opera 11.00",
"Mozilla/5.0 (Windows NT 5.1; U; pl; rv:1.9.1.6) Gecko/20091201 Firefox/3.5.6 Opera 11.00",
"Mozilla/5.0 (Windows NT 5.1; U; de; rv:1.9.1.6) Gecko/20091201 Firefox/3.5.6 Opera 11.00",
"Mozilla/4.0 (compatible; MSIE 8.0; X11; Linux x86_64; pl) Opera 11.00",
"Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; fr) Opera 11.00",
"Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; ja) Opera 11.00",
"Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; en) Opera 11.00",
"Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 5.1; pl) Opera 11.00",
"Opera/9.80 (Windows NT 6.1; U; pl) Presto/2.6.31 Version/10.70",
"Mozilla/5.0 (Windows NT 5.2; U; ru; rv:1.9.1.6) Gecko/20091201 Firefox/3.5.6 Opera 10.70",
"Mozilla/5.0 (Windows NT 5.1; U; zh-cn; rv:1.9.1.6) Gecko/20091201 Firefox/3.5.6 Opera 10.70",
"Opera/9.80 (Windows NT 5.2; U; zh-cn) Presto/2.6.30 Version/10.63",
"Opera/9.80 (Windows NT 5.2; U; en) Presto/2.6.30 Version/10.63",
"Opera/9.80 (Windows NT 5.1; U; MRA 5.6 (build 03278); ru) Presto/2.6.30 Version/10.63",
"Opera/9.80 (Windows NT 5.1; U; pl) Presto/2.6.30 Version/10.62",
"Mozilla/5.0 (X11; Linux x86_64; U; de; rv:1.9.1.6) Gecko/20091201 Firefox/3.5.6 Opera 10.62",
"Mozilla/4.0 (compatible; MSIE 8.0; X11; Linux x86_64; de) Opera 10.62",
"Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; en) Opera 10.62",
"Opera/9.80 (X11; Linux i686; U; pl) Presto/2.6.30 Version/10.61",
"Opera/9.80 (X11; Linux i686; U; es-ES) Presto/2.6.30 Version/10.61",
"Opera/9.80 (Windows NT 6.1; U; zh-cn) Presto/2.6.30 Version/10.61",
"Opera/9.80 (Windows NT 6.1; U; en) Presto/2.6.30 Version/10.61",
"Opera/9.80 (Windows NT 6.0; U; it) Presto/2.6.30 Version/10.61",
"Opera/9.80 (Windows NT 5.2; U; ru) Presto/2.6.30 Version/10.61",
"Opera/9.80 (Windows 98; U; de) Presto/2.6.30 Version/10.61",


    
    // Brave
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Brave/1.61',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Brave/1.60',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Brave/1.61',
    
    // Vivaldi
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Vivaldi/6.5',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Vivaldi/6.4',
    
    // Samsung Browser
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/22.0 Chrome/111.0.0.0 Mobile Safari/537.36',
    
    // UC Browser
    'Mozilla/5.0 (Linux; U; Android 13; en-US; SM-G991B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.127 Mobile Safari/537.36 UCBrowser/13.4.0.1307',
    
    // Yandex
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 YaBrowser/24.1.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 YaBrowser/24.1.0.0 Safari/537.36',
    
    // Windows 7/8
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    
    // Eski browser'lar
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.82 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0 Waterfox/133.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/117.0.0.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/117.0.0.0',
'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; SM-A556B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/116.0.0.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/7.0.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 YaBrowser/24.10.0.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 SeznamBrowser/25.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0',
'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.89',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Brave/1.70',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/7.1',
'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 YaBrowser/24.12.0.0',
'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 OPR/113.0.0.0',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2843.46',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; Pixel 9 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
];

const RAW_PROXIES = [
    "207.180.207.217:10808",
"141.148.206.170:1088",
"144.24.111.128:1088",
"47.238.126.208:1080",
"109.111.4.184:2080",
"83.147.217.103:1080",
"107.174.30.92:1080",
"107.174.30.94:1080",
"185.112.83.80:1080",
"144.172.99.34:1081",
"144.172.108.179:1081",
"144.172.105.57:1081",
"144.172.116.50:1081",
"192.252.208.70:14282",
"199.66.182.243:4145",
"70.166.167.38:57728",
"184.178.172.18:15280",
"199.66.182.232:4145",
"5.255.117.250:1080",
"5.255.123.162:1080",
"67.201.33.10:25283",
"217.142.236.180:1080",
"82.139.234.160:1001",
"72.195.34.42:4145",
"184.178.172.25:15291",
"69.61.200.104:36181",
"98.178.72.21:10919",
"70.166.167.55:57745",
"212.77.75.25:1088",
"216.105.128.144:4145",
"5.255.117.127:1080",
"193.25.215.182:22222",
"171.25.158.95:1080",
"38.49.210.79:40000",
"66.42.224.229:41679",
"185.232.170.87:10808",
"70.166.65.160:4145",
"45.74.31.42:13995",
"208.102.51.6:58208",
"184.178.172.5:15303",
"202.62.55.95:1080",
"154.37.218.130:555",
"199.102.105.242:4145",
"45.74.31.41:15608",
"72.195.114.169:4145",
"14.225.204.32:10800",
"184.170.249.65:4145",
"66.59.197.63:3128",
"68.71.242.118:4145",
"65.109.215.187:8090",
"98.175.31.222:4145",
"199.66.183.251:4145",
"199.229.254.129:4145",
"192.252.211.193:4145",
"119.73.109.210:1080",
"220.158.232.118:1080",
"174.64.199.82:4145",
"109.205.182.143:1088",
"142.54.226.214:4145",
"67.205.161.254:9050",
"72.195.34.60:27391",
"72.195.34.59:4145",
"67.201.59.70:4145",
"72.207.113.97:4145",
"142.54.235.9:4145",
"184.181.217.213:4145",
"206.220.175.2:4145",
"98.190.239.3:4145",
"98.188.47.132:4145",
"67.201.58.190:4145",
"45.61.129.165:9050",
"74.119.147.209:4145",
"184.170.245.148:4145",
"85.142.124.27:1080",
"5.75.133.113:10808",
"184.182.240.12:4145",
"72.205.0.67:4145",
"72.195.114.184:4145",
"98.170.57.241:4145",
"101.36.112.205:1081",
"5.255.113.177:1080",
"147.93.172.241:5555",
"184.181.217.210:4145",
"138.124.66.226:1080",
"192.111.135.18:18301",
"199.102.107.145:4145",
"184.185.2.12:4145",
"199.116.112.6:4145",
"98.182.147.97:4145",
"192.111.130.5:17002",
"192.111.139.163:19404",
"101.36.104.239:10808",
"185.73.39.118:9999",
"107.167.18.122:443",
"37.18.73.60:5566",
"184.178.172.28:15294",
"213.199.47.140:1080",
"72.205.0.93:4145",
"192.111.129.145:16894",
"141.148.8.171:1080",
"192.111.130.2:4145",
"68.71.247.130:4145",
"82.23.173.223:1080",
"104.200.152.30:4145",
"24.249.199.4:4145",
"142.54.237.34:4145",
"85.209.156.148:1080",
"67.201.35.145:4145",
"72.214.108.67:4145",
"192.111.137.37:18762",
"103.88.234.239:40015",
"199.58.184.97:4145",
"199.66.183.226:4145",
"72.195.34.35:27360",
"174.77.111.196:4145",
"72.206.74.126:4145",
"98.191.0.47:4145",
"184.178.172.17:4145",
"72.49.49.11:31034",
"142.54.236.97:4145",
"216.105.130.131:4145",
"199.102.104.70:4145",
"199.116.114.11:4145",
"152.53.183.107:8081",
"192.252.211.197:14921",
"111.206.4.163:18888",
"192.252.209.155:14455",
"216.105.143.146:4145",
"174.75.211.222:4145",
"195.98.82.62:1080",
"45.155.71.236:1080",
"107.152.98.5:4145",
"72.194.42.156:4145",
"72.195.34.58:4145",
"79.76.59.115:1080",
"65.20.79.228:40000",
"192.252.214.20:15864",
"198.8.94.174:39078",
"98.170.57.249:4145",
"98.191.0.37:4145",
"184.181.217.206:4145",
"24.249.199.12:4145",
"142.54.231.38:4145",
"184.181.217.201:4145",
"108.61.185.188:1080",
"68.71.254.6:4145",
"184.181.217.194:4145",
"162.253.68.97:4145",
"142.54.232.6:4145",
"68.1.210.189:4145",
"184.181.217.220:4145",
"68.71.243.14:4145",
"210.172.216.185:1080",
"67.201.39.14:4145",
"80.82.54.243:1080",
"142.54.239.1:4145",
"198.8.94.170:4145",
"160.187.0.89:1080",
"157.245.129.129:10000",
"72.195.101.99:4145",
"184.178.172.13:15311",
"98.175.31.195:4145",
"184.170.251.30:11288",
"149.248.18.106:1080",
"68.71.252.38:4145",
"185.133.239.244:16299",
"123.58.219.171:10808",
"192.111.129.150:4145",
"142.54.237.38:4145",
"98.181.137.83:4145",
"192.111.135.17:18302",
"216.68.128.121:4145",
"72.223.188.67:4145",
"124.248.177.43:1080",
"184.178.172.26:4145",
"174.75.211.193:4145",
"184.178.172.11:4145",
"168.144.72.32:1080",
"45.61.188.134:44499",
"178.206.231.147:1080",
"101.36.104.46:10808",
"185.50.202.185:1080",
"212.3.206.215:10800",
"185.54.244.166:1080",
"61.247.178.178:1080",
"8.210.127.52:1080",
"8.219.245.123:1080",
"118.179.155.202:9090",
"192.252.215.5:16137",
"31.133.202.236:1080",
"72.37.216.68:4145",
"68.71.241.33:4145",
"68.71.240.210:4145",
"192.252.216.81:4145",
"98.188.47.150:4145",
"72.194.42.131:4145",
"192.111.137.35:4145",
"192.111.134.10:4145",
"107.149.92.23:8443",
"184.181.178.33:4145",
"5.255.99.75:1080",
"72.223.188.92:4145",
"78.156.229.34:1080",
"192.252.216.86:4145",
"98.170.57.231:4145",
"184.170.248.5:4145",
"37.9.4.101:1088",
"78.85.188.110:1080",
"178.128.146.125:10000",
"212.33.248.45:1080",
"104.200.135.46:4145",
"176.208.114.114:1080",
"192.252.209.158:4145",
"158.101.8.92:1080",
"107.181.168.145:4145",
"95.81.126.73:1080",
"174.64.199.79:4145",
"113.249.111.67:1080",
"107.181.161.81:4145",
"68.71.249.158:4145",
"95.220.82.101:1080",
"72.195.34.41:4145",
"185.200.177.138:445",
"212.231.230.141:18500",
"98.178.72.30:4145",
"159.89.239.204:10000",
"184.178.172.3:4145",
"199.58.185.9:4145",
"142.54.229.249:4145",
"68.71.249.153:48606",
"43.230.193.154:1080",
"129.151.128.225:1080",
"174.77.111.197:4145",
"192.111.139.162:4145",
"119.148.7.10:22122",
"202.160.76.173:1080",
"38.18.230.153:8888",
"43.160.245.155:8080",
"43.155.130.224:443",
"98.181.137.80:4145",
"103.84.166.37:1080",
"157.66.26.151:1080",
"103.142.255.32:1080",
"72.207.109.5:4145",
"94.232.62.170:1080",
"202.160.76.169:1080",
"74.119.144.60:4145",
"199.102.106.94:4145",
"184.178.172.14:4145",
"2.28.105.45:8888",
"178.92.72.205:1080",
"144.217.107.25:1080",
"192.252.214.17:4145",
"159.89.87.80:10000",
"104.37.135.145:4145",
"192.111.139.165:4145",
"119.63.130.153:1080",
"130.17.13.182:8080",
"182.163.96.66:1080",
"132.243.168.30:9150",
"184.178.172.23:4145",
"46.17.43.219:7890",
"116.236.146.234:4145",
"64.227.186.105:1080",
"192.252.220.89:4145",
"192.111.137.34:18765",
"96.60.107.30:9050",
"193.221.203.14:1080",
"192.252.220.92:17328",
"174.77.111.198:49547",
"23.251.102.121:80",
"57.128.249.250:9052",
"188.242.163.28:21",
"192.252.215.2:4145",
"184.182.240.211:4145",
"72.37.217.3:4145",
"68.1.210.163:4145",
"72.207.33.64:4145",
"68.71.251.134:4145",
"66.59.197.62:4000",
"202.141.161.53:7891",
"198.8.84.3:4145",
"192.111.138.29:4145",
"68.71.245.206:4145",
"172.105.192.212:9080",
"93.115.20.101:1080",
"199.187.210.54:4145",
"192.252.210.233:4145",
"113.108.63.150:7890",
"47.243.222.214:1080",
"157.151.196.142:1080",
"77.50.61.182:1080",
"89.208.232.117:1080",
"31.172.215.67:1080",
"178.178.2.255:1080",
"66.59.197.61:4000",
"77.239.123.7:1080",
"67.207.92.87:1088",
"141.148.65.110:1081",
"192.252.208.67:14287",
"31.59.170.18:1080",
"125.130.120.93:1080",
"47.251.127.154:1080",
"192.210.197.13:1080",
"192.210.197.131:1080",
"27.54.121.90:1080",
"202.62.42.92:1080",
"94.156.114.45:1080",
"213.230.121.41:1080",
"103.187.162.75:8199",
"142.54.228.193:4145",
"37.49.224.167:1080",
"161.97.119.1:8888",
"95.165.108.201:1080",
"195.9.192.50:1080",
"203.189.150.44:1080",
"91.195.86.221:1080",
"223.25.109.146:8199",
"85.122.120.119:30016",
"103.151.74.5:2025",
"109.124.73.231:1080",
"199.168.131.234:1080",
"95.83.152.62:1080",
"85.122.120.46:30000",
"93.123.189.213:1080",
"43.248.173.40:888",
"50.222.120.243:1080",
"5.42.123.150:1080",
"2.26.170.250:1080",
"194.186.5.21:1080",
"168.138.155.212:9050",
"124.41.225.101:1080",
"132.148.244.30:45157",
"193.24.222.150:33500",
"31.130.59.142:1080",
"203.189.150.126:1080",
"185.190.154.121:4145",
"167.250.137.129:1080",
"103.148.201.74:1089",
"95.188.83.253:1080",
"103.168.246.3:4153",
"105.30.248.241:1080",
"123.200.5.146:57775",
"179.189.245.173:5432",
"187.62.194.167:5678",
"187.86.153.254:30660",
"103.41.33.169:51951",
"102.0.35.254:1080",
"200.71.123.77:60606",
"50.192.195.69:39792",
"85.117.32.166:4153",
"116.100.218.208:1080",
"125.209.110.83:1981",
"113.166.93.239:5678",
"160.20.36.126:80",
"181.205.207.66:1080",
"101.255.150.238:1080",
"113.53.91.26:4153",
"171.242.14.54:1080",
"36.88.242.103:1080",
"201.184.177.10:4153",
"5.157.64.213:1080",
"116.90.234.106:1080",
"27.65.242.224:1080",
"189.39.118.210:5678",
"119.63.95.3:4153",
"103.185.250.136:1080",
"179.189.248.129:5432",
"190.104.26.227:33638",
"177.91.255.35:5678",
"160.20.36.109:80",
"103.137.148.253:1080",
"103.146.185.170:1083",
"176.236.29.193:1080",
"103.105.79.18:1080",
"27.65.243.69:1080",
"105.214.53.188:5678",
"160.20.165.242:8080",
"114.130.89.94:1080",
"190.113.249.14:50000",
"159.224.243.185:61303",
"181.189.132.74:5678",
"190.89.104.76:5432",
"200.70.56.84:1080",
"38.191.204.195:33317",
"188.72.16.74:1080",
"123.200.28.149:1080",
"118.70.211.121:60606",
"180.158.166.144:4145",
"181.57.178.146:1080",
"90.178.216.215:4153",
"177.54.239.13:4145",
"222.212.85.149:5678",
"221.157.45.249:80",
"177.85.65.177:4153",
"36.95.82.69:1080",
"160.250.226.94:1081",
"182.53.96.56:4145",
"103.97.94.22:4153",
"119.235.50.78:4153",
"58.18.39.58:10800",
"1.4.195.114:4145",
"81.12.157.98:5678",
"185.32.4.110:4153",
"177.26.112.65:5678",
"27.75.144.255:1080",
"113.53.29.228:13629",
"179.189.242.5:5432",
"129.205.244.158:1080",
"38.191.204.45:33317",
"202.179.83.169:51951",
"190.12.95.170:37209",
"103.41.32.250:51951",
"50.238.47.86:32100",
"49.0.156.20:32000",
"38.191.204.40:33317",
"101.96.105.88:1080",
"36.94.110.49:5678",
"83.220.46.106:4145",
"190.144.224.182:44550",
"69.36.63.128:1080",
"103.175.127.230:60606",
"36.95.189.165:5678",
"85.237.62.189:3629",
"60.217.64.237:35292",
"200.43.43.121:4145",
"193.106.57.96:5678",
"1.179.151.165:31948",
"27.75.146.95:1080",
"136.232.116.2:43314",
"123.200.28.222:1080",
"110.77.135.70:4145",
"177.125.212.244:4145",
"186.216.195.1:4153",
"91.150.189.122:1080",
"171.248.208.105:1080",
"159.192.97.129:5678",
"102.222.145.8:1080",
"5.23.104.251:1080",
"24.37.245.42:51056",
"159.192.139.42:5678",
"105.214.51.182:5678",
"103.31.103.71:1080",
"121.139.218.165:43295",
"193.158.12.141:4153",
"179.189.249.137:5432",
"27.77.239.218:1080",
"171.247.246.7:1080",
"27.77.239.67:1080",
"200.8.235.10:4145",
"103.167.156.92:1080",
"58.65.142.254:8125",
"189.202.204.53:1080",
"181.78.67.162:1080",
"27.75.158.248:1080",
"45.198.10.229:80",
"171.248.212.239:1080",
"105.214.19.138:5678",
"46.171.28.162:59311",
"171.248.208.50:1080",
"109.160.97.49:4145",
"212.46.242.185:1080",
"190.89.104.48:5432",
"185.190.90.2:4145",
"217.17.112.98:1080",
"83.218.186.22:5678",
"89.250.148.154:4145",
"89.186.8.107:1080",
"179.27.86.36:4153",
"116.232.80.133:1080",
"103.19.78.127:1080",
"186.1.182.194:4153",
"103.76.108.99:80",
"91.147.235.162:4153",
"89.151.134.157:3629",
"209.94.84.33:1080",
"93.93.61.153:1080",
"195.78.100.186:3629",
"93.118.135.176:1080",
"171.4.85.65:5678",
"77.65.50.118:34159",
"160.20.37.109:80",
"96.9.77.71:51080",
"31.57.178.174:1080",
"83.56.15.57:5678",
"109.224.12.170:52015",
"91.230.154.221:4145",
"113.108.42.55:1081",
"103.208.101.17:1080",
"185.62.48.126:5678",
"70.60.132.130:5678",
"103.118.127.222:4153",
"109.68.189.22:54643",
"38.75.82.217:999",
"103.178.176.14:8080",
"103.186.97.193:8080",
"47.81.56.193:8888",
"90.156.196.230:3128",
"95.3.69.222:8080",
"51.68.10.90:80",
"103.154.77.19:8085",
"172.236.242.244:3128",
"45.229.16.212:999",
"185.226.194.0:999",
"181.78.44.63:999",
"122.246.112.107:7890",
"34.88.38.81:9443",
"8.138.217.152:21001",
"43.155.62.157:443",
"111.192.44.8:8888",
"203.150.128.73:8080",
"203.175.102.169:3125",
"103.137.158.112:83",
"38.156.238.24:999",
"101.255.209.158:8181",
"103.68.215.115:8181",
"49.151.184.212:8082",
"157.15.211.48:8080",
"180.191.231.112:8082",
"49.147.63.121:8080",
"156.67.110.124:10808",
"138.186.76.57:999",
"202.160.76.169:1080",
"103.191.218.119:69",
"108.61.166.38:1080",
"199.66.183.226:4145",
"184.182.240.12:4145",
"185.210.85.26:56981",
"202.160.76.173:1080",
"174.77.111.197:4145",
"202.160.76.167:1080",
"154.223.77.54:10002",
"192.111.139.162:4145",
"2.28.105.45:8888",
"79.137.198.71:7777",
"124.248.191.83:1080",
"199.102.104.70:4145",
"98.181.137.80:4145",
"174.77.111.196:4145",
"188.215.44.164:1080",
"103.18.78.157:1080",
"199.58.184.97:4145",
"38.18.230.153:8888",
"67.201.35.145:4145",
"103.142.255.32:1080",
"85.94.21.103:1080",
"152.53.183.107:8081",
"103.162.57.42:1080",
"184.181.217.206:4145",
"72.207.109.5:4145",
"116.236.146.234:4145",
"109.202.0.25:1080",
"72.195.114.184:4145",
"216.105.143.146:4145",
"184.178.172.14:4145",
"74.119.144.60:4145",
"142.54.231.38:4145",
"62.152.37.189:1080",
"199.102.106.94:4145",
"107.167.18.122:443",
"192.252.214.17:4145",
"104.37.135.145:4145",
"98.190.239.3:4145",
"192.111.139.165:4145",
"98.175.31.222:4145",
"72.223.188.67:4145",
"184.181.217.194:4145",
"159.89.87.80:10000",
"47.88.94.79:1080",
"184.170.249.65:4145",
"192.163.200.82:17071",
"192.252.208.70:14282",
"89.113.5.120:1080",
"193.221.203.14:1080",
"188.166.120.48:1080",
"192.252.214.20:15864",
"195.19.55.74:1080",
"188.242.163.28:21",
"119.148.20.109:22122",
"185.73.39.118:9999",
"64.227.186.105:1080",
"199.116.112.6:4145",
"85.142.124.27:1080",
"184.178.172.28:15294",
"24.249.199.12:4145",
"46.17.43.219:7890",
"184.178.172.23:4145",
"184.182.240.211:4145",
"192.252.220.89:4145",
"174.77.111.198:49547",
"192.111.137.34:18765",
"192.252.220.92:17328",
"188.134.95.74:1080",
"72.49.49.11:31034",
"23.251.102.121:80",
"72.195.34.59:4145",
"57.128.249.250:9052",
"178.214.201.74:7080",
"98.191.0.47:4145",
"98.170.57.241:4145",
"37.18.73.60:5566",
"192.252.215.2:4145",
"72.37.217.3:4145",
"184.170.245.148:4145",
"68.1.210.163:4145",
"45.61.188.134:44499",
"72.207.33.64:4145",
"68.71.251.134:4145",
"194.87.232.240:1080",
"192.111.130.2:4145",
"216.105.128.144:4145",
"66.59.197.63:4000",
"198.8.84.3:4145",
"31.57.166.38:1080",
"192.111.138.29:4145",
"192.111.137.37:18762",
"68.71.245.206:4145",
"72.195.114.169:4145",
"74.119.147.209:4145",
"135.136.188.213:1081",
"174.75.211.222:4145",
"142.54.237.38:4145",
"72.194.42.156:4145",
"199.187.210.54:4145",
"93.115.20.101:1080",
"218.70.229.168:1081",
"193.37.71.46:10808",
"199.102.107.145:4145",
"192.111.130.5:17002",
"192.252.211.193:4145",
"192.252.210.233:4145",
"94.228.240.23:1080",
"89.208.232.117:1080",
"185.248.138.201:1080",
"91.224.96.93:1080",
"157.90.113.23:9052",
"72.255.38.180:1080",
"92.101.193.58:1080",
"176.114.199.202:1080",
"87.249.237.90:1080",
"62.220.49.233:1080",
"210.172.216.185:1080",
"107.152.98.5:4145",
"111.67.103.162:1080",
"66.59.197.61:4000",
"142.54.235.9:4145",
"68.71.252.38:4145",
"192.111.129.150:4145",
"68.71.243.14:4145",
"68.71.254.6:4145",
"212.55.99.157:1080",
"195.245.238.86:1080",
"178.170.181.118:1080",
"103.76.149.140:1080",
"104.200.152.30:4145",
"199.102.105.242:4145",
"103.58.251.74:1080",
"67.207.92.87:1088",
"179.255.188.138:1080",
"140.238.28.230:10808",
"192.252.208.67:14287",
"5.140.110.96:1080",
"142.54.239.1:4145",
"79.76.59.115:1080",
"109.201.65.165:1080",
"103.239.52.100:1080",
"176.119.23.27:1080",
"143.20.185.219:9150",
"103.187.162.75:8199",
"62.245.48.172:1080",
"72.56.104.252:9058",
"137.59.195.198:1080",
"142.54.228.193:4145",
"46.224.14.155:9050",
"115.127.53.114:1080",
"203.189.150.44:1080",
"91.151.195.138:1080",
"221.176.85.236:1080",
"5.255.103.55:1080",
"83.237.213.34:1080",
"91.195.86.221:1080",
"103.66.46.54:69",
"103.236.190.197:1080",
"185.108.76.197:9050",
"202.74.203.17:1080",
"103.239.201.50:58765",
"192.163.200.93:17071",
"202.62.54.146:1080",
"91.84.98.74:12546",
"85.122.120.119:30016",
"90.151.107.14:1080",
"103.151.74.5:2025",
"185.70.129.183:1080",
"103.36.11.18:8199",
"185.21.141.238:1080",
"95.83.152.62:1080",
"37.27.112.71:9050",
"124.41.225.101:1080",
"43.131.25.228:9000",
"62.148.143.229:1080",
"177.52.25.34:1080",
"173.254.204.118:7890",
"37.49.224.243:1080",
"144.172.116.50:1081",
"69.174.54.190:10000",
"83.221.222.194:1080",
"84.254.198.175:1080",
"188.243.219.81:1080",
"94.103.2.238:1080",
"95.83.154.186:1080",
"69.174.54.9:10000",
"172.247.27.29:11080",
"37.110.55.67:1080",
"188.128.86.74:1080",
"82.142.130.102:1080",
"202.133.90.24:1080",
"91.122.248.146:1080",
"69.174.54.56:14431",
"95.84.168.158:8080",
"103.86.135.114:1080",
"134.35.162.114:1080",
"69.174.54.168:11006",
"69.174.54.21:10000",
"69.174.54.213:10000",
"88.222.220.216:1081",
"69.174.54.231:10000",
"69.174.54.241:10810",
"69.174.54.60:10000",
"69.174.54.93:10000",
"109.73.177.168:7080",
"194.186.5.21:1080",
"85.172.55.85:1080",
"85.172.81.216:1080",
"62.169.152.178:1080",
"132.148.244.30:45157",
"102.0.14.42:1080",
"31.47.103.209:1080",
"195.19.50.120:1080",
"45.157.163.41:1080",
"31.25.139.82:21",
"138.3.218.141:54261",
"103.118.85.146:1080",
"198.46.175.249:1082",
"144.172.105.57:1081",
"144.172.108.179:1081",
"107.175.215.32:1080",
"113.222.40.135:10808",
"2.26.170.220:1080",
"180.92.212.178:5678",
"185.157.111.3:5678",
"77.238.79.111:5678",
"96.9.77.71:51080",
"61.7.147.227:4145",
"196.1.182.158:1080",
"183.88.219.206:34676",
"103.41.33.169:51951",
"177.68.149.141:1080",
"108.175.24.1:13135",
"110.77.149.227:4153",
"117.4.26.246:1080",
"49.0.156.20:32000",
"116.100.218.208:1080",
"177.207.247.189:4153",
"143.105.108.210:1080",
"202.162.197.57:4145",
"93.184.7.217:1080",
"189.39.118.210:5678",
"179.189.249.137:5432",
"222.212.85.149:5678",
"85.117.32.166:4153",
"114.108.177.104:60984",
"181.189.132.74:5678",
"182.93.75.254:1080",
"50.250.205.21:32100",
"1.20.254.32:4153",
"212.39.114.139:5678",
"41.75.84.86:4153",
"103.167.187.4:1080",
"159.255.164.163:1080",
"58.65.142.254:8125",
"176.236.37.132:1080",
"5.157.64.213:1080",
"103.137.148.253:1080",
"181.205.207.66:1080",
"103.139.246.166:5678",
"195.78.100.186:3629",
"123.25.116.228:1080",
"177.85.65.177:4153",
"160.119.159.98:1080",
"103.97.94.22:4153",
"123.231.230.58:31196",
"94.253.95.241:3629",
"46.98.192.116:5678",
"27.75.144.255:1080",
"117.102.101.52:5678",
"193.105.62.11:58973",
"45.249.79.190:3629",
"190.144.224.182:44550",
"103.37.82.134:39873",
"96.36.50.99:39593",
"103.18.47.79:4145",
"218.26.101.226:53813",
"200.122.92.211:5678",
"85.237.62.189:3629",
"64.49.67.164:5678",
"1.179.172.45:31225",
"186.194.127.41:4153",
"143.105.48.163:1080",
"123.200.6.58:5678",
"185.232.170.87:10808",
"170.254.173.6:1080",
"179.189.248.125:5432",
"109.224.12.170:52015",
"109.160.97.49:4145",
"212.46.242.185:1080",
"116.111.44.189:1080",
"90.151.59.8:1080",
"203.190.8.59:1088",
"103.167.156.92:1080",
"170.80.221.192:4153",
"95.188.83.253:1080",
"185.216.18.138:44550",
"171.248.214.0:1080",
"176.236.29.193:1080",
"110.38.234.74:1080",
"103.118.127.222:4153",
"103.238.232.70:8080",
"95.3.69.222:8080",
"45.71.186.214:999",
"38.225.117.1:999",
"36.92.149.235:8080",
"185.225.41.171:8080",
"36.95.223.193:8080",
"103.82.126.243:8080",
"92.223.2.95:8888",
"103.166.159.227:8080",
"156.240.114.210:3129",
"223.85.21.195:8080",
"163.5.53.34:8082",
"187.190.58.152:8081",
"190.97.241.106:999",
"122.246.112.107:7890",
"38.194.246.34:999",
"47.81.56.193:8888",
"90.156.196.230:3128",
"103.210.16.10:8090",
"101.206.186.99:8080",
"36.25.247.27:6256",
"24.106.221.230:53281",
"85.155.228.112:3128",
"52.214.92.206:18695",
"54.249.49.32:8084",
"108.131.152.118:8103",
"51.17.99.135:58496",
"111.196.31.120:8888",
"103.147.134.39:8082",
"120.76.101.238:8080",
"184.72.79.151:26009",
"18.163.182.106:40877",
"8.134.115.60:21056",
"98.81.204.137:53313",
"13.126.183.60:19081",
"47.129.105.10:30953",
"3.231.160.150:5864",
"43.198.78.37:13880",
"114.246.197.252:8888",
"8.138.217.152:21001",
"13.245.183.150:3629",
"103.86.117.23:8080",
"172.236.242.244:3128",
"18.230.23.72:9050",
"122.3.207.67:8089",
"161.248.171.25:8585",
"186.96.111.214:999",
"103.82.246.93:6080",
"109.225.40.145:58080",
"201.190.41.246:999",
"82.138.122.43:80",
"103.153.63.146:8080",
"109.224.242.230:8080",
"103.135.189.2:83",
"38.50.165.122:999",
"102.38.24.30:19000",
"103.66.12.225:8080",
"200.94.38.46:2604",
"103.156.16.235:8818",
"185.65.247.133:48049",
"38.19.111.74:8080",
"182.160.124.174:9669",
"45.174.242.142:999",
"104.251.93.248:16062",
"38.76.9.0:999",
"103.153.211.220:8080",
"91.186.218.52:3128",
"207.177.122.144:8080",
"109.224.242.171:8080",
"122.52.27.1:8080",
"177.234.211.175:999",
"201.4.65.79:8080"
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

async function getEUSurvivalServers() {
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
                if (!mode.includes("survival")) continue;
                servers.push({
                    id: sys.id, name: sys.name || "Unknown",
                    players: sys.players || 0, max: sys.max_players || sys.max || 64,
                    address: srv.address, open: sys.open !== false
                });
            }
        }
        console.log(`📡 Radar: ${servers.length} EU Survival sunucusu bulundu`);
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
    
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    try {
        // Ana sayfa (Backend'de HTML yok, sadece API)
        if (url.pathname === '/') {
            return json(res, 200, { status: 'ok', message: 'Starblast Bot Backend API', bots: sessions.size });
        }

        if (url.pathname === '/api/radar') {
            const servers = await getEUSurvivalServers();
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