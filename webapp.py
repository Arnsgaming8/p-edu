from flask import Flask

app = Flask(__name__)

# ---------- DARK MODE CSS ----------
css = """
<style>
body {
    margin: 0;
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #121212;
    color: #f5f5f5;
}
header {
    background: #1f1f1f;
    padding: 15px;
    text-align: center;
    font-size: 24px;
}
nav {
    background: #181818;
    padding: 10px;
    text-align: center;
    position: sticky;
    top: 0;
}
nav a {
    color: #00e5ff;
    text-decoration: none;
    margin: 0 15px;
    font-size: 18px;
    cursor: pointer;
}
nav a:hover {
    color: #00bcd4;
}
.container {
    padding: 20px;
}
textarea {
    width: 100%;
    height: 200px;
    background: #202020;
    color: #00e5ff;
    border: 1px solid #333;
    padding: 10px;
    border-radius: 4px;
    resize: none;
}
button {
    margin-top: 10px;
    padding: 10px 18px;
    background: #00e5ff;
    color: #000;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
button:hover {
    background: #00bcd4;
}
iframe {
    width: 100%;
    height: 300px;
    margin-top: 20px;
    background: #ffffff;
    border: 1px solid #333;
}
section {
    margin-bottom: 40px;
    border-bottom: 1px solid #333;
    padding-bottom: 20px;
}
</style>
"""

# ---------- HOMEPAGE ----------
home_page = f"""
{css}
<header>Welcome to the Platform</header>
<nav>
    <a href="/">Home</a>
    <a href="/editor">HTML Runner</a>
    <a href="/echoza">Echoza</a>
    <a href="/ai">AI Project</a>
</nav>

<div class="container">
    <section>
        <h1>Home</h1>
        <p>This platform contains:</p>
        <ul>
            <li>An HTML runner</li>
            <li>An Echoza development page</li>
            <li>An AI project page</li>
        </ul>
    </section>
</div>
"""

# ---------- HTML RUNNER PAGE ----------
editor_page = f"""
{css}
<header>HTML Runner</header>
<nav>
    <a href="/">Home</a>
    <a href="/editor">HTML Runner</a>
    <a href="/echoza">Echoza</a>
    <a href="/ai">AI Project</a>
</nav>

<div class="container">
    <section>
        <h1>Run Your HTML</h1>
        <textarea id="htmlBox"><h1 style='color:white;'>Hello!</h1></textarea>
        <button onclick="runHTML()">Run HTML ▶</button>
        <iframe id="outputFrame"></iframe>
    </section>
</div>

<script>
function runHTML() {{
    const html = document.getElementById("htmlBox").value;
    const iframe = document.getElementById("outputFrame");
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
}}
runHTML();
</script>
"""

# ---------- ECHOZA PAGE ----------
echoza_page = f"""
{css}
<header>Echoza Development</header>
<nav>
    <a href="/">Home</a>
    <a href="/editor">HTML Runner</a>
    <a href="/echoza">Echoza</a>
    <a href="/ai">AI Project</a>
</nav>

<div class="container">
    <section>
        <h1>Echoza Section</h1>
        <p>This page is for Echoza development and integration.</p>
        <ul>
            <li>Echoza scripts</li>
            <li>Echoza UI</li>
            <li>Echoza features</li>
        </ul>
    </section>
</div>
"""

# ---------- AI PAGE ----------
ai_page = f"""
{css}
<header>AI Project</header>
<nav>
    <a href="/">Home</a>
    <a href="/editor">HTML Runner</a>
    <a href="/echoza">Echoza</a>
    <a href="/ai">AI Project</a>
</nav>

<div class="container">
    <section>
        <h1>AI Project</h1>
        <p>This page is for building and testing your AI system.</p>
        <ul>
            <li>AI UI</li>
            <li>AI logic</li>
            <li>AI features</li>
        </ul>
    </section>
</div>
"""

@app.route("/")
def home():
    return home_page

@app.route("/editor")
def editor():
    return editor_page

@app.route("/echoza")
def echoza():
    return echoza_page

@app.route("/ai")
def ai():
    return ai_page

app.run(debug=True)
