<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Platform</title>

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

</head>
<body>

<header>Welcome to the Platform</header>

<nav>
    <a onclick="scrollToSection('home')">Home</a>
    <a onclick="scrollToSection('editor')">HTML Runner</a>
    <a onclick="scrollToSection('echoza')">Echoza</a>
    <a onclick="scrollToSection('ai')">AI Project</a>
</nav>

<div class="container">

    <!-- HOME -->
    <section id="home">
        <h1>Home</h1>
        <p>This platform contains:</p>
        <ul>
            <li>An HTML runner</li>
            <li>An Echoza development page</li>
            <li>An AI project page</li>
        </ul>
    </section>

    <!-- HTML RUNNER -->
    <section id="editor">
        <h1>HTML Runner</h1>
        <textarea id="htmlBox"><h1 style='color:white;'>Hello!</h1></textarea>
        <button onclick="runHTML()">Run HTML ▶</button>
        <iframe id="outputFrame"></iframe>
    </section>

    <!-- ECHOZA -->
    <section id="echoza">
        <h1>Echoza Section</h1>
        <p>This page is for Echoza development and integration.</p>
        <ul>
            <li>Echoza scripts</li>
            <li>Echoza UI</li>
            <li>Echoza features</li>
        </ul>
    </section>

    <!-- AI -->
    <section id="ai">
        <h1>AI Project</h1>
        <p>This page is for building and testing your AI system.</p>
        <ul>
            <li>AI UI</li>
            <li>AI logic</li>
            <li>AI features</li>
        </ul>
    </section>

</div>

<script>
function runHTML() {
    const html = document.getElementById("htmlBox").value;
    const iframe = document.getElementById("outputFrame");
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
}
runHTML();

function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: "smooth" });
}
</script>

</body>
</html>
