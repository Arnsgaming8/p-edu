var HTML_DEFAULT = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>HTML Runner</title><style>    body {        margin: 0;        font-family: "Cascadia Code", Consolas, monospace;        background: #ffffff;        color: #1a1a1a;        display: flex;        align-items: center;        justify-content: center;        min-height: 100vh;    }    .card {        max-width: 560px;        border: 1px solid #d0d0d0;        background: #fafafa;        padding: 28px 32px;        text-align: center;        border-radius: 6px;    }    h1 {        color: #0a7d2e;        text-transform: uppercase;        letter-spacing: 3px;        margin-top: 0;    }    p { color: #444; line-height: 1.6; }    code {        color: #0a7d2e;        background: #eef2ee;        padding: 2px 6px;        border: 1px solid #d0d0d0;        border-radius: 3px;    }    button {        margin-top: 16px;        padding: 9px 18px;        background: #0a7d2e;        color: #ffffff;        border: none;        border-radius: 4px;        cursor: pointer;        font-family: "Cascadia Code", Consolas, monospace;        text-transform: uppercase;        letter-spacing: 1px;    }    button:hover { background: #086b26; }</style></head><body>    <div class="card">        <h1>HTML Runner</h1>        <p>Edit the code on the left and press <b>Run</b> to see your changes here.</p>        <p>Start with <code>&lt;h1&gt;Hello&lt;/h1&gt;</code> and build from there.</p>        <button>It Works</button>    </div></body></html>';

var codeBox = document.getElementById('codeBox');
var codeHi = document.getElementById('codeHi');
var acBox = document.getElementById('acBox');
var acHost = codeBox ? codeBox.parentElement : null;

function renderToFrame(code) {
    var frame = document.getElementById('outputFrame');
    var doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(code);
    doc.close();
}

function runCode() {
    renderToFrame(codeBox.value);
}

function refreshHighlight() {
    if (!codeHi || !window.PlatformHL) return;
    var lang = /<\/?[a-z][\s>]|^</.test(codeBox.value) ? 'html' : window.PlatformHL.detectLang(codeBox.value);
    codeHi.innerHTML = window.PlatformHL.highlight(codeBox.value, lang);
}

function syncHiScroll() {
    if (!codeHi) return;
    codeHi.scrollTop = codeBox.scrollTop;
    codeHi.scrollLeft = codeBox.scrollLeft;
}

var _acState = null;
var _acIndex = 0;

function closeAc() {
    if (acBox) acBox.hidden = true;
    _acState = null;
}

function caretMetrics() {
    var v = codeBox.value;
    var sel = codeBox.selectionStart == null ? v.length : codeBox.selectionStart;
    var before = v.slice(0, sel);
    var parts = before.split('\n');
    var line = parts.length - 1;
    var col = 0;
    var last = parts[line];
    for (var i = 0; i < last.length; i++) {
        col += last[i] === '\t' ? 4 - (col % 4) : 1;
    }
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
    if (y + e.lh + 8 + 220 > hostH) {
        acBox.style.top = Math.max(2, y - 218) + 'px';
    } else {
        acBox.style.top = (y + e.lh + 8) + 'px';
    }
}

function renderAc() {
    if (!_acState || !acBox) return;
    var items = _acState.list.slice(0, 12);
    acBox.innerHTML = '';
    var label = document.createElement('div');
    label.className = 'ac-label';
    label.textContent = _acState.kind === 'attr' ? 'attribute' : _acState.kind === 'close-tag' ? 'closing tag' : _acState.kind === 'value' ? 'value' : 'tag';
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

function updateAc() {
    if (!codeBox || !window.PlatformHL) return;
    var sel = codeBox.selectionStart == null ? codeBox.value.length : codeBox.selectionStart;
    var before = codeBox.value.slice(0, sel);
    var s = window.PlatformHL.suggestionsFor({ textBeforeCaret: before });
    if (!s || !s.list || !s.list.length) { closeAc(); return; }
    if (!_acState || _acState.kind !== s.kind || _acState.prefix !== s.prefix) _acIndex = 0;
    _acState = s;
    renderAc();
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
    } else {
        v = v.slice(0, start) + pick + after;
        codeBox.value = v;
        codeBox.setSelectionRange(start + pick.length, start + pick.length);
    }
    closeAc();
    refreshHighlight();
    codeBox.focus();
    var evt = new Event('input', { bubbles: true });
    codeBox.dispatchEvent(evt);
}

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
    refreshHighlight();
    updateAc();
}

codeBox.addEventListener('keydown', editorKey);
codeBox.addEventListener('input', editorInput);
codeBox.addEventListener('scroll', function () { syncHiScroll(); if (acBox && !acBox.hidden) positionAcBox(); });
codeBox.addEventListener('click', function () { updateAc(); });
codeBox.addEventListener('blur', function () { setTimeout(closeAc, 150); });

document.getElementById('runBtn').addEventListener('click', runCode);

renderToFrame(HTML_DEFAULT);
refreshHighlight();
codeBox.focus();
