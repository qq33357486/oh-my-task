const Database = require('better-sqlite3');
const db = new Database('./data/data.db');

// 检查 WAL 模式和外键
console.log('journal_mode:', JSON.stringify(db.pragma('journal_mode')));
console.log('foreign_keys:', JSON.stringify(db.pragma('foreign_keys')));

// 检查所有表
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', JSON.stringify(tables));

// 检查所有索引
const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name").all();
console.log('Indices:', JSON.stringify(indices));

// 检查 system_config 默认数据
const configs = db.prepare("SELECT key FROM system_config ORDER BY key").all();
console.log('Config keys:', JSON.stringify(configs));

db.close();
