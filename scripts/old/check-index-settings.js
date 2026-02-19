#!/usr/bin/env node
const { MeiliSearch } = require('meilisearch');

async function checkSettings() {
  const client = new MeiliSearch({ host: 'http://127.0.0.1:7700' });
  const index = client.index('books');
  
  console.log('⚙️  Index Settings:\n');
  
  const settings = await index.getSettings();
  console.log(JSON.stringify(settings, null, 2));
  
  console.log('\n📊 Index Stats:\n');
  const stats = await index.getStats();
  console.log(JSON.stringify(stats, null, 2));
}

checkSettings().catch(err => console.error('Error:', err.message));
