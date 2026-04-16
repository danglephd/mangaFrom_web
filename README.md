# 📥 Comic/Manga Downloader

A web application to download all images from manga and comic chapter pages with an offline viewer.

## Features

✨ **Easy to Use**
- Simple web interface
- Paste URL → Test → Download

🔍 **Smart Image Detection**
- Automatically detects all images on the page
- Supports custom CSS selectors
- Filters out thumbnails and small images
- Handles lazy loading

📦 **Batch Download**
- Download all images at once
- Automatic retry on failed downloads
- Generates offline image viewer

🌙 **Offline Viewer**
- Beautiful dark theme
- Lazy loading support
- Mobile responsive
- All images in one folder

## Installation

### Requirements
- Node.js 14+ 
- npm or yarn

### Setup

1. **Clone or download this repository**

2. **Install dependencies**
```bash
npm install
```

## Usage

### Start the Server

```bash
npm start
```

The application will be available at `http://localhost:3000`

### Using the App

1. **Input Page URL**
   - Paste the full URL of the manga/comic chapter page

2. **Input Folder Name**
   - Enter a name for the downloaded folder
   - Example: `one-piece-chapter-100`

3. **Test Images (Optional)**
   - Click "Test Images" to preview detected images
   - Verify the correct images are found
   - Use custom CSS selector if needed

4. **Download**
   - Click "Download" to start downloading all images
   - Images will be saved to `downloads/{folder-name}/`
   - A file named `index.html` will be generated automatically

5. **View Offline**
   - Navigate to the downloads folder
   - Open `index.html` in your web browser
   - View all images offline with lazy loading

## API Endpoints

### POST /api/extract-images
Extract images from a URL.

**Request:**
```json
{
  "url": "https://example.com/chapter/123",
  "selector": "img.manga-image" // optional
}
```

**Response:**
```json
{
  "images": ["image-url-1", "image-url-2", ...]
}
```

### POST /api/download
Download images and generate offline viewer.

**Request:**
```json
{
  "url": "https://example.com/chapter/123",
  "folder": "my-chapter",
  "selector": "img.manga-image" // optional
}
```

**Response:**
```json
{
  "message": "Download completed",
  "folder": "my-chapter",
  "downloadedCount": 45,
  "totalCount": 50
}
```

## Custom CSS Selectors

If the app doesn't detect the right images, use a CSS selector:

**Examples:**
- `img.chapter-image` - Select by class
- `div.article img` - Select img inside div
- `.manga-page > img` - Select direct children
- `img[alt*="page"]` - Select by attribute

**How to find the right selector:**
1. Right-click on an image → Inspect Element
2. Find the class or tag pattern
3. Test with that selector in the app

## Downloaded Folder Structure

```
downloads/
└── my-chapter/
    ├── index.html (offline viewer)
    ├── 001.jpg
    ├── 002.jpg
    ├── 003.jpg
    └── ...
```

## Features of Generated index.html

- 🌙 Dark theme optimized for reading
- 📱 Mobile responsive design
- ⚡ Lazy loading for smooth scrolling
- 🎨 Beautiful UI with smooth transitions
- 🔍 Click image to open in new tab
- 📊 Shows total image count

## Technical Stack

- **Backend:** Node.js + Express
- **Browser Automation:** Playwright (Chromium)
- **Frontend:** HTML + Vanilla JavaScript + CSS3
- **HTTP Client:** Axios

## How It Works

1. **Image Extraction**
   - Launches a headless Chromium browser
   - Navigates to the provided URL
   - Waits for network idle (all resources loaded)
   - Scrolls to bottom to trigger lazy loading
   - Extracts images using provided or default selector

2. **Image Filtering**
   - Removes duplicates
   - Validates URLs (http/https only)
   - Converts relative URLs to absolute
   - Scores images and prioritizes larger ones

3. **Download Process**
   - Downloads each image sequentially
   - Retries up to 2 times on failure
   - Sets proper headers (Referer, User-Agent)
   - Saves with padded numbering (001.jpg, 002.jpg, etc.)

4. **Offline Viewer Generation**
   - Creates a standalone HTML file
   - Includes embedded CSS and JavaScript
   - Lists all downloaded images
   - No external dependencies required

## Troubleshooting

### "No images found"
- The website might use JavaScript to load images
- Try using a custom CSS selector
- Check the browser console for errors

### "Download failed"
- The website might block automated downloads
- Try adding appropriate headers in the code
- Some images might be protected

### Slow download
- Large image files take time to download
- The app processes one image at a time
- Be patient, especially with many images

### Images not displaying in viewer
- Check the `downloads/{folder}/` directory
- Ensure images were actually downloaded
- Open the browser console to check for errors

## Browser Compatibility

The offline viewer works in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## License

MIT - See LICENSE file

## Disclaimer

This tool is meant for personal use and educational purposes. Always respect:
- Website terms of service
- Copyright laws
- Author's rights
- Server resources

## Contributing

Feel free to submit issues and enhancement requests!

## Support

For bugs or questions, please open an issue on the repository.

---

**Made with ❤️ for manga and comic enthusiasts**