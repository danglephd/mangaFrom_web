CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  author VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chapters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  chapter_number INT NOT NULL,
  title VARCHAR(255),
  content_html MEDIUMTEXT,
  content_text MEDIUMTEXT,
  source_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_chapter (book_id, chapter_number),
  INDEX idx_book (book_id),

  FOREIGN KEY (book_id) REFERENCES books(id)
);

INSERT INTO books (name, slug)
VALUES ('Ỷ Thiên Đồ Long Ký', 'y-thien-do-long-ky');

INSERT INTO chapters (
  book_id,
  chapter_number,
  title,
  content_html,
  content_text,
  source_url
)
VALUES (
  1,
  1,
  'Hồi 1: Thiên Nhai...',
  '<p>nội dung html...</p>',
  'nội dung text...',
  'https://...'
);

