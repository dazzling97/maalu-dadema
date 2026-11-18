// Builds play.html: the whole game in one file that opens by double-click (no server, no install).
// Usage: npm run build:play   (runs the embed build first)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'dist-embed', 'malu-dadayama.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Malu Dadayama (මාළු දඩයම) — The Great Fish Heist</title>
<meta name="description" content="Malu Dadayama (මාළු දඩයම): a Sri Lankan fishing game for desktop, phone and tablet.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@700&family=Nunito:wght@400;700&display=swap">
<style>
  html, body { margin: 0; height: 100%; background: #14201a; overflow: hidden; }
  #game { width: 100vw; height: 100vh; }
  canvas { image-rendering: pixelated; outline: none; }
</style>
</head>
<body>
<div id="game"></div>
<script>${js}</script>
<script>window.__game = MaluDadayama.mount({ parent: 'game' });</script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'play.html'), html);
console.log('play.html written', (html.length / 1024 / 1024).toFixed(2) + ' MB');
