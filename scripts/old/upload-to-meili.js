#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { MeiliSearch } = require('meilisearch');

async function uploadToMeili() {
  const docsPath = path.join(__dirname, '..', 'index', 'meili-docs.json');
  
  console.log('📂 Loading documents from:', docsPath);
  const docs = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
  console.log(`📄 Found ${docs.length} documents\n`);
  
  const client = new MeiliSearch({ host: 'http://127.0.0.1:7700' });
  
  // מחק אינדקס קיים אם יש
  try {
    await client.deleteIndex('books');
    console.log('🗑️  Deleted old index\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (e) {
    // אין אינדקס קיים
  }
  
  // צור אינדקס חדש עם primary key מפורש
  await client.createIndex('books', { primaryKey: 'id' });
  console.log('✅ Created new index with primaryKey: id\n');
  
  const index = client.index('books');
  
  // הגדרות אינדקס משופרות לחיפוש חכם
  console.log('⚙️  Configuring index with smart search settings...');
  await index.updateSettings({
    searchableAttributes: ['text', 'fileId'], // text קודם = חשוב יותר
    displayedAttributes: ['id', 'fileId', 'safeFileId', 'chunkId', 'chunkStart', 'pageNum', 'text'],
    filterableAttributes: ['fileId', 'safeFileId'],
    sortableAttributes: ['chunkStart', 'pageNum'],
    // הגדרות לנרמול טקסט - התעלם מגרשיים וסימני פיסוק
    separatorTokens: ['"', "'", '\u05F4', '\u05F3', '\u2018', '\u2019', '\u201C', '\u201D'],
    nonSeparatorTokens: [],
    // כללי דירוג - מה חשוב יותר בתוצאות
    rankingRules: [
      'words',        // כמה מילות חיפוש נמצאו
      'typo',         // פחות שגיאות כתיב = טוב יותר
      'proximity',    // מילים קרובות יותר = טוב יותר
      'attribute',    // סדר השדות (text לפני fileId)
      'sort',         // מיון
      'exactness'     // התאמה מדויקת = הכי טוב
    ],
    // הגדרות חיפוש מחמירות יותר
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 4,   // רק מילים מעל 4 תווים - סובלנות לשגיאה אחת
        twoTypos: 8   // רק מילים מעל 8 תווים - סובלנות ל-2 שגיאות
      }
    },
    // הגדרות pagination - מאפשר עד 10,000 תוצאות
    pagination: {
      maxTotalHits: 10000  // מקסימום 10,000 תוצאות (ברירת מחדל: 1000)
    }
  });
  console.log('✓ Smart search settings updated (including pagination: 10,000 max results)\n');
  
  // העלאה בקבוצות
  const batchSize = 500;
  const batches = [];
  for (let i = 0; i < docs.length; i += batchSize) {
    batches.push(docs.slice(i, i + batchSize));
  }
  
  console.log(`📤 Uploading ${docs.length} docs in ${batches.length} batches...\n`);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    // וודא שכל המסמכים כוללים את כל השדות הנדרשים
    const docsToUpload = batch.map(doc => ({
      id: doc.id,
      fileId: doc.fileId,
      safeFileId: doc.safeFileId,
      chunkId: doc.chunkId,
      chunkStart: doc.chunkStart,
      pageNum: doc.pageNum || 1,  // 🎯 חשוב! מספר העמוד
      text: doc.text
    }));
    const task = await index.addDocuments(docsToUpload);
    console.log(`  ✓ Batch ${i + 1}/${batches.length} - Task ID: ${task.taskUid}`);
  }
  
  console.log('\n✅ Upload complete! Waiting for indexing...\n');
  
  // המתן לסיום האינדוקס
  let isIndexing = true;
  while (isIndexing) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const stats = await index.getStats();
    console.log(`📊 Documents: ${stats.numberOfDocuments}, Indexing: ${stats.isIndexing}`);
    isIndexing = stats.isIndexing;
  }
  
  console.log('\n🎉 Indexing complete!');
  
  // בדיקת חיפוש עם ציונים
  console.log('\n🔍 Testing search with "שבת"...\n');
  const results = await index.search('שבת', { 
    limit: 5,
    showRankingScore: true 
  });
  console.log(`Found ${results.hits.length} results\n`);
  
  if (results.hits.length > 0) {
    console.log('Top results with scores:');
    results.hits.forEach((hit, i) => {
      const score = hit._rankingScore || 0;
      console.log(`  ${i + 1}. Score: ${score.toFixed(3)} | File: ${hit.fileId}`);
      console.log(`     Text: ${hit.text.substring(0, 80)}...`);
    });
    
    console.log('\n💡 Tip: Results with score < 0.3 will be filtered out in the app');
  }
}

uploadToMeili().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
