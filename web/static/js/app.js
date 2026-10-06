/**
 * CapCut AI Voice Studio - Frontend Logic
 * Supports Vietnamese (VN) & US (Hoa Kỳ) voice selection,
 * real-time TTS synthesis, HTML5 audio playback, and MP3 download.
 */

document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        voices: { vn: [], us: [], other: [], all: [] },
        currentRegion: 'vn', // 'vn', 'us', 'all'
        currentFilter: 'all',  // 'all', 'female', 'male', 'special'
        searchQuery: '',
        selectedVoice: null,
        rate: 1.0,
        isGenerating: false,
        audioElement: document.getElementById('nativeAudioElement'),
        currentlyPreviewingVoice: null,
        history: []
    };

    // DOM Elements
    const elements = {
        // Text Editor
        ttsTextInput: document.getElementById('ttsTextInput'),
        charCount: document.getElementById('charCount'),
        wordCount: document.getElementById('wordCount'),
        btnPasteText: document.getElementById('btnPasteText'),
        btnClearText: document.getElementById('btnClearText'),
        promptChips: document.querySelectorAll('.prompt-chip'),

        // Speed Controls
        rateSlider: document.getElementById('rateSlider'),
        rateValue: document.getElementById('rateValue'),
        speedPills: document.querySelectorAll('.speed-pill'),

        // Generate CTA
        btnGenerate: document.getElementById('btnGenerate'),
        btnGenerateLabel: document.getElementById('btnGenerateLabel'),
        generationProgress: document.getElementById('generationProgress'),
        progressStatusText: document.getElementById('progressStatusText'),

        // Voice Catalog
        voiceCountBadge: document.getElementById('voiceCountBadge'),
        regionTabs: document.querySelectorAll('.region-tab'),
        countVn: document.getElementById('countVn'),
        countUs: document.getElementById('countUs'),
        countAll: document.getElementById('countAll'),
        voiceSearchInput: document.getElementById('voiceSearchInput'),
        btnClearSearch: document.getElementById('btnClearSearch'),
        filterPills: document.querySelectorAll('.filter-pill'),
        voiceCardsGrid: document.getElementById('voiceCardsGrid'),
        activeVoiceName: document.getElementById('activeVoiceName'),
        activeVoiceType: document.getElementById('activeVoiceType'),
        activeVoiceAvatar: document.getElementById('activeVoiceAvatar'),
        btnPreviewVoice: document.getElementById('btnPreviewVoice'),
        btnPreviewText: document.getElementById('btnPreviewText'),
        previewIcon: document.getElementById('previewIcon'),

        // Audio Player
        playerCard: document.getElementById('playerCard'),
        playerPlaceholder: document.getElementById('playerPlaceholder'),
        activePlayerBox: document.getElementById('activePlayerBox'),
        playerMetaBadge: document.getElementById('playerMetaBadge'),
        playerMetaVoice: document.getElementById('playerMetaVoice'),
        playerMetaDuration: document.getElementById('playerMetaDuration'),
        waveVisualizer: document.getElementById('waveVisualizer'),
        btnPlayPause: document.getElementById('btnPlayPause'),
        playIcon: document.getElementById('playIcon'),
        pauseIcon: document.getElementById('pauseIcon'),
        currentTimeDisplay: document.getElementById('currentTimeDisplay'),
        totalTimeDisplay: document.getElementById('totalTimeDisplay'),
        seekSlider: document.getElementById('seekSlider'),
        btnToggleMute: document.getElementById('btnToggleMute'),
        volumeSlider: document.getElementById('volumeSlider'),
        btnDownloadMp3: document.getElementById('btnDownloadMp3'),
        btnCopyAudioLink: document.getElementById('btnCopyAudioLink'),

        // History
        historyGrid: document.getElementById('historyGrid'),
        historyEmpty: document.getElementById('historyEmpty'),
        btnRefreshHistory: document.getElementById('btnRefreshHistory'),
        btnClearHistory: document.getElementById('btnClearHistory'),

        // Toast
        toastContainer: document.getElementById('toastContainer')
    };

    // -------------------------------------------------------------------------
    // Toast Notification System
    // -------------------------------------------------------------------------
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // -------------------------------------------------------------------------
    // Helper Formatters
    // -------------------------------------------------------------------------
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 KB';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // -------------------------------------------------------------------------
    // Bulletproof Direct MP3 File Downloader
    // -------------------------------------------------------------------------
    async function triggerDirectDownload(url, filename) {
        if (!url || url === '#' || url === 'undefined') {
            showToast('Chưa có file âm thanh để tải', 'error');
            return;
        }

        const safeFilename = filename && filename.endsWith('.mp3') ? filename : (filename ? filename + '.mp3' : 'capcut_audio.mp3');
        showToast('Đang chuẩn bị tải file MP3...', 'info');

        try {
            const downloadEndpoint = url + (url.includes('?') ? '&' : '?') + 'download=1';
            const response = await fetch(downloadEndpoint);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const tempLink = document.createElement('a');
            tempLink.style.display = 'none';
            tempLink.href = blobUrl;
            tempLink.setAttribute('download', safeFilename);
            document.body.appendChild(tempLink);
            tempLink.click();

            setTimeout(() => {
                document.body.removeChild(tempLink);
                window.URL.revokeObjectURL(blobUrl);
            }, 2000);

            showToast(`Đã tải xuống file "${safeFilename}"!`, 'success');
        } catch (err) {
            console.warn('Blob download thất bại, dùng fallback direct link:', err);
            // Fallback: direct browser navigation to download attachment
            const directUrl = url + (url.includes('?') ? '&' : '?') + 'download=1';
            const fallbackLink = document.createElement('a');
            fallbackLink.style.display = 'none';
            fallbackLink.href = directUrl;
            fallbackLink.setAttribute('download', safeFilename);
            fallbackLink.target = '_blank';
            document.body.appendChild(fallbackLink);
            fallbackLink.click();
            setTimeout(() => document.body.removeChild(fallbackLink), 1000);
            showToast(`Đang tải file "${safeFilename}" qua liên kết trực tiếp`, 'info');
        }
    }

    function getAvatarForVoice(voice) {
        if (voice.gender === 'female') {
            const lower = (voice.voice_type + ' ' + voice.display_name).toLowerCase();
            if (lower.includes('bản tin') || lower.includes('news')) return '🎙️';
            if (lower.includes('review')) return '🎬';
            if (lower.includes('dsp') || lower.includes('bé')) return '👶';
            return '👩';
        }
        if (voice.gender === 'male') {
            const lower = (voice.voice_type + ' ' + voice.display_name).toLowerCase();
            if (lower.includes('đại đế') || lower.includes('alex')) return '👑';
            return '👨';
        }
        if (voice.gender === 'special') {
            const lower = (voice.voice_type + ' ' + voice.display_name).toLowerCase();
            if (lower.includes('robot')) return '🤖';
            if (lower.includes('demon') || lower.includes('đại đế')) return '👑';
            return '🎭';
        }
        return '✨';
    }

    // -------------------------------------------------------------------------
    // Voice Catalog Management
    // -------------------------------------------------------------------------
    async function loadVoices() {
        try {
            elements.voiceCountBadge.textContent = 'Đang tải danh mục...';
            const res = await fetch('/api/voices');
            const data = await res.json();

            if (data.success && data.data) {
                state.voices = data.data;

                // Update tab counts
                elements.countVn.textContent = state.voices.vn.length;
                elements.countUs.textContent = state.voices.us.length;
                elements.countAll.textContent = state.voices.all.length;

                // Select default voice (Nhỏ Ngọt Ngào - BV421_vivn_streaming)
                const defaultVoice = state.voices.vn.find(v => v.voice_type === 'BV421_vivn_streaming') || state.voices.vn[0];
                selectVoice(defaultVoice);

                // Render voice grid
                renderVoiceCards();
                elements.voiceCountBadge.textContent = `${state.voices.all.length} giọng sẵn sàng`;
            }
        } catch (err) {
            console.error('Lỗi khi tải danh sách giọng:', err);
            showToast('Không thể tải danh sách giọng đọc từ máy chủ', 'error');
            elements.voiceCountBadge.textContent = 'Lỗi kết nối';
        }
    }

    function selectVoice(voice) {
        if (!voice) return;
        state.selectedVoice = voice;
        elements.activeVoiceName.textContent = voice.display_name;
        elements.activeVoiceType.textContent = voice.voice_type;
        elements.activeVoiceAvatar.textContent = getAvatarForVoice(voice);

        // Highlight selected card
        document.querySelectorAll('.voice-card').forEach(card => {
            if (card.dataset.voiceType === voice.voice_type) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    function getFilteredVoices() {
        let list = [];
        if (state.currentRegion === 'vn') {
            list = state.voices.vn;
        } else if (state.currentRegion === 'us') {
            list = state.voices.us;
        } else {
            list = state.voices.all;
        }

        // Filter by gender / style
        if (state.currentFilter !== 'all') {
            list = list.filter(v => v.gender === state.currentFilter);
        }

        // Filter by search query
        if (state.searchQuery.trim()) {
            const q = state.searchQuery.toLowerCase().trim();
            list = list.filter(v => 
                v.display_name.toLowerCase().includes(q) ||
                v.voice_type.toLowerCase().includes(q) ||
                (v.tag && v.tag.toLowerCase().includes(q))
            );
        }

        return list;
    }

    function renderVoiceCards() {
        const voices = getFilteredVoices();
        elements.voiceCardsGrid.innerHTML = '';

        if (voices.length === 0) {
            elements.voiceCardsGrid.innerHTML = `
                <div class="voice-cards-empty">
                    Không tìm thấy giọng đọc phù hợp với từ khóa "${state.searchQuery}"
                </div>
            `;
            return;
        }

        voices.forEach(voice => {
            const card = document.createElement('div');
            const isSelected = state.selectedVoice && state.selectedVoice.voice_type === voice.voice_type;
            card.className = `voice-card ${isSelected ? 'selected' : ''}`;
            card.dataset.voiceType = voice.voice_type;

            const avatar = getAvatarForVoice(voice);
            const flag = voice.lang === 'vi-VN' ? '🇻🇳' : voice.lang === 'en-US' ? '🇺🇸' : '🌐';

            card.innerHTML = `
                <div class="vc-avatar">${avatar}</div>
                <div class="vc-info">
                    <span class="vc-name" title="${voice.display_name}">${voice.display_name}</span>
                    <div class="vc-sub">
                        <span class="vc-lang">${flag} ${voice.lang}</span>
                        <span class="vc-tag">${voice.tag || 'Tự nhiên'}</span>
                    </div>
                </div>
                <button type="button" class="btn-card-preview" title="Nghe thử giọng này">
                    🔊
                </button>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-card-preview')) return;
                selectVoice(voice);
            });

            // Card preview button
            const previewBtn = card.querySelector('.btn-card-preview');
            if (previewBtn) {
                previewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectVoice(voice);
                    playVoicePreview(voice, previewBtn);
                });
            }

            elements.voiceCardsGrid.appendChild(card);
        });
    }

    // -------------------------------------------------------------------------
    // Voice Preview Feature
    // -------------------------------------------------------------------------
    const previewAudioPlayer = new Audio();
    previewAudioPlayer.addEventListener('ended', resetPreviewUI);

    async function playVoicePreview(voice, triggerBtn) {
        if (!voice) return;

        // If preview is playing for this voice, stop it
        if (state.currentlyPreviewingVoice === voice.voice_type && !previewAudioPlayer.paused) {
            previewAudioPlayer.pause();
            resetPreviewUI();
            return;
        }

        resetPreviewUI();
        state.currentlyPreviewingVoice = voice.voice_type;

        if (elements.btnPreviewVoice) {
            elements.btnPreviewText.textContent = 'Đang tải mẫu...';
            elements.btnPreviewVoice.classList.add('playing');
        }
        if (triggerBtn && triggerBtn.classList.contains('btn-card-preview')) {
            triggerBtn.classList.add('playing');
            triggerBtn.textContent = '⏳';
        }

        try {
            const res = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voice: voice.voice_type })
            });
            const data = await res.json();

            if (data.success && data.audio_url) {
                previewAudioPlayer.src = data.audio_url;
                previewAudioPlayer.play().catch(e => {
                    console.log('Preview autoplay blocked:', e);
                });

                if (elements.btnPreviewVoice) {
                    elements.btnPreviewText.textContent = 'Đang phát mẫu...';
                    elements.previewIcon.textContent = '⏹️';
                }
                if (triggerBtn && triggerBtn.classList.contains('btn-card-preview')) {
                    triggerBtn.textContent = '⏹️';
                }
            } else {
                throw new Error(data.error || 'Không tải được mẫu');
            }
        } catch (err) {
            console.error('Lỗi nghe thử:', err);
            showToast(`Lỗi nghe thử: ${err.message}`, 'error');
            resetPreviewUI();
        }
    }

    function resetPreviewUI() {
        state.currentlyPreviewingVoice = null;
        if (elements.btnPreviewVoice) {
            elements.btnPreviewVoice.classList.remove('playing');
            elements.btnPreviewText.textContent = 'Nghe thử giọng';
            elements.previewIcon.textContent = '🔊';
        }
        document.querySelectorAll('.btn-card-preview').forEach(b => {
            b.classList.remove('playing');
            b.textContent = '🔊';
        });
    }

    if (elements.btnPreviewVoice) {
        elements.btnPreviewVoice.addEventListener('click', () => {
            playVoicePreview(state.selectedVoice, elements.btnPreviewVoice);
        });
    }

    // -------------------------------------------------------------------------
    // Text Editor Events
    // -------------------------------------------------------------------------
    function updateTextMetrics() {
        const text = elements.ttsTextInput.value.trim();
        elements.charCount.textContent = text.length;
        const words = text ? text.split(/\s+/).length : 0;
        elements.wordCount.textContent = words;
    }

    elements.ttsTextInput.addEventListener('input', updateTextMetrics);

    // Prompt sample buttons
    elements.promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const sample = chip.dataset.sample;
            if (sample) {
                elements.ttsTextInput.value = sample;
                updateTextMetrics();
                elements.ttsTextInput.focus();
                showToast('Đã chèn nội dung mẫu!', 'info');

                // If sample is English, automatically switch to US region tab!
                if (chip.textContent.includes('US') || chip.textContent.includes('Anh')) {
                    switchRegion('us');
                }
            }
        });
    });

    // Paste button
    elements.btnPasteText.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                elements.ttsTextInput.value = text;
                updateTextMetrics();
                showToast('Đã dán từ clipboard', 'info');
            }
        } catch (e) {
            elements.ttsTextInput.focus();
            showToast('Vui lòng nhấn Ctrl+V để dán trực tiếp', 'info');
        }
    });

    // Clear button
    elements.btnClearText.addEventListener('click', () => {
        elements.ttsTextInput.value = '';
        updateTextMetrics();
        elements.ttsTextInput.focus();
    });

    // -------------------------------------------------------------------------
    // Rate Slider & Presets
    // -------------------------------------------------------------------------
    elements.rateSlider.addEventListener('input', (e) => {
        state.rate = parseFloat(e.target.value).toFixed(1);
        elements.rateValue.textContent = `${state.rate}x`;

        // Sync pills
        elements.speedPills.forEach(pill => {
            if (pill.dataset.rate === state.rate) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    });

    elements.speedPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const r = pill.dataset.rate;
            state.rate = parseFloat(r).toFixed(1);
            elements.rateSlider.value = state.rate;
            elements.rateValue.textContent = `${state.rate}x`;
            elements.speedPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });

    // -------------------------------------------------------------------------
    // Region & Filter Tabs
    // -------------------------------------------------------------------------
    function switchRegion(regionKey) {
        state.currentRegion = regionKey;
        elements.regionTabs.forEach(tab => {
            if (tab.dataset.region === regionKey) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // If current selected voice is not in this region, switch selected voice to the first voice in region
        const targetList = regionKey === 'vn' ? state.voices.vn : regionKey === 'us' ? state.voices.us : state.voices.all;
        if (targetList.length > 0) {
            const exists = targetList.some(v => v.voice_type === (state.selectedVoice && state.selectedVoice.voice_type));
            if (!exists) {
                selectVoice(targetList[0]);
            }
        }

        renderVoiceCards();
    }

    elements.regionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchRegion(tab.dataset.region);
        });
    });

    elements.filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            elements.filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            state.currentFilter = pill.dataset.filter;
            renderVoiceCards();
        });
    });

    // Search input
    elements.voiceSearchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (state.searchQuery) {
            elements.btnClearSearch.classList.remove('hidden');
        } else {
            elements.btnClearSearch.classList.add('hidden');
        }
        renderVoiceCards();
    });

    elements.btnClearSearch.addEventListener('click', () => {
        elements.voiceSearchInput.value = '';
        state.searchQuery = '';
        elements.btnClearSearch.classList.add('hidden');
        renderVoiceCards();
        elements.voiceSearchInput.focus();
    });

    // -------------------------------------------------------------------------
    // TTS Audio Generation
    // -------------------------------------------------------------------------
    elements.btnGenerate.addEventListener('click', async () => {
        const text = elements.ttsTextInput.value.trim();
        if (!text) {
            showToast('Vui lòng nhập văn bản cần đọc trước!', 'error');
            elements.ttsTextInput.focus();
            return;
        }

        if (!state.selectedVoice) {
            showToast('Vui lòng chọn một giọng đọc trong danh mục', 'error');
            return;
        }

        if (state.isGenerating) return;

        // Set Loading State
        state.isGenerating = true;
        elements.btnGenerate.disabled = true;
        elements.btnGenerateLabel.textContent = 'Đang xử lý tạo âm thanh...';
        elements.generationProgress.classList.remove('hidden');
        elements.progressStatusText.textContent = 'Đang mã hóa RSA PKCS#1 v1.5 & gửi tác vụ lên CapCut...';

        try {
            // Step text animation
            setTimeout(() => {
                if (state.isGenerating) {
                    elements.progressStatusText.textContent = 'CapCut đang tổng hợp âm thanh đa ngữ...';
                }
            }, 1800);

            const payload = {
                text: text,
                voice: state.selectedVoice.voice_type,
                rate: String(state.rate)
            };

            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success && result.audio_url) {
                elements.progressStatusText.textContent = 'Đã hoàn tất! Đang tải file MP3...';
                showToast(`Thành công! Đã tạo file ${result.filename}`, 'success');

                // Load to Audio Player
                setupAudioPlayer(result);

                // Reload History
                loadHistory();
            } else {
                throw new Error(result.error || 'Không nhận được đường dẫn âm thanh từ CapCut');
            }
        } catch (err) {
            console.error('Lỗi khi tạo TTS:', err);
            showToast(`Lỗi: ${err.message}`, 'error');
        } finally {
            state.isGenerating = false;
            elements.btnGenerate.disabled = false;
            elements.btnGenerateLabel.textContent = 'Tạo Giọng Nói & Xuất File MP3';
            elements.generationProgress.classList.add('hidden');
        }
    });

    // -------------------------------------------------------------------------
    // Audio Player Implementation
    // -------------------------------------------------------------------------
    function setupAudioPlayer(audioData) {
        elements.playerPlaceholder.classList.add('hidden');
        elements.activePlayerBox.classList.remove('hidden');
        elements.playerMetaBadge.classList.remove('hidden');

        // Meta
        const durationSec = audioData.duration_ms ? (audioData.duration_ms / 1000).toFixed(1) + 's' : 'Hoàn thành';
        elements.playerMetaVoice.textContent = audioData.voice_name || state.selectedVoice.display_name;
        elements.playerMetaDuration.textContent = durationSec;

        // Set audio element source
        state.audioElement.src = audioData.audio_url;
        state.audioElement.load();

        // Download button
        const dlUrl = audioData.audio_url + (audioData.audio_url.includes('?') ? '&' : '?') + 'download=1';
        elements.btnDownloadMp3.href = dlUrl;
        elements.btnDownloadMp3.dataset.audioUrl = audioData.audio_url;
        elements.btnDownloadMp3.setAttribute('download', audioData.filename || 'capcut_audio.mp3');

        // Copy audio URL button
        elements.btnCopyAudioLink.onclick = () => {
            const fullUrl = window.location.origin + audioData.audio_url;
            navigator.clipboard.writeText(fullUrl);
            showToast('Đã sao chép link file MP3!', 'info');
        };

        // Auto play
        state.audioElement.play().catch(e => {
            console.log('Autoplay prevented by browser:', e);
        });

        // Scroll into view if needed
        elements.playerCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Audio Player Events
    state.audioElement.addEventListener('play', () => {
        elements.playIcon.classList.add('hidden');
        elements.pauseIcon.classList.remove('hidden');
        elements.waveVisualizer.classList.add('playing');
    });

    state.audioElement.addEventListener('pause', () => {
        elements.playIcon.classList.remove('hidden');
        elements.pauseIcon.classList.add('hidden');
        elements.waveVisualizer.classList.remove('playing');
    });

    state.audioElement.addEventListener('ended', () => {
        elements.playIcon.classList.remove('hidden');
        elements.pauseIcon.classList.add('hidden');
        elements.waveVisualizer.classList.remove('playing');
        elements.seekSlider.value = 0;
    });

    state.audioElement.addEventListener('timeupdate', () => {
        const cur = state.audioElement.currentTime;
        const dur = state.audioElement.duration || 0;
        elements.currentTimeDisplay.textContent = formatTime(cur);
        if (dur > 0) {
            elements.totalTimeDisplay.textContent = formatTime(dur);
            elements.seekSlider.value = (cur / dur) * 100;
        }
    });

    state.audioElement.addEventListener('loadedmetadata', () => {
        elements.totalTimeDisplay.textContent = formatTime(state.audioElement.duration);
    });

    // Play / Pause Click
    elements.btnPlayPause.addEventListener('click', () => {
        if (!state.audioElement.src) return;
        if (state.audioElement.paused) {
            state.audioElement.play();
        } else {
            state.audioElement.pause();
        }
    });

    // Scrub slider
    elements.seekSlider.addEventListener('input', (e) => {
        if (state.audioElement.duration) {
            const seekTo = (e.target.value / 100) * state.audioElement.duration;
            state.audioElement.currentTime = seekTo;
        }
    });

    // Volume
    elements.volumeSlider.addEventListener('input', (e) => {
        state.audioElement.volume = parseFloat(e.target.value);
    });

    elements.btnToggleMute.addEventListener('click', () => {
        state.audioElement.muted = !state.audioElement.muted;
        if (state.audioElement.muted) {
            elements.volumeSlider.value = 0;
        } else {
            elements.volumeSlider.value = state.audioElement.volume;
        }
    });

    // -------------------------------------------------------------------------
    // History Section
    // -------------------------------------------------------------------------
    async function loadHistory() {
        try {
            const res = await fetch('/api/history');
            const data = await res.json();
            if (data.success && data.data) {
                state.history = data.data;
                renderHistory();
            }
        } catch (e) {
            console.error('Lỗi khi tải lịch sử:', e);
        }
    }

    function renderHistory() {
        if (!state.history || state.history.length === 0) {
            elements.historyEmpty.classList.remove('hidden');
            elements.historyGrid.innerHTML = '';
            return;
        }

        elements.historyEmpty.classList.add('hidden');
        elements.historyGrid.innerHTML = '';

        state.history.forEach(item => {
            const card = document.createElement('div');
            card.className = 'history-item-card';

            const durationSec = item.duration_ms ? (item.duration_ms / 1000).toFixed(1) + 's' : 'Âm thanh';
            const sizeStr = formatFileSize(item.file_size);

            card.innerHTML = `
                <div class="history-item-top">
                    <span class="history-item-voice">🎙️ ${item.voice_name || item.voice}</span>
                    <span class="history-item-time">${item.created_at || ''}</span>
                </div>
                <p class="history-item-text" title="${item.text}">"${item.text}"</p>
                <div class="history-item-bottom">
                    <span class="history-item-meta">${durationSec} • ${sizeStr}</span>
                    <div class="history-item-actions">
                        <button type="button" class="btn-sm-action btn-play-history" data-url="${item.audio_url}" data-name="${item.voice_name}" data-filename="${item.filename}" data-duration="${item.duration_ms}">
                            ▶ Nghe
                        </button>
                        <button type="button" class="btn-sm-action btn-download-history" data-url="${item.audio_url}" data-filename="${item.filename}" title="Tải file MP3">
                            ⬇ MP3
                        </button>
                        <button type="button" class="btn-sm-action btn-delete-item" title="Xóa bản thu này">
                            🗑️
                        </button>
                    </div>
                </div>
            `;

            // Click play history
            const playBtn = card.querySelector('.btn-play-history');
            playBtn.addEventListener('click', () => {
                setupAudioPlayer({
                    audio_url: item.audio_url,
                    filename: item.filename,
                    voice_name: item.voice_name,
                    duration_ms: item.duration_ms
                });
            });

            // Click download history
            const dlBtn = card.querySelector('.btn-download-history');
            if (dlBtn) {
                dlBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    triggerDirectDownload(item.audio_url, item.filename);
                });
            }

            // Click delete single history item
            const deleteBtn = card.querySelector('.btn-delete-item');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Bạn có chắc muốn xóa bản thu "${item.text.slice(0, 30)}..."?`)) return;
                    try {
                        const res = await fetch('/api/history/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: item.id })
                        });
                        const data = await res.json();
                        if (data.success) {
                            showToast('Đã xóa bản thu!', 'info');
                            loadHistory();
                        } else {
                            showToast(data.error || 'Lỗi khi xóa', 'error');
                        }
                    } catch (err) {
                        showToast('Lỗi kết nối máy chủ', 'error');
                    }
                });
            }

            elements.historyGrid.appendChild(card);
        });
    }

    elements.btnRefreshHistory.addEventListener('click', () => {
        loadHistory();
        showToast('Đã làm mới lịch sử', 'info');
    });

    if (elements.btnClearHistory) {
        elements.btnClearHistory.addEventListener('click', async () => {
            if (!state.history || state.history.length === 0) {
                showToast('Lịch sử hiện đang trống', 'info');
                return;
            }
            if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử và các file âm thanh đã tạo?')) return;
            try {
                const res = await fetch('/api/history/clear', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Đã xóa sạch toàn bộ lịch sử!', 'success');
                    loadHistory();
                } else {
                    showToast(data.error || 'Lỗi khi xóa', 'error');
                }
            } catch (err) {
                showToast('Lỗi kết nối máy chủ', 'error');
            }
        });
    }

    // Download button click in main player
    if (elements.btnDownloadMp3) {
        elements.btnDownloadMp3.addEventListener('click', (e) => {
            e.preventDefault();
            const url = elements.btnDownloadMp3.dataset.audioUrl || elements.btnDownloadMp3.getAttribute('href');
            const filename = elements.btnDownloadMp3.getAttribute('download') || 'capcut_audio.mp3';
            triggerDirectDownload(url, filename);
        });
    }

    // -------------------------------------------------------------------------
    // Initial Load
    // -------------------------------------------------------------------------
    loadVoices();
    loadHistory();
    updateTextMetrics();
});
