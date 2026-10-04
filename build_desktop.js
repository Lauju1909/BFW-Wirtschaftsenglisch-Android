const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Building BFW Vokabel-Verwaltung Standalone Desktop App ===');

const baseDir = __dirname;
const wwwDir = path.join(baseDir, 'www');

const htmlPath = path.join(wwwDir, 'index.html');
const cssPath = path.join(wwwDir, 'styles.css');
const xlsxPath = path.join(wwwDir, 'xlsx.full.min.js');
const mammothPath = path.join(wwwDir, 'mammoth.browser.min.js');
const catalogPath = path.join(wwwDir, 'bfw_catalog.js');
const appJsPath = path.join(wwwDir, 'app.js');
const outHtmlPath = path.join(baseDir, 'BFW_VokabelVerwaltung_App.html');

console.log('1. Reading web assets...');
let html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const xlsx = fs.readFileSync(xlsxPath, 'utf8');
const mammoth = fs.readFileSync(mammothPath, 'utf8');
const catalog = fs.readFileSync(catalogPath, 'utf8');
const appJs = fs.readFileSync(appJsPath, 'utf8');

console.log('2. Inlining styles...');
html = html.replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`);

console.log('3. Inlining scripts (xlsx, mammoth, catalog, app.js)...');
html = html.replace('<script src="xlsx.full.min.js"></script>', `<script>\n${xlsx}\n</script>`);
html = html.replace('<script src="mammoth.browser.min.js"></script>', `<script>\n${mammoth}\n</script>`);
html = html.replace('<script src="bfw_catalog.js"></script>', `<script>\n${catalog}\n</script>`);
html = html.replace('<script src="app.js"></script>', `<script>\n${appJs}\n</script>`);

fs.writeFileSync(outHtmlPath, html, 'utf8');
console.log(`✅ BFW_VokabelVerwaltung_App.html generated (${(fs.statSync(outHtmlPath).size / 1024 / 1024).toFixed(2)} MB).`);

console.log('4. Compiling BFW_VokabelVerwaltung.exe via csc.exe...');
const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const outExePath = path.join(baseDir, 'BFW_VokabelVerwaltung.exe');
const cmd = `"${cscPath}" /target:winexe /out:"${outExePath}" /resource:"${outHtmlPath}",BFWVocabManagerApp.embedded_app.html "${path.join(baseDir, 'Program.cs')}"`;

execSync(cmd, { stdio: 'inherit' });
console.log(`✅ BFW_VokabelVerwaltung.exe successfully compiled! Size: ${(fs.statSync(outExePath).size / 1024 / 1024).toFixed(2)} MB.`);
