let pz;
let countriesMaster = [];
let CFR_DATA = {};
let FEED_LOGS = {};

async function boot() {
    try {
        const [m, s, c, f] = await Promise.all([
            fetch('./countries.json').then(r => r.json()),
            fetch('./world.svg').then(r => r.text()),
            fetch('./conflicts.json').then(r => r.json()),
            fetch('./feed.json').then(r => r.json())
        ]);
        
        countriesMaster = Object.values(m).flat();
        CFR_DATA = c;
        FEED_LOGS = f;
        
        document.getElementById('map-wrapper').innerHTML = s;
        setup();
        draw();
        ticker();
        initClock();
        pz.fit();
        pz.center();

        const params = new URLSearchParams(window.location.search);
        const sectorCode = params.get('sector');
        if (sectorCode) setTimeout(() => focus(sectorCode.toUpperCase()), 500);
    } catch (e) {
        console.error("SYSTEM_FAILURE", e);
    }
}

function initClock() {
    const clockEl = document.getElementById('clock-display');
    const updateTime = () => {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];
        clockEl.textContent = `${dateStr} | ${timeStr}`;
    };
    updateTime();
    setInterval(updateTime, 1000);
}

function setup() {
    const v = document.querySelector('svg');
    pz = svgPanZoom(v, {
        zoomEnabled: true, 
        fit: true, 
        center: true, 
        maxZoom: 80,
        mouseWheelZoomEnabled: true,
        controlIconsEnabled: false,
        eventsListenerElement: document.getElementById('map-wrapper')
    });

    document.querySelectorAll('path').forEach(p => {
        if (CFR_DATA[p.id]) p.classList.add('conflict-active');
        p.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            focus(p.id);
        });
    });

    v.addEventListener('pointerdown', (e) => {
        if (e.target.tagName === 'svg') kill();
    });
}

function toggleBoard(forceState = null) {
    const board = document.getElementById('conflict-board');
    const btn = document.getElementById('board-toggle');
    
    if (forceState === 'collapse') board.classList.add('collapsed');
    else if (forceState === 'expand') board.classList.remove('collapsed');
    else board.classList.toggle('collapsed');
    
    btn.textContent = board.classList.contains('collapsed') ? '▵' : '_';
}

function draw() {
    const stream = document.getElementById('conflict-stream');
    const statsContainer = document.getElementById('level-stats');
    stream.innerHTML = '';
    
    const stats = { CRITICAL: 0, SIGNIFICANT: 0, LIMITED: 0 };
    Object.values(CFR_DATA).forEach(d => { 
        if(stats[d.risk.toUpperCase()] !== undefined) stats[d.risk.toUpperCase()]++; 
    });

    statsContainer.innerHTML = Object.entries(stats).map(([level, count]) => `
        <div class="stat-item">${level}:<span class="stat-count">${count}</span></div>
    `).join('');

    Object.entries(CFR_DATA).forEach(([code, data]) => {
        const country = countriesMaster.find(x => x.code === code);
        if (!country) return;
        const card = document.createElement('div');
        card.className = 'intel-card';
        card.innerHTML = `
            <div class="card-name">${country.emoji} ${country.name.toUpperCase()}</div>
            <div class="card-risk">IMPACT: ${data.risk}</div>
            <div class="card-subj">${data.subject}</div>
        `;
        card.onpointerdown = () => focus(code);
        stream.appendChild(card);
    });
}

function ticker() {
    const t = document.getElementById('news-ticker');
    const log = Object.values(FEED_LOGS).map(entry => `${entry} — `).join(' ');
    t.textContent = (log + " ").repeat(2);
}

function focus(code) {
    const path = document.getElementById(code);
    const country = countriesMaster.find(x => x.code === code);
    const portal = document.getElementById('info-portal');
    if (!path || !country) return;
    
    if (path.classList.contains('selected')) { kill(); return; }
    document.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
    path.classList.add('selected');

    toggleBoard('collapse');

    const data = CFR_DATA[code];
    document.getElementById('p-emoji').textContent = country.emoji;
    document.getElementById('p-name').textContent = country.name;
    document.getElementById('p-code').textContent = `SECTOR: ${code}`;
    
    const riskTag = document.getElementById('p-risk-tag');
    const subjectBox = document.getElementById('p-subject');
    
    if (data) {
        riskTag.textContent = `IMPACT: ${data.risk}`;
        riskTag.classList.add('risk-active-tag');
        subjectBox.textContent = data.subject;
        subjectBox.classList.add('subject-active');
    } else {
        riskTag.textContent = `STATUS: STABLE`;
        riskTag.classList.remove('risk-active-tag');
        subjectBox.textContent = "Sector monitoring active. No critical conflicts reported.";
        subjectBox.classList.remove('subject-active');
    }

    portal.classList.remove('hidden');

    const bbox = path.getBBox();
    const wrapper = document.getElementById('map-wrapper');
    const targetZoom = Math.min(wrapper.clientWidth / bbox.width, wrapper.clientHeight / bbox.height) * 0.4;
    const finalZoom = Math.min(Math.max(targetZoom, 2), 15);

    const isMobile = window.innerWidth <= 768;
    const offsetX = isMobile ? (wrapper.clientWidth / 2) : (wrapper.clientWidth * 0.65);
    const offsetY = isMobile ? (wrapper.clientHeight * 0.4) : (wrapper.clientHeight / 2);

    const targetX = offsetX - ((bbox.x + bbox.width / 2) * finalZoom);
    const targetY = offsetY - ((bbox.y + bbox.height / 2) * finalZoom);

    pz.zoom(1.1);
    
    setTimeout(() => {
        pz.zoom(finalZoom);
        pz.pan({ x: targetX, y: targetY });
    }, 50);
}

function kill() {
    document.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
    document.getElementById('info-portal').classList.add('hidden');
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function shareIntel() {
    const name = document.getElementById('p-name').innerText;
    const codeRaw = document.getElementById('p-code').innerText;
    const code = codeRaw.split(': ')[1];
    
    const url = `${window.location.origin}${window.location.pathname}?sector=${code}`;
    
    const shareData = {
        title: `Intel Report: ${name}`,
        text: `Active tactical sector monitoring for ${name} [${code}]. View the live theater:`,
        url: url
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(`${shareData.text} ${url}`);
            alert("SECURE INTEL COPIED TO CLIPBOARD");
        }
    } catch (err) {
        console.error("SHARE_LOG_FAILURE", err);
    }
}

function zoomInMap() { pz.zoomIn(); }
function zoomOutMap() { pz.zoomOut(); }
function resetMap() { kill(); pz.fit(); pz.center(); }

window.onload = boot;
