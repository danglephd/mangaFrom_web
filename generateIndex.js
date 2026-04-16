const fs = require('fs');
const path = require('path');

const ROOT_FOLDER = path.join(__dirname, 'downloads');

// Natural sort for chapter names
function naturalSort(a, b) {
    const regex = /(\d+)/g;
    const aNumbers = a.match(regex) || [];
    const bNumbers = b.match(regex) || [];
    
    if (aNumbers.length && bNumbers.length) {
        const aNum = parseInt(aNumbers[0]);
        const bNum = parseInt(bNumbers[0]);
        if (aNum !== bNum) return aNum - bNum;
    }
    
    return a.localeCompare(b);
}

// Get all valid chapters
function getChapters() {
    if (!fs.existsSync(ROOT_FOLDER)) {
        fs.mkdirSync(ROOT_FOLDER, { recursive: true });
        return [];
    }

    const folders = fs.readdirSync(ROOT_FOLDER)
        .filter(item => {
            const fullPath = path.join(ROOT_FOLDER, item);
            const stats = fs.statSync(fullPath);
            return stats.isDirectory() && fs.existsSync(path.join(fullPath, 'index.html'));
        })
        .sort(naturalSort);

    return folders;
}

// Generate main index.html
function generateMainIndex(chapters) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comic Reader</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #fff;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 100vh;
            padding: 40px 20px;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 50px;
        }

        .header h1 {
            font-size: 42px;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .chapter-count {
            color: #aaa;
            font-size: 16px;
        }

        .chapters-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .chapter-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 20px;
            text-decoration: none;
            color: #fff;
            transition: all 0.3s ease;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100px;
            text-align: center;
        }

        .chapter-card:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 107, 107, 0.5);
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(255, 107, 107, 0.2);
        }

        .chapter-card-number {
            display: block;
            font-size: 12px;
            color: #ff6b6b;
            margin-bottom: 5px;
            font-weight: 600;
            letter-spacing: 1px;
        }

        .chapter-card-name {
            display: block;
            font-size: 18px;
            font-weight: 500;
        }

        .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 28px;
            }

            .chapters-grid {
                grid-template-columns: 1fr;
            }

            body {
                padding: 20px 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Comic Reader</h1>
            <p class="chapter-count">Total chapters: ${chapters.length}</p>
        </div>

        <div class="chapters-grid">
            ${chapters.map((chapter, index) => `
            <a href="./${chapter}/index.html" class="chapter-card">
                <div>
                    <span class="chapter-card-number">CHAPTER ${index + 1}</span>
                    <span class="chapter-card-name">${chapter}</span>
                </div>
            </a>
            `).join('')}
        </div>

        <div class="footer">
            <p>Offline Comic Reader • Created with ❤️</p>
        </div>
    </div>
</body>
</html>`;

    return html;
}

// Generate navigation HTML for chapter
function generateNavigation(chapters, currentChapterIndex) {
    const prevChapter = currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;
    const nextChapter = currentChapterIndex < chapters.length - 1 ? chapters[currentChapterIndex + 1] : null;

    const navHtml = `
    <nav class="chapter-nav">
        <div class="nav-container">
            ${prevChapter ? `<a href="../${prevChapter}/index.html" class="nav-btn nav-prev">← Previous</a>` : `<div class="nav-btn nav-disabled">← Previous</div>`}
            <a href="../index.html" class="nav-btn nav-home">🏠 Home</a>
            ${nextChapter ? `<a href="../${nextChapter}/index.html" class="nav-btn nav-next">Next →</a>` : `<div class="nav-btn nav-disabled">Next →</div>`}
        </div>
    </nav>
    <style>
        .chapter-nav {
            background: rgba(0, 0, 0, 0.7);
            padding: 15px 0;
            position: sticky;
            top: 0;
            z-index: 100;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .nav-container {
            display: flex;
            justify-content: center;
            gap: 20px;
            max-width: 100%;
            flex-wrap: wrap;
        }

        .nav-btn {
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            text-decoration: none;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
            font-size: 14px;
            display: inline-block;
        }

        .nav-btn:hover {
            background: rgba(255, 107, 107, 0.3);
            border-color: #ff6b6b;
        }

        .nav-disabled {
            padding: 8px 16px;
            color: #666;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 14px;
            display: inline-block;
            cursor: not-allowed;
        }

        @media (max-width: 768px) {
            .nav-container {
                gap: 10px;
            }

            .nav-btn {
                padding: 6px 12px;
                font-size: 12px;
            }
        }
    </style>`;

    return navHtml;
}

// Inject navigation into chapter index.html
function injectNavigationToChapters(chapters) {
    chapters.forEach((chapter, index) => {
        const chapterPath = path.join(ROOT_FOLDER, chapter, 'index.html');
        
        if (!fs.existsSync(chapterPath)) return;

        let content = fs.readFileSync(chapterPath, 'utf-8');

        // Remove existing navigation if present
        content = content.replace(/<nav class="chapter-nav">[\s\S]*?<\/style>/g, '');

        const navigation = generateNavigation(chapters, index);
        
        // Insert navigation after <body>
        if (content.includes('<body>')) {
            content = content.replace('<body>', `<body>\n${navigation}`);
        } else if (content.includes('<body ')) {
            content = content.replace(/(<body[^>]*>)/, `$1\n${navigation}`);
        }

        fs.writeFileSync(chapterPath, content, 'utf-8');
        console.log(`✓ Updated: ${chapter}/index.html`);
    });
}

// Main execution
function main() {
    const chapters = getChapters();

    if (chapters.length === 0) {
        console.log('No chapters found in downloads folder');
        return;
    }

    console.log(`Found ${chapters.length} chapters`);

    // Generate main index.html
    const mainIndexHtml = generateMainIndex(chapters);
    const mainIndexPath = path.join(ROOT_FOLDER, 'index.html');
    fs.writeFileSync(mainIndexPath, mainIndexHtml, 'utf-8');
    console.log(`✓ Generated: downloads/index.html`);

    // Inject navigation to all chapters
    injectNavigationToChapters(chapters);

    console.log('\n✓ All done!');
}

main();
