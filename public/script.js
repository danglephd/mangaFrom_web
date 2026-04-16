// Dom Elements
const urlInput = document.getElementById('url');
const folderInput = document.getElementById('folder');
const selectorInput = document.getElementById('selector');
const testBtn = document.getElementById('testBtn');
const downloadBtn = document.getElementById('downloadBtn');

const previewSection = document.getElementById('previewSection');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const previewCount = document.getElementById('previewCount');

const statusSection = document.getElementById('statusSection');
const statusMessage = document.getElementById('statusMessage');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

const completeSection = document.getElementById('completeSection');
const completionMessage = document.getElementById('completionMessage');
const downloadedFolder = document.getElementById('downloadedFolder');
const downloadPath = document.getElementById('downloadPath');

let currentImages = [];
let notificationPermissionRequested = false;

// Load download history from localStorage
function loadDownloadHistory() {
    const history = localStorage.getItem('downloadHistory');
    return history ? JSON.parse(history) : [];
}

// Save to localStorage
function saveDownloadHistory(url, folder, selector) {
    const history = loadDownloadHistory();
    history.unshift({ url, folder, selector, timestamp: new Date().toISOString() });
    localStorage.setItem('downloadHistory', JSON.stringify(history.slice(0, 20))); // Keep last 20
}

// Request Notification Permission
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Notifications not supported');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied' && !notificationPermissionRequested) {
        notificationPermissionRequested = true;
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

// Show Notification
function showNotification() {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted' && document.hidden) {
        const notification = new Notification('Download complete', {
            body: 'Your images have been downloaded successfully',
            icon: '📖',
        });

        notification.addEventListener('click', () => {
            window.focus();
            notification.close();
        });
    }
}

// Test Images Button
testBtn.addEventListener('click', testImages);

// Download Button
downloadBtn.addEventListener('click', async (e) => {
    // Request notification permission before download
    await requestNotificationPermission();
    downloadImages();
});

// Test Images Function
async function testImages() {
    const url = urlInput.value.trim();
    const selector = selectorInput.value.trim();

    if (!url) {
        showError('Please enter a URL');
        return;
    }

    testBtn.disabled = true;
    testBtn.textContent = '🔄 Testing...';

    try {
        const response = await fetch('/api/extract-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                selector: selector || undefined,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            showError(`Error: ${data.error}`);
            return;
        }

        currentImages = data.images;

        // Display preview
        displayPreview(currentImages);
        previewSection.style.display = 'block';
        statusSection.style.display = 'none';
        completeSection.style.display = 'none';

        previewCount.textContent = `Found ${currentImages.length} images`;
    } catch (error) {
        console.error('Test error:', error);
        showError(`Error: ${error.message}`);
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = '🔍 Test Images';
    }
}

// Download Images Function
async function downloadImages() {
    const url = urlInput.value.trim();
    const folder = folderInput.value.trim();
    const selector = selectorInput.value.trim();

    if (!url) {
        showError('Please enter a URL');
        return;
    }

    if (!folder) {
        showError('Please enter a folder name');
        return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = '⏳ Downloading...';

    previewSection.style.display = 'none';
    statusSection.style.display = 'block';
    completeSection.style.display = 'none';

    statusMessage.innerHTML =
        '📦 Processing your request... This may take a while.';

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                folder: folder,
                selector: selector || undefined,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            showError(`Error: ${data.error}`);
            return;
        }

        // Show success
        statusSection.style.display = 'none';
        completeSection.style.display = 'block';

        completionMessage.textContent = `Successfully downloaded ${data.downloadedCount} out of ${data.totalCount} images`;
        downloadedFolder.textContent = data.folder;
        downloadPath.textContent = `downloads/${data.folder}`;

        // Save to localStorage
        saveDownloadHistory(url, folder, selector);

        // Show notification if tab is not focused
        showNotification();
    } catch (error) {
        console.error('Download error:', error);
        showError(`Error: ${error.message}`);
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇️ Download';
    }
}

// Display Preview Images
function displayPreview(images) {
    imagePreviewContainer.innerHTML = '';

    images.slice(0, 50).forEach((imgUrl, index) => {
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = `Preview ${index + 1}`;
        img.className = 'preview-image';
        img.onerror = () => {
            img.style.background = '#333';
            img.title = 'Failed to load image preview';
        };

        img.addEventListener('click', () => {
            openImageInNewTab(imgUrl);
        });

        imagePreviewContainer.appendChild(img);
    });

    if (images.length > 50) {
        const moreText = document.createElement('div');
        moreText.style.padding = '20px';
        moreText.style.textAlign = 'center';
        moreText.style.color = '#aaa';
        moreText.textContent = `... and ${images.length - 50} more`;
        imagePreviewContainer.appendChild(moreText);
    }
}

// Open Image in New Tab
function openImageInNewTab(url) {
    window.open(url, '_blank');
}

// Show Error Message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(errorDiv, mainContent.firstChild);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);

    console.error(message);
}

// Update Progress (optional, for real-time updates if needed)
function updateProgress(current, total) {
    const percentage = (current / total) * 100;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${current}/${total}`;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+Enter or Cmd+Enter to test
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (document.activeElement === urlInput) {
            testImages();
        }
    }
});
