#!/usr/bin/env node
// סקריפט אופטימלי לבניית אינדקס - חסכוני בזיכרון
const fs = require('fs');
const path = require('path');

// הסרת ניקוד עברי
function removeNikud(text) {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

// Tokenize עם offsets
function tokenizeWithOffsets(text) {
  const tokens = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const cleaned = removeNikud(raw).toLowerCase();
    if (cleaned.length >= 2) {
      tokens.push({ token: cleaned, index: m.index, length: raw.length });
    }
  }
  return tokens;
}

// חילוץ טקסט מ-PDF עם שחרור זיכרון מיידי
async function extractTextFromPDF(filePath) {
  let dataBuffer = null;
  let pdfjsLib = null;
  let pdfDoc = null;
  
  try {
    dataBuffer = fs.readFileSync(filePath);
    
    // נסה pdf-parse קודם (יותר חסכוני)
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      if (data && data.text) {
        const text = data.text;
        dataBuffer = null; // שחרר מיד
        return { text, pages: null };
      }
    } catch (e) {
      // fallback to pdfjs-dist
    }
    
    // Fallback: pdfjs-dist
    try {
      pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    } catch (e) {
      pdfjsLib = require('pdfjs-dist');
    }
    
    const uint8Array = new Uint8Array(dataBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array, disableWorker: true });
    pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    
    const pages = [];
    let fullText = '';
    
    for (let p = 1; p <= numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      const strings = content.items.map(i => (i.str || '')).join(' ');
      const pageText = strings + '\n';
      
      pages.push({
        pageNum: p,
        text: pageText,
        startOffset: fullText.length,
        endOffset: fullText.length + pageText.length
      });
      
      fullText += pageText;
      
      // נקה מיד
      page.cleanup();
    }
    
    // נקה הכל
    await pdfDoc.cleanup();
    await pdfDoc.destroy();
    
    dataBuffer = null;
    pdfjsLib = null;
    pdfDoc = null;
    
    return { text: fullText, pages };
  } catch (err) {
    console.log(`  ✗ PDF error: ${err.message}`);
    // שחרר הכל במקרה של שגיאה
    dataBuffer = null;
    if (pdfDoc) {
      try {
        await pdfDoc.cleanup();
        await pdfDoc.destroy();
      } catch (e) {}
    }
    pdfjsLib = null;
    return { text: '', pages: null };
  }
}

// בניית chunks ו-postings
function buildChunksAndPostings(fileId, fullText, pages, chunkSize = 2000) {
  const chunks = [];
  const postings = {};
  
  const safeFileId = Buffer.from(fileId, 'utf8').toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  
  for (let start = 0, chunkId = 0; start < fullText.length; start += chunkSize, chunkId++) {
    const chunkText = fullText.slice(start, Math.min(fullText.length, start + chunkSize));
    const excerpt = chunkText.slice(0, 200);
    
    let pageNum = 1;
    if (pages && pages.length > 0) {
      for (const page of pages) {
        if (start >= page.startOffset && start < page.endOffset) {
          pageNum = page.pageNum;
          break;
        }
      }
    }
    
    chunks.push({
      id: `${safeFileId}_${chunkId}`,
      fileId: fileId,
      safeFileId: safeFileId,
      chunkId,
      chunkStart: start,
      pageNum: pageNum,
      text: excerpt
    });
    
    const tokens = tokenizeWithOffsets(chunkText);
    for (const t of tokens) {
      if (!postings[t.token]) postings[t.token] = [];
      postings[t.token].push(start + t.index);
    }
  }
  
  return { chunks, postings };
}

// Delta encoding
function deltaEncode(arr) {
  if (!arr || arr.length === 0) return [];
  const out = [arr[0]];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] - arr[i - 1]);
  return out;
}

// SQLite DB
function openDB(dbPath) {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      word TEXT PRIMARY KEY,
      postings BLOB
    );
    CREATE INDEX IF NOT EXISTS idx_posts_word ON posts(word);
  `);
  return db;
}

// Flush postings to DB
function flushPostings(db, postingsMap) {
  const zlib = require('zlib');
  const selectStmt = db.prepare('SELECT postings FROM posts WHERE word = ?');
  const insertStmt = db.prepare('INSERT OR REPLACE INTO posts (word, postings) VALUES (?, ?)');
  
  const tx = db.transaction((entries) => {
    for (const word of Object.keys(entries)) {
      const incoming = entries[word];
      const row = selectStmt.get(word);
      let merged = {};
      
      if (row && row.postings) {
        const json = zlib.gunzipSync(row.postings).toString('utf8');
        merged = JSON.parse(json);
      }
      
      for (const fileId of Object.keys(incoming)) {
        if (!merged[fileId]) merged[fileId] = incoming[fileId].slice();
        else merged[fileId] = merged[fileId].concat(incoming[fileId]);
        merged[fileId].sort((a, b) => a - b);
        merged[fileId] = deltaEncode(merged[fileId]);
      }
      
      const gz = zlib.gzipSync(Buffer.from(JSON.stringify(merged), 'utf8'));
      insertStmt.run(word, gz);
    }
  });
  
  tx(postingsMap);
}

// שמירת chunks לקובץ (append mode)
function appendChunksToFile(chunks, filePath) {
  // שמור כל chunk בשורה נפרדת (JSONL format)
  const lines = chunks.map(c => JSON.stringify(c)).join('\n') + '\n';
  fs.appendFileSync(filePath, lines);
}

// טעינת chunks מקובץ JSONL
function loadChunksFromFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  return lines.map(line => JSON.parse(line));
}

// העלאה ל-Meilisearch
async function uploadToMeili(chunksFilePath, host = 'http://127.0.0.1:7700', indexName = 'books') {
  const { MeiliSearch } = require('meilisearch');
  let pLimit;
  try {
    pLimit = require('p-limit');
    if (typeof pLimit !== 'function' && pLimit.default) {
      pLimit = pLimit.default;
    }
  } catch (e) {
    pLimit = (n) => (fn) => fn();
  }
  
  console.log(`\n📤 Loading chunks from ${chunksFilePath}...`);
  const allChunks = loadChunksFromFile(chunksFilePath);
  console.log(`📦 Loaded ${allChunks.length} chunks`);
  
  const client = new MeiliSearch({ host });
  const index = client.index(indexName);
  const limit = pLimit(3);
  
  const batchSize = 500;
  const batches = [];
  for (let i = 0; i < allChunks.length; i += batchSize) {
    batches.push(allChunks.slice(i, i + batchSize));
  }
  
  console.log(`\n📤 Uploading ${allChunks.length} docs in ${batches.length} batches...`);
  
  let uploaded = 0;
  await Promise.all(batches.map((batch, idx) => limit(async () => {
    const docs = batch.map(c => ({
      id: c.id,
      fileId: c.fileId,
      safeFileId: c.safeFileId,
      chunkId: c.chunkId,
      chunkStart: c.chunkStart,
      pageNum: c.pageNum || 1,
      text: c.text
    }));
    
    await index.addDocuments(docs);
    uploaded += docs.length;
    console.log(`  ✓ Batch ${idx + 1}/${batches.length} (${uploaded}/${allChunks.length})`);
  })));
  
  console.log('✓ Upload complete!');
}

// רשימת קבצים רקורסיבית
function listFiles(dir, extensions = ['.txt', '.pdf']) {
  let results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        results = results.concat(listFiles(full, extensions));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (extensions.includes(ext)) results.push(full);
      }
    }
  } catch (err) {
    console.warn(`⚠ Cannot access ${dir}: ${err.message}`);
  }
  return results;
}

// Main
async function main() {
  const argv = require('minimist')(process.argv.slice(2));
  
  const booksPath = argv.booksPath || path.join(__dirname, '..', 'books');
  const outDir = argv.outDir || path.join(__dirname, '..', 'index');
  const chunkSize = parseInt(argv.chunkSize, 10) || 2000;
  const skipPdf = !!argv.skipPdf;
  const uploadMeili = !!argv.meili;
  const meiliHost = argv.meiliHost || 'http://127.0.0.1:7700';
  const meiliIndex = argv.meiliIndex || 'books';
  const flushEvery = parseInt(argv.flushEvery, 10) || 2; // 🎯 ברירת מחדל: 2
  const maxFiles = parseInt(argv.maxFiles, 10) || 0;
  const reset = !!argv.reset;
  
  console.log('🚀 Memory-Optimized Index Builder\n');
  console.log(`📂 Books: ${booksPath}`);
  console.log(`💾 Output: ${outDir}`);
  console.log(`📏 Chunk size: ${chunkSize}`);
  console.log(`📄 Skip PDF: ${skipPdf ? 'YES' : 'NO'}`);
  console.log(`🔄 Upload to Meili: ${uploadMeili ? 'YES' : 'NO'}`);
  console.log(`💾 Auto-save: Every ${flushEvery} files`);
  if (maxFiles) console.log(`⚠️  Max files: ${maxFiles}`);
  console.log('');
  console.log('💡 TIP: Press Ctrl+C to pause. Run again to resume from checkpoint.');
  console.log('');
  
  const extensions = skipPdf ? ['.txt'] : ['.txt', '.pdf'];
  let files = listFiles(booksPath, extensions);
  
  if (maxFiles && files.length > maxFiles) {
    console.log(`⚠️  Limiting to first ${maxFiles} files for testing\n`);
    files = files.slice(0, maxFiles);
  }
  
  console.log(`📋 Found ${files.length} files\n`);
  
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const dbPath = path.join(outDir, 'posmap.sqlite');
  const db = openDB(dbPath);
  
  let postingsMap = {};
  let processedFiles = 0;
  const startTime = Date.now();
  
  const checkpointPath = path.join(outDir, 'checkpoint.json');
  const chunksFilePath = path.join(outDir, 'meili-docs.jsonl'); // 🎯 JSONL format

  if (reset) {
    console.log('🧨 RESET requested - deleting checkpoint/temp files');
    try {
      if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
      if (fs.existsSync(chunksFilePath)) fs.unlinkSync(chunksFilePath);
    } catch (e) {
      console.warn(`⚠️  Could not delete files: ${e.message}`);
    }
  }
  
  let checkpoint = { lastProcessedIndex: -1, processedFiles: [], completed: false };
  if (fs.existsSync(checkpointPath)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
      
      if (checkpoint && checkpoint.completed) {
        const remaining = files.filter((fp) => !checkpoint.processedFiles.includes(path.basename(fp))).length;
        if (remaining === 0) {
          console.log(`\n✅ Checkpoint indicates indexing already completed.`);
          console.log(`💡 If you really want to rebuild from scratch, run with --reset`);
          return;
        }
        console.log(`\n🆕 New files detected: ${remaining}`);
        checkpoint.completed = false;
      }
      
      console.log(`\n📍 ===== RESUMING FROM CHECKPOINT =====`);
      console.log(`   Already processed: ${checkpoint.processedFiles.length} files`);
      console.log(`   Remaining: ${files.length - checkpoint.processedFiles.length} files`);
      console.log(`=====================================\n`);
    } catch (err) {
      console.warn(`⚠️  Could not load checkpoint: ${err.message}`);
      checkpoint = { lastProcessedIndex: -1, processedFiles: [], completed: false };
    }
  }
  
  function saveCheckpoint(fileIndex, fileName) {
    checkpoint.lastProcessedIndex = fileIndex;
    checkpoint.processedFiles.push(fileName);
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }
  
  let isExiting = false;
  process.on('SIGINT', () => {
    if (isExiting) {
      console.log('\n⚠️  Force exit!');
      process.exit(1);
    }
    
    isExiting = true;
    console.log('\n\n⏸️  ===== PAUSING =====');
    console.log('💾 Saving progress...');
    
    if (Object.keys(postingsMap).length > 0) {
      console.log(`💾 Flushing ${Object.keys(postingsMap).length} words to DB...`);
      flushPostings(db, postingsMap);
    }
    
    db.close();
    
    console.log(`\n✅ Progress saved!`);
    console.log(`📊 Processed: ${processedFiles}/${files.length} files`);
    console.log(`\n💡 To resume: node --expose-gc scripts/build-index-memory-optimized.js --meili`);
    console.log(`====================\n`);
    
    process.exit(0);
  });

  // Process files
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileName = path.basename(filePath);
    const fileId = fileName.replace(/\.(txt|pdf)$/i, '');
    
    if (checkpoint.processedFiles.includes(fileName)) {
      console.log(`[${i + 1}/${files.length}] ${fileName} - ⏭️  Already processed`);
      continue;
    }
    
    console.log(`[${i + 1}/${files.length}] ${fileName} (${Math.round((i + 1) / files.length * 100)}%)`);
    
    let content = '';
    let pages = null;
    try {
      if (fileName.toLowerCase().endsWith('.txt')) {
        content = fs.readFileSync(filePath, 'utf8');
      } else if (fileName.toLowerCase().endsWith('.pdf')) {
        const result = await extractTextFromPDF(filePath);
        content = result.text;
        pages = result.pages;
      }
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      saveCheckpoint(i, fileName);
      continue;
    }
    
    if (!content || content.length < 10) {
      console.log('  ✗ Empty or too short');
      saveCheckpoint(i, fileName);
      continue;
    }
    
    const { chunks, postings } = buildChunksAndPostings(fileId, content, pages, chunkSize);
    
    // 🎯 שמור chunks ישירות לקובץ במקום לזיכרון
    appendChunksToFile(chunks, chunksFilePath);
    
    for (const word of Object.keys(postings)) {
      if (!postingsMap[word]) postingsMap[word] = {};
      postingsMap[word][fileId] = postings[word];
    }
    
    processedFiles++;
    console.log(`  ✓ ${chunks.length} chunks, ${Object.keys(postings).length} unique words`);
    
    saveCheckpoint(i, fileName);
    
    // שחרר זיכרון
    content = null;
    pages = null;
    
    // 🎯 Flush תכוף יותר
    if (processedFiles % flushEvery === 0) {
      console.log(`\n💾 Flushing ${Object.keys(postingsMap).length} words to DB...`);
      flushPostings(db, postingsMap);
      postingsMap = {}; // נקה
      
      if (global.gc) {
        global.gc();
        console.log('🗑️  GC triggered');
      }
      
      console.log(`✅ Progress saved! (${processedFiles}/${files.length} files)`);
      console.log('');
    }
    
    // GC קל אחרי כל קובץ
    if (i % 3 === 0 && global.gc) {
      global.gc();
    }
  }
  
  // Final flush
  if (Object.keys(postingsMap).length > 0) {
    console.log(`\n💾 Final flush: ${Object.keys(postingsMap).length} words`);
    flushPostings(db, postingsMap);
  }
  
  db.close();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Index built in ${duration}s`);
  console.log(`📊 Stats:`);
  console.log(`   Files: ${processedFiles}`);
  console.log(`   DB: ${dbPath}`);
  console.log(`   Chunks: ${chunksFilePath}`);
  
  checkpoint.completed = true;
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  
  // Upload to Meilisearch
  if (uploadMeili) {
    console.log('');
    await uploadToMeili(chunksFilePath, meiliHost, meiliIndex);
  }
  
  console.log('\n🎉 Done!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
