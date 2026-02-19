// סקריפט בדיקה למסד נתונים של אוצריא
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'books', 'אוצריא', 'seforim.db');

console.log('🔍 בודק נתיב:', dbPath);

const fs = require('fs');
if (!fs.existsSync(dbPath)) {
  console.error('❌ הקובץ לא קיים!');
  console.log('💡 וודא שהקובץ נמצא ב:', dbPath);
  process.exit(1);
}

console.log('✅ הקובץ קיים');

try {
  console.log('📖 פותח מסד נתונים...');
  const db = new Database(dbPath, { readonly: true });
  
  console.log('✅ מסד הנתונים נפתח בהצלחה!');
  
  // בדיקת טבלאות
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('\n📊 טבלאות במסד הנתונים:', tables.length);
  
  // בדיקת קטגוריות
  const categories = db.prepare('SELECT * FROM category WHERE parentId IS NULL ORDER BY orderIndex, title').all();
  console.log('\n📚 קטגוריות ראשיות:', categories.length);
  categories.forEach(cat => {
    console.log(`  - ${cat.title} (id: ${cat.id})`);
  });
  
  // בדיקת ספרים בקטגוריה הראשונה
  if (categories.length > 0) {
    const firstCat = categories[0];
    const books = db.prepare('SELECT id, title FROM book WHERE categoryId = ? LIMIT 5').all(firstCat.id);
    console.log(`\n📖 ספרים בקטגוריה "${firstCat.title}":`, books.length);
    books.forEach(book => {
      console.log(`  - ${book.title} (id: ${book.id})`);
    });
  }
  
  // סטטיסטיקות
  const stats = {
    categories: db.prepare('SELECT COUNT(*) as count FROM category').get().count,
    books: db.prepare('SELECT COUNT(*) as count FROM book').get().count,
    lines: db.prepare('SELECT COUNT(*) as count FROM line').get().count,
  };
  
  console.log('\n📊 סטטיסטיקות:');
  console.log(`  - קטגוריות: ${stats.categories}`);
  console.log(`  - ספרים: ${stats.books}`);
  console.log(`  - שורות: ${stats.lines}`);
  
  db.close();
  console.log('\n✅ הכל עובד מצוין!');
  
} catch (error) {
  console.error('\n❌ שגיאה:', error.message);
  console.error(error);
}
