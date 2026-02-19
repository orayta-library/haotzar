#!/usr/bin/env node
// סקריפט להפעלת ממשק בניית האינדקס
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3456;
const HTML_FILE = path.join(__dirname, 'index-builder-ui.html');

// יצירת שרת HTTP פשוט
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    // הגש את הממשק
    fs.readFile(HTML_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('שגיאה בטעינת הממשק');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  } else if (req.url === '/api/build-index' && req.method === 'POST') {
    // הרץ את סקריפט בניית האינדקס
    console.log('🚀 מתחיל בניית אינדקס...');
    
    const buildScript = path.join(__dirname, 'build-index.js');
    const child = exec(`node "${buildScript}"`, { maxBuffer: 10 * 1024 * 1024 });
    
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data;
      console.log(data.toString());
    });
    
    child.stderr.on('data', (data) => {
      output += data;
      console.error(data.toString());
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          output: output,
          message: 'אינדקס נבנה בהצלחה'
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: false,
          output: output,
          message: 'שגיאה בבניית אינדקס'
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('לא נמצא');
  }
});

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🔨 בונה אינדקס חיפוש - האויצר      ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ השרת רץ על: http://localhost:${PORT}`);
  console.log('');
  console.log('📖 פתח את הדפדפן בכתובת הזו כדי להתחיל');
  console.log('');
  console.log('⏹️  לעצירה: Ctrl+C');
  console.log('');
  
  // פתח את הדפדפן אוטומטית
  const url = `http://localhost:${PORT}`;
  const start = process.platform === 'darwin' ? 'open' :
                process.platform === 'win32' ? 'start' : 'xdg-open';
  
  exec(`${start} ${url}`, (err) => {
    if (err) {
      console.log('💡 פתח ידנית את:', url);
    }
  });
});

// טיפול בסגירה נקייה
process.on('SIGINT', () => {
  console.log('\n\n👋 סוגר את השרת...');
  server.close(() => {
    console.log('✅ השרת נסגר');
    process.exit(0);
  });
});
