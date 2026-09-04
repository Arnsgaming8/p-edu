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
    /* ---------- CSS completion data ---------- */
  var CSS_PROPS = ['align-content','align-items','align-self','all','animation','animation-delay','animation-direction','animation-duration','animation-fill-mode','animation-iteration-count','animation-name','animation-play-state','animation-timing-function','appearance','aspect-ratio','backdrop-filter','backface-visibility','background','background-attachment','background-blend-mode','background-clip','background-color','background-image','background-origin','background-position','background-repeat','background-size','border','border-bottom','border-bottom-color','border-bottom-left-radius','border-bottom-right-radius','border-bottom-style','border-bottom-width','border-collapse','border-color','border-image','border-left','border-left-color','border-left-style','border-left-width','border-radius','border-right','border-right-color','border-right-style','border-right-width','border-spacing','border-style','border-top','border-top-color','border-top-left-radius','border-top-right-radius','border-top-style','border-top-width','border-width','bottom','box-decoration-break','box-shadow','box-sizing','break-after','break-before','break-inside','caption-side','caret-color','clear','clip','clip-path','color','column-count','column-fill','column-gap','column-rule','column-rule-color','column-rule-style','column-rule-width','column-span','column-width','columns','content','counter-increment','counter-reset','cursor','direction','display','empty-cells','filter','flex','flex-basis','flex-direction','flex-flow','flex-grow','flex-shrink','flex-wrap','float','font','font-family','font-feature-settings','font-kerning','font-size','font-size-adjust','font-stretch','font-style','font-variant','font-variant-caps','font-variant-ligatures','font-variant-numeric','font-variation-settings','font-weight','gap','grid','grid-area','grid-auto-columns','grid-auto-flow','grid-auto-rows','grid-column','grid-column-end','grid-column-gap','grid-column-start','grid-gap','grid-row','grid-row-end','grid-row-gap','grid-row-start','grid-template','grid-template-areas','grid-template-columns','grid-template-rows','height','hyphens','image-rendering','isolation','justify-content','justify-items','justify-self','left','letter-spacing','line-break','line-height','list-style','list-style-image','list-style-position','list-style-type','margin','margin-bottom','margin-left','margin-right','margin-top','mask','mask-image','mask-position','mask-size','max-height','max-width','min-height','min-width','mix-blend-mode','object-fit','object-position','opacity','order','orphans','outline','outline-color','outline-offset','outline-style','outline-width','overflow','overflow-wrap','overflow-x','overflow-y','padding','padding-bottom','padding-left','padding-right','padding-top','page-break-after','page-break-before','page-break-inside','perspective','perspective-origin','place-content','place-items','place-self','pointer-events','position','quotes','resize','right','row-gap','scroll-behavior','scroll-margin','scroll-padding','scroll-snap-align','scroll-snap-type','tab-size','table-layout','text-align','text-align-last','text-decoration','text-decoration-color','text-decoration-line','text-decoration-style','text-indent','text-justify','text-overflow','text-rendering','text-shadow','text-transform','text-underline-offset','top','touch-action','transform','transform-origin','transform-style','transition','transition-delay','transition-duration','transition-property','transition-timing-function','unicode-bidi','user-select','vertical-align','visibility','white-space','widows','width','will-change','word-break','word-spacing','word-wrap','writing-mode','z-index','zoom'];
  var CSS_COLORS = ['aliceblue','antiquewhite','aqua','aquamarine','azure','beige','bisque','black','blanchedalmond','blue','blueviolet','brown','burlywood','cadetblue','chartreuse','chocolate','coral','cornflowerblue','cornsilk','crimson','cyan','darkblue','darkcyan','darkgoldenrod','darkgray','darkgreen','darkgrey','darkkhaki','darkmagenta','darkolivegreen','darkorange','darkorchid','darkred','darksalmon','darkseagreen','darkslateblue','darkslategray','darkslategrey','darkturquoise','darkviolet','deeppink','deepskyblue','dimgray','dimgrey','dodgerblue','firebrick','floralwhite','forestgreen','fuchsia','gainsboro','ghostwhite','gold','goldenrod','gray','grey','green','greenyellow','honeydew','hotpink','indianred','indigo','ivory','khaki','lavender','lavenderblush','lawngreen','lemonchiffon','lightblue','lightcoral','lightcyan','lightgoldenrodyellow','lightgray','lightgreen','lightgrey','lightpink','lightsalmon','lightseagreen','lightskyblue','lightslategray','lightslategrey','lightsteelblue','lightyellow','lime','limegreen','linen','magenta','maroon','mediumaquamarine','mediumblue','mediumorchid','mediumpurple','mediumseagreen','mediumslateblue','mediumspringgreen','mediumturquoise','mediumvioletred','midnightblue','mintcream','mistyrose','moccasin','navajowhite','navy','oldlace','olive','olivedrab','orange','orangered','orchid','palegoldenrod','palegreen','paleturquoise','palevioletred','papayawhip','peachpuff','peru','pink','plum','powderblue','purple','rebeccapurple','red','rosybrown','royalblue','saddlebrown','salmon','sandybrown','seagreen','seashell','sienna','silver','skyblue','slateblue','slategray','slategrey','snow','springgreen','steelblue','tan','teal','thistle','tomato','turquoise','violet','wheat','white','whitesmoke','yellow','yellowgreen','transparent','currentColor'];
  var CSS_VALUE_MAP = {
    display: ['block','inline','inline-block','flex','inline-flex','grid','inline-grid','none','contents','table','table-row','table-cell','list-item','flow-root'],
    position: ['static','relative','absolute','fixed','sticky'],
    visibility: ['visible','hidden','collapse'],
    overflow: ['visible','hidden','scroll','auto','clip'],
    'overflow-x': ['visible','hidden','scroll','auto','clip'],
    'overflow-y': ['visible','hidden','scroll','auto','clip'],
    float: ['left','right','none','inline-start','inline-end'],
    clear: ['left','right','both','none'],
    'text-align': ['left','right','center','justify','start','end'],
    'text-align-last': ['auto','left','right','center','justify','start','end'],
    'text-transform': ['none','capitalize','uppercase','lowercase','full-width'],
    'text-decoration': ['none','underline','overline','line-through'],
    'text-decoration-line': ['none','underline','overline','line-through'],
    'text-overflow': ['clip','ellipsis'],
    'text-justify': ['auto','none','inter-word','inter-character'],
    'list-style-type': ['none','disc','circle','square','decimal','decimal-leading-zero','lower-alpha','upper-alpha','lower-roman','upper-roman'],
    'list-style-position': ['inside','outside'],
    cursor: ['auto','default','pointer','crosshair','text','wait','help','progress','move','not-allowed','grab','grabbing','zoom-in','zoom-out'],
    'font-style': ['normal','italic','oblique'],
    'font-weight': ['normal','bold','bolder','lighter','100','200','300','400','500','600','700','800','900'],
    'font-variant': ['normal','small-caps'],
    'font-family': ['serif','sans-serif','monospace','cursive','fantasy','system-ui','inherit'],
    'white-space': ['normal','nowrap','pre','pre-wrap','pre-line','break-spaces'],
    'word-break': ['normal','break-all','keep-all','break-word'],
    'overflow-wrap': ['normal','break-word','anywhere'],
    'box-sizing': ['content-box','border-box'],
    'background-repeat': ['repeat','repeat-x','repeat-y','no-repeat','space','round'],
    'background-position': ['left','right','top','bottom','center'],
    'background-size': ['auto','cover','contain'],
    'background-attachment': ['scroll','fixed','local'],
    'background-clip': ['border-box','padding-box','content-box','text'],
    'flex-direction': ['row','row-reverse','column','column-reverse'],
    'flex-wrap': ['nowrap','wrap','wrap-reverse'],
    'align-items': ['stretch','flex-start','flex-end','center','baseline'],
    'align-content': ['stretch','flex-start','flex-end','center','space-between','space-around','space-evenly'],
    'justify-content': ['flex-start','flex-end','center','space-between','space-around','space-evenly','start','end'],
    'justify-items': ['stretch','center','start','end','self-start','self-end'],
    'justify-self': ['auto','stretch','center','start','end','self-start','self-end'],
    'object-fit': ['fill','contain','cover','none','scale-down'],
    'object-position': ['center','top','bottom','left','right'],
    'animation-iteration-count': ['infinite'],
    'animation-direction': ['normal','reverse','alternate','alternate-reverse'],
    'animation-fill-mode': ['none','forwards','backwards','both'],
    'animation-play-state': ['running','paused'],
    'transition-timing-function': ['ease','linear','ease-in','ease-out','ease-in-out','step-start','step-end'],
    'transition-property': ['all','opacity','transform','background-color','color','width','height','left','right','top','bottom','filter','box-shadow','none'],
    'transform-origin': ['center','top','bottom','left','right'],
    filter: ['none','blur()','brightness()','contrast()','grayscale()','hue-rotate()','invert()','opacity()','saturate()','sepia()','drop-shadow()'],
    'box-shadow': ['none','inset'],
    'outline-style': ['none','hidden','dotted','dashed','solid','double','groove','ridge','inset','outset'],
    'border-style': ['none','hidden','dotted','dashed','solid','double','groove','ridge','inset','outset'],
    content: ['none','""','open-quote','close-quote'],
    resize: ['none','both','horizontal','vertical','block','inline'],
    direction: ['ltr','rtl'],
    'vertical-align': ['baseline','sub','super','text-top','text-bottom','middle','top','bottom'],
    'pointer-events': ['auto','none'],
    'user-select': ['auto','text','none','all'],
    'scroll-behavior': ['auto','smooth'],
    appearance: ['none','auto'],
    'mix-blend-mode': ['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'],
    isolation: ['auto','isolate'],
    'caption-side': ['top','bottom'],
    'table-layout': ['auto','fixed'],
    'border-collapse': ['collapse','separate'],
    'empty-cells': ['show','hide'],
    'flex-basis': ['auto'],
    'flex-grow': ['0','1'],
    'flex-shrink': ['0','1'],
    order: ['0','1','-1'],
    opacity: ['0','0.5','1'],
    'z-index': ['0','1','-1','auto'],
    'line-height': ['normal','1','1.5','2'],
    'letter-spacing': ['normal'],
    'word-spacing': ['normal'],
    'text-indent': ['0'],
    'tab-size': ['2','4','8'],
    transform: ['none','translate()','translateX()','translateY()','scale()','scaleX()','scaleY()','rotate()','skew()','matrix()'],
    'background-color': CSS_COLORS,
    color: CSS_COLORS,
    'border-color': CSS_COLORS,
    'border-top-color': CSS_COLORS,
    'border-bottom-color': CSS_COLORS,
    'border-left-color': CSS_COLORS,
    'border-right-color': CSS_COLORS,
    'outline-color': CSS_COLORS,
    'caret-color': CSS_COLORS,
    'text-decoration-color': CSS_COLORS,
    'column-gap': ['normal'],
    'row-gap': ['normal'],
    gap: ['normal'],
    'grid-auto-flow': ['row','column','dense','row dense','column dense'],
    'grid-template-columns': ['none','repeat()','minmax()','1fr','auto'],
    'grid-template-rows': ['none','repeat()','minmax()','1fr','auto'],
    'page-break-before': ['auto','always','avoid','left','right'],
    'page-break-after': ['auto','always','avoid','left','right'],
    'page-break-inside': ['auto','avoid'],
    'backdrop-filter': ['none','blur()','brightness()','contrast()','grayscale()','sepia()','saturate()'],
    perspective: ['none','200px','400px','600px','800px','1000px'],
    'transform-style': ['flat','preserve-3d'],
    'backface-visibility': ['visible','hidden'],
    'will-change': ['auto','scroll-position','contents','transform','opacity'],
    'box-decoration-break': ['slice','clone'],
    'image-rendering': ['auto','crisp-edges','pixelated'],
    'writing-mode': ['horizontal-tb','vertical-rl','vertical-lr'],
    hyphens: ['none','manual','auto'],
    'scroll-snap-type': ['none','x','y','block','inline','both','mandatory','proximity'],
    'scroll-snap-align': ['none','start','end','center'],
    'touch-action': ['auto','none','pan-x','pan-y','manipulation','pinch-zoom'],
    'clip-path': ['none','circle()','ellipse()','inset()','polygon()']
  };
  var CSS_GRADIENTS = ['none','url()','linear-gradient()','radial-gradient()','conic-gradient()','repeating-linear-gradient()','repeating-radial-gradient()'];
  var CSS_VALUE_MAP_EXTRA = {
    background: CSS_GRADIENTS.concat(['transparent', 'currentColor']).concat(CSS_COLORS),
    'background-image': CSS_GRADIENTS,
    'background-color': CSS_COLORS,
    border: ['none', '1px solid', '1px dashed', '1px dotted', '2px solid', 'thin solid', 'medium solid', 'thick solid'],
    'border-top': ['none', '1px solid'],
    'border-bottom': ['none', '1px solid'],
    'border-left': ['none', '1px solid'],
    'border-right': ['none', '1px solid'],
    outline: ['none', '1px solid', '2px solid', '1px dashed'],
    'text-shadow': ['none', '1px 1px 2px'],
    'box-shadow': ['none', 'inset', '0 1px 3px', '0 4px 12px'],
    'font-family': ['Arial, sans-serif', 'Georgia, serif', "'Times New Roman', serif", "'Courier New', monospace", "'Cascadia Code', monospace", 'Verdana, sans-serif', 'Impact, sans-serif']
  };
  function cssDepth(text) {
    var d = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === '/' && text[i + 1] === '*') {
        var e = text.indexOf('*/', i + 2);
        if (e === -1) break;
        i = e + 1;
        continue;
      }
      if (c === '"' || c === "'") {
        var q = c, k = i + 1;
        while (k < text.length && text[k] !== q) k++;
        i = k;
        continue;
      }
      if (c === '{') d++;
      else if (c === '}') { if (d > 0) d--; }
    }
    return d;
  }
  for (var __kv in CSS_VALUE_MAP_EXTRA) if (CSS_VALUE_MAP_EXTRA.hasOwnProperty(__kv)) CSS_VALUE_MAP[__kv] = CSS_VALUE_MAP_EXTRA[__kv];
  function cssSuggest(before) {
    if (!before) return null;
    if (cssDepth(before) <= 0) {
      var at = /(@[\w-]*)$/.exec(before);
      if (at) {
        var ats = ['@media', '@keyframes', '@import', '@font-face', '@supports', '@charset', '@page', '@layer'];
        var atl = [];
        for (var ai = 0; ai < ats.length; ai++) if (ciPref(ats[ai], at[1])) atl.push(ats[ai]);
        return atl.length ? { kind: 'css-at', list: atl, prefix: at[1] } : null;
      }
      return null;
    }
    var segStart = Math.max(before.lastIndexOf('{'), before.lastIndexOf(';'));
    var seg = before.slice(segStart + 1);
    var inStr = false, strCh = '', paren = 0, colonIdx = -1;
    for (var i = 0; i < seg.length; i++) {
      var c = seg[i];
      if (inStr) { if (c === strCh) inStr = false; continue; }
      if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
      if (c === '(') { paren++; continue; }
      if (c === ')') { paren = Math.max(0, paren - 1); continue; }
      if (c === ':' && paren === 0) colonIdx = i;
    }
    if (colonIdx === -1) {
      var pw = (/[\w-]*$/.exec(seg) || [''])[0];
      if (!pw) return null;
      var bw = seg.slice(0, seg.length - pw.length);
      if (bw !== '' && !/[\s{;]$/.test(bw)) return null;
      var pl = [];
      for (var pi = 0; pi < CSS_PROPS.length; pi++) if (ciPref(CSS_PROPS[pi], pw)) pl.push(CSS_PROPS[pi]);
      return pl.length ? { kind: 'css-prop', list: pl, prefix: pw } : null;
    }
    var valuePart = seg.slice(colonIdx + 1);
    if (valuePart.replace(/\s+$/, '') === '') return null;
    var vl = (/[\w-]*$/.exec(valuePart) || [''])[0];
    if (!vl) return null;
    var cut = valuePart.slice(0, valuePart.length - vl.length);
    if (cut !== '' && !/[\s;]$/.test(cut) && !/\($/.test(cut)) return null;
    if (vl.charAt(0) === '!') return { kind: 'css-value', list: ['!important'], prefix: vl, prop: '' };
    var propName = (/[\w-]+/.exec(seg) || [''])[0];
    var cands = CSS_VALUE_MAP[propName] || (propName.indexOf('color') >= 0 ? CSS_COLORS : CSS_GENERIC_VALUES);
    var vlist = [];
    for (var vi = 0; vi < cands.length; vi++) if (ciPref(cands[vi], vl)) vlist.push(cands[vi]);
    return vlist.length ? { kind: 'css-value', list: vlist, prefix: vl, prop: propName } : null;
  }

  /* ---------- JavaScript completion data ---------- */
  var JS_KEYWORDS = ['async','await','break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','false','finally','for','function','if','import','in','instanceof','let','new','null','of','return','static','super','switch','this','throw','true','try','typeof','undefined','var','void','while','with','yield'];
  var JS_GLOBALS = ['Array','Boolean','console','Date','decodeURI','decodeURIComponent','document','encodeURI','encodeURIComponent','Error','Event','fetch','File','FormData','Function','history','JSON','localStorage','location','Map','Math','NaN','navigator','Number','Object','parseFloat','parseInt','Promise','RegExp','requestAnimationFrame','sessionStorage','Set','String','Symbol','window'];
  var JS_MEMBERS = {
    document: ['addEventListener','body','characterSet','cookie','createElement','documentElement','forms','getElementById','getElementsByClassName','getElementsByName','getElementsByTagName','head','hidden','images','querySelector','querySelectorAll','readyState','referrer','removeEventListener','scripts','title','URL','visibilityState','write','writeln'],
    window: ['addEventListener','alert','atob','btoa','clearInterval','clearTimeout','close','confirm','console','devicePixelRatio','document','fetch','frames','history','innerHeight','innerWidth','localStorage','location','matchMedia','name','navigator','open','outerHeight','outerWidth','parent','postMessage','print','prompt','requestAnimationFrame','screen','sessionStorage','setInterval','setTimeout','stop'],
    console: ['assert','clear','count','debug','dir','error','group','groupCollapsed','groupEnd','info','log','table','time','timeEnd','trace','warn'],
    localStorage: ['clear','getItem','key','length','removeItem','setItem'],
    sessionStorage: ['clear','getItem','key','length','removeItem','setItem'],
    location: ['assign','hash','host','hostname','href','origin','pathname','port','protocol','reload','replace','search'],
    navigator: ['appName','appVersion','clipboard','connection','cookieEnabled','geolocation','hardwareConcurrency','language','languages','maxTouchPoints','onLine','platform','sendBeacon','serviceWorker','share','userAgent','vibrate'],
    Math: ['E','PI','abs','acos','asin','atan','atan2','ceil','cos','exp','floor','hypot','log','max','min','pow','random','round','sign','sin','sqrt','tan','trunc'],
    JSON: ['parse','stringify'],
    history: ['back','forward','go','length','pushState','replaceState','scrollRestoration','state'],
    Date: ['now','parse','UTC'],
    Object: ['assign','create','defineProperty','entries','freeze','fromEntries','getOwnPropertyDescriptor','getOwnPropertyNames','is','keys','values'],
    Array: ['from','isArray','of'],
    Promise: ['all','allSettled','any','race','resolve','reject'],
    String: ['fromCharCode','fromCodePoint','raw'],
    Number: ['isFinite','isInteger','isNaN','MAX_VALUE','MIN_VALUE','parseFloat','parseInt'],
    Set: ['add','clear','delete','entries','forEach','has','keys','size','values'],
    Map: ['clear','delete','entries','forEach','get','has','keys','set','size','values']
  };
  function ciPref(w, p) { return w.toLowerCase().indexOf(p.toLowerCase()) === 0; }
  function jsDeclared(text) {
    var names = [];
    var m;
    var re1 = /(?:^|[;\s{}()])(?:var|let|const)\s+([A-Za-z_$][\w$]*)/gm;
    while ((m = re1.exec(text))) names.push(m[1]);
    var re2 = /(?:^|[;\s}])(?:function|class)\s+([A-Za-z_$][\w$]*)/gm;
    while ((m = re2.exec(text))) names.push(m[1]);
    return names;
  }
  function jsSuggest(before) {
    if (!before) return null;
    var c1 = before.lastIndexOf('/*'), c2 = before.lastIndexOf('*/');
    if (c1 > c2) return null;
    var lineStart = before.lastIndexOf('\n');
    var line = before.slice(lineStart + 1);
    var slash = line.lastIndexOf('//');
    var dotEmpty = /(?:^|[.\s])([A-Za-z_$][\w$]*)\s*\.\s*$/.exec(line);
    var member = dotEmpty ? [null, dotEmpty[1], ''] : /(?:^|[.\s])([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)$/.exec(line);
    if (member) {
      var base = member[1];
      var members = JS_MEMBERS[base];
      if (members) {
        var prefix2 = member[2];
        var ml = [];
        for (var mi = 0; mi < members.length; mi++) if (ciPref(members[mi], prefix2)) ml.push(members[mi]);
        return ml.length ? { kind: 'js-member', list: ml, prefix: prefix2, base: base } : null;
      }
      return null;
    }
    var word = /([A-Za-z_$][\w$]*)$/.exec(line);
    if (!word) return null;
    if (slash !== -1 && slash < word.index) return null;
    var prefix = word[1];
    var startIdx = word.index;
    if (startIdx > 0) {
      var ch = line[startIdx - 1];
      if (/[0-9A-Za-z_$.]/.test(ch)) return null;
    }
    var cands = jsDeclared(before).concat(JS_GLOBALS).concat(JS_KEYWORDS);
    var seen = {};
    var exact = [], loose = [];
    for (var i = 0; i < cands.length; i++) {
      var n = cands[i];
      if (seen[n] || !ciPref(n, prefix)) continue;
      seen[n] = true;
      if (n.indexOf(prefix) === 0) exact.push(n); else loose.push(n);
    }
    var out = exact.concat(loose);
    return out.length ? { kind: 'js', list: out, prefix: prefix } : null;
  }

function htmlSuggest(ctx) {
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
      var tagList = TAGS.filter(function (t) { return ciPref(t, prefix); });
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
          var tv = INPUT_TYPES.filter(function (t) { return ciPref(t, p2); });
          if (tv.length) return { kind: 'value', list: tv, prefix: p2 };
        }
        return null;
      }
      var curWord = (/[^\s]+$/.exec(attrZone) || [''])[0];
      if (/^[A-Za-z-]+$/.test(curWord) && (attrZone.length === curWord.length || /\s/.test(attrZone.slice(0, attrZone.length - curWord.length)))) {
        var attrSet = (TAG_ATTRS[tagName] || []).concat(GLOBAL_ATTRS).concat(EVENT_ATTRS);
        var uniq = [];
        for (var ai = 0; ai < attrSet.length; ai++) if (uniq.indexOf(attrSet[ai]) === -1) uniq.push(attrSet[ai]);
        var list2 = uniq.filter(function (a) { return ciPref(a, curWord); });
        if (list2.length) return { kind: 'attr', list: list2, prefix: curWord, tag: tagName };
      }
    }
    return null;
  }
  function suggestionsFor(ctx) {
    var lang = (ctx && ctx.lang) || 'html';
    if (lang === 'css') return cssSuggest(ctx.textBeforeCaret || '');
    if (lang === 'js') return jsSuggest(ctx.textBeforeCaret || '');
    return htmlSuggest(ctx);
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
