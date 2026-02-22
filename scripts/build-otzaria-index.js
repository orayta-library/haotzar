#!/usr/bin/env node
/**
 * סקריפט לבניית אינדקס Meilisearch מספרי אוצריא
 * קורא מ-seforim.db ויוצר מסמכים מתאימים לאינדקס
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

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

// Delta encoding
function deltaEncode(arr) {
  if (!arr || arr.length === 0) return [];
  const out = [arr[0]];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] - arr[i - 1]);
  return out;
}

// פתיחת DB של postings
function openPostingsDB(dbPath) {
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
      
      // Merge
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

/**
 * בניית chunks ו-postings מתוכן ספר אוצריא
 */
function buildChunksAndPostings(bookId, bookTitle, lines, chunkSize = 2000) {
  const chunks = [];
  const postings = {};
  
  // המר bookId לפורמט בטוח
  const fileId = `otzaria-${bookId}`;
  const safeFileId = Buffer.from(fileId, 'utf8').toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  
  // בנה טקסט מלא מכל השורות
  let fullText = '';
  const lineOffsets = []; // מיפוי של offset למספר שורה
  
  lines.forEach(line => {
    const startOffset = fullText.length;
    const lineText = line.content + '\n';
    fullText += lineText;
    
    lineOffsets.push({
      lineIndex: line.lineIndex,
      startOffset: startOffset,
      endOffset: fullText.length,
      heRef: line.heRef
    });
  });
  
  // חלק ל-chunks
  for (let start = 0, chunkId = 0; start < fullText.length; start += chunkSize, chunkId++) {
    const chunkText = fullText.slice(start, Math.min(fullText.length, start + chunkSize));
    const excerpt = chunkText.slice(0, 200); // רק 200 תווים ראשונים
    
    // מצא את השורה של ה-chunk הזה
    let lineNum = 1;
    let heRef = '';
    for (const lineOffset of lineOffsets) {
      if (start >= lineOffset.startOffset && start < lineOffset.endOffset) {
        lineNum = lineOffset.lineIndex + 1; // lineIndex מתחיל מ-0
        heRef = lineOffset.heRef || '';
        break;
      }
    }
    
    chunks.push({
      id: `${safeFileId}_${chunkId}`,
      fileId: fileId,
      safeFileId: safeFileId,
      chunkId,
      chunkStart: start,
      pageNum: lineNum, // משתמשים במספר שורה כ-"עמוד"
      heRef: heRef,
      text: excerpt
    });
    
    // Tokenize
    const tokens = tokenizeWithOffsets(chunkText);
    for (const t of tokens) {
      if (!postings[t.token]) postings[t.token] = [];
      postings[t.token].push(start + t.index);
    }
  }
  
  return { chunks, postings };
}

/**
 * Main
 */
async function main() {
  const argv = require('minimist')(process.argv.slice(2));
  
  const otzariaDbPath = argv.db || path.join(__dirname, '..', 'books', 'אוצריא', 'seforim.db');
  const outDir = argv.outDir || path.join(__dirname, '..', 'index-otzaria');
  const chunkSize = parseInt(argv.chunkSize, 10) || 2000;
  const maxBooks = parseInt(argv.maxBooks, 10) || 0;
  const flushEvery = parseInt(argv.flushEvery, 10) || 10;
  
  console.log('🚀 Otzaria Index Builder\n');
  console.log(`📂 Otzaria DB: ${otzariaDbPath}`);
  console.log(`💾 Output: ${outDir}`);
  console.log(`📏 Chunk size: ${chunkSize}`);
  if (maxBooks) console.log(`⚠️  Max books: ${maxBooks}`);
  console.log('');
  
  // בדוק שהקובץ קיים
  if (!fs.existsSync(otzariaDbPath)) {
    console.error(`❌ קובץ seforim.db לא נמצא ב: ${otzariaDbPath}`);
    console.error('💡 הורד את הקובץ מ: https://github.com/Otzaria/otzaria-library/releases');
    process.exit(1);
  }
  
  // פתח את מסד הנתונים של אוצריא
  console.log('📖 פותח מסד נתונים של אוצריא...');
  const otzariaDb = new Database(otzariaDbPath, { readonly: true });
  
  // קבל סטטיסטיקות
  const stats = otzariaDb.prepare('SELECT COUNT(*) as count FROM book').get();
  console.log(`📚 סה"כ ספרים במסד הנתונים: ${stats.count}`);
  
  // סנן קטגוריות חיצוניות
  const externalCategories = `
    SELECT id FROM category 
    WHERE title LIKE '%hebrewbooks%'
       OR title LIKE '%hebrew books%'
       OR title LIKE '%היברו-בוקס%'
       OR title LIKE '%היברו בוקס%'
       OR title LIKE '%היברובוקס%'
       OR title LIKE '%אוצר החכמה%'
       OR title LIKE '%אוצר חכמה%'
  `;
  
  const externalCategoryIds = otzariaDb.prepare(externalCategories).all().map(c => c.id);
  console.log(`🚫 קטגוריות חיצוניות לסינון: ${externalCategoryIds.length}`);
  
  // קבל רשימת ספרים (ללא קטגוריות חיצוניות)
  let booksQuery = `
    SELECT b.id, b.title, b.volume, b.totalLines, c.title as categoryTitle
    FROM book b
    JOIN category c ON b.categoryId = c.id
    WHERE b.categoryId NOT IN (${externalCategoryIds.map(() => '?').join(',')})
    ORDER BY b.title
  `;
  
  if (maxBooks > 0) {
    booksQuery += ` LIMIT ${maxBooks}`;
  }
  
  const books = externalCategoryIds.length > 0 
    ? otzariaDb.prepare(booksQuery).all(...externalCategoryIds)
    : otzariaDb.prepare('SELECT b.id, b.title, b.volume, b.totalLines, c.title as categoryTitle FROM book b JOIN category c ON b.categoryId = c.id ORDER BY b.title' + (maxBooks > 0 ? ` LIMIT ${maxBooks}` : '')).all();
  
  console.log(`📋 ספרים לאינדוקס: ${books.length}\n`);
  
  // צור תיקיית פלט
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const postingsDbPath = path.join(outDir, 'posmap.sqlite');
  const postingsDb = openPostingsDB(postingsDbPath);
  
  const allChunks = [];
  let postingsMap = {};
  let processedBooks = 0;
  const startTime = Date.now();
  
  // עבור על כל ספר
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const bookTitle = book.title + (book.volume ? ` - ${book.volume}` : '');
    
    console.log(`[${i + 1}/${books.length}] ${bookTitle} (${book.totalLines} שורות)`);
    
    try {
      // קבל את כל השורות של הספר
      const lines = otzariaDb.prepare(
        'SELECT lineIndex, content, heRef FROM line WHERE bookId = ? ORDER BY lineIndex'
      ).all(book.id);
      
      if (lines.length === 0) {
        console.log('  ⚠️  אין שורות בספר');
        continue;
      }
      
      // בנה chunks ו-postings
      const { chunks, postings } = buildChunksAndPostings(
        book.id,
        bookTitle,
        lines,
        chunkSize
      );
      
      allChunks.push(...chunks);
      
      // Merge postings
      const fileId = `otzaria-${book.id}`;
      for (const word of Object.keys(postings)) {
        if (!postingsMap[word]) postingsMap[word] = {};
        postingsMap[word][fileId] = postings[word];
      }
      
      processedBooks++;
      console.log(`  ✓ ${chunks.length} chunks, ${Object.keys(postings).length} unique words`);
      
      // Flush כל X ספרים
      if (processedBooks % flushEvery === 0) {
        console.log(`\n💾 Flushing ${Object.keys(postingsMap).length} words to DB...`);
        flushPostings(postingsDb, postingsMap);
        postingsMap = {};
        
        if (global.gc) {
          global.gc();
          console.log('🗑️  GC triggered');
        }
        
        console.log(`✅ Progress: ${processedBooks}/${books.length}\n`);
      }
      
    } catch (error) {
      console.error(`  ❌ שגיאה: ${error.message}`);
    }
  }
  
  // Final flush
  if (Object.keys(postingsMap).length > 0) {
    console.log(`\n💾 Final flush: ${Object.keys(postingsMap).length} words`);
    flushPostings(postingsDb, postingsMap);
  }
  
  postingsDb.close();
  otzariaDb.close();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Index built in ${duration}s`);
  console.log(`📊 Stats:`);
  console.log(`   Books: ${processedBooks}`);
  console.log(`   Chunks: ${allChunks.length}`);
  console.log(`   DB: ${postingsDbPath}`);
  
  // שמור את ה-chunks ל-JSON
  const meiliDocsPath = path.join(outDir, 'meili-docs.json');
  fs.writeFileSync(meiliDocsPath, JSON.stringify(allChunks));
  const sizeMB = (fs.statSync(meiliDocsPath).size / (1024 * 1024)).toFixed(2);
  console.log(`   Meili docs: ${meiliDocsPath} (${sizeMB} MB)`);
  
  console.log('\n🎉 Done!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
