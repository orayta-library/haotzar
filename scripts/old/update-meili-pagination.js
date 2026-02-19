#!/usr/bin/env node
/**
 * עדכון הגדרות pagination של Meilisearch
 * מאפשר לקבל עד 10,000 תוצאות במקום 1000
 */

const { MeiliSearch } = require('meilisearch');

async function updatePaginationSettings() {
  console.log('🔧 מעדכן הגדרות pagination...\n');
  
  const client = new MeiliSearch({ host: 'http://127.0.0.1:7700' });
  
  try {
    const index = client.index('books');
    
    // בדוק שהאינדקס קיים
    const stats = await index.getStats();
    console.log(`📊 נמצא אינדקס עם ${stats.numberOfDocuments.toLocaleString()} מסמכים\n`);
    
    if (stats.numberOfDocuments === 0) {
      console.log('⚠️  האינדקס ריק! צריך לבנות אינדקס תחילה.');
      console.log('💡 הרץ: node scripts/upload-to-meili.js\n');
      process.exit(1);
    }
    
    // עדכן הגדרות pagination
    console.log('⚙️  מעדכן הגדרות pagination...');
    await index.updateSettings({
      pagination: {
        maxTotalHits: 10000  // מקסימום 10,000 תוצאות
      }
    });
    
    console.log('✅ הגדרות pagination עודכנו!\n');
    
    // המתן לסיום העדכון
    console.log('⏳ ממתין לסיום עדכון האינדקס...');
    let isIndexing = true;
    while (isIndexing) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const currentStats = await index.getStats();
      isIndexing = currentStats.isIndexing;
      if (isIndexing) {
        process.stdout.write('.');
      }
    }
    console.log('\n');
    
    // בדיקת חיפוש
    console.log('🔍 בודק חיפוש עם הגדרות חדשות...\n');
    const results = await index.search('שבת', { 
      limit: 10000,
      showRankingScore: true 
    });
    
    console.log(`✅ נמצאו ${results.hits.length} תוצאות (מקסימום: ${results.estimatedTotalHits || results.hits.length})\n`);
    
    if (results.hits.length === 1000) {
      console.log('⚠️  עדיין מוגבל ל-1000 תוצאות!');
      console.log('💡 נסה להפעיל מחדש את Meilisearch\n');
    } else {
      console.log('🎉 עדכון הושלם בהצלחה!');
      console.log(`💡 עכשיו אפשר לקבל עד 10,000 תוצאות בחיפוש\n`);
    }
    
  } catch (error) {
    if (error.code === 'index_not_found') {
      console.log('❌ האינדקס לא קיים!');
      console.log('💡 הרץ תחילה: node scripts/upload-to-meili.js\n');
    } else {
      console.error('❌ שגיאה:', error.message);
    }
    process.exit(1);
  }
}

updatePaginationSettings().catch(err => {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});
