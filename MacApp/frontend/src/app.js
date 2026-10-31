/**
 * Audio Extractor — macOS Desktop Application Frontend
 * Clean matte dark theme, JetBrains Mono font, pure Vanilla JS.
 * Integrated with Wails v2 native Go runtime & WKWebView.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if running inside Wails Desktop App
  const isWails = () => Boolean(window.go && window.go.main && window.go.main.App);

  // Status & Badges
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');

  // Upload & File Bar
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadPrompt = document.getElementById('upload-prompt');
  const fileLoadedView = document.getElementById('file-loaded-view');
  const fileNameText = document.getElementById('file-name-text');
  const fileSizeText = document.getElementById('file-size-text');
  const changeFileBtn = document.getElementById('change-file-btn');
  const removeFileBtn = document.getElementById('remove-file-btn');

  // Hidden Media Engine & Readouts
  const trimWorkspace = document.getElementById('trim-workspace');
  const videoPreview = document.getElementById('video-preview');
  const currentPlayheadDisplay = document.getElementById('current-playhead-display');
  const totalDurationDisplay = document.getElementById('total-duration-display');

  // Transport & Timeline
  const waveformContainer = document.getElementById('waveform-container');
  const waveformCanvas = document.getElementById('waveform-canvas');
  const timeRuler = document.getElementById('time-ruler');
  const dimmedLeft = document.getElementById('dimmed-left');
  const dimmedRight = document.getElementById('dimmed-right');
  const selectedRegion = document.getElementById('selected-region');
  const handleLeft = document.getElementById('handle-left');
  const handleRight = document.getElementById('handle-right');
  const tooltipLeft = document.getElementById('tooltip-left');
  const tooltipRight = document.getElementById('tooltip-right');
  const timelinePlayhead = document.getElementById('timeline-playhead');

  const playSelectionBtn = document.getElementById('play-selection-btn');
  const playSelectionLabel = document.getElementById('play-selection-label');
  const loopSelectionBtn = document.getElementById('loop-selection-btn');
  const mutePreviewBtn = document.getElementById('mute-preview-btn');
  const rangeDurationText = document.getElementById('range-duration-text');
  const rangeLengthText = document.getElementById('range-length-text');

  // Inputs, Nudges & Presets
  const beginInput = document.getElementById('begin-input');
  const endInput = document.getElementById('end-input');
  const setBeginBtn = document.getElementById('set-begin-playhead-btn');
  const setEndBtn = document.getElementById('set-end-playhead-btn');
  const nudgeStartMinus = document.getElementById('nudge-start-minus');
  const nudgeStartPlus = document.getElementById('nudge-start-plus');
  const nudgeEndMinus = document.getElementById('nudge-end-minus');
  const nudgeEndPlus = document.getElementById('nudge-end-plus');

  const segmentSummary = document.getElementById('segment-summary');
  const presetFull = document.getElementById('preset-full');
  const preset30s = document.getElementById('preset-30s');
  const preset60s = document.getElementById('preset-60s');
  const presetClear = document.getElementById('preset-clear');

  // Extract Action & Processing
  const extractBtn = document.getElementById('extract-btn');
  const extractBtnText = document.getElementById('extract-btn-text');
  const saveLocationToggle = document.getElementById('save-location-toggle');
  const saveOptionHint = document.getElementById('save-option-hint');
  const processingView = document.getElementById('processing-view');
  const processingMsg = document.getElementById('processing-msg');

  // Result View
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
  const saveResultBtn = document.getElementById('save-result-btn');
  const saveResultText = document.getElementById('save-result-text');
  const revealFinderBtn = document.getElementById('reveal-finder-btn');
  const downloadAudioLink = document.getElementById('download-audio-link');
  const resetWorkspaceBtn = document.getElementById('reset-workspace-btn');
  const backToTrimBtn = document.getElementById('back-to-trim-btn');

  // Hidden Fallback Form
  const nativeForm = document.getElementById('native-extract-form');
  const formFileInput = document.getElementById('form-file-input');
  const formBeginInput = document.getElementById('form-begin-input');
  const formEndInput = document.getElementById('form-end-input');

  const toastContainer = document.getElementById('toast-container');

  // Application State
  let currentFile = null;               // File object (web) or { name, size, sizeFormatted, path } (Wails)
  let currentNativePath = '';           // Absolute file path on macOS disk
  let lastExtractedPath = '';           // Output MP3 path on macOS disk
  let lastOutputFilename = 'output.mp3';
  let lastExtractedBlob = null;         // For web fallback
  let videoObjectURL = null;
  let extractedAudioObjectURL = null;
  let totalMediaDuration = 0;
  let beginSeconds = 0;
  let endSeconds = 0;
  let isTestingSelection = false;
  let isLoopingSelection = false;
  let waveformPeaks = [];

  // =========================================================================
  // Desktop Environment Initialization
  // =========================================================================

  function initEnvironment() {
    if (isWails()) {
      setStatus('macOS native');
      if (saveOptionHint) {
        saveOptionHint.textContent = 'NSSavePanel';
      }
      if (revealFinderBtn) {
        revealFinderBtn.classList.remove('hidden');
      }

      // Listen for Finder file drop events delivered by Wails
      if (window.runtime && window.runtime.EventsOn) {
        window.runtime.EventsOn('file-dropped', (details) => {
          if (details && details.path) {
            handleNativeFileChosen(details);
          }
        });
      }
    } else {
      setStatus('ready');
      if (revealFinderBtn) {
        revealFinderBtn.classList.add('hidden');
      }
    }
  }

  // Allow Wails runtime a brief moment to inject bindings if needed
  setTimeout(initEnvironment, 60);

  // =========================================================================
  // File Selection (Native macOS Dialog + Finder Drag-and-Drop)
  // =========================================================================

  async function openFileSelector() {
    if (isWails()) {
      try {
        const details = await window.go.main.App.SelectFile();
        if (details && details.path) {
          handleNativeFileChosen(details);
        }
      } catch (err) {
        console.error('File dialog error:', err);
        showToast(`Failed selecting file: ${err}`, 'error');
      }
    } else {
      fileInput.click();
    }
  }

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#remove-file-btn') || e.target.closest('#change-file-btn')) return;
    if (!currentFile) {
      openFileSelector();
    }
  });

  changeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openFileSelector();
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetAll();
  });

  // Browser file input fallback
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleWebFileChosen(e.target.files[0]);
    }
  });

  // HTML5 drag and drop (fallback for web mode)
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (isWails()) {
      // Wails OnFileDrop handler manages Finder file drops natively
      return;
    }
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleWebFileChosen(files[0]);
    }
  });

  // Handle file chosen via native macOS dialog or Finder drag-and-drop
  function handleNativeFileChosen(details) {
    stopTestingSelection();
    currentNativePath = details.path;
    currentFile = {
      name: details.name,
      size: details.size,
      sizeFormatted: details.sizeFormatted || formatBytes(details.size),
      path: details.path
    };

    fileNameText.textContent = details.name;
    fileSizeText.textContent = details.sizeFormatted || formatBytes(details.size);
    uploadPrompt.classList.add('hidden');
    fileLoadedView.classList.remove('hidden');

    // Load file preview via streaming asset server route
    const streamUrl = `/media-file?path=${encodeURIComponent(details.path)}`;
    videoPreview.src = streamUrl;
    videoPreview.load();

    resultView.classList.add('hidden');
    processingView.classList.add('hidden');
    trimWorkspace.classList.remove('hidden');
    setStatus('loaded');

    // Generate waveform peaks
    generatePlaceholderPeaks();
    drawWaveform();
    tryFetchAudioPeaks(streamUrl);
  }

  // Handle file chosen via standard HTML5 file picker (Web fallback)
  function handleWebFileChosen(file) {
    stopTestingSelection();
    currentNativePath = '';
    currentFile = file;

    fileNameText.textContent = file.name;
    fileSizeText.textContent = formatBytes(file.size);
    uploadPrompt.classList.add('hidden');
    fileLoadedView.classList.remove('hidden');

    if (videoObjectURL) {
      URL.revokeObjectURL(videoObjectURL);
    }
    videoObjectURL = URL.createObjectURL(file);
    videoPreview.src = videoObjectURL;
    videoPreview.load();

    resultView.classList.add('hidden');
    processingView.classList.add('hidden');
    trimWorkspace.classList.remove('hidden');
    setStatus('loaded');

    extractWaveformFromFile(file);
  }

  function setStatus(state) {
    if (statusText) {
      statusText.textContent = state;
    }
  }

  // =========================================================================
  // Media Engine Synchronization
  // =========================================================================

  videoPreview.addEventListener('loadedmetadata', () => {
    totalMediaDuration = videoPreview.duration || 1;
    totalDurationDisplay.textContent = formatSecondsToMMSS(totalMediaDuration);
    currentPlayheadDisplay.textContent = formatSecondsToMMSS(0);

    beginSeconds = 0;
    endSeconds = totalMediaDuration;
    beginInput.value = '0s';
    endInput.value = `${Math.ceil(totalMediaDuration)}s`;

    initTimeRuler(totalMediaDuration);
    setActivePreset(presetFull);
    updateTimelineUI();
  });

  videoPreview.addEventListener('timeupdate', () => {
    const curr = videoPreview.currentTime;
    currentPlayheadDisplay.textContent = formatSecondsToMMSS(curr);

    if (totalMediaDuration > 0) {
      const playRatio = Math.max(0, Math.min(curr / totalMediaDuration, 1));
      timelinePlayhead.style.left = `${playRatio * 100}%`;
    }

    if (isTestingSelection) {
      if (curr >= endSeconds || curr < beginSeconds - 0.25) {
        if (isLoopingSelection) {
          videoPreview.currentTime = beginSeconds;
        } else {
          stopTestingSelection();
          videoPreview.currentTime = beginSeconds;
        }
      }
    }
  });

  videoPreview.addEventListener('ended', () => {
    if (isLoopingSelection && isTestingSelection) {
      videoPreview.currentTime = beginSeconds;
      videoPreview.play();
    } else {
      stopTestingSelection();
    }
  });

  // =========================================================================
  // Dual-Pointer Timeline Logic
  // =========================================================================

  function updateTimelineUI() {
    if (!totalMediaDuration || totalMediaDuration <= 0) return;

    const startRatio = Math.max(0, Math.min(beginSeconds / totalMediaDuration, 1));
    const endRatio = Math.max(startRatio, Math.min(endSeconds / totalMediaDuration, 1));

    handleLeft.style.left = `${startRatio * 100}%`;
    handleRight.style.left = `${endRatio * 100}%`;

    dimmedLeft.style.width = `${startRatio * 100}%`;
    dimmedRight.style.width = `${(1 - endRatio) * 100}%`;

    selectedRegion.style.left = `${startRatio * 100}%`;
    selectedRegion.style.width = `${Math.max(0, (endRatio - startRatio) * 100)}%`;

    tooltipLeft.textContent = formatSecondsToMMSS(beginSeconds);
    tooltipRight.textContent = formatSecondsToMMSS(endSeconds);

    // Prevent pointer heads from colliding when pointers are close
    const startHead = handleLeft.querySelector('.pointer-head');
    const endHead = handleRight.querySelector('.pointer-head');
    if (startHead && endHead) {
      if (endRatio - startRatio < 0.14) {
        startHead.style.transform = 'translateX(-45%)';
        endHead.style.transform = 'translateX(45%)';
      } else {
        startHead.style.transform = startRatio < 0.06 ? 'translateX(20%)' : 'translateX(0)';
        endHead.style.transform = endRatio > 0.94 ? 'translateX(-20%)' : 'translateX(0)';
      }
    }

    const diff = Math.max(0, endSeconds - beginSeconds);
    rangeDurationText.textContent = `${formatSecondsToMMSS(beginSeconds)} → ${formatSecondsToMMSS(endSeconds)}`;
    rangeLengthText.textContent = formatSecondsToReadable(diff);

    updateSegmentSummary();
    drawWaveform();
  }

  // Pointer 1: START
  handleLeft.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handleLeft.setPointerCapture(e.pointerId);
    handleLeft.classList.add('dragging');
    stopTestingSelection();
  });

  handleLeft.addEventListener('pointermove', (e) => {
    if (!handleLeft.hasPointerCapture(e.pointerId)) return;
    const rect = waveformContainer.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    const maxBegin = Math.max(0, endSeconds - 0.2);
    beginSeconds = Math.max(0, Math.min(ratio * totalMediaDuration, maxBegin));

    beginInput.value = `${beginSeconds.toFixed(1)}s`;
    videoPreview.currentTime = beginSeconds;
    setActivePreset(null);
    updateTimelineUI();
  });

  const onLeftRelease = () => {
    if (!handleLeft.classList.contains('dragging')) return;
    handleLeft.classList.remove('dragging');
    beginInput.value = `${Math.round(beginSeconds)}s`;
    updateTimelineUI();
  };
  handleLeft.addEventListener('lostpointercapture', onLeftRelease);
  handleLeft.addEventListener('pointerup', onLeftRelease);
  handleLeft.addEventListener('pointercancel', onLeftRelease);

  handleLeft.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nudgeStart(-step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nudgeStart(step);
    }
  });

  // Pointer 2: END
  handleRight.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handleRight.setPointerCapture(e.pointerId);
    handleRight.classList.add('dragging');
    stopTestingSelection();
  });

  handleRight.addEventListener('pointermove', (e) => {
    if (!handleRight.hasPointerCapture(e.pointerId)) return;
    const rect = waveformContainer.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    const minEnd = Math.min(totalMediaDuration, beginSeconds + 0.2);
    endSeconds = Math.min(totalMediaDuration, Math.max(ratio * totalMediaDuration, minEnd));

    endInput.value = `${endSeconds.toFixed(1)}s`;
    videoPreview.currentTime = endSeconds;
    setActivePreset(null);
    updateTimelineUI();
  });

  const onRightRelease = () => {
    if (!handleRight.classList.contains('dragging')) return;
    handleRight.classList.remove('dragging');
    endInput.value = `${Math.round(endSeconds)}s`;
    updateTimelineUI();
  };
  handleRight.addEventListener('lostpointercapture', onRightRelease);
  handleRight.addEventListener('pointerup', onRightRelease);
  handleRight.addEventListener('pointercancel', onRightRelease);

  handleRight.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nudgeEnd(-step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nudgeEnd(step);
    }
  });

  // Drag Selected Window or Click to Seek
  let windowDragStartX = 0;
  let initialBegin = 0;
  let initialEnd = 0;
  let hasDraggedSelection = false;

  selectedRegion.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.drag-pointer')) return;
    e.preventDefault();
    selectedRegion.setPointerCapture(e.pointerId);
    selectedRegion.classList.add('dragging');
    windowDragStartX = e.clientX;
    initialBegin = beginSeconds;
    initialEnd = endSeconds;
    hasDraggedSelection = false;
    stopTestingSelection();
  });

  selectedRegion.addEventListener('pointermove', (e) => {
    if (!selectedRegion.hasPointerCapture(e.pointerId)) return;
    const rect = waveformContainer.getBoundingClientRect();
    const deltaX = e.clientX - windowDragStartX;
    if (Math.abs(deltaX) > 3) {
      hasDraggedSelection = true;
    }
    if (!hasDraggedSelection) return;

    const deltaSec = (deltaX / rect.width) * totalMediaDuration;
    const span = initialEnd - initialBegin;

    let newBegin = initialBegin + deltaSec;
    let newEnd = initialEnd + deltaSec;

    if (newBegin < 0) {
      newBegin = 0;
      newEnd = Math.min(totalMediaDuration, span);
    }
    if (newEnd > totalMediaDuration) {
      newEnd = totalMediaDuration;
      newBegin = Math.max(0, totalMediaDuration - span);
    }

    beginSeconds = newBegin;
    endSeconds = newEnd;
    beginInput.value = `${Math.round(beginSeconds)}s`;
    endInput.value = `${Math.round(endSeconds)}s`;
    videoPreview.currentTime = beginSeconds;
    setActivePreset(null);
    updateTimelineUI();
  });

  const onSelectionRelease = () => {
    if (!selectedRegion.classList.contains('dragging')) return;
    selectedRegion.classList.remove('dragging');

    if (!hasDraggedSelection && totalMediaDuration > 0) {
      const rect = waveformContainer.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(windowDragStartX - rect.left, rect.width));
      videoPreview.currentTime = (clickX / rect.width) * totalMediaDuration;
    }
  };
  selectedRegion.addEventListener('lostpointercapture', onSelectionRelease);
  selectedRegion.addEventListener('pointerup', onSelectionRelease);
  selectedRegion.addEventListener('pointercancel', onSelectionRelease);

  // Click Outside Selection on Track to Seek Playhead
  waveformContainer.addEventListener('click', (e) => {
    if (e.target.closest('.drag-pointer') || e.target.closest('.selected-region')) return;
    const rect = waveformContainer.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    videoPreview.currentTime = (x / rect.width) * totalMediaDuration;
  });

  // =========================================================================
  // Transport Controls
  // =========================================================================

  playSelectionBtn.addEventListener('click', () => {
    if (isTestingSelection) {
      stopTestingSelection();
    } else {
      startTestingSelection();
    }
  });

  loopSelectionBtn.addEventListener('click', () => {
    isLoopingSelection = !isLoopingSelection;
    loopSelectionBtn.classList.toggle('active', isLoopingSelection);
  });

  mutePreviewBtn.addEventListener('click', () => {
    videoPreview.muted = !videoPreview.muted;
    mutePreviewBtn.querySelector('.icon-vol-on').classList.toggle('hidden', videoPreview.muted);
    mutePreviewBtn.querySelector('.icon-vol-off').classList.toggle('hidden', !videoPreview.muted);
  });

  // Spacebar shortcut for previewing selection
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName)) {
      if (currentFile && !trimWorkspace.classList.contains('hidden')) {
        e.preventDefault();
        playSelectionBtn.click();
      }
    }
  });

  function startTestingSelection() {
    if (!totalMediaDuration) return;
    isTestingSelection = true;
    playSelectionBtn.classList.add('playing');
    playSelectionBtn.querySelector('.icon-play').classList.add('hidden');
    playSelectionBtn.querySelector('.icon-pause').classList.remove('hidden');
    if (playSelectionLabel) playSelectionLabel.textContent = 'Pause';

    if (videoPreview.currentTime < beginSeconds || videoPreview.currentTime >= endSeconds - 0.15) {
      videoPreview.currentTime = beginSeconds;
    }
    videoPreview.play();
    setStatus('playing');
  }

  function stopTestingSelection() {
    if (!isTestingSelection) return;
    isTestingSelection = false;
    playSelectionBtn.classList.remove('playing');
    playSelectionBtn.querySelector('.icon-play').classList.remove('hidden');
    playSelectionBtn.querySelector('.icon-pause').classList.add('hidden');
    if (playSelectionLabel) playSelectionLabel.textContent = 'Play Selection';
    videoPreview.pause();
    if (currentFile) setStatus('loaded');
  }

  // =========================================================================
  // Inputs, Nudges & Presets
  // =========================================================================

  function nudgeStart(delta) {
    if (!totalMediaDuration) return;
    beginSeconds = Math.max(0, Math.min(beginSeconds + delta, endSeconds - 0.2));
    beginInput.value = `${Math.round(beginSeconds)}s`;
    videoPreview.currentTime = beginSeconds;
    setActivePreset(null);
    updateTimelineUI();
  }

  function nudgeEnd(delta) {
    if (!totalMediaDuration) return;
    endSeconds = Math.min(totalMediaDuration, Math.max(endSeconds + delta, beginSeconds + 0.2));
    endInput.value = `${Math.round(endSeconds)}s`;
    videoPreview.currentTime = endSeconds;
    setActivePreset(null);
    updateTimelineUI();
  }

  nudgeStartMinus.addEventListener('click', () => nudgeStart(-1));
  nudgeStartPlus.addEventListener('click', () => nudgeStart(1));
  nudgeEndMinus.addEventListener('click', () => nudgeEnd(-1));
  nudgeEndPlus.addEventListener('click', () => nudgeEnd(1));

  setBeginBtn.addEventListener('click', () => {
    if (!totalMediaDuration) return;
    beginSeconds = Math.max(0, Math.min(videoPreview.currentTime, endSeconds - 0.2));
    beginInput.value = `${Math.round(beginSeconds)}s`;
    setActivePreset(null);
    updateTimelineUI();
  });

  setEndBtn.addEventListener('click', () => {
    if (!totalMediaDuration) return;
    endSeconds = Math.min(totalMediaDuration, Math.max(videoPreview.currentTime, beginSeconds + 0.2));
    endInput.value = `${Math.round(endSeconds)}s`;
    setActivePreset(null);
    updateTimelineUI();
  });

  beginInput.addEventListener('change', () => {
    const sec = parseDurationToSeconds(beginInput.value);
    if (!isNaN(sec) && sec >= 0 && sec < totalMediaDuration) {
      beginSeconds = Math.min(sec, endSeconds - 0.2);
      beginInput.value = `${Math.round(beginSeconds)}s`;
      videoPreview.currentTime = beginSeconds;
    }
    setActivePreset(null);
    updateTimelineUI();
  });

  endInput.addEventListener('change', () => {
    const sec = parseDurationToSeconds(endInput.value);
    if (!isNaN(sec) && sec > 0 && sec <= totalMediaDuration) {
      endSeconds = Math.max(sec, beginSeconds + 0.2);
      endInput.value = `${Math.round(endSeconds)}s`;
      videoPreview.currentTime = endSeconds;
    }
    setActivePreset(null);
    updateTimelineUI();
  });

  presetFull.addEventListener('click', () => {
    beginSeconds = 0;
    endSeconds = totalMediaDuration;
    beginInput.value = '0s';
    endInput.value = `${Math.ceil(totalMediaDuration)}s`;
    setActivePreset(presetFull);
    updateTimelineUI();
  });

  preset30s.addEventListener('click', () => {
    beginSeconds = 0;
    endSeconds = Math.min(30, totalMediaDuration);
    beginInput.value = '0s';
    endInput.value = `${Math.round(endSeconds)}s`;
    setActivePreset(preset30s);
    updateTimelineUI();
  });

  preset60s.addEventListener('click', () => {
    beginSeconds = 0;
    endSeconds = Math.min(60, totalMediaDuration);
    beginInput.value = '0s';
    endInput.value = `${Math.round(endSeconds)}s`;
    setActivePreset(preset60s);
    updateTimelineUI();
  });

  presetClear.addEventListener('click', () => {
    beginSeconds = 0;
    endSeconds = totalMediaDuration;
    beginInput.value = '0s';
    endInput.value = `${Math.ceil(totalMediaDuration)}s`;
    setActivePreset(presetFull);
    updateTimelineUI();
  });

  function setActivePreset(activeBtn) {
    [presetFull, preset30s, preset60s, presetClear].forEach(btn => btn?.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
  }

  function updateSegmentSummary() {
    if (!totalMediaDuration) return;
    const b = beginSeconds;
    const e = endSeconds;
    const len = formatSecondsToReadable(Math.max(0, e - b));
    if (b <= 0.1 && e >= totalMediaDuration - 0.5) {
      segmentSummary.textContent = `Full Track (${len})`;
    } else {
      segmentSummary.textContent = `${formatSecondsToMMSS(b)} → ${formatSecondsToMMSS(e)} (${len})`;
    }
    updateExtractButtonText(len);
  }

  function updateExtractButtonText(len) {
    if (!extractBtnText) return;
    const lengthStr = len || (totalMediaDuration ? formatSecondsToReadable(Math.max(0, endSeconds - beginSeconds)) : '');
    const suffix = lengthStr ? ` (${lengthStr})` : '';
    const isSaveAs = saveLocationToggle ? saveLocationToggle.checked : true;
    if (isSaveAs) {
      extractBtnText.textContent = `Extract & Save As...${suffix}`;
    } else {
      extractBtnText.textContent = `Extract MP3${suffix}`;
    }
  }

  if (saveLocationToggle) {
    saveLocationToggle.addEventListener('change', () => {
      updateExtractButtonText();
    });
  }

  // =========================================================================
  // Waveform Rendering
  // =========================================================================

  async function tryFetchAudioPeaks(mediaUrl) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const res = await fetch(mediaUrl, {
        headers: { Range: 'bytes=0-15728640' } // Sample first 15MB
      });
      const arrayBuffer = await res.arrayBuffer();
      const audioCtx = new AudioCtx();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const rawData = audioBuffer.getChannelData(0);
      const samples = 150;
      const blockSize = Math.floor(rawData.length / samples);
      const peaks = [];

      for (let i = 0; i < samples; i++) {
        const blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        peaks.push(sum / blockSize);
      }

      const max = Math.max(...peaks) || 1;
      waveformPeaks = peaks.map(p => Math.max(0.1, p / max));
      drawWaveform();
      audioCtx.close();
    } catch (_) {
      // Keep placeholder peaks if container cannot be decoded directly by WebAudio
    }
  }

  async function extractWaveformFromFile(file) {
    generatePlaceholderPeaks();
    drawWaveform();

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const arrayBuffer = await file.slice(0, 15 * 1024 * 1024).arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const rawData = audioBuffer.getChannelData(0);
      const samples = 150;
      const blockSize = Math.floor(rawData.length / samples);
      const peaks = [];

      for (let i = 0; i < samples; i++) {
        const blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        peaks.push(sum / blockSize);
      }

      const max = Math.max(...peaks) || 1;
      waveformPeaks = peaks.map(p => Math.max(0.1, p / max));
      drawWaveform();
      audioCtx.close();
    } catch (_) {
      // Keep placeholder peaks
    }
  }

  function generatePlaceholderPeaks() {
    waveformPeaks = [];
    const count = 150;
    for (let i = 0; i < count; i++) {
      const base = Math.sin(i / 9) * 0.3 + 0.45;
      const detail = Math.cos(i * 1.7) * 0.18;
      waveformPeaks.push(Math.max(0.12, Math.min(0.92, base + detail)));
    }
  }

  function drawWaveform() {
    if (!waveformCanvas) return;
    const rect = waveformContainer.getBoundingClientRect();
    if (!rect.width) {
      requestAnimationFrame(drawWaveform);
      return;
    }
    const dpr = window.devicePixelRatio || 1;

    waveformCanvas.width = rect.width * dpr;
    waveformCanvas.height = rect.height * dpr;

    const ctx = waveformCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const peaks = waveformPeaks;
    const count = peaks.length;
    const barWidth = 3;
    const gap = (rect.width - count * barWidth) / (count - 1);
    const midY = rect.height / 2;

    const startX = (beginSeconds / (totalMediaDuration || 1)) * rect.width;
    const endX = (endSeconds / (totalMediaDuration || 1)) * rect.width;

    for (let i = 0; i < count; i++) {
      const x = i * (barWidth + gap);
      const amp = peaks[i];
      const barHeight = Math.max(4, amp * (rect.height - 18));
      const y = midY - barHeight / 2;

      const isInside = x >= startX - 2 && x <= endX + 2;
      ctx.fillStyle = isInside ? '#34d399' : '#3d3d38';

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  }

  window.addEventListener('resize', () => {
    drawWaveform();
  });

  function initTimeRuler(duration) {
    timeRuler.innerHTML = '';
    const marks = 6;
    for (let i = 0; i <= marks; i++) {
      const timeVal = (i / marks) * duration;
      const span = document.createElement('span');
      span.textContent = formatSecondsToMMSS(timeVal);
      timeRuler.appendChild(span);
    }
  }

  // =========================================================================
  // Extraction Logic (Wails Desktop + Web Fallback)
  // =========================================================================

  extractBtn.addEventListener('click', async () => {
    if (!currentFile) {
      showToast('Please select a video or audio file first', 'error');
      return;
    }

    stopTestingSelection();

    // Parse begin and end
    const beginVal = Math.max(0, beginSeconds);
    const endVal = endSeconds > 0 && endSeconds < totalMediaDuration ? endSeconds : totalMediaDuration;

    if (endVal <= beginVal) {
      showToast('End time must be greater than start time', 'error');
      return;
    }

    const baseName = currentFile.name.replace(/\.[^/.]+$/, "");
    const suggestedFilename = `${baseName}.mp3`;

    // -----------------------------------------------------------------------
    // Native macOS Mode (Wails Go API)
    // -----------------------------------------------------------------------
    if (isWails()) {
      let chosenDestination = '';

      if (saveLocationToggle && saveLocationToggle.checked) {
        try {
          chosenDestination = await window.go.main.App.SelectSavePath(suggestedFilename);
          if (!chosenDestination) {
            showToast('Save cancelled', 'info');
            return;
          }
        } catch (err) {
          console.error('Save dialog error:', err);
          showToast(`Save dialog failed: ${err}`, 'error');
          return;
        }
      }

      // Show processing state
      trimWorkspace.classList.add('hidden');
      processingView.classList.remove('hidden');
      if (processingMsg) {
        processingMsg.textContent = `Extracting ${formatSecondsToMMSS(beginVal)} → ${formatSecondsToMMSS(endVal)}...`;
      }
      setStatus('extracting');

      try {
        const result = await window.go.main.App.Extract(
          currentNativePath,
          beginVal,
          endVal,
          chosenDestination
        );

        lastExtractedPath = result.outputPath;
        lastOutputFilename = result.fileName;

        setupNativeAudioResult(result);
        setStatus('complete');
        showToast('Audio extracted successfully!', 'success');
      } catch (err) {
        console.error('Native extraction error:', err);
        processingView.classList.add('hidden');
        trimWorkspace.classList.remove('hidden');
        setStatus('error');
        showToast(`Extraction failed: ${err}`, 'error');
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Web Fallback Mode (Fetch / Stream / Form)
    // -----------------------------------------------------------------------
    trimWorkspace.classList.add('hidden');
    processingView.classList.remove('hidden');
    setStatus('extracting');

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('begin', `${beginVal}s`);
    formData.append('end', `${endVal}s`);

    try {
      const response = await fetch('/extract', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Server returned ${response.status}`);
      }

      const blob = await response.blob();
      setupAudioResult(blob, suggestedFilename, false);
      setStatus('complete');
      showToast('Audio extracted successfully!', 'success');
    } catch (err) {
      console.warn('Web fetch error:', err);
      handleFetchFallback(err, `${beginVal}s`, `${endVal}s`);
    }
  });

  function handleFetchFallback(error, beginVal, endVal) {
    try {
      const dt = new DataTransfer();
      dt.items.add(currentFile);
      formFileInput.files = dt.files;
      formBeginInput.value = beginVal;
      formEndInput.value = endVal;

      nativeForm.submit();
      setStatus('extracting');
      showToast('Downloading extracted audio via fallback...', 'info');

      setTimeout(() => {
        processingView.classList.add('hidden');
        resultView.classList.remove('hidden');
        resultFilenameDisplay.textContent = 'Extraction complete (downloading)';
        setStatus('ready');
      }, 2500);
    } catch (err) {
      processingView.classList.add('hidden');
      trimWorkspace.classList.remove('hidden');
      setStatus('error');
      showToast(`Error: ${error.message}`, 'error');
    }
  }

  // =========================================================================
  // Result Display & Audio Player
  // =========================================================================

  function setupNativeAudioResult(result) {
    processingView.classList.add('hidden');
    resultView.classList.remove('hidden');

    resultFilenameDisplay.textContent = `${result.fileName} (${result.sizeFormatted})`;

    // Load extracted audio into player
    extractedAudio.src = `/media-file?path=${encodeURIComponent(result.outputPath)}`;
    extractedAudio.load();

    if (saveResultText) {
      saveResultText.textContent = 'Save As Another Copy...';
    }
  }

  function setupAudioResult(blob, filename, alreadySaved = false) {
    lastExtractedBlob = blob;
    lastOutputFilename = filename;

    if (extractedAudioObjectURL) {
      URL.revokeObjectURL(extractedAudioObjectURL);
    }
    extractedAudioObjectURL = URL.createObjectURL(blob);
    extractedAudio.src = extractedAudioObjectURL;
    extractedAudio.load();

    resultFilenameDisplay.textContent = alreadySaved
      ? `${filename} (saved to chosen folder)`
      : filename;

    downloadAudioLink.href = extractedAudioObjectURL;
    downloadAudioLink.download = filename;

    if (saveResultText) {
      saveResultText.textContent = alreadySaved ? 'Save Another Copy...' : 'Save As...';
    }

    processingView.classList.add('hidden');
    resultView.classList.remove('hidden');
  }

  // Save As button in Result View
  saveResultBtn.addEventListener('click', async () => {
    if (isWails()) {
      try {
        const dest = await window.go.main.App.SelectSavePath(lastOutputFilename || 'output.mp3');
        if (!dest) return;

        showToast('Saving copy...', 'info');
        const beginVal = Math.max(0, beginSeconds);
        const endVal = endSeconds > 0 && endSeconds < totalMediaDuration ? endSeconds : totalMediaDuration;
        const result = await window.go.main.App.Extract(currentNativePath, beginVal, endVal, dest);

        lastExtractedPath = result.outputPath;
        resultFilenameDisplay.textContent = `${result.fileName} (${result.sizeFormatted})`;
        showToast('Saved to chosen folder!', 'success');
      } catch (err) {
        showToast(`Save failed: ${err}`, 'error');
      }
      return;
    }

    if (lastExtractedBlob) {
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: lastOutputFilename || 'output.mp3',
            types: [{
              description: 'MP3 Audio File (*.mp3)',
              accept: { 'audio/mpeg': ['.mp3'] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(lastExtractedBlob);
          await writable.close();
          showToast(`Saved to ${handle.name}`, 'success');
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      downloadAudioLink.click();
    }
  });

  // Reveal in Finder Button
  if (revealFinderBtn) {
    revealFinderBtn.addEventListener('click', async () => {
      if (isWails() && lastExtractedPath) {
        try {
          await window.go.main.App.RevealInFinder(lastExtractedPath);
        } catch (err) {
          showToast(`Could not open Finder: ${err}`, 'error');
        }
      } else {
        showToast('Only available in desktop mode', 'info');
      }
    });
  }

  // Minimal audio player controls
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

  backToTrimBtn.addEventListener('click', () => {
    extractedAudio.pause();
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    resultView.classList.add('hidden');
    trimWorkspace.classList.remove('hidden');
    setStatus('loaded');
  });

  resetWorkspaceBtn.addEventListener('click', () => {
    resetAll();
  });

  function resetAll() {
    stopTestingSelection();
    currentFile = null;
    currentNativePath = '';
    lastExtractedPath = '';
    lastExtractedBlob = null;
    totalMediaDuration = 0;
    beginSeconds = 0;
    endSeconds = 0;

    if (videoObjectURL) {
      URL.revokeObjectURL(videoObjectURL);
      videoObjectURL = null;
    }
    if (extractedAudioObjectURL) {
      URL.revokeObjectURL(extractedAudioObjectURL);
      extractedAudioObjectURL = null;
    }

    videoPreview.removeAttribute('src');
    videoPreview.load();
    extractedAudio.removeAttribute('src');
    extractedAudio.load();

    fileInput.value = '';
    beginInput.value = '0s';
    endInput.value = '';

    fileLoadedView.classList.add('hidden');
    uploadPrompt.classList.remove('hidden');
    trimWorkspace.classList.add('hidden');
    processingView.classList.add('hidden');
    resultView.classList.add('hidden');

    setStatus(isWails() ? 'macOS native' : 'ready');
  }

  // =========================================================================
  // Formatting Utilities
  // =========================================================================

  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  function formatSecondsToMMSS(totalSec) {
    if (isNaN(totalSec) || totalSec < 0) return '00:00';
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function formatSecondsToReadable(totalSec) {
    if (isNaN(totalSec) || totalSec <= 0) return '0s';
    const mins = Math.floor(totalSec / 60);
    const secs = Math.round(totalSec % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  function parseDurationToSeconds(str) {
    if (!str) return NaN;
    str = str.trim().toLowerCase();
    if (str.endsWith('s') && !str.includes('m')) {
      const num = parseFloat(str.slice(0, -1));
      if (!isNaN(num)) return num;
    }
    if (str.includes(':')) {
      const parts = str.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] * 60 + parts[1];
      }
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }
    const num = parseFloat(str);
    return isNaN(num) ? NaN : num;
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconSvg = type === 'error'
      ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
