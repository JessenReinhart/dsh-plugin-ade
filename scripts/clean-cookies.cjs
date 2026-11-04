const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const cookiePath = path.join(process.env.APPDATA, '@deepseek-ai', 'dsh-desktop', 'Network', 'Cookies');
const backupPath = cookiePath + '.bak-' + Date.now();

console.log('Backing up cookies to:', backupPath);
fs.copyFileSync(cookiePath, backupPath);

const db = new DatabaseSync(cookiePath);
const res = db.prepare("DELETE FROM cookies WHERE host_key IN ('127.0.0.1', 'localhost') AND name LIKE 'dsh-auth-%'").run();
console.log('Deleted cookies changes:', res.changes);
db.exec('VACUUM');
db.close();

const db2 = new DatabaseSync(cookiePath);
const remaining = db2.prepare("SELECT count(*) as count FROM cookies WHERE name LIKE 'dsh-auth-%'").all();
console.log('Remaining dsh-auth-* cookies:', remaining);
db2.close();
