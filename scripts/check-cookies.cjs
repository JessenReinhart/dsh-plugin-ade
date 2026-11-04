const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const cookiePath = path.join(process.env.APPDATA, '@deepseek-ai', 'dsh-desktop', 'Network', 'Cookies');
console.log('Cookie path exists:', fs.existsSync(cookiePath));

if (fs.existsSync(cookiePath)) {
  const stats = fs.statSync(cookiePath);
  console.log('Cookie file size:', stats.size);
  try {
    const db = new DatabaseSync(cookiePath);
    const rows = db.prepare("SELECT count(*) as count, sum(length(name) + length(value)) as totalLen FROM cookies WHERE name LIKE 'dsh-auth-%'").all();
    console.log('dsh-auth-* cookie count and size:', rows);
    db.close();
  } catch (err) {
    console.error('Error querying SQLite:', err.message);
  }
}
