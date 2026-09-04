var HTML_DEFAULT = '';
/* ---- file tabs / multi-buffer editor + live console ---- */
var FILES = [
    { lang: 'html', name: 'index.html', ph: 'Type HTML here...' },
    { lang: 'css', name: 'style.css', ph: 'Type CSS here... it is injected into the preview on Run.' },
    { lang: 'js', name: 'script.js', ph: 'Type JavaScript here... it runs in the preview on Run.' }
];
var KEY = 'platform_runner_files_v1';
var active = 'html';
var buffers = { html: HTML_DEFAULT, css: '', js: '' };

var codeBox = document.getElementById('codeBox');
var codeHi = document.getElementById('codeHi');
var codeGutter = document.getElementById('codeGutter');
var _gutterLines = -1;
var acBox = document.getElementById('acBox');
var acHost = codeBox ? codeBox.parentElement : null;
var conBody = document.getElementById('consoleBody');
var conDot = document.getElementById('consoleDot');
var conCount = document.getElementById('consoleCount');
var _logCount = 0;
var _logErr = 0;

/* ---- persistence ---- */
function loadBufs() {
    // Code never persists: every page load starts fresh and wipes any saved buffers.
    try { localStorage.removeItem(KEY); } catch (e) {}
    buffers.html = HTML_DEFAULT;
    buffers.css = '';
    buffers.js = '';
}
function saveBufs() {
    try { localStorage.removeItem(KEY); } catch (e) {}
}
var _saveT = null;
function scheduleSave() { clearTimeout(_saveT); _saveT = setTimeout(saveBufs, 400); }

/* ---- console ---- */
function emptyConsole() {
    if (!conBody) return;
    var had = conBody.querySelector('.c-line');
    conBody.innerHTML = '<div class="c-empty">Errors and console messages from your code show up here when you press Run.</div>';
    _logCount = 0; _logErr = 0;
    if (conDot) conDot.classList.remove('has-error');
    if (conCount) conCount.textContent = '';
    return had;
}
function pushConsole(kind, text) {
    if (!conBody) return;
    if (conBody.querySelector('.c-empty')) conBody.innerHTML = '';
    var line = document.createElement('div');
    line.className = 'c-line c-' + (kind === 'log' || kind === 'debug' ? 'log' : kind);
    line.textContent = String(text);
    conBody.appendChild(line);
    while (conBody.children.length > 300) conBody.removeChild(conBody.firstChild);
    _logCount++;
    if (kind === 'error' || kind === 'warn') { _logErr++; if (conDot) conDot.classList.add('has-error'); }
    if (conCount) conCount.textContent = _logCount + ' message' + (_logCount === 1 ? '' : 's');
    conBody.scrollTop = conBody.scrollHeight;
}
window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (d && d.__pf && (d.type === 'log' || d.type === 'info' || d.type === 'debug' || d.type === 'warn' || d.type === 'error')) {
        pushConsole(d.type, d.data);
    }
});

/* capture script injected into the preview before user code */
var CAPTURE_SRC = '(function(){if(window.__pfCap){return;}window.__pfCap=true;function send(t,d){try{parent.postMessage({__pf:true,type:t,data:d},"*");}catch(e){}}function fmt(v){if(v instanceof Error){var st=(v&&v.stack)?String(v.stack):"";var m=(v&&v.message)?String(v.message):"";return st?st.split("\\n").slice(0,4).join(" "):m;}if(typeof v==="string")return v;try{var s=JSON.stringify(v);if(s===undefined)s=String(v);if(s&&s.length>500)s=s.slice(0,500)+"…";return s;}catch(e){try{return String(v);}catch(x){return "[object]";}}}var c=window.console||{};var lv=["log","info","debug","warn","error"];for(var i=0;i<lv.length;i++){(function(l){var orig=c[l];window.console[l]=function(){var args=Array.prototype.slice.call(arguments);var parts=[];for(var j=0;j<args.length;j++)parts.push(fmt(args[j]));send(l==="debug"?"log":l,parts.join(" "));if(orig&&typeof orig==="function"){try{orig.apply(c,arguments);}catch(e){}}}})(lv[i]);}window.addEventListener("error",function(e){var msg=(e&&e.message)||"Unknown error";if(e&&e.lineno!=null){msg+=" (line "+e.lineno+(e.colno!=null?":"+e.colno:"")+")";}send("error",msg);},false);window.addEventListener("unhandledrejection",function(e){var r=e&&e.reason;send("error","Unhandled rejection: "+(r?fmt(r):""));});document.addEventListener("error",function(e){var t=e.target;if(t&&t!==window){var what=(t.tagName)?t.tagName.toLowerCase():"resource";var src=t.src||t.href||"";if(src)send("warn","Failed to load "+what+": "+src);}},true);})();';

function renderToFrame(docHtml) {
    var old = document.getElementById('outputFrame');
    if (!old) return;
    var frame = document.createElement('iframe');
    frame.id = 'outputFrame';
    old.parentNode.replaceChild(frame, old);
    var doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(docHtml);
    doc.close();
}
function buildDoc() {
    var h = buffers.html;
    var css = (buffers.css || '').trim();
    var js = (buffers.js || '').trim();
    var cap = '<script>' + CAPTURE_SRC + '<\/script>';
    var into = '';
    if (css) into += '<style>\n' + css + '\n</style>';
    into += cap;
    if (/<\/head>/i.test(h)) {
        h = h.replace(/<\/head>/i, into + '</head>');
    } else {
        // No head element: find the earliest spot before user content (after any
        // doctype / <html> open tag) so capture runs before any user script below.
        var m = /^(\s*)((?:<!DOCTYPE[^>]*>)?)((?:<html[^>]*>)?)([\s\S]*)$/i.exec(h);
        h = m[1] + m[2] + m[3] + into + m[4];
    }
    var tail = '';
    if (js) tail += '<script>\n' + js + '\n<\/script>';
    if (/<\/body>/i.test(h)) h = h.replace(/<\/body>/i, tail + '</body>');
    else h = h + tail;
    return h;
}
function runCode() {
    saveBufs();
    emptyConsole();
    renderToFrame(buildDoc());
}

/* ---- highlight + autocomplete ---- */
function fileLang() { return active === 'html' ? 'html' : (active === 'css' ? 'css' : 'js'); }
function refreshHighlight() {
    if (!codeHi || !window.PlatformHL) return;
    codeHi.innerHTML = window.PlatformHL.highlight(codeBox.value || '', fileLang());
}
function refreshGutter() {
    if (!codeGutter) return;
    var n = codeBox.value.split('\n').length;
    if (n === _gutterLines) return;
    _gutterLines = n;
    var parts = [];
    for (var i = 1; i <= n; i++) parts.push(String(i));
    codeGutter.textContent = parts.join('\n');
}
function syncHiScroll() {
    if (!codeHi) return;
    codeHi.scrollTop = codeBox.scrollTop;
    codeHi.scrollLeft = codeBox.scrollLeft;
    if (codeGutter) codeGutter.scrollTop = codeBox.scrollTop;
}
function updateAc() {
    if (!codeBox || !window.PlatformHL) { closeAc(); return; }
    var sel = codeBox.selectionStart == null ? codeBox.value.length : codeBox.selectionStart;
    var before = codeBox.value.slice(0, sel);
    var s = window.PlatformHL.suggestionsFor({ lang: active, textBeforeCaret: before });
    if (!s || !s.list || !s.list.length) { closeAc(); return; }
    if (!_acState || _acState.kind !== s.kind || _acState.prefix !== s.prefix) _acIndex = 0;
    _acState = s;
    renderAc();
}

/* ---- tab switching ---- */
function switchFile(lang) {
    if (!lang || lang === active) return;
    buffers[active] = codeBox.value;
    active = lang;
    codeBox.value = buffers[lang];
    var meta = FILES.filter(function (f) { return f.lang === lang; })[0];
    codeBox.placeholder = meta ? meta.ph : '';
    var tabs = document.querySelectorAll('.file-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', tabs[i].getAttribute('data-file') === lang);
    }
    closeAc();
    codeBox.scrollTop = 0;
    codeBox.scrollLeft = 0;
    syncHiScroll();
    refreshHighlight();
    refreshGutter();
    codeBox.focus();
}
(function wireTabs() {
    var tabs = document.querySelectorAll('.file-tab');
    for (var i = 0; i < tabs.length; i++) {
        (function (b) {
            b.addEventListener('click', function () { switchFile(b.getAttribute('data-file')); });
        })(tabs[i]);
    }
})();

/* ---- ac machinery (unchanged behavior, html tab only) ---- */
var _acState = null;
var _acIndex = 0;
function closeAc() { if (acBox) acBox.hidden = true; _acState = null; }
function caretMetrics() {
    var v = codeBox.value;
    var sel = codeBox.selectionStart == null ? v.length : codeBox.selectionStart;
    var before = v.slice(0, sel);
    var parts = before.split('\n');
    var line = parts.length - 1;
    var col = 0;
    var last = parts[line];
    for (var i = 0; i < last.length; i++) col += last[i] === '\t' ? 4 - (col % 4) : 1;
    return { line: line, col: col };
}
function editorMetrics() {
    var cs = window.getComputedStyle(codeBox);
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize + ';font-weight:' + cs.fontWeight + ';letter-spacing:' + cs.letterSpacing + ';';
    probe.textContent = 'MMMMMMMMMM';
    document.body.appendChild(probe);
    var cw = probe.getBoundingClientRect().width / 10;
    document.body.removeChild(probe);
    var lh = parseFloat(cs.lineHeight);
    if (!lh || isNaN(lh)) lh = parseFloat(cs.fontSize) * 1.5;
    return { cw: cw, lh: lh, padL: parseFloat(cs.paddingLeft) || 0, padT: parseFloat(cs.paddingTop) || 0 };
}
function positionAcBox() {
    if (!acBox || acBox.hidden || !acHost) return;
    var m = caretMetrics();
    var e = editorMetrics();
    var hostW = acHost.clientWidth;
    var hostH = acHost.clientHeight;
    var x = e.padL + m.col * e.cw - codeBox.scrollLeft;
    var y = e.padT + m.line * e.lh - codeBox.scrollTop;
    var w = Math.min(260, hostW - 12);
    acBox.style.width = w + 'px';
    acBox.style.left = Math.max(2, x) + 'px';
    if (y + e.lh + 8 + 220 > hostH) acBox.style.top = Math.max(2, y - 218) + 'px';
    else acBox.style.top = (y + e.lh + 8) + 'px';
}
function renderAc() {
    if (!_acState || !acBox) return;
    var items = _acState.list.slice(0, 12);
    acBox.innerHTML = '';
    var label = document.createElement('div');
    label.className = 'ac-label';
    var LABELS = { 'tag': 'tag', 'close-tag': 'closing tag', 'attr': 'attribute', 'value': 'value', 'css-at': 'at-rule', 'css-prop': 'css property', 'css-value': 'css value', 'js': 'javascript', 'js-member': 'member' };
    label.textContent = LABELS[_acState.kind] || 'suggestion';
    acBox.appendChild(label);
    for (var i = 0; i < items.length; i++) {
        var row = document.createElement('div');
        row.className = 'ac-item' + (i === _acIndex ? ' active' : '');
        row.textContent = items[i];
        (function (idx) {
            row.addEventListener('mousedown', function (ev) { ev.preventDefault(); applySuggestion(idx); });
        })(i);
        acBox.appendChild(row);
    }
    if (!items.length) { closeAc(); return; }
    acBox.hidden = false;
    positionAcBox();
}
function applySuggestion(idx) {
    if (!_acState || !acBox || acBox.hidden) return;
    var items = _acState.list.slice(0, 12);
    var pick = items[idx == null ? _acIndex : idx];
    if (!pick) return;
    var sel = codeBox.selectionStart == null ? codeBox.value.length : codeBox.selectionStart;
    var start = Math.max(0, sel - _acState.prefix.length);
    var v = codeBox.value;
    var after = v.slice(sel);
    if (_acState.kind === 'tag' || _acState.kind === 'close-tag') {
        v = v.slice(0, start) + pick + '>' + after;
        codeBox.value = v;
        codeBox.setSelectionRange(start + pick.length + 1, start + pick.length + 1);
    } else if (_acState.kind === 'attr') {
        v = v.slice(0, start) + pick + '=""' + after;
        codeBox.value = v;
        codeBox.setSelectionRange(start + pick.length + 1, start + pick.length + 1);
    } else if (_acState.kind === 'css-prop') {
        v = v.slice(0, start) + pick + ': ' + after;
        codeBox.value = v;
        codeBox.setSelectionRange(start + pick.length + 2, start + pick.length + 2);
    } else {
        v = v.slice(0, start) + pick + after;
        codeBox.value = v;
        codeBox.setSelectionRange(start + pick.length, start + pick.length);
    }
    closeAc();
    refreshHighlight();
    codeBox.focus();
    scheduleSave();
    var evt = new Event('input', { bubbles: true });
    codeBox.dispatchEvent(evt);
}

/* ---- keyboard + input ---- */
function editorKey(e) {
    var open = acBox && !acBox.hidden;
    if (open) {
        if (e.key === 'ArrowDown') { e.preventDefault(); _acIndex = Math.min(_acIndex + 1, 11); renderAc(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); _acIndex = Math.max(_acIndex - 1, 0); renderAc(); return; }
        if (e.key === 'Enter') { e.preventDefault(); applySuggestion(); return; }
        if (e.key === 'Tab') { e.preventDefault(); applySuggestion(); return; }
        if (e.key === 'Escape') { e.preventDefault(); closeAc(); return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(); return; }
    if (e.key === 'Tab') {
        e.preventDefault();
        var a = codeBox.selectionStart == null ? 0 : codeBox.selectionStart;
        var b = codeBox.selectionEnd == null ? 0 : codeBox.selectionEnd;
        var cur = codeBox.value;
        codeBox.value = cur.slice(0, a) + '  ' + cur.slice(b);
        codeBox.setSelectionRange(a + 2, a + 2);
        refreshHighlight();
        return;
    }
    if (e.key === 'Escape') { closeAc(); return; }
}
function editorInput() {
    buffers[active] = codeBox.value;
    refreshHighlight();
    refreshGutter();
    scheduleSave();
    updateAc();
}

loadBufs();
codeBox.value = buffers.html;
codeBox.placeholder = FILES[0].ph;
refreshGutter();
codeBox.addEventListener('keydown', editorKey);
codeBox.addEventListener('input', editorInput);
codeBox.addEventListener('scroll', function () { syncHiScroll(); if (acBox && !acBox.hidden) positionAcBox(); });
codeBox.addEventListener('click', function () { updateAc(); });
codeBox.addEventListener('blur', function () {
    setTimeout(function () { if (document.activeElement !== codeBox) closeAc(); }, 150);
});
document.getElementById('runBtn').addEventListener('click', runCode);
var clearBtn = document.getElementById('consoleClear');
if (clearBtn) clearBtn.addEventListener('click', function () { emptyConsole(); });

runCode();
codeBox.focus();
