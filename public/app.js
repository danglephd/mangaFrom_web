// Dom Elements
const urlInput = document.getElementById('url');
const folderInput = document.getElementById('folder');
const startChapterInput = document.getElementById('startChapter');
const downloadBtn = document.getElementById('downloadBtn');
const downloadSeriesBtn = document.getElementById('downloadSeriesBtn');
const downloadSeries2Btn = document.getElementById('downloadSeries2Btn');

const historyContainer = document.getElementById('historyContainer');
const copyHistoryBtn = document.getElementById('copyHistoryBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

let notificationPermissionRequested = false;
let isDownloadingChapter2 = false;
let userStoppedDownload = false;

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
    downloadSeriesBtn.disabled = true;
    downloadSeries2Btn.textContent = '⏸️ Dừng';
    downloadSeries2Btn.disabled = false;

    addLog(`Starting download from: ${url}`, 'info');

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
            addLog(`ERROR: ${data.error}`, 'error');
            showError(`Error: ${data.error}`);
            return;
        }

        // Show success
        addLog(`SUCCESS: Downloaded ${data.downloadedCount} images`, 'success');

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
        addLog(`ERROR: ${error.message}`, 'error');
        showError(`Error: ${error.message}`);
    } finally {
        isDownloadingChapter2 = false;
        downloadBtn.disabled = false;
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
