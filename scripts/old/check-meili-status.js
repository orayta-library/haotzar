#!/usr/bin/env node
const { MeiliSearch } = require('meilisearch');

async function checkStatus() {
  try {
    const client = new MeiliSearch({ host: 'http://127.0.0.1:7700' });
    const index = client.index('books');
    
    // בדוק סטטיסטיקות
    console.log('📊 Meilisearch Status:\n');
    
    const stats = await index.getStats();
    console.log('Index Stats:');
    console.log(`  Documents: ${stats.numberOfDocuments}`);
    console.log(`  Indexing: ${stats.isIndexing}`);
    console.log('');
    
    // נסה חיפוש פשוט
    console.log('🔍 Testing search with "שבת"...\n');
    const results = await index.search('שבת', { limit: 5 });
    console.log(`Found ${results.hits.length} results`);
    
    if (results.hits.length > 0) {
      console.log('\nFirst result:');
      console.log(JSON.stringify(results.hits[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStatus();
