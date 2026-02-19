#!/usr/bin/env node
/**
 * עדכון הגדרות חיפוש ללא בנייה מחדש של האינדקס
 * מעדכן את כללי הדירוג והסינון לחיפוש חכם יותר
 */

const { MeiliSearch } = require('meilisearch');

async function updateSearchSettings() {
  console.log('🔧 מעדכן הגדרות חיפוש...\n');
  
  const client = new MeiliSearch({ host: 'http://127.0.0.1:7700' });
  
  try {
    const index = client.index('books');
    
    // בדוק שהאינדקס קיים
    const stats = await index.getStats();
    console.log(`📊 נמצא אינדקס עם ${stats.numberOfDocuments} מסמכים\n`);
    
    if (stats.numberOfDocuments === 0) {
      console.log('⚠️  האינדקס ריק! צריך לבנות אינדקס תחילה.');
      console.log('💡 הרץ: node scripts/upload-to-meili.js\n');
      process.exit(1);
    }
    
    // עדכן הגדרות
    console.log('⚙️  מעדכן הגדרות חיפוש חכם...');
    await index.updateSettings({
      searchableAttributes: ['text', 'fileId'], // text קודם = חשוב יותר
      displayedAttributes: ['id', 'fileId', 'fileName', 'filePath', 'chunkIndex', 'text', 'pageNum', 'chunkStart', 'chunkId'],
      filterableAttributes: ['fileId', 'fileName'],
      sortableAttributes: ['chunkStart', 'pageNum'],
      // הגדרות לנרמול טקסט - התעלם מסימני פיסוק
      separatorTokens: [
        '"', "'", '\u05F4', '\u05F3',  // גרשיים עבריים
        '\u2018', '\u2019', '\u201C', '\u201D',  // גרשיים אנגליים
        '(', ')', '[', ']', '{', '}',  // סוגריים
        ',', '.', '!', '?', ';', ':',  // סימני פיסוק
        '-', '–', '—',  // מקפים
        '/', '\\', '|'  // קווים
      ],
      nonSeparatorTokens: [],
      // כללי דירוג משופרים - התאמה מדויקת למעלה!
      rankingRules: [
        'words',        // כמה מילות חיפוש נמצאו - הכי חשוב!
        'typo',         // פחות שגיאות כתיב = טוב יותר
        'proximity',    // מילים קרובות יותר = טוב יותר
        'attribute',    // סדר השדות (text לפני fileId)
        'exactness',    // התאמה מדויקת = הכי טוב
        'sort'          // מיון
      ],
      // הגדרות חיפוש עם סובלנות מתונה
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 4,   // מילים מעל 4 תווים - סובלנות לשגיאה אחת
          twoTypos: 7   // מילים מעל 7 תווים - סובלנות ל-2 שגיאות
        },
        disableOnWords: [], // אפשר טעויות בכל המילים
        disableOnAttributes: [] // אפשר טעויות בכל השדות
      }
    });
    
    console.log('✅ הגדרות עודכנו בהצלחה!\n');
    
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
      limit: 5,
      showRankingScore: true 
    });
    
    console.log(`✅ נמצאו ${results.hits.length} תוצאות\n`);
    
    if (results.hits.length > 0) {
      console.log('דוגמאות תוצאות עם ציונים:');
      results.hits.slice(0, 3).forEach((hit, i) => {
        const score = hit._rankingScore || 0;
        console.log(`  ${i + 1}. ציון: ${(score * 100).toFixed(1)}% | קובץ: ${hit.fileId}`);
      });
      
      console.log('\n💡 תוצאות עם ציון מתחת ל-30% לא יוצגו באפליקציה');
    }
    
    console.log('\n🎉 עדכון הושלם בהצלחה!');
    console.log('💡 עכשיו אפשר להפעיל את האפליקציה ולהנות מחיפוש משופר\n');
    
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

updateSearchSettings().catch(err => {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});
