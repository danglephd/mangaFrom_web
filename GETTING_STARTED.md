# 🚀 Getting Started

## Quick Setup (5 minutes)

### 1. Install Dependencies
Open terminal in this folder and run:
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

You should see:
```
Server running at http://localhost:3000
Navigate to http://localhost:3000 to start
```

### 3. Open in Browser
- Go to: **http://localhost:3000**
- You should see the Comic/Manga Downloader interface

## First Test

### Try with a Sample Site
1. Enter a manga/comic URL in the "Page URL" field
2. Enter a folder name like `test-download`
3. Click "🔍 Test Images" to see detected images
4. If images look good, click "⬇️ Download"

### Where are downloads saved?
- All downloads go to: `downloads/` folder in the project
- Each download gets its own subfolder with an `index.html` viewer

## Example URLs to Test

Try these sites (check if they still work):
- `https://example-manga-site.com/chapter/1` 
- `https://example-comic-site.com/page/123`

## Project Structure

```
mangaFrom_web/
├── server.js              # Express backend
├── package.json           # Dependencies
├── public/                # Frontend files
│   ├── index.html         # Main UI
│   ├── style.css          # Styling
│   └── script.js          # Client-side logic
├── downloads/             # Downloaded images folder
│   └── (created on first download)
├── README.md              # Full documentation
└── GETTING_STARTED.md     # This file
```

## API Endpoints

The backend provides two main APIs:

### Test Images Only
```
POST /api/extract-images
Body: { "url": "...", "selector": "..." (optional) }
Returns: List of image URLs
```

### Download Images
```
POST /api/download
Body: { "url": "...", "folder": "...", "selector": "..." (optional) }
Returns: Success message with download stats
```

## Troubleshooting

### "Cannot find module 'express'"
Run: `npm install`

### "Server doesn't start"
- Check port 3000 is not in use
- Check Node.js is installed: `node --version`

### "Images not found"
- Website might use lazy loading or JavaScript
- Try with a custom CSS selector
- Right-click on image → Inspect to find the selector

### "Download is slow"
- Normal for many/large images
- Network speed affects download time
- Be patient!

### "404 on http://localhost:3000"
- Server needs to be running (see step 2)
- Try refreshing the page
- Check terminal for errors

## Environment Variables (Optional)

Create a `.env` file to customize:
```
PORT=3000
NODE_ENV=development
```

## Next Steps

1. ✅ Get it running
2. 📝 Read the full README.md for detailed docs
3. 🔧 Customize the code as needed
4. 🚀 Deploy or use locally

## Need Help?

- Check README.md for detailed documentation
- Look at the browser console (F12) for errors
- Check terminal output for server errors
- Try a different website if one doesn't work

---

**Happy manga downloading! 📚**
