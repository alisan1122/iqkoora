// ==========================================
// IQ KOORA - محرك صفحة تفاصيل المباراة والبث المباشر
// ==========================================

let hlsInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // جلب بيانات المباراة من localStorage
    const matchDataRaw = localStorage.getItem('selectedMatch');
    let match = null;

    if (matchDataRaw) {
        try {
            match = JSON.stringify ? JSON.parse(matchDataRaw) : null;
        } catch (e) {
            console.error("خطأ في قراءة بيانات المباراة:", e);
        }
    }

    if (!match) {
        // بيانات افتراضية مباراة البرازيل واليابان في حال الدخول المباشر
        match = {
            league: "مباريات ودية دولية",
            team1: { name: "البرازيل", logo: "https://cdn-icons-png.flaticon.com/512/197/197386.png" },
            team2: { name: "اليابان", logo: "https://cdn-icons-png.flaticon.com/512/197/197604.png" },
            status: "live",
            statusText: "مباشر 65'",
            score1: "2",
            score2: "1",
            date: "اليوم",
            streamUrl: "https://kora.depoooo.com/albaplayer/bein-1/"
        };
    }

    // تعبئة البيانات في العناصر
    document.getElementById('page-league-name').textContent = match.league;
    document.getElementById('page-team1-name').textContent = match.team1.name;
    document.getElementById('page-team2-name').textContent = match.team2.name;
    document.getElementById('page-match-date').textContent = match.date;
    document.getElementById('page-stream-title').textContent = `${match.team1.name} ضد ${match.team2.name}`;
    document.title = `IQ KOORA | ${match.team1.name} ضد ${match.team2.name}`;

    // اللوجوهات
    const logo1Container = document.getElementById('page-team1-logo');
    const logo2Container = document.getElementById('page-team2-logo');
    if (logo1Container) logo1Container.innerHTML = renderLogo(match.team1.logo);
    if (logo2Container) logo2Container.innerHTML = renderLogo(match.team2.logo);

    // الحالة
    const statusElem = document.getElementById('page-match-status');
    if (statusElem) {
        statusElem.className = `match-status ${getStatusClass(match.status)}`;
        statusElem.innerHTML = `${match.status === 'live' ? '<span style="display:inline-block; width:6px; height:6px; background-color:#ff4d94; border-radius:50%; margin-left:4px;"></span>' : ''} ${match.statusText}`;
    }

    // النتيجة
    const scoreContainer = document.getElementById('page-score-container');
    if (scoreContainer) {
        if (match.status === 'time') {
            scoreContainer.className = 'hero-score-numbers not-started';
            scoreContainer.textContent = 'لم تبدأ بعد';
        } else {
            scoreContainer.className = 'hero-score-numbers';
            scoreContainer.innerHTML = `<span>${match.score1}</span><span class="score-dash">-</span><span>${match.score2}</span>`;
        }
    }

    // معلومات وتفاصيل إضافية للمباراة
    document.getElementById('info-time').textContent = match.statusText || match.date;

    // تهيئة وتشغيل المشغل
    initHlsPlayer(match);
});

function renderLogo(logo) {
    if (logo && (logo.includes('.') || logo.includes('/'))) {
        return `<img src="${logo}" alt="logo" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/53/53283.png';" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">`;
    }
    return logo || "⚽";
}

function getStatusClass(status) {
    if (status === 'live') return 'status-live';
    if (status === 'finished') return 'status-finished';
    return 'status-time';
}

function initHlsPlayer(matchData) {
    const videoPlayer = document.getElementById('page-video-player');
    const iframePlayer = document.getElementById('page-iframe-player');
    const loader = document.getElementById('page-video-loader');
    const serverBtns = document.querySelectorAll('.server-btn');

    const isBrazilJapan = matchData && matchData.team1 && matchData.team2 && 
        ((matchData.team1.name.includes('البرازيل') && matchData.team2.name.includes('اليابان')) ||
         (matchData.team1.name.includes('اليابان') && matchData.team2.name.includes('البرازيل')));

    const targetStreamUrl = (matchData && matchData.streamUrl) || (isBrazilJapan ? 'https://kora.depoooo.com/albaplayer/bein-1/' : null);

    if (serverBtns && (targetStreamUrl || isBrazilJapan)) {
        serverBtns.forEach(btn => {
            btn.setAttribute('data-stream', 'https://kora.depoooo.com/albaplayer/bein-1/');
        });
    }

    function loadStream(url) {
        if (loader) loader.classList.remove('hidden');

        const isIframe = url.includes('albaplayer') || url.includes('depoooo.com') || (!url.includes('.m3u8') && !url.includes('.mp4'));

        if (isIframe) {
            if (hlsInstance) {
                hlsInstance.destroy();
                hlsInstance = null;
            }
            if (videoPlayer) {
                videoPlayer.pause();
                videoPlayer.style.display = 'none';
            }
            if (iframePlayer) {
                iframePlayer.style.display = 'block';
                iframePlayer.src = url;
            }
            if (loader) {
                setTimeout(() => loader.classList.add('hidden'), 500);
            }
        } else {
            if (iframePlayer) {
                iframePlayer.style.display = 'none';
                iframePlayer.src = '';
            }
            if (videoPlayer) {
                videoPlayer.style.display = 'block';
            }
            if (hlsInstance) {
                hlsInstance.destroy();
            }

            if (Hls.isSupported()) {
                hlsInstance = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true
                });
                hlsInstance.loadSource(url);
                hlsInstance.attachMedia(videoPlayer);

                hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () {
                    if (loader) loader.classList.add('hidden');
                    videoPlayer.play().catch(e => console.log("Auto-play:", e));
                });
            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                videoPlayer.src = url;
                videoPlayer.addEventListener('loadedmetadata', function () {
                    if (loader) loader.classList.add('hidden');
                    videoPlayer.play().catch(e => console.log("Auto-play:", e));
                });
            }
        }
    }

    // السيرفر الافتراضي
    const activeBtn = document.querySelector('.server-btn.active') || serverBtns[0];
    const defaultUrl = targetStreamUrl || (activeBtn ? activeBtn.getAttribute('data-stream') : 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
    loadStream(defaultUrl);

    // ربط أزرار السيرفرات
    if (serverBtns) {
        serverBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                serverBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadStream(btn.getAttribute('data-stream'));
            });
        });
    }
}

