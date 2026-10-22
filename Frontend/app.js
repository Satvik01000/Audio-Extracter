/**
 * AuraAudio — Pure Vanilla JavaScript Controller
 * Interacts directly with the Go backend at http://localhost:8080/extract
 */

document.addEventListener('DOMContentLoaded', () => {
  // Config: relative path '/extract' when served on port 8080, fallback to 'http://localhost:8080/extract' if opened from file://
  const BACKEND_URL = window.location.origin && window.location.origin.startsWith('http') 
    ? '/extract' 
    : 'http://localhost:8080/extract';

  // DOM Elements - Upload Zone
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadPrompt = document.getElementById('upload-prompt');
  const fileLoadedView = document.getElementById('file-loaded-view');
  const fileNameText = document.getElementById('file-name-text');
  const fileSizeText = document.getElementById('file-size-text');
  const removeFileBtn = document.getElementById('remove-file-btn');

  // DOM Elements - Trim & Workspace
  const trimWorkspace = document.getElementById('trim-workspace');
  const videoPreview = document.getElementById('video-preview');
  const currentPlayheadDisplay = document.getElementById('current-playhead-display');
  const totalDurationDisplay = document.getElementById('total-duration-display');
  const beginInput = document.getElementById('begin-input');
  const endInput = document.getElementById('end-input');
  const setBeginBtn = document.getElementById('set-begin-playhead-btn');
  const setEndBtn = document.getElementById('set-end-playhead-btn');
  const segmentSummary = document.getElementById('segment-summary');
  
  // Presets
  const presetFull = document.getElementById('preset-full');
  const preset30s = document.getElementById('preset-30s');
  const preset60s = document.getElementById('preset-60s');
  const presetClear = document.getElementById('preset-clear');

  // Primary Action & Processing View
  const extractBtn = document.getElementById('extract-btn');
  const processingView = document.getElementById('processing-view');
  const processingMsg = document.getElementById('processing-msg');

  // Result & Audio Player View
  const resultView = document.getElementById('result-view');
  const resultFilenameDisplay = document.getElementById('result-filename-display');
  const extractedAudio = document.getElementById('extracted-audio');
  const audioPlayBtn = document.getElementById('audio-play-btn');
  const iconPlay = audioPlayBtn.querySelector('.icon-play');
  const iconPause = audioPlayBtn.querySelector('.icon-pause');
  const audioCurrentTime = document.getElementById('audio-current-time');
  const audioTotalTime = document.getElementById('audio-total-time');
  const audioSeekSlider = document.getElementById('audio-seek-slider');
  const volumeToggleBtn = document.getElementById('volume-toggle-btn');
  const downloadAudioLink = document.getElementById('download-audio-link');
  const resetWorkspaceBtn = document.getElementById('reset-workspace-btn');

  // Fallback Native Form
  const nativeForm = document.getElementById('native-extract-form');
  const formFileInput = document.getElementById('form-file-input');
  const formBeginInput = document.getElementById('form-begin-input');
  const formEndInput = document.getElementById('form-end-input');

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // State
  let currentFile = null;
  let videoObjectURL = null;
  let extractedAudioObjectURL = null;

  // =========================================================================
  // Drag and Drop & File Upload Handling
  // =========================================================================

  dropZone.addEventListener('click', (e) => {
    // Only trigger file picker if clicked outside the remove button
    if (e.target.closest('#remove-file-btn')) return;
    if (!currentFile) {
      fileInput.click();
    }
  });

  dropZone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !currentFile) {
      e.preventDefault();
      fileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetAll();
  });

  function handleFileSelected(file) {
    currentFile = file;

    // Display file meta
    fileNameText.textContent = file.name;
    fileSizeText.textContent = formatBytes(file.size);
    uploadPrompt.classList.add('hidden');
    fileLoadedView.classList.remove('hidden');

    // Create object URL for instant preview
    if (videoObjectURL) {
      URL.revokeObjectURL(videoObjectURL);
    }
    videoObjectURL = URL.createObjectURL(file);
    videoPreview.src = videoObjectURL;
    videoPreview.load();

    // Reset inputs
    beginInput.value = '';
    endInput.value = '';
    updateSegmentSummary();

    // Hide any previous results
    resultView.classList.add('hidden');
    processingView.classList.add('hidden');
    trimWorkspace.classList.remove('hidden');
  }

  // =========================================================================
  // Video Player Preview & Playhead Tracking
  // =========================================================================

  videoPreview.addEventListener('loadedmetadata', () => {
    const totalDuration = videoPreview.duration;
    totalDurationDisplay.textContent = formatSecondsToTimestamp(totalDuration);
    currentPlayheadDisplay.textContent = formatSecondsToTimestamp(0);
    updateSegmentSummary();
  });

  videoPreview.addEventListener('timeupdate', () => {
    currentPlayheadDisplay.textContent = formatSecondsToTimestamp(videoPreview.currentTime);
  });

  // Use Playhead Buttons
  setBeginBtn.addEventListener('click', () => {
    if (!videoPreview.duration) return;
    const sec = Math.floor(videoPreview.currentTime);
    beginInput.value = `${sec}s`;
    setActivePreset(null);
    updateSegmentSummary();
    showToast(`Start position set to ${sec}s`, 'success');
  });

  setEndBtn.addEventListener('click', () => {
    if (!videoPreview.duration) return;
    const sec = Math.ceil(videoPreview.currentTime);
    endInput.value = `${sec}s`;
    setActivePreset(null);
    updateSegmentSummary();
    showToast(`End position set to ${sec}s`, 'success');
  });

  beginInput.addEventListener('input', () => {
    setActivePreset(null);
    updateSegmentSummary();
  });

  endInput.addEventListener('input', () => {
    setActivePreset(null);
    updateSegmentSummary();
  });

  // Presets
  presetFull.addEventListener('click', () => {
    beginInput.value = '';
    endInput.value = '';
    setActivePreset(presetFull);
    updateSegmentSummary();
  });

  preset30s.addEventListener('click', () => {
    beginInput.value = '0s';
    endInput.value = '30s';
    setActivePreset(preset30s);
    updateSegmentSummary();
  });

  preset60s.addEventListener('click', () => {
    beginInput.value = '0s';
    endInput.value = '60s';
    setActivePreset(preset60s);
    updateSegmentSummary();
  });

  presetClear.addEventListener('click', () => {
    beginInput.value = '';
    endInput.value = '';
    setActivePreset(presetFull);
    updateSegmentSummary();
  });

  function setActivePreset(activeBtn) {
    [presetFull, preset30s, preset60s, presetClear].forEach(btn => btn.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
  }

  function updateSegmentSummary() {
    const b = beginInput.value.trim();
    const e = endInput.value.trim();
    if (!b && !e) {
      segmentSummary.textContent = 'Full Audio Track';
    } else if (b && !e) {
      segmentSummary.textContent = `From ${b} to End`;
    } else if (!b && e) {
      segmentSummary.textContent = `Start to ${e}`;
    } else {
      segmentSummary.textContent = `${b} → ${e}`;
    }
  }

  // =========================================================================
  // Extraction Execution (AJAX fetch + Native Fallback)
  // =========================================================================

  extractBtn.addEventListener('click', async () => {
    if (!currentFile) {
      showToast('Please select or drop a video file first.', 'error');
      return;
    }

    const beginVal = beginInput.value.trim();
    const endVal = endInput.value.trim();

    // Prepare UI state
    trimWorkspace.classList.add('hidden');
    resultView.classList.add('hidden');
    processingView.classList.remove('hidden');
    processingMsg.textContent = `Extracting audio from ${currentFile.name}...`;

    const formData = new FormData();
    formData.append('file', currentFile);
    if (beginVal) formData.append('begin', beginVal);
    if (endVal) formData.append('end', endVal);

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server responded with status ${response.status}`);
      }

      // Read audio blob
      const audioBlob = await response.blob();
      const outputFilename = `output_${currentFile.name.substring(0, currentFile.name.lastIndexOf('.')) || currentFile.name}.mp3`;

      setupAudioResult(audioBlob, outputFilename);
      showToast('Audio extracted successfully!', 'success');

    } catch (err) {
      console.warn('Direct fetch failed or was blocked by browser:', err);
      
      // If error might be CORS (e.g. running from file:// or different port without proxy),
      // we offer seamless native form download as an automatic fallback!
      handleFetchFallback(err, beginVal, endVal);
    }
  });

  function handleFetchFallback(error, beginVal, endVal) {
    // Check if error is network/CORS related
    const isNetworkError = error instanceof TypeError || error.message.includes('Failed to fetch');

    if (isNetworkError) {
      processingMsg.textContent = 'Triggering direct browser download via backend...';
      
      try {
        // Populate and submit native form
        const dt = new DataTransfer();
        dt.items.add(currentFile);
        formFileInput.files = dt.files;
        formBeginInput.value = beginVal;
        formEndInput.value = endVal;

        nativeForm.action = BACKEND_URL;
        nativeForm.submit();

        setTimeout(() => {
          processingView.classList.add('hidden');
          trimWorkspace.classList.remove('hidden');
          showToast('Extraction started! Your browser will prompt to save the MP3.', 'success');
        }, 1500);

      } catch (nativeErr) {
        processingView.classList.add('hidden');
        trimWorkspace.classList.remove('hidden');
        showToast(`Extraction failed: ${error.message}. Is backend running on localhost:8080?`, 'error');
      }
    } else {
      processingView.classList.add('hidden');
      trimWorkspace.classList.remove('hidden');
      showToast(`Extraction error: ${error.message}`, 'error');
    }
  }

  function setupAudioResult(blob, filename) {
    if (extractedAudioObjectURL) {
      URL.revokeObjectURL(extractedAudioObjectURL);
    }
    extractedAudioObjectURL = URL.createObjectURL(blob);
    extractedAudio.src = extractedAudioObjectURL;
    extractedAudio.load();

    resultFilenameDisplay.textContent = filename;
    downloadAudioLink.href = extractedAudioObjectURL;
    downloadAudioLink.download = filename;

    // Show result view
    processingView.classList.add('hidden');
    resultView.classList.remove('hidden');
  }

  // =========================================================================
  // Custom Audio Player Controls
  // =========================================================================

  audioPlayBtn.addEventListener('click', () => {
    if (extractedAudio.paused) {
      extractedAudio.play();
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
    } else {
      extractedAudio.pause();
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
    }
  });

  extractedAudio.addEventListener('loadedmetadata', () => {
    audioTotalTime.textContent = formatSecondsToMMSS(extractedAudio.duration);
    audioSeekSlider.max = extractedAudio.duration || 100;
  });

  extractedAudio.addEventListener('timeupdate', () => {
    audioCurrentTime.textContent = formatSecondsToMMSS(extractedAudio.currentTime);
    audioSeekSlider.value = extractedAudio.currentTime;
  });

  extractedAudio.addEventListener('ended', () => {
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    audioSeekSlider.value = 0;
  });

  audioSeekSlider.addEventListener('input', () => {
    extractedAudio.currentTime = audioSeekSlider.value;
  });

  volumeToggleBtn.addEventListener('click', () => {
    extractedAudio.muted = !extractedAudio.muted;
    volumeToggleBtn.style.opacity = extractedAudio.muted ? '0.4' : '1';
  });

  resetWorkspaceBtn.addEventListener('click', () => {
    resetAll();
  });

  // =========================================================================
  // Reset & Cleanup Helpers
  // =========================================================================

  function resetAll() {
    currentFile = null;
    fileInput.value = '';

    if (videoObjectURL) {
      URL.revokeObjectURL(videoObjectURL);
      videoObjectURL = null;
    }
    if (extractedAudioObjectURL) {
      URL.revokeObjectURL(extractedAudioObjectURL);
      extractedAudioObjectURL = null;
    }

    videoPreview.pause();
    videoPreview.src = '';
    extractedAudio.pause();
    extractedAudio.src = '';

    uploadPrompt.classList.remove('hidden');
    fileLoadedView.classList.add('hidden');
    trimWorkspace.classList.add('hidden');
    processingView.classList.add('hidden');
    resultView.classList.add('hidden');
  }

  // =========================================================================
  // Utility Functions
  // =========================================================================

  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatSecondsToTimestamp(totalSec) {
    if (isNaN(totalSec) || totalSec < 0) return '00:00:00';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function formatSecondsToMMSS(totalSec) {
    if (isNaN(totalSec) || totalSec < 0) return '00:00';
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconSvg = type === 'error' 
      ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
