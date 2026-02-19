#!/usr/bin/env node
const { MeiliSearch } = require('meilisearch');

async function checkTasks() {
  const client = new MeiliSearch({ host: 'http://127.0.0.1:7700' });
  
  // בדוק task ספציפי
  console.log('📋 Checking task 22:\n');
  const task = await client.getTask(22);
  
  console.log(`Task ${task.uid}:`);
  console.log(`  Type: ${task.type}`);
  console.log(`  Status: ${task.status}`);
  console.log(`  Index: ${task.indexUid}`);
  if (task.error) {
    console.log(`  Error: ${JSON.stringify(task.error, null, 2)}`);
  }
  console.log('');
  
  // בדוק גם task 12
  console.log('📋 Checking task 12:\n');
  const task12 = await client.getTask(12);
  
  console.log(`Task ${task12.uid}:`);
  console.log(`  Type: ${task12.type}`);
  console.log(`  Status: ${task12.status}`);
  console.log(`  Index: ${task12.indexUid}`);
  if (task12.error) {
    console.log(`  Error: ${JSON.stringify(task12.error, null, 2)}`);
  }
}

checkTasks().catch(err => console.error('Error:', err.message));
