
var CACHE = "platform-v30";
var PAGES = ["/", "/art", "/math", "/english", "/manifest.json", "/sw.js", "/P.svg", "/icon.svg"];

self.addEventListener("install", function(e) {
    
    
    e.waitUntil(
        caches.open(CACHE).then(function(c) {
            return Promise.all(PAGES.map(function(p) {
                return c.add(p).catch(function() {});
            }));
        }).then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener("activate", function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() { return self.clients.claim(); })
    );
});

var OFFLINE_PAGE = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The Platform</title><style>body{margin:0;font-family:'Cascadia Code',Consolas,monospace;background:#050a05;color:#c8ffd2;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}.card{border:1px solid #1d3a22;padding:36px 44px;max-width:460px}h1{color:#00ff41;letter-spacing:3px;text-transform:uppercase;text-shadow:0 0 12px rgba(0,255,65,.4)}p{color:#6f9c77}a{color:#00ff41;text-decoration:none;border:1px solid #00ff41;padding:8px 18px;display:inline-block;margin-top:10px}</style></head><body><div class="card"><h1>The Platform</h1><p>You are offline right now. The saved app is still here.</p><a href="/">Open The Platform</a></div></body></html>`;

self.addEventListener("fetch", function(e) {
    var url = e.request.url;
    if (url.indexOf("http:") !== 0 && url.indexOf("https:") !== 0) return;
    if (url.indexOf("/api/") !== -1 || url.indexOf("challenges.cloudflare.com") !== -1) return;
    var isNav = e.request.mode === "navigate";

    
    function fallback() {
        return caches.match("/").then(function(h) {
            return h || new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html" } });
        });
    }

    
    
    
    if (isNav) {
        e.respondWith(
            caches.match(e.request).then(function(cached) {
                var fresh = fetch(e.request).then(function(resp) {
                    var clone = resp.clone();
                    caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
                    return resp;
                }).catch(function() { return null; });
                if (cached) return cached;
                return fresh.then(function(resp) { return resp || fallback(); });
            })
        );
        return;
    }

    
    e.respondWith(
        caches.match(e.request).then(function(r) {
            return r || fetch(e.request).then(function(resp) {
                var clone = resp.clone();
                caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
                return resp;
            }).catch(fallback);
        })
    );
});
