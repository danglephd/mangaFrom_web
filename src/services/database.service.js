/** 
    * Database Service
    * Handles saving download history to SQLite database
    * Uses sqlite3 package for database operations
    * Provides function to save download history with URL, folder, series name, chapter, and timestamp
    * Logs success or error messages when saving history
*/
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
// Database setup
const dbPath = path.join(process.cwd(), 'mangaFrom_web.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    // Create history table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS download_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        folder TEXT NOT NULL,
        series_name TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        UNIQUE(folder, url)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Download history table ready');
      }
    });
  }
});

// Save download history to database
function saveDownloadHistory(url, folder, seriesName, chapter) {
  const timestamp = new Date().toISOString();
  const query = `
    INSERT OR REPLACE INTO download_history (url, folder, series_name, chapter, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.run(query, [url, folder, seriesName, chapter, timestamp], (err) => {
    if (err) {
      console.error('Error saving history:', err.message);
    } else {
      console.log(`[History] Saved: ${folder} (Chapter ${chapter})`);
    }
  });
}


module.exports = {
    saveDownloadHistory,
    db
};
