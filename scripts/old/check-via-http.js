#!/usr/bin/env node
const http = require('http');

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:7700${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function check() {
  console.log('📊 Checking Meilisearch via HTTP...\n');
  
  // בדוק stats
  const stats = await httpGet('/indexes/books/stats');
  console.log('Index Stats:');
  console.log(JSON.stringify(stats, null, 2));
  console.log('');
  
  // בדוק task אחרון
  const task = await httpGet('/tasks/22');
  console.log('Task 22:');
  console.log(JSON.stringify(task, null, 2));
}

check().catch(err => console.error('Error:', err.message));
