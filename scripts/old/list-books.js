#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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

const booksPath = path.join(__dirname, '..', 'books');
const files = listFiles(booksPath, ['.pdf']);

console.log(`📚 נמצאו ${files.length} קבצי PDF\n`);

// הצג את 10 הראשונים
console.log('10 קבצים ראשונים:');
files.slice(0, 10).forEach((f, i) => {
  const name = path.basename(f);
  console.log(`${i + 1}. ${name}`);
});

// חפש את הקבצים שאינדקסנו
console.log('\n🔍 מחפש קבצים שאינדקסנו:');
const indexed = ['חזון איש זרעים.pdf', 'חזון איש יורה דעה.pdf', 'חזון איש חושן משפט.pdf'];
indexed.forEach(name => {
  const found = files.find(f => f.includes(name));
  if (found) {
    console.log(`✅ ${name}`);
    console.log(`   ${found}`);
  } else {
    console.log(`❌ ${name} - לא נמצא!`);
  }
});
