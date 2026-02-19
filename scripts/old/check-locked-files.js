#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// הקבצים שאינדקסנו
const testFiles = [
  'books/האויצר ספריה/הלכה/חזון איש/חזון איש זרעים.pdf',
  'books/האויצר ספריה/הלכה/חזון איש/חזון איש יורה דעה.pdf',
  'books/האויצר ספריה/הלכה/חזון איש/חזון איש חושן משפט.pdf'
];

console.log('🔍 בודק אם קבצים נעולים...\n');

testFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  const fileName = path.basename(file);
  
  try {
    // נסה לפתוח את הקובץ במצב read
    const fd = fs.openSync(fullPath, 'r');
    fs.closeSync(fd);
    console.log(`✅ ${fileName} - לא נעול`);
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      console.log(`❌ ${fileName} - נעול!`);
    } else {
      console.log(`⚠️  ${fileName} - ${err.message}`);
    }
  }
});

console.log('\n✅ בדיקה הושלמה');
