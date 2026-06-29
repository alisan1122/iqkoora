// ==========================================
// IQ KOORA - محرك جلب المباريات ومشغل البث المباشر HLS.js
// ==========================================

// قائمة البطولات المشمولة
const LEAGUES = [
    { id: 'fifa.world', name: 'كأس العالم' },
    { id: 'uefa.champions', name: 'دوري أبطال أوروبا' },
    { id: 'eng.1', name: 'الدوري الإنجليزي الممتاز' },
    { id: 'esp.1', name: 'الدوري الإسباني' },
    { id: 'ita.1', name: 'الدوري الإيطالي' },
    { id: 'ger.1', name: 'الدوري الألماني' },
    { id: 'fra.1', name: 'الدوري الفرنسي' },
    { id: 'sau.1', name: 'الدوري السعودي للمحترفين' },
    { id: 'uefa.europa', name: 'الدوري الأوروبي' },
    { id: 'fifa.friendly', name: 'مباريات ودية دولية' }
];

// قاموس الترجمة إلى العربية
const TEAM_TRANSLATIONS = {
    "Japan": "اليابان", "Brazil": "البرازيل", "Paraguay": "باراغواي", "Germany": "ألمانيا",
    "Morocco": "المغرب", "Netherlands": "هولندا", "Argentina": "الأرجنتين", "France": "فرنسا",
    "Spain": "إسبانيا", "England": "إنجلترا", "Portugal": "البرتغال", "Italy": "إيطاليا",
    "Belgium": "بلجيكا", "Croatia": "كرواتيا", "Uruguay": "أوروغواي", "Saudi Arabia": "السعودية",
    "Egypt": "مصر", "Algeria": "الجزائر", "Tunisia": "تونس", "Iraq": "العراق",
    "Jordan": "الأردن", "Qatar": "قطر", "UAE": "الإمارات",

    "Arsenal": "أرسنال", "Manchester City": "مانشستر سيتي", "Manchester United": "مانشستر يونايتد",
    "Liverpool": "ليفربول", "Chelsea": "تشيلسي", "Tottenham Hotspur": "توتنهام",
    "Newcastle United": "نيوكاسل", "Aston Villa": "أستون فيلا",

    "Real Madrid": "ريال مدريد", "Barcelona": "برشلونة", "Atletico Madrid": "أتلتيكو مدريد",
    "Sevilla": "إشبيلية", "Villarreal": "فياريال", "Real Sociedad": "ريال سوسيداد",

    "Inter Milan": "إنتر ميلان", "AC Milan": "إيه سي ميلان", "Juventus": "يوفنتوس",
    "Napoli": "نابولي", "AS Roma": "روما", "Lazio": "لاتسيو",

    "Bayern Munich": "بايرن ميونخ", "Borussia Dortmund": "بوروسيا دورتموند",
    "Bayer Leverkusen": "باير ليفركوزن", "RB Leipzig": "لايبزيغ",

    "Paris Saint-Germain": "باريس سان جيرمان", "Olympique Marseille": "مارسيليا", "AS Monaco": "موناكو",
    "Al Hilal": "الهلال", "Al Nassr": "النصر", "Al Ittihad": "الاتحاد", "Al Ahli": "الأهلي"
};

// حالة التطبيق المحلية
let cachedMatches = [];
let currentActiveTab = 'today';
let currentLeagueFilter = 'all';
let currentSearchQuery = '';

// متغيرة مشغل HLS
let hlsInstance = null;

// عناصر الواجهة (DOM Elements)
const tabs = document.querySelectorAll('.tab-btn');
const matchesContainer = document.getElementById('matches-container');
const searchInput = document.getElementById('search-input');
const refreshBtn = document.getElementById('refresh-btn');
const matchesCountPill = document.getElementById('matches-count-pill');
const filterChips = document.querySelectorAll('.filter-chip');

// عناصر نافذة المشغل
const playerModal = document.getElementById('player-modal');
const playerMatchTitle = document.getElementById('player-match-title');
const closePlayerBtn = document.getElementById('close-player-btn');
const hlsVideoPlayer = document.getElementById('hls-video-player');
const videoLoader = document.getElementById('video-loader');
const serverBtns = document.querySelectorAll('.server-btn');

// تنسيق التواريخ والأسماء
function getFormattedDate(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function getDisplayDate(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}

function translateTeamName(name) {
    if (!name) return "فريق";
    return TEAM_TRANSLATIONS[name] || name;
}

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

// جلب المباريات من الـ API
async function fetchMatchesData(dayTarget) {
    let offset = 0;
    if (dayTarget === 'yesterday') offset = -1;
    if (dayTarget === 'tomorrow') offset = 1;

    const dateStr = getFormattedDate(offset);
    const fallbackDateDisplay = getDisplayDate(offset);

    try {
        const fetchPromises = LEAGUES.map(league =>
            fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard?dates=${dateStr}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null)
        );

        const results = await Promise.all(fetchPromises);
        const allMatches = [];

        results.forEach((data, index) => {
            if (data && data.events && data.events.length > 0) {
                const leagueName = LEAGUES[index].name;

                data.events.forEach(event => {
                    const competition = event.competitions && event.competitions[0];
                    if (!competition) return;

                    const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home') || competition.competitors[0];
                    const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away') || competition.competitors[1];

                    if (!homeCompetitor || !awayCompetitor) return;

                    let status = "time";
                    let statusText = "";
                    const state = event.status?.type?.state;
                    const completed = event.status?.type?.completed;

                    if (completed || state === 'post') {
                        status = "finished";
                        statusText = "انتهت";
                    } else if (state === 'in') {
                        status = "live";
                        const clock = event.status?.displayClock || `${event.status?.clock || ''}'`;
                        statusText = `مباشر ${clock}`;
                    } else {
                        status = "time";
                        const matchDate = new Date(event.date);
                        statusText = matchDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                    }

                    const t1 = translateTeamName(homeCompetitor.team?.displayName || homeCompetitor.team?.name);
                    const t2 = translateTeamName(awayCompetitor.team?.displayName || awayCompetitor.team?.name);

                    const isBrazilJapan = (t1.includes('البرازيل') && t2.includes('اليابان')) || (t1.includes('اليابان') && t2.includes('البرازيل'));

                    allMatches.push({
                        id: event.id || Math.random(),
                        league: leagueName,
                        team1: {
                            name: t1,
                            logo: homeCompetitor.team?.logo || "⚽"
                        },
                        team2: {
                            name: t2,
                            logo: awayCompetitor.team?.logo || "⚽"
                        },
                        status: status,
                        statusText: statusText,
                        score1: homeCompetitor.score !== undefined ? homeCompetitor.score : "0",
                        score2: awayCompetitor.score !== undefined ? awayCompetitor.score : "0",
                        date: fallbackDateDisplay,
                        streamUrl: isBrazilJapan ? 'https://kora.depoooo.com/albaplayer/bein-1/' : null
                    });
                });
            }
        });

        // التأكد من وجود مباراة البرازيل واليابان في قائمة مباريات اليوم
        const hasBrazilJapan = allMatches.some(m =>
            (m.team1.name.includes('البرازيل') && m.team2.name.includes('اليابان')) ||
            (m.team1.name.includes('اليابان') && m.team2.name.includes('البرازيل'))
        );

        if (!hasBrazilJapan && dayTarget === 'today') {
            allMatches.unshift({
                id: 'brazil-japan-live-special',
                league: 'مباريات ودية دولية',
                team1: { name: 'البرازيل', logo: 'https://cdn-icons-png.flaticon.com/512/197/197386.png' },
                team2: { name: 'اليابان', logo: 'https://cdn-icons-png.flaticon.com/512/197/197604.png' },
                status: 'live',
                statusText: "مباشر 65'",
                score1: '2',
                score2: '1',
                date: fallbackDateDisplay,
                streamUrl: 'https://kora.depoooo.com/albaplayer/bein-1/'
            });
        }

        return allMatches;

    } catch (error) {
        console.error("خطأ أثناء جلب البيانات:", error);
        return [];
    }
}

// فتح صفحة تفاصيل المباراة في نافذة جديدة
function openMatchDetails(matchIndex) {
    const match = cachedMatches[matchIndex];
    if (match) {
        localStorage.setItem('selectedMatch', JSON.stringify(match));
        window.open('match.html', '_blank');
    }
}

// تصفية ورندر المباريات
function renderFilteredMatches() {
    let filtered = cachedMatches;

    if (currentSearchQuery.trim() !== '') {
        const query = currentSearchQuery.toLowerCase().trim();
        filtered = filtered.filter(m =>
            m.team1.name.toLowerCase().includes(query) ||
            m.team2.name.toLowerCase().includes(query) ||
            m.league.toLowerCase().includes(query)
        );
    }

    if (currentLeagueFilter !== 'all') {
        filtered = filtered.filter(m => m.league.includes(currentLeagueFilter));
    }

    const liveCount = cachedMatches.filter(m => m.status === 'live').length;
    if (matchesCountPill) {
        matchesCountPill.innerHTML = `مباريات اليوم: <strong>${cachedMatches.length}</strong> ${liveCount > 0 ? `<span style="color:var(--accent-3); margin-right:5px;">(${liveCount} مباشر 🔴)</span>` : ''}`;
    }

    matchesContainer.innerHTML = '';

    if (!filtered || filtered.length === 0) {
        matchesContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 4rem 1rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 24px; backdrop-filter: blur(16px);">
                <h3 style="color:var(--text-primary); margin-bottom: 0.5rem; font-size:1.4rem;">لا توجد مباريات مطابقة</h3>
                <p style="color:var(--text-secondary); font-size:1rem;">جرب التغيير في كلمات البحث أو اختيار فلتر بطولة آخر.</p>
            </div>
        `;
        return;
    }

    filtered.forEach((match, index) => {
        const matchCard = document.createElement('div');
        matchCard.className = 'match-card';
        matchCard.style.animationDelay = `${index * 0.04}s`;

        const isLive = match.status === 'live';
        const isNotStarted = match.status === 'time';

        // زر مشاهدة البث يظهر فقط في مباريات اليوم وعندما تكون المباراة جارية ومباشرة (live)
        const showStreamButton = currentActiveTab === 'today' && isLive;

        // النتيجة
        const scoreHtml = isNotStarted ? `
            <div class="score-numbers not-started">
                لم تبدأ بعد
            </div>
        ` : `
            <div class="score-numbers">
                <span>${match.score1}</span>
                <span class="score-dash">-</span>
                <span>${match.score2}</span>
            </div>
        `;

        // تخزين مؤشر المباراة في المصفوفة الأصلية
        const originalIndex = cachedMatches.findIndex(m => m.id === match.id);

        matchCard.innerHTML = `
            <div class="match-header">
                <div class="league-info">
                    <span>${match.league}</span>
                </div>
                <div class="match-status ${getStatusClass(match.status)}">
                    ${isLive ? '<span style="display:inline-block; width:6px; height:6px; background-color:#ff4d94; border-radius:50%; margin-left:4px;"></span>' : ''}
                    ${match.statusText}
                </div>
            </div>
            
            <div class="match-teams">
                <div class="team">
                    <div class="team-logo-container">
                        <div class="team-logo">${renderLogo(match.team1.logo)}</div>
                    </div>
                    <div class="team-name">${match.team1.name}</div>
                </div>
                
                <div class="match-score">
                    ${scoreHtml}
                    <div class="match-date">${match.date}</div>
                </div>
                
                <div class="team">
                    <div class="team-logo-container">
                        <div class="team-logo">${renderLogo(match.team2.logo)}</div>
                    </div>
                    <div class="team-name">${match.team2.name}</div>
                </div>
            </div>

            <div class="match-actions-group">
                <button class="details-btn" onclick="openMatchDetails(${originalIndex})">
                    تفاصيل المباراة ➔
                </button>
                ${showStreamButton ? `
                    <button class="watch-live-btn live-now" onclick="openLivePlayer(${originalIndex})">
                        البث المباشر 🔴
                    </button>
                ` : ''}
            </div>
        `;

        matchesContainer.appendChild(matchCard);
    });
}

// دالة تحميل البيانات
async function loadMatches(day) {
    currentActiveTab = day;
    matchesContainer.classList.add('fade-out');

    setTimeout(() => {
        matchesContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 4rem 1rem;">
                <div style="display:inline-block; width: 45px; height: 45px; border: 4px solid var(--glass-border); border-top-color: var(--accent-glow); border-radius: 50%; animation: spinSlow 1s infinite linear;"></div>
                <p style="color:var(--text-secondary); margin-top:1.2rem; font-weight:700; font-size:1.1rem;">جاري الاتصال المباشر بالـ API وكشوفات المباريات...</p>
            </div>
        `;
        matchesContainer.classList.remove('fade-out');
    }, 250);

    cachedMatches = await fetchMatchesData(day);

    matchesContainer.classList.add('fade-out');
    setTimeout(() => {
        renderFilteredMatches();
        matchesContainer.classList.remove('fade-out');
    }, 250);
}

// ==========================================
// محرك البث المباشر HLS.js & Iframe Player Engine
// ==========================================

let activeMatchForModal = null;

function playStreamSource(url) {
    const iframeVideoPlayer = document.getElementById('iframe-video-player');
    if (videoLoader) videoLoader.classList.remove('hidden');

    const isIframeStream = url.includes('albaplayer') || url.includes('depoooo.com') || (!url.includes('.m3u8') && !url.includes('.mp4'));

    if (isIframeStream) {
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
        if (hlsVideoPlayer) {
            hlsVideoPlayer.pause();
            hlsVideoPlayer.style.display = 'none';
        }
        if (iframeVideoPlayer) {
            iframeVideoPlayer.style.display = 'block';
            iframeVideoPlayer.src = url;
        }
        if (videoLoader) {
            setTimeout(() => videoLoader.classList.add('hidden'), 500);
        }
    } else {
        if (iframeVideoPlayer) {
            iframeVideoPlayer.style.display = 'none';
            iframeVideoPlayer.src = '';
        }
        if (hlsVideoPlayer) {
            hlsVideoPlayer.style.display = 'block';
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
            hlsInstance.attachMedia(hlsVideoPlayer);

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () {
                if (videoLoader) videoLoader.classList.add('hidden');
                hlsVideoPlayer.play().catch(e => console.log("Auto-play blocked:", e));
            });

            hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log("Network error, recovering...");
                            hlsInstance.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log("Media error, recovering...");
                            hlsInstance.recoverMediaError();
                            break;
                        default:
                            hlsInstance.destroy();
                            break;
                    }
                }
            });
        } else if (hlsVideoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            hlsVideoPlayer.src = url;
            hlsVideoPlayer.addEventListener('loadedmetadata', function () {
                if (videoLoader) videoLoader.classList.add('hidden');
                hlsVideoPlayer.play().catch(e => console.log("Auto-play blocked:", e));
            });
        }
    }
}

function openLivePlayer(index) {
    let match = null;
    if (typeof index === 'number') {
        match = cachedMatches[index];
    } else if (typeof index === 'string') {
        match = cachedMatches.find(m => `${m.team1.name} ضد ${m.team2.name} - ${m.league}` === index);
    }

    if (!match) {
        if (playerMatchTitle) playerMatchTitle.textContent = index || "البث المباشر";
        if (playerModal) playerModal.classList.add('active');
        playStreamSource('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
        return;
    }

    activeMatchForModal = match;
    const title = `${match.team1.name} ضد ${match.team2.name} - ${match.league}`;
    if (playerMatchTitle) playerMatchTitle.textContent = title;
    if (playerModal) playerModal.classList.add('active');

    const isBrazilJapan = (match.team1.name.includes('البرازيل') && match.team2.name.includes('اليابان')) ||
                          (match.team1.name.includes('اليابان') && match.team2.name.includes('البرازيل'));

    const streamUrl = match.streamUrl || (isBrazilJapan ? 'https://kora.depoooo.com/albaplayer/bein-1/' : null);

    if (serverBtns) {
        serverBtns.forEach(btn => {
            if (isBrazilJapan || match.streamUrl) {
                btn.setAttribute('data-stream', 'https://kora.depoooo.com/albaplayer/bein-1/');
            } else {
                const defaultServerStreams = [
                    'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
                    'https://multiplatform-f.akamaihd.net/i/multi/will/bbb/big_buck_bunny_,640x360_400,1000x576_800,1280x720_1200,1920x1080_1500,.mp4.csmil/master.m3u8',
                    'https://demo.unified-streaming.com/k8s/live/stable/scte35.isml/.m3u8'
                ];
                const serverIndex = Array.from(serverBtns).indexOf(btn);
                if (serverIndex >= 0 && defaultServerStreams[serverIndex]) {
                    btn.setAttribute('data-stream', defaultServerStreams[serverIndex]);
                }
            }
        });
    }

    const activeServerBtn = document.querySelector('.server-btn.active') || serverBtns[0];
    const targetUrl = streamUrl || (activeServerBtn ? activeServerBtn.getAttribute('data-stream') : 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');

    playStreamSource(targetUrl);
}

function closeLivePlayer() {
    const iframeVideoPlayer = document.getElementById('iframe-video-player');
    if (playerModal) playerModal.classList.remove('active');
    if (hlsVideoPlayer) {
        hlsVideoPlayer.pause();
        hlsVideoPlayer.removeAttribute('src');
        hlsVideoPlayer.load();
    }
    if (iframeVideoPlayer) {
        iframeVideoPlayer.src = '';
        iframeVideoPlayer.style.display = 'none';
    }
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
}

// أحداث مشغل البث المباشر
if (closePlayerBtn) {
    closePlayerBtn.addEventListener('click', closeLivePlayer);
}

if (playerModal) {
    playerModal.addEventListener('click', (e) => {
        if (e.target === playerModal) {
            closeLivePlayer();
        }
    });
}

// التنقل بين سيرفرات البث
if (serverBtns) {
    serverBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            serverBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const streamUrl = btn.getAttribute('data-stream');
            playStreamSource(streamUrl);
        });
    });
}

// الأحداث والتنقل في الصفحة
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.classList.contains('active')) return;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        loadMatches(tab.getAttribute('data-target'));
    });
});

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value;
        renderFilteredMatches();
    });
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        refreshBtn.style.transform = 'rotate(360deg)';
        loadMatches(currentActiveTab);
        setTimeout(() => { refreshBtn.style.transform = 'none'; }, 600);
    });
}

if (filterChips) {
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            currentLeagueFilter = chip.getAttribute('data-league');
            renderFilteredMatches();
        });
    });
}

// التشغيل الابتدائي
document.addEventListener('DOMContentLoaded', () => {
    loadMatches('today');

    setInterval(() => {
        if (currentActiveTab === 'today') {
            fetchMatchesData('today').then(data => {
                cachedMatches = data;
                renderFilteredMatches();
            });
        }
    }, 60000);
});
