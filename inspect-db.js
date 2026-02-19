const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'books', 'אוצריא', 'seforim.db');
console.log('Opening database:', dbPath);

const db = new Database(dbPath, { readonly: true });

// Get all tables
console.log('\n=== Tables ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => console.log('-', t.name));

// For each table, show structure and sample data
tables.forEach(table => {
  console.log(`\n=== Table: ${table.name} ===`);
  
  // Show columns
  const columns = db.pragma(`table_info(${table.name})`);
  console.log('Columns:');
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  // Show row count
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
  console.log(`Total rows: ${count.count}`);
  
  // Show sample data (first 3 rows)
  if (count.count > 0) {
    console.log('Sample data (first 3 rows):');
    const samples = db.prepare(`SELECT * FROM ${table.name} LIMIT 3`).all();
    samples.forEach((row, i) => {
      console.log(`\nRow ${i + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        const displayValue = typeof value === 'string' && value.length > 100 
          ? value.substring(0, 100) + '...' 
          : value;
        console.log(`  ${key}: ${displayValue}`);
      });
    });
  }
});

db.close();
console.log('\n=== Done ===');
