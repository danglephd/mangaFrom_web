// Dom Elements
const urlInput = document.getElementById('url');
const folderInput = document.getElementById('folder');
const startChapterInput = document.getElementById('startChapter');
const testBtn = document.getElementById('testBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadSeriesBtn = document.getElementById('downloadSeriesBtn');
const downloadSeries2Btn = document.getElementById('downloadSeries2Btn');

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
let isDownloadingChapter2 = false;
let userStoppedDownload = false;

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
function showNotification(title = 'Download complete', body = 'Your images have been downloaded successfully') {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted' && document.hidden) {
        const notification = new Notification(title, {
            body: body,
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
    await requestNotificationPermission();
    downloadImages();
});

// Download Series Button
downloadSeriesBtn.addEventListener('click', async (e) => {
    await requestNotificationPermission();
    downloadSeries();
});

// Download Series 2 Button
downloadSeries2Btn.addEventListener('click', async (e) => {
    if (isDownloadingChapter2) {
        // User clicked Stop button while downloading
        userStoppedDownload = true;
        downloadSeries2Btn.disabled = true;
        downloadSeries2Btn.textContent = '📚 Download Series 2';
    } else {
        await requestNotificationPermission();
        downloadSeries2();
    }
});

// Test Images Function
async function testImages() {
    const url = urlInput.value.trim();

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

// Download Single Chapter
async function downloadImages() {
    const url = urlInput.value.trim();
    const folder = folderInput.value.trim();
    const startChapter = parseInt(startChapterInput.value) || 1;

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
    downloadSeriesBtn.disabled = true;

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
                startChapter: startChapter,
                seriesName: folder,
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

        // Show notification if tab is not focused
        showNotification('Download complete', `Downloaded ${data.downloadedCount} images`);
    } catch (error) {
        console.error('Download error:', error);
        showError(`Error: ${error.message}`);
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇️ Download';
        downloadSeriesBtn.disabled = false;
    }
}

// Download Series
async function downloadSeries() {
    const url = urlInput.value.trim();
    const folder = folderInput.value.trim();
    const startChapter = parseInt(startChapterInput.value) || 1;

    if (!url) {
        showError('Please enter a URL');
        return;
    }

    if (!folder) {
        showError('Please enter a folder name (series name)');
        return;
    }

    downloadBtn.disabled = true;
    downloadSeriesBtn.disabled = true;
    downloadSeriesBtn.textContent = '⏳ Downloading Series...';

    previewSection.style.display = 'none';
    statusSection.style.display = 'block';
    completeSection.style.display = 'none';

    statusMessage.innerHTML =
        '📚 Starting series download... This may take a very long time.';

    try {
        const response = await fetch('/api/download-series', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                folder: folder,
                startChapter: startChapter,
                seriesName: folder,
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

        let resultsSummary = `Successfully processed ${data.totalChapters} chapters:\n`;
        data.results.forEach((r) => {
            resultsSummary += `\n✓ Chapter ${r.chapter}: ${r.downloadedCount}/${r.totalCount} images`;
        });

        completionMessage.innerHTML = resultsSummary.replace(/\n/g, '<br>');
        downloadedFolder.textContent = folder;
        downloadPath.textContent = `downloads/${folder}`;

        // Show notification if tab is not focused
        showNotification('Series download complete', `Processed ${data.totalChapters} chapters`);
    } catch (error) {
        console.error('Series download error:', error);
        showError(`Error: ${error.message}`);
    } finally {
        downloadBtn.disabled = false;
        downloadSeriesBtn.disabled = false;
        downloadSeriesBtn.textContent = '📚 Download Series';
    }
}

// Download Series 2 (Single Chapter with Auto-Update)
async function downloadSeries2() {
    const url = urlInput.value.trim();
    const folder = folderInput.value.trim();
    const startChapter = parseInt(startChapterInput.value) || 1;

    if (!url) {
        showError('Please enter a URL');
        return;
    }

    if (!folder) {
        showError('Please enter a folder name (series name)');
        return;
    }

    // Set download in progress and update button immediately
    isDownloadingChapter2 = true;
    userStoppedDownload = false;
    downloadBtn.disabled = true;
    testBtn.disabled = true;
    downloadSeriesBtn.disabled = true;
    downloadSeries2Btn.textContent = '⏸️ Dừng';
    downloadSeries2Btn.disabled = false;

    previewSection.style.display = 'none';
    statusSection.style.display = 'block';
    completeSection.style.display = 'none';

    statusMessage.innerHTML =
        `📦 Downloading chapter ${startChapter}... Please wait.`;

    try {
        const response = await fetch('/api/download-series-2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                folder: folder,
                startChapter: startChapter,
                seriesName: folder,
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
        if (!userStoppedDownload) {
            statusSection.style.display = 'none';
            completeSection.style.display = 'block';
        }

        completionMessage.innerHTML = `✓ Chapter ${data.chapter}: ${data.downloadedCount}/${data.totalCount} images`;
        downloadedFolder.textContent = data.folder;
        downloadPath.textContent = `downloads/${data.folder}`;

        // Update URL and Chapter Number for next download
        if (data.nextLink) {
            urlInput.value = data.nextLink;
            startChapterInput.value = startChapter + 1;
            
            // Show notification if tab is not focused
            showNotification('Chapter downloaded', `Chapter ${data.chapter} completed. Ready for next chapter.`);
            
            // Auto-continue to next chapter after 2 seconds (only if user didn't stop)
            if (!userStoppedDownload) {
                setTimeout(() => {
                    if (!userStoppedDownload) {
                        downloadSeries2();
                    }
                }, 2000);
            }
        } else {
            // No next link - series completed
            showNotification('Series completed', `Chapter ${data.chapter} is the last chapter.`);
        }
    } catch (error) {
        console.error('Series 2 download error:', error);
        showError(`Error: ${error.message}`);
    } finally {
        isDownloadingChapter2 = false;
        downloadBtn.disabled = false;
        testBtn.disabled = false;
        downloadSeriesBtn.disabled = false;
        
        // Update button state only if user stopped or no next chapter
        if (userStoppedDownload) {
            downloadSeries2Btn.textContent = '📚 Download Series 2';
            downloadSeries2Btn.disabled = false;
        } else {
            // If auto-continuing, keep the button as is
            // Otherwise reset to normal state
            const hasNextChapter = completeSection.style.display !== 'none';
            if (!hasNextChapter) {
                downloadSeries2Btn.textContent = '📚 Download Series 2';
                downloadSeries2Btn.disabled = false;
            }
        }
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
