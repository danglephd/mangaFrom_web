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
let isDownloadingSeries = false;
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
    // downloadImages();
    getSeriesMangadexInfo();
});

// Download Series Button
downloadSeriesBtn.addEventListener('click', async (e) => {
    if (isDownloadingSeries) {
        // User clicked Stop button while downloading
        userStoppedDownload = true;
        downloadSeriesBtn.disabled = true;
        downloadSeriesBtn.textContent = '📚 Download Mangadex';
    } else {
        await requestNotificationPermission();
        downloadSeriesMangadex();
    }
});

// Download Series 2 Button
downloadSeries2Btn.addEventListener('click', async (e) => {
    if (isDownloadingSeries) {
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
async function getSeriesMangadexInfo() {
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
        const response = await fetch('/api/mangadex-get-manga', {
            // const response = await fetch('/api/download-series-mangadex', {
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
        addLog(`SUCCESS`, 'success');
        addLog(`Manga ID: ${data.mangaId}`, 'info'); 
        addLog(`Chapter: ${data.currentChapter} `, 'info'); 
        addLog(`Volume: ${data.currentVolume}, Next Chapter: ${data.nextChapterUrl}`, 'info');

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
        addLog(`Manga ID: ${data.mangaId}`, 'info'); 
        addLog(`Chapter: ${data.currentChapter} `, 'info'); 
        addLog(`Volume: ${data.currentVolume}`, 'info'); 
        addLog(`Next Chapter: ${data.nextChapterUrl}`, 'info');

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

// Download Series MangaDex 
async function downloadSeriesMangadex() {
    ``
    const url = urlInput.value.trim();
    const folder = folderInput.value.trim();
    const startChapter = parseInt(startChapterInput.value) || 1;

    // Validation
    if (!url || !folder) {
        showError('Vui lòng nhập URL và tên folder');
        return;
    }

    // Cập nhật UI
    isDownloadingSeries = true;
    userStoppedDownload = false;
    updateButtonStates(true, true);

    addLog(`Starting download from: ${url}`, 'info');

    try {
        const response = await fetch('/api/download-series-mangadex', {
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

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Invalid server response');
        }

        // Show success
        addLog(`SUCCESS: Downloaded ${data.downloadedCount} out of ${data.totalCount} images`, 'success');
        addLog(`Manga ID: ${data.mangaId}, Chapter: ${data.currentChapter}, 
            Volume: ${data.currentVolume}, Next Chapter: ${data.nextChapterUrl}`, 'info');
        if (data.error) throw new Error(data.error);

        // Refresh downloaded series combobox
        await loadDownloadedSeries();
        showNotification('Chapter downloaded', `Chapter ${data.chapter} ready`);

        if (data.nextChapterUrl) {
            urlInput.value = data.nextChapterUrl;
            startChapterInput.value = startChapter + 1;
            if (!userStoppedDownload) {
                // Chỉ schedule nếu user chưa stop
                setTimeout(() => {
                    if (!userStoppedDownload && isDownloadingSeries) {
                        downloadSeriesMangadex();
                    }
                }, 2000);
            }
        } else {
            isDownloadingSeries = false;
            userStoppedDownload = true;
            showNotification('Series completed', `Chapter ${data.chapter} finished`);
        }
    } catch (error) {
        console.error('Download error:', error);
        addLog(`ERROR: ${error.message}`, 'error');
        showError(error.message);
        isDownloadingSeries = false;
        userStoppedDownload = true;
    } finally {
        // Luôn reset state nếu không auto-continue
        if (userStoppedDownload || !isDownloadingSeries) {
            updateButtonStates(false, true);
        }
    }
}

// Download Series 2 (Background Job with Polling)
async function downloadSeries2() {
    const url = urlInput.value.trim();
    const folder = folderInput.value.trim();
    const startChapter = parseInt(startChapterInput.value) || 1;

    // Validation
    if (!url || !folder) {
        showError('Vui lòng nhập URL và tên folder');
        return;
    }

    // Update UI
    isDownloadingSeries = true;
    userStoppedDownload = false;
    updateButtonStates(true, false);

    addLog(`Starting download from: ${url}`, 'info');

    try {
        // Step 1: Send download request and get jobId
        const response = await fetch('/api/download-series-2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, folder, startChapter, seriesName: folder }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const jobId = data.jobId;
        addLog(`Job started: ${jobId}`, 'info');
        addLog(`Polling for progress every 3 seconds...`, 'info');

        // Step 2: Poll job status until completion
        const result = await pollJobStatus(jobId, 3000); // Poll every 3 seconds

        // Step 3: Handle completion
        if (result.status === 'completed') {
            addLog(`SUCCESS: Downloaded ${result.downloadedCount} out of ${result.totalCount} images`, 'success');
            addLog(`Folder: ${result.folder}`, 'success');
            
            // Refresh downloaded series combobox
            await loadDownloadedSeries();
            showNotification('Chapter downloaded', `Chapter downloaded successfully`);

            if (result.nextLink) {
                urlInput.value = result.nextLink;
                startChapterInput.value = startChapter + 1;
                if (!userStoppedDownload) {
                    // Auto continue to next chapter
                    setTimeout(() => {
                        if (!userStoppedDownload && isDownloadingSeries) {
                            downloadSeries2();
                        }
                    }, 2000);
                }
            } else {
                isDownloadingSeries = false;
                userStoppedDownload = true;
                showNotification('Series completed', `No more chapters available`);
                addLog(`Series completed: ${result.folder}`, 'success');
            }
        } else if (result.status === 'failed') {
            throw new Error(result.error || 'Job failed');
        }
    } catch (error) {
        console.error('Download error:', error);
        addLog(`ERROR: ${error.message}`, 'error');
        showError(error.message);
        isDownloadingSeries = false;
        userStoppedDownload = true;
    } finally {
        // Reset state if not auto-continuing
        if (userStoppedDownload || !isDownloadingSeries) {
            updateButtonStates(false, false);
        }
    }
}

// Helper function: Poll job status
async function pollJobStatus(jobId, pollingInterval = 3000) {
    return new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/job-status/${jobId}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const job = await response.json();
                
                // Update progress log
                addLog(`[${job.status}] Progress: ${job.progress}% (${job.downloadedCount}/${job.totalCount} images)`, 'info');

                // Check if job is complete
                if (job.status === 'completed' || job.status === 'failed') {
                    clearInterval(pollInterval);
                    
                    if (job.status === 'completed') {
                        // Return result data
                        resolve({
                            status: 'completed',
                            downloadedCount: job.downloadedCount,
                            totalCount: job.totalCount,
                            folder: job.folder,
                            nextLink: job.nextLink,
                            result: job.result,
                        });
                    } else {
                        resolve({
                            status: 'failed',
                            error: job.error,
                        });
                    }
                }
            } catch (error) {
                clearInterval(pollInterval);
                reject(error);
            }
        }, pollingInterval);

        // Timeout after 30 minutes
        setTimeout(() => {
            clearInterval(pollInterval);
            reject(new Error('Job polling timeout (30 minutes)'));
        }, 30 * 60 * 1000);
    });
}


// Helper function
function updateButtonStates(isDownloading, isMangaDex = true) {
    const disabled = isDownloading;
    downloadBtn.disabled = disabled;
    downloadNovelBtn.disabled = disabled;
    if (isMangaDex) {
        downloadSeries2Btn.disabled = disabled;
        if (userStoppedDownload) {
            downloadSeriesBtn.disabled = false;
            downloadSeriesBtn.textContent = '📚 Download Mangadex';
        } else {
            downloadSeriesBtn.disabled = !disabled;
            downloadSeriesBtn.textContent = disabled ? '⏸️ Dừng' : '📚 Download Mangadex';
        }
    } else {
        downloadSeriesBtn.disabled = disabled;
        if (userStoppedDownload) {
            downloadSeries2Btn.disabled = false;
            downloadSeries2Btn.textContent = '📚 Download Series 2';
        } else {
            downloadSeries2Btn.disabled = !disabled;
            downloadSeries2Btn.textContent = disabled ? '⏸️ Dừng' : '📚 Download Series 2';
        }
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
