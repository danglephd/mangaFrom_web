// Dom Elements
const urlInput = document.getElementById('url');
const folderInput = document.getElementById('folder');
const startChapterInput = document.getElementById('startChapter');
const downloadedSeriesCombo = document.getElementById('downloadedSeriesCombo');
const downloadBtn = document.getElementById('downloadBtn');
const downloadSeriesBtn = document.getElementById('downloadSeriesBtn');
const downloadSeries2Btn = document.getElementById('downloadSeries2Btn');
const downloadNovelBtn = document.getElementById('downloadNovelBtn');

const historyContainer = document.getElementById('historyContainer');
const copyHistoryBtn = document.getElementById('copyHistoryBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

let notificationPermissionRequested = false;
let isDownloadingChapter2 = false;
let isDownloadingNovel = false;
let userStoppedDownload = false;
let downloadedSeriesData = [];

// Add Log Function
function addLog(message, type = "info") {
    const entry = document.createElement('div');
    entry.className = `history-log-entry ${type}`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    entry.textContent = `[${timeStr}] ${message}`;

    // Prepend to container (newest first)
    historyContainer.insertBefore(entry, historyContainer.firstChild);
}

// Load Downloaded Series Data
async function loadDownloadedSeries() {
    try {
        const response = await fetch('/api/get-downloaded-series');
        if (!response.ok) throw new Error('Failed to load downloaded series');

        const result = await response.json();
        downloadedSeriesData = result.data || [];
        populateDownloadedSeriesCombo();
    } catch (error) {
        console.error('Error loading downloaded series:', error);
    }
}

// Populate Combobox
function populateDownloadedSeriesCombo() {
    // Clear existing options (keep the placeholder)
    const options = downloadedSeriesCombo.querySelectorAll('option');
    options.forEach((option, index) => {
        if (index > 0) option.remove();
    });

    // Add new options
    downloadedSeriesData.forEach((item) => {
        const option = document.createElement('option');
        option.value = JSON.stringify(item);
        option.textContent = `${item.series_name}/Chapter ${item.chapter}`;
        downloadedSeriesCombo.appendChild(option);
    });
}

// Handle Combobox Selection
downloadedSeriesCombo.addEventListener('change', (e) => {
    if (!e.target.value) return;

    try {
        const selectedData = JSON.parse(e.target.value);
        urlInput.value = selectedData.url;
        folderInput.value = selectedData.series_name;
        startChapterInput.value = selectedData.chapter;
    } catch (error) {
        console.error('Error parsing selected data:', error);
    }
});

// Copy History to Clipboard
copyHistoryBtn.addEventListener('click', () => {
    const allLogs = Array.from(historyContainer.querySelectorAll('.history-log-entry'))
        .reverse()
        .map(entry => entry.textContent)
        .join('\n');

    if (!allLogs) {
        showError('No logs to copy');
        return;
    }

    navigator.clipboard.writeText(allLogs).then(() => {
        addLog('Logs copied to clipboard', 'success');
    }).catch(err => {
        addLog('Failed to copy logs', 'error');
        console.error('Clipboard error:', err);
    });
});

// Clear History
clearHistoryBtn.addEventListener('click', () => {
    historyContainer.innerHTML = '';
    addLog('History cleared', 'info');
});

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

// Download Novel Button
downloadNovelBtn.addEventListener('click', async (e) => {
    if (isDownloadingNovel) {
        // User clicked Stop button while downloading
        userStoppedDownload = true;
        downloadNovelBtn.disabled = true;
        downloadNovelBtn.textContent = '📖 Download Novel';
    } else {
        await requestNotificationPermission();
        downloadNovel();
    }
});

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

    addLog(`Starting download from: ${url}`, 'info');

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
            addLog(`ERROR: ${data.error}`, 'error');
            showError(`Error: ${data.error}`);
            return;
        }

        // Show success
        addLog(`SUCCESS: Downloaded ${data.downloadedCount} out of ${data.totalCount} images`, 'success');

        // Show notification if tab is not focused
        showNotification('Download complete', `Downloaded ${data.downloadedCount} images`);

        // Refresh downloaded series combobox
        await loadDownloadedSeries();
    } catch (error) {
        console.error('Download error:', error);
        addLog(`ERROR: ${error.message}`, 'error');
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

    addLog(`Starting download from: ${url}`, 'info');

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
            addLog(`ERROR: ${data.error}`, 'error');
            showError(`Error: ${data.error}`);
            return;
        }

        // Show success
        let downloadedTotal = 0;
        data.results.forEach((r) => {
            downloadedTotal += r.downloadedCount;
        });
        addLog(`SUCCESS: Downloaded ${downloadedTotal} images from ${data.totalChapters} chapters`, 'success');

        // Show notification if tab is not focused
        showNotification('Series download complete', `Processed ${data.totalChapters} chapters`);

        // Refresh downloaded series combobox
        await loadDownloadedSeries();
    } catch (error) {
        console.error('Series download error:', error);
        addLog(`ERROR: ${error.message}`, 'error');
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

    // Validation
    if (!url || !folder) {
        showError('Vui lòng nhập URL và tên folder');
        return;
    }

    // Cập nhật UI
    isDownloadingChapter2 = true;
    userStoppedDownload = false;
    updateButtonStates(true);

    addLog(`Starting download from: ${url}`, 'info');

    try {
        const response = await fetch('/api/download-series-2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, folder, startChapter, seriesName: folder }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Invalid server response');
        }

        if (data.error) throw new Error(data.error);

        addLog(`SUCCESS: Downloaded ${data.downloadedCount} images`, 'success');

        // Refresh downloaded series combobox
        await loadDownloadedSeries();
        showNotification('Chapter downloaded', `Chapter ${data.chapter} ready`);

        if (data.nextLink){
            urlInput.value = data.nextLink;
            startChapterInput.value = startChapter + 1;
            if(!userStoppedDownload) {
                // Chỉ schedule nếu user chưa stop
                setTimeout(() => {
                    if (!userStoppedDownload && isDownloadingChapter2) {
                        downloadSeries2();
                    }
                }, 2000);
            }
        } else {
            isDownloadingChapter2 = false;
            userStoppedDownload = true;
            showNotification('Series completed', `Chapter ${data.chapter} finished`);
        }
    } catch (error) {
        console.error('Download error:', error);
        addLog(`ERROR: ${error.message}`, 'error');
        showError(error.message);
        isDownloadingChapter2 = false;
        userStoppedDownload = true;
    } finally {
        // Luôn reset state nếu không auto-continue
        if (userStoppedDownload || !isDownloadingChapter2) {
            updateButtonStates(false);
        }
    }
}

// Helper function
function updateButtonStates(isDownloading) {
    const disabled = isDownloading;
    downloadBtn.disabled = disabled;
    downloadSeriesBtn.disabled = disabled;
    downloadNovelBtn.disabled = disabled;
    if (userStoppedDownload) {
        downloadSeries2Btn.disabled = false;
        downloadSeries2Btn.textContent = '📚 Download Series 2';
    } else {
        downloadSeries2Btn.disabled = !disabled;
        downloadSeries2Btn.textContent = disabled ? '⏸️ Dừng' : '📚 Download Series 2';
    }
}

// Download Novel (scrape and save to database)
async function downloadNovel() {
    const url = urlInput.value.trim();
    const folder = folderInput.value.trim();
    const seriesName = folder;
    const startChapter = parseInt(startChapterInput.value) || 1;


    if (!url) {
        showError('Please enter a URL');
        return;
    }

    if (!folder) {
        showError('Please enter a folder/series name');
        return;
    }

    // Set download in progress and update button immediately
    isDownloadingNovel = true;
    userStoppedDownload = false;
    downloadBtn.disabled = true;
    downloadSeriesBtn.disabled = true;
    downloadSeries2Btn.disabled = true;
    downloadNovelBtn.textContent = '⏸️ Dừng';
    downloadNovelBtn.disabled = false;

    addLog(`Starting download from: ${url}`, 'info');

    try {
        const response = await fetch('/api/download-novel-series', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                folder: folder,
                seriesName: seriesName,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            addLog(`ERROR: ${data.error}`, 'error');
            showError(`Error: ${data.error}`);
            return;
        }

        // Show success
        addLog(`SUCCESS: Chapter ${data.chapter_number} - ${data.title}`, 'success');
        showNotification('Chapter saved', `Chapter ${data.chapter_number} saved to database successfully.`);

        // Refresh downloaded series combobox
        await loadDownloadedSeries();

        if (data.nextLink) {
            urlInput.value = data.nextLink;
            startChapterInput.value = startChapter + 1;

            showNotification(
                'Chapter saved',
                `Ready for next chapter.`
            );

            if (!userStoppedDownload) {
                setTimeout(() => {
                    if (!userStoppedDownload) {
                        downloadNovel();
                    }
                }, 2000);
            }
        } else {
            showNotification(
                'Series completed',
                `Chapter ${data.chapter_number} is the last chapter.`
            );
        }

    } catch (error) {
        console.error('Novel download error:', error);
        addLog(`ERROR: ${error.message}`, 'error');
        showError(`Error: ${error.message}`);
    } finally {
        isDownloadingNovel = false;
        downloadBtn.disabled = false;
        downloadSeriesBtn.disabled = false;
        downloadSeries2Btn.disabled = false;
        downloadNovelBtn.textContent = '📖 Download Novel';
        downloadNovelBtn.disabled = false;
    }
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDownloadedSeries();
});
