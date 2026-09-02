/* Self-contained syntax highlighter + HTML autocomplete helper. No deps. */
window.PlatformHL = (function () {
  'use strict';
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return ESC[c]; });
  }
  function unesc(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }
  function span(cls, text) {
    return '<span class="tok-' + cls + '">' + text + '</span>';
  }

  var JS_KEYWORDS = 'abstract|arguments|async|await|boolean|break|byte|case|catch|char|class|const|continue|debugger|default|delete|do|double|else|enum|eval|export|extends|false|final|finally|float|for|function|get|goto|if|implements|import|in|instanceof|int|interface|let|long|native|new|null|of|package|private|protected|public|return|set|short|static|super|switch|synchronized|this|throw|throws|transient|true|try|typeof|undefined|var|void|volatile|while|with|yield';
  var JS_KEY_RE = new RegExp('^(?:' + JS_KEYWORDS + ')$');
  var CSS_UNIT = '(?:px|em|rem|ex|ch|vw|vh|vmin|vmax|cm|mm|in|pt|pc|%|s|ms|deg|rad|grad|turn|fr)';

  /* ---------- generic scanner: runs `step(text, pos)` producing {html, pos} ---------- */
  function scan(text, step) {
    var out = '', pos = 0, n = text.length;
    while (pos < n) {
      var r = step(text, pos);
      if (!r || r.pos <= pos) { out += esc(text[pos]); pos++; continue; }
      out += r.html;
      pos = r.pos;
    }
    return out;
  }

  /* ---------- HTML ---------- */
  function stepHtml(text, pos) {
    if (text[pos] !== '<') return null;
    var rest = text.slice(pos);
    var cm = /^<!--[\s\S]*?(?:-->|$)/.exec(rest);
    if (cm) return { html: span('c', esc(cm[0])), pos: pos + cm[0].length };
    var doct = /^<!DOCTYPE[^>]*>/i.exec(rest);
    if (doct) return { html: span('d', esc(doct[0])), pos: pos + doct[0].length };
    var tag = /^<\/?([A-Za-z][\w-]*)((?:\s+[^<>]*?)?)(\/?)(?:\s*)?>/.exec(rest);
    if (tag) {
      var q = pos + tag[0].length;
      var name = tag[1], attrsRaw = tag[2], selfClose = tag[3];
      var body = '';
      var attrRe = /([\w:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
      var m, last = 0;
      attrsRaw = attrsRaw.replace(/^\s+/, '');
      body += '<span class="tok-tag">&lt;' + (text[pos + 1] === '/' ? '/' : '') + esc(name) + '</span>';
      attrRe.lastIndex = 0;
      while ((m = attrRe.exec(attrsRaw)) !== null) {
        body += esc(attrsRaw.slice(last, m.index));
        var val = m[2];
        if (val === undefined) {
          body += '<span class="tok-attr">' + esc(m[1]) + '</span>';
        } else {
          body += '<span class="tok-attr">' + esc(m[1]) + '</span><span class="tok-punc">=</span>';
          if (/^["']/.test(val)) {
            body += '<span class="tok-punc">' + esc(val[0]) + '</span><span class="tok-str">' + esc(val.slice(1, -1)) + '</span><span class="tok-punc">' + esc(val[val.length - 1]) + '</span>';
          } else {
            body += '<span class="tok-str">' + esc(val) + '</span>';
          }
        }
        last = m.index + m[0].length;
      }
      body += esc(attrsRaw.slice(last));
      body += selfClose ? '<span class="tok-punc">/&gt;</span>' : '<span class="tok-punc">&gt;</span>';
      return { html: body, pos: q };
    }
    return null;
  }

  function hlHtml(text) { return scan(text, stepHtml); }

  /* Full document: highlights <style> bodies as CSS and <script> bodies as JS. */
  function hlDoc(text) {
    var out = '', i = 0, n = text.length;
    while (i < n) {
      var lt = text.indexOf('<', i);
      if (lt < 0) { out += esc(text.slice(i)); break; }
      if (lt > i) out += esc(text.slice(i, lt));
      var rest = text.slice(lt);
      var cm = /^<!--[\s\S]*?(?:-->|$)/.exec(rest);
      if (cm) { out += span('c', esc(cm[0])); i = lt + cm[0].length; continue; }
      var tag = /^<\/?([A-Za-z][\w-]*)/.exec(rest);
      if (tag && (tag[1].toLowerCase() === 'style' || tag[1].toLowerCase() === 'script')) {
        var endOpen = text.indexOf('>', lt);
        if (endOpen < 0) { out += esc(rest); break; }
        var bodyStart = endOpen + 1;
        var low = text.toLowerCase();
        var closeLow = low.indexOf('</' + tag[1].toLowerCase() + '>', bodyStart);
        var bodyEnd = closeLow < 0 ? n : closeLow;
        out += hlHtml(text.slice(lt, bodyStart));
        var innerRaw = text.slice(bodyStart, bodyEnd);
        out += tag[1].toLowerCase() === 'style' ? hlCss(innerRaw) : hlJs(innerRaw);
        if (closeLow < 0) break;
        out += hlHtml(text.slice(bodyEnd, closeLow + tag[1].length + 3));
        i = closeLow + tag[1].length + 3;
        continue;
      }
      var r = stepHtml(text, lt);
      if (r && r.pos > lt) { out += r.html; i = r.pos; continue; }
      out += esc('<');
      i = lt + 1;
    }
    return out;
  }

  /* ---------- CSS ---------- */
  function stepCss(text, pos) {
    var rest = text.slice(pos);
    var cm = /^\/\*[\s\S]*?(?:\*\/|$)/.exec(rest);
    if (cm) return { html: span('c', esc(cm[0])), pos: pos + cm[0].length };
    if (text[pos] === '"' || text[pos] === "'") {
      var q = text[pos], i = pos + 1;
      while (i < text.length && text[i] !== q) i++;
      if (text[i] === q) i++;
      return { html: span('s', esc(text.slice(pos, i))), pos: i };
    }
    var hex = /^#(?:[0-9a-fA-F]{3,8})/.exec(rest);
    if (hex) return { html: span('n', esc(hex[0])), pos: pos + hex[0].length };
    var num = new RegExp('^(?:-?\\d*\\.?\\d+' + CSS_UNIT + '?)').exec(rest);
    if (num) return { html: span('n', esc(num[0])), pos: pos + num[0].length };
    if (text[pos] === '@') {
      var j = pos;
      while (j < text.length && /[A-Za-z0-9_-]/.test(text[j])) j++;
      return { html: span('at', esc(text.slice(pos, j))), pos: j };
    }
    if ((text[pos] === '#' || text[pos] === '.') && text[pos + 1] && /[A-Za-z0-9_-]/.test(text[pos + 1])) {
      var k = pos;
      while (k < text.length && /[A-Za-z0-9_-]/.test(text[k])) k++;
      return { html: span('sel', esc(text.slice(pos, k))), pos: k };
    }
    if (/[A-Za-z_-]/.test(text[pos])) {
      var j2 = pos;
      while (j2 < text.length && /[A-Za-z0-9_-]/.test(text[j2])) j2++;
      return { html: esc(text.slice(pos, j2)), pos: j2 };
    }
    return null;
  }

  function hlCss(text) { return scan(text, stepCss); }

  /* ---------- JS / generic C-like ---------- */
  function stepJs(text, pos) {
    var rest = text.slice(pos);
    var line = /^\/\/[^\n]*/.exec(rest);
    if (line) return { html: span('c', esc(line[0])), pos: pos + line[0].length };
    var block = /^\/\*[\s\S]*?(?:\*\/|$)/.exec(rest);
    if (block) return { html: span('c', esc(block[0])), pos: pos + block[0].length };
    if (text[pos] === '"' || text[pos] === "'") {
      var q = text[pos], i = pos + 1;
      while (i < text.length) {
        if (text[i] === '\\') i += 2;
        else if (text[i] === q) { i++; break; }
        else i++;
      }
      return { html: span('s', esc(text.slice(pos, i))), pos: i };
    }
    if (text[pos] === '`') {
      var t = pos + 1;
      while (t < text.length && text[t] !== '`') t++;
      if (text[t] === '`') t++;
      return { html: span('s', esc(text.slice(pos, t))), pos: t };
    }
    if (/[0-9]/.test(text[pos])) {
      var nm = /^(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(rest);
      if (nm) return { html: span('n', esc(nm[0])), pos: pos + nm[0].length };
    }
    if (/[A-Za-z_$]/.test(text[pos])) {
      var w = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(rest)[0];
      var after = text.slice(pos + w.length);
      if (JS_KEY_RE.test(w)) return { html: span('k', esc(w)), pos: pos + w.length };
      if (/^\s*\(/.test(after)) return { html: span('fn', esc(w)), pos: pos + w.length };
      return { html: span('id', esc(w)), pos: pos + w.length };
    }
    return null;
  }

  function hlJs(text) { return scan(text, stepJs); }

  /* ---------- Python ---------- */
  var PY_KEYWORDS = 'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield';
  var PY_KEY_RE = new RegExp('^(?:' + PY_KEYWORDS + ')$');
  var PY_BUILTINS = '|print|len|range|str|int|float|list|dict|set|tuple|bool|type|isinstance|super|self|open|sum|min|max|abs|sorted|enumerate|zip|map|filter|input|Exception|ValueError|TypeError|KeyError|IndexError|__init__|__str__|__repr__|__name__|__main__|';

  function stepPy(text, pos) {
    var rest = text.slice(pos);
    if (/^#/.test(rest)) {
      var eol = rest.indexOf('\n');
      var line = eol < 0 ? rest : rest.slice(0, eol);
      return { html: span('c', esc(line)), pos: pos + line.length };
    }
    if (/^"""/.test(rest)) {
      var end = rest.indexOf('"""', 3);
      var tri = end < 0 ? rest : rest.slice(0, end + 3);
      return { html: span('s', esc(tri)), pos: pos + tri.length };
    }
    if (/^'''/.test(rest)) {
      var end2 = rest.indexOf("'''", 3);
      var tri2 = end2 < 0 ? rest : rest.slice(0, end2 + 3);
      return { html: span('s', esc(tri2)), pos: pos + tri2.length };
    }
    if (text[pos] === '"' || text[pos] === "'") {
      var q = text[pos], i = pos + 1;
      while (i < text.length) {
        if (text[i] === '\\') i += 2;
        else if (text[i] === q) { i++; break; }
        else i++;
      }
      return { html: span('s', esc(text.slice(pos, i))), pos: i };
    }
    if (text[pos] === '@') {
      var at = /^@[A-Za-z_][\w.]*/.exec(rest);
      if (at) return { html: span('d', esc(at[0])), pos: pos + at[0].length };
    }
    if (/[A-Za-z_]/.test(text[pos])) {
      var w = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest)[0];
      if (PY_KEY_RE.test(w)) return { html: span('k', esc(w)), pos: pos + w.length };
      var after = text.slice(pos + w.length);
      if (/^\s*\(/.test(after)) return { html: span('fn', esc(w)), pos: pos + w.length };
      if (PY_BUILTINS.indexOf('|' + w + '|') !== -1) return { html: span('fn', esc(w)), pos: pos + w.length };
      return { html: span('id', esc(w)), pos: pos + w.length };
    }
    if (/[0-9]/.test(text[pos])) {
      var nm = /^\d+(?:\.\d+)?/.exec(rest);
      if (nm) return { html: span('n', esc(nm[0])), pos: pos + nm[0].length };
    }
    return null;
  }

  function hlPy(text) { return scan(text, stepPy); }

  /* ---------- auto-detect language ---------- */
  function detectLang(code) {
    var t = (code || '').replace(/^\s+/, '');
    if (/^</.test(t) || /<\/?[a-z][\s>]/i.test(t)) return 'html';
    if (/^def\s+\w+/.test(t) || /^import\s+\w+/.test(t) || /^from\s+\w+\s+import/.test(t)) return 'py';
    if (/[{};]/.test(t) && /[:;]/.test(t) && !/\b(?:function|return|const|let|var)\b/.test(t)) return 'css';
    return 'js';
  }

  function hlByLang(code, lang) {
    var l = String(lang || '').toLowerCase();
    if (l.indexOf('html') !== -1 || l.indexOf('xml') !== -1 || l.indexOf('svg') !== -1 || l.indexOf('htm') !== -1) return hlDoc(code);
    if (l.indexOf('css') !== -1 || l.indexOf('scss') !== -1 || l.indexOf('less') !== -1 || l.indexOf('style') !== -1) return hlCss(code);
    if (l.indexOf('python') !== -1 || l === 'py') return hlPy(code);
    if (l.indexOf('json') !== -1) return hlJs(code);
    return hlJs(code);
  }

  function highlight(code, lang) {
    if (!code) return '';
    return hlByLang(code, String(lang || '').toLowerCase() || detectLang(code));
  }

  /* ---------- HTML tag/attribute dictionaries ---------- */
  var TAGS = [
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr'
  ];
  var GLOBAL_ATTRS = [
    'accesskey', 'autocapitalize', 'class', 'contenteditable', 'dir', 'draggable', 'enterkeyhint', 'hidden', 'id', 'inert', 'inputmode', 'lang', 'part', 'popover', 'slot', 'spellcheck', 'style', 'tabindex', 'title', 'translate'
  ];
  var TAG_ATTRS = {
    a: ['href', 'target', 'rel', 'download', 'hreflang', 'type', 'referrerpolicy'],
    img: ['src', 'alt', 'width', 'height', 'srcset', 'sizes', 'loading', 'decoding', 'referrerpolicy'],
    input: ['type', 'name', 'value', 'placeholder', 'required', 'disabled', 'readonly', 'checked', 'min', 'max', 'step', 'minlength', 'maxlength', 'pattern', 'autocomplete', 'autofocus', 'accept', 'multiple', 'size', 'list'],
    form: ['action', 'method', 'enctype', 'name', 'target', 'autocomplete', 'novalidate', 'rel'],
    button: ['type', 'name', 'value', 'disabled', 'autofocus', 'form', 'formaction', 'formmethod', 'formtarget'],
    textarea: ['name', 'rows', 'cols', 'placeholder', 'required', 'disabled', 'readonly', 'maxlength', 'minlength', 'wrap', 'autocomplete', 'autofocus'],
    select: ['name', 'multiple', 'disabled', 'required', 'size', 'autofocus', 'form'],
    option: ['value', 'label', 'disabled', 'selected'],
    label: ['for', 'form'],
    video: ['src', 'controls', 'autoplay', 'loop', 'muted', 'poster', 'preload', 'width', 'height', 'playsinline'],
    audio: ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload'],
    source: ['src', 'srcset', 'type', 'media', 'sizes'],
    link: ['rel', 'href', 'type', 'media', 'sizes', 'crossorigin', 'integrity', 'as', 'hreflang'],
    script: ['src', 'type', 'async', 'defer', 'crossorigin', 'integrity', 'nomodule', 'referrerpolicy'],
    style: ['type', 'media', 'nonce'],
    meta: ['name', 'content', 'charset', 'http-equiv', 'property'],
    iframe: ['src', 'srcdoc', 'width', 'height', 'name', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy', 'sandbox', 'title'],
    td: ['colspan', 'rowspan', 'headers', 'scope', 'abbr', 'align', 'valign'],
    th: ['colspan', 'rowspan', 'headers', 'scope', 'abbr', 'align', 'valign'],
    table: ['border', 'cellpadding', 'cellspacing', 'width', 'align', 'summary'],
    ol: ['type', 'start', 'reversed'],
    ul: ['type'],
    li: ['value', 'type'],
    progress: ['value', 'max'],
    meter: ['value', 'min', 'max', 'low', 'high', 'optimum'],
    output: ['for', 'form', 'name'],
    details: ['open'],
    dialog: ['open'],
    area: ['shape', 'coords', 'href', 'alt', 'target', 'rel'],
    map: ['name'],
    object: ['data', 'type', 'width', 'height', 'name', 'form'],
    embed: ['src', 'type', 'width', 'height'],
    blockquote: ['cite'],
    q: ['cite'],
    del: ['cite', 'datetime'],
    ins: ['cite', 'datetime'],
    time: ['datetime'],
    col: ['span', 'width'],
    colgroup: ['span'],
    track: ['src', 'kind', 'srclang', 'label', 'default'],
    svg: ['viewBox', 'width', 'height', 'xmlns', 'fill', 'stroke', 'stroke-width', 'class', 'id', 'preserveAspectRatio'],
    canvas: ['width', 'height'],
    base: ['href', 'target'],
    body: ['onload', 'class', 'id'],
    html: ['lang', 'manifest'],
    head: [],
    template: []
  };
  var EVENT_ATTRS = ['onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onmouseout', 'onmousemove', 'onkeydown', 'onkeyup', 'onkeypress', 'onchange', 'oninput', 'onsubmit', 'onfocus', 'onblur', 'onload', 'onerror', 'onscroll', 'onresize', 'ondrag', 'ondrop', 'ontouchstart', 'ontouchend', 'onpointerdown', 'onpointerup', 'onpointermove', 'onwheel', 'oncontextmenu', 'onanimationend', 'ontransitionend'];

  var INPUT_TYPES = ['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'hidden', 'image', 'month', 'number', 'password', 'radio', 'range', 'reset', 'search', 'submit', 'tel', 'text', 'time', 'url', 'week'];

  /* Returns completion suggestions for the current textarea state. */
  function suggestionsFor(ctx) {
    var before = ctx.textBeforeCaret || '';
    var open = before.lastIndexOf('<');
    var close = before.lastIndexOf('>');
    if (open <= close) return null;
    var inner = before.slice(open + 1);
    var isClosing = inner.charAt(0) === '/';
    if (isClosing) inner = inner.slice(1);
    if (inner === '') {
      // right after '<' or '</': offer every tag (or every closing tag)
      return { kind: isClosing ? 'close-tag' : 'tag', list: TAGS.slice(0), prefix: '' };
    }
    if (/^[A-Za-z][\w-]*$/.test(inner)) {
      var prefix = inner;
      var tagList = TAGS.filter(function (t) { return t.indexOf(prefix) === 0; });
      if (!tagList.length) return null;
      return { kind: isClosing ? 'close-tag' : 'tag', list: tagList, prefix: prefix };
    }
    // Inside a tag body: only suggest attributes when typing a fresh word after whitespace.
    var tagMatch = /^\/?([A-Za-z][\w-]*)([\s\S]*)$/.exec(inner);
    if (tagMatch) {
      var tagName = tagMatch[1].toLowerCase();
      var attrZone = tagMatch[2];
      // caret is after an = or inside quotes -> no attribute suggestions
      var eq = attrZone.lastIndexOf('=');
      var lastQuote = Math.max(attrZone.lastIndexOf('"'), attrZone.lastIndexOf("'"));
      if (eq > lastQuote && (eq === attrZone.length - 1 || /\s/.test(attrZone.slice(eq + 1)) === false)) return null;
      var afterEqWord = /=\s*(\w*)$/.exec(attrZone);
      if (afterEqWord && afterEqWord[1]) {
        if (tagName === 'input' && /type\s*=\s*["']?$/.test(attrZone.slice(0, attrZone.length - afterEqWord[1].length))) {
          var p2 = afterEqWord[1];
          var tv = INPUT_TYPES.filter(function (t) { return t.indexOf(p2) === 0; });
          if (tv.length) return { kind: 'value', list: tv, prefix: p2 };
        }
        return null;
      }
      var curWord = (/[^\s]+$/.exec(attrZone) || [''])[0];
      if (/^[A-Za-z-]+$/.test(curWord) && (attrZone.length === curWord.length || /\s/.test(attrZone.slice(0, attrZone.length - curWord.length)))) {
        var attrSet = (TAG_ATTRS[tagName] || []).concat(GLOBAL_ATTRS).concat(EVENT_ATTRS);
        var uniq = [];
        for (var ai = 0; ai < attrSet.length; ai++) if (uniq.indexOf(attrSet[ai]) === -1) uniq.push(attrSet[ai]);
        var list2 = uniq.filter(function (a) { return a.indexOf(curWord) === 0; });
        if (list2.length) return { kind: 'attr', list: list2, prefix: curWord, tag: tagName };
      }
    }
    return null;
  }

  return {
    esc: esc, unesc: unesc,
    hlHtml: hlHtml, hlCss: hlCss, hlJs: hlJs, hlPy: hlPy, hlDoc: hlDoc,
    detectLang: detectLang, highlight: highlight, hlByLang: hlByLang,
    TAGS: TAGS, GLOBAL_ATTRS: GLOBAL_ATTRS, TAG_ATTRS: TAG_ATTRS,
    EVENT_ATTRS: EVENT_ATTRS, INPUT_TYPES: INPUT_TYPES,
    suggestionsFor: suggestionsFor
  };
})();
