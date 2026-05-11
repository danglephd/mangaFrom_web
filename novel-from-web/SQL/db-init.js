const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, '../../db/novel.db');
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('✗ Lỗi kết nối DB:', err.message);
        reject(err);
      } else {
        console.log('✓ Đã kết nối SQLite');
        createTables()
          .then(resolve)
          .catch(reject);
      }
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          author TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Lỗi tạo bảng books:', err.message);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS chapters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          chapter_number INTEGER NOT NULL,
          title TEXT,
          content_html TEXT,
          content_text TEXT,
          source_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

          UNIQUE(book_id, chapter_number),
          FOREIGN KEY(book_id) REFERENCES books(id)
        )
      `, (err) => {
        if (err) {
          console.error('Lỗi tạo bảng chapters:', err.message);
          reject(err);
        } else {
          console.log('✓ Đã tạo bảng xong');
          resolve();
        }
      });
    });
  });
}

async function initializePool() {
  if (!db) {
    await initializeDatabase();
  }
  return db;
}

function upsertBook(slug, name) {
  return new Promise(async (resolve, reject) => {
    try {
      const pool = await initializePool();
      
      // Kiểm tra sách đã tồn tại
      pool.get('SELECT id FROM books WHERE slug = ?', [slug], (err, row) => {
        if (err) {
          console.error('✗ Lỗi kiểm tra books:', err.message);
          return reject(err);
        }

        if (row) {
          console.log(`ℹ Sách "${slug}" đã tồn tại (ID: ${row.id})`);
          return resolve(row.id);
        }

        // Thêm sách mới
        pool.run(
          'INSERT INTO books (name, slug) VALUES (?, ?)',
          [name, slug],
          function(err) {
            if (err) {
              console.error('✗ Lỗi thêm sách:', err.message);
              return reject(err);
            }
            console.log(`✓ Sách mới thêm: "${name}" (ID: ${this.lastID})`);
            resolve(this.lastID);
          }
        );
      });
    } catch (error) {
      reject(error);
    }
  });
}

function insertChapter(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const pool = await initializePool();
      const {
        book_id,
        chapter_number,
        title,
        content_html,
        content_text,
        source_url
      } = data;

      pool.run(`
        INSERT OR REPLACE INTO chapters 
        (book_id, chapter_number, title, content_html, content_text, source_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        book_id,
        chapter_number,
        title,
        content_html,
        content_text,
        source_url
      ], function(err) {
        if (err) {
          console.error('✗ Lỗi thêm chapter:', err.message);
          return reject(err);
        }
        console.log(`✓ Chapter ${chapter_number} đã lưu`);
        resolve(this.lastID);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('✗ Lỗi đóng DB:', err.message);
          reject(err);
        } else {
          console.log('✓ DB đã đóng');
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initializePool,
  initializeDatabase,
  upsertBook,
  insertChapter,
  closeDatabase
};