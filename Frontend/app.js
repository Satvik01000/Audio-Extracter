/**
 * Audio Extractor — Minimalist Application Frontend
 */

document.addEventListener('DOMContentLoaded', () => {
  const BACKEND_URL = window.location.origin && window.location.origin.startsWith('http')
    ? '/extract'
    : 'http://localhost:8080/extract';

  // Status
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
  const downloadAudioLink = document.getElementById('download-audio-link');
  const resetWorkspaceBtn = document.getElementById('reset-workspace-btn');
  const backToTrimBtn = document.getElementById('back-to-trim-btn');

  // Native Form Fallback
  const nativeForm = document.getElementById('native-extract-form');
  const formFileInput = document.getElementById('form-file-input');
  const formBeginInput = document.getElementById('form-begin-input');
  const formEndInput = document.getElementById('form-end-input');

  const toastContainer = document.getElementById('toast-container');

  // State
  let currentFile = null;
  let videoObjectURL = null;
  let extractedAudioObjectURL = null;
  let lastExtractedBlob = null;
  let lastOutputFilename = 'output.mp3';
  let totalMediaDuration = 0;
  let beginSeconds = 0;
  let endSeconds = 0;
  let isTestingSelection = false;
  let isLoopingSelection = false;
  let waveformPeaks = [];

  // =========================================================================
  // File Selection & Drag-and-Drop
  // =========================================================================

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#remove-file-btn') || e.target.closest('#change-file-btn')) return;
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

  changeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetAll();
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
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

  function handleFileSelected(file) {
    stopTestingSelection();
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
    if ( statusText ) {
      statusText.textContent = state;
    }
  }

  // =========================================================================
  // Hidden Media Engine Synchronization
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

    // Prevent pointer heads from colliding when pointers are close together
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
  // Transport Controls (Play Selection, Loop, Mute, Spacebar)
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

  if (saveOptionHint) {
    if ('showSaveFilePicker' in window) {
      saveOptionHint.textContent = 'native picker';
    } else {
      saveOptionHint.textContent = 'browser default';
    }
  }

  // =========================================================================
  // Waveform Extraction & Matte Canvas Rendering
  // =========================================================================

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
      // Keep clean simulated waveform if container cannot be decoded directly
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
    if (!peaks || peaks.length === 0) return;

    const barWidth = 2.5;
    const gap = 2.5;
    const totalBars = Math.floor(rect.width / (barWidth + gap));
    const step = peaks.length / totalBars;

    const startRatio = totalMediaDuration > 0 ? beginSeconds / totalMediaDuration : 0;
    const endRatio = totalMediaDuration > 0 ? endSeconds / totalMediaDuration : 1;

    const centerY = (rect.height - 14) / 2;
    const maxBarHeight = rect.height - 28;

    for (let i = 0; i < totalBars; i++) {
      const barRatio = i / totalBars;
      const peakIndex = Math.min(peaks.length - 1, Math.floor(i * step));
      const val = peaks[peakIndex];
      const barHeight = Math.max(3, val * maxBarHeight);
      const x = i * (barWidth + gap);
      const y = centerY - barHeight / 2;

      const isSelected = barRatio >= startRatio && barRatio <= endRatio;
      ctx.fillStyle = isSelected ? '#34d399' : '#3a3a36';

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }
  }

  function initTimeRuler(duration) {
    timeRuler.innerHTML = '';
    const ticks = 6;
    for (let i = 0; i < ticks; i++) {
      const sec = (duration / (ticks - 1)) * i;
      const span = document.createElement('span');
      span.textContent = formatSecondsToMMSS(sec);
      timeRuler.appendChild(span);
    }
  }

  window.addEventListener('resize', drawWaveform);

  // =========================================================================
  // Extraction Request
  // =========================================================================

  extractBtn.addEventListener('click', async () => {
    if (!currentFile) {
      showToast('Select a file first', 'error');
      return;
    }

    stopTestingSelection();

    const beginVal = beginInput.value.trim() || '0s';
    const endVal = endInput.value.trim() || `${Math.ceil(endSeconds)}s`;
    const baseName = currentFile.name.substring(0, currentFile.name.lastIndexOf('.')) || currentFile.name;
    const defaultFilename = `output_${baseName}.mp3`;

    let fileHandle = null;
    const wantSaveAs = saveLocationToggle ? saveLocationToggle.checked : true;

    // Prompt user for save destination upfront using native OS file picker
    if (wantSaveAs && 'showSaveFilePicker' in window) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [{
            description: 'MP3 Audio File (*.mp3)',
            accept: { 'audio/mpeg': ['.mp3'] }
          }]
        });
      } catch (pickerErr) {
        if (pickerErr.name === 'AbortError') {
          // User cancelled native file dialog, cleanly exit
          return;
        }
        console.warn('Native picker error:', pickerErr);
      }
    }

    trimWorkspace.classList.add('hidden');
    resultView.classList.add('hidden');
    processingView.classList.remove('hidden');

    if (fileHandle) {
      processingMsg.textContent = `${currentFile.name} (${beginVal} → ${endVal}) → ${fileHandle.name}`;
    } else {
      processingMsg.textContent = `${currentFile.name} (${beginVal} → ${endVal})`;
    }
    setStatus('extracting');

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
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      lastExtractedBlob = audioBlob;
      const targetFilename = fileHandle ? fileHandle.name : defaultFilename;
      lastOutputFilename = targetFilename;

      if (fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(audioBlob);
          await writable.close();
          setupAudioResult(audioBlob, targetFilename, true);
          setStatus('saved');
          showToast(`Saved to ${targetFilename}`);
          return;
        } catch (writeErr) {
          console.error('Failed writing to fileHandle:', writeErr);
          showToast('Could not save to chosen file, using preview', 'error');
        }
      }

      setupAudioResult(audioBlob, targetFilename, false);
      if (wantSaveAs && !fileHandle) {
        downloadAudioLink.click();
      }
      setStatus('done');
      showToast('Extraction complete');
    } catch (err) {
      handleFetchFallback(err, beginVal, endVal);
    }
  });

  function handleFetchFallback(error, beginVal, endVal) {
    const isNetworkError = error instanceof TypeError || error.message.includes('Failed to fetch');

    if (isNetworkError) {
      try {
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
          setStatus('done');
          showToast('Download started');
        }, 1200);
      } catch (_) {
        processingView.classList.add('hidden');
        trimWorkspace.classList.remove('hidden');
        setStatus('error');
        showToast(`Failed: ${error.message}`, 'error');
      }
    } else {
      processingView.classList.add('hidden');
      trimWorkspace.classList.remove('hidden');
      setStatus('error');
      showToast(`Error: ${error.message}`, 'error');
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

  // =========================================================================
  // Result Player Controls
  // =========================================================================

  if (saveResultBtn) {
    saveResultBtn.addEventListener('click', async () => {
      if (!lastExtractedBlob) return;

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
          showToast(`Saved to ${handle.name}`);
          if (resultFilenameDisplay) {
            resultFilenameDisplay.textContent = `${handle.name} (saved to chosen folder)`;
          }
          if (saveResultText) {
            saveResultText.textContent = 'Save Another Copy...';
          }
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('Picker error:', err);
        }
      }

      // Fallback for browsers without showSaveFilePicker
      downloadAudioLink.click();
    });
  }

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
    drawWaveform();
  });

  resetWorkspaceBtn.addEventListener('click', resetAll);

  function resetAll() {
    stopTestingSelection();
    currentFile = null;
    fileInput.value = '';
    totalMediaDuration = 0;
    beginSeconds = 0;
    endSeconds = 0;
    waveformPeaks = [];
    lastExtractedBlob = null;
    lastOutputFilename = 'output.mp3';

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
    setStatus('ready');
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
