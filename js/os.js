// Bichu OS: the working mini computer in the hero.
// Boot sequence, clock, network wallpaper, window manager, blog loader and a small terminal.
(() => {
    const screen = document.getElementById('os-screen');
    if (!screen) return;

    const hero = screen.closest('.os-hero');
    const viewport = screen.parentElement;
    const layer = screen.querySelector('.os-windows');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const phone = matchMedia('(max-width: 767px)');
    const W = 1280;
    const H = 760;
    let scale = 1;

    /* ---------- Fit the 1280×760 screen into the monitor ---------- */
    const fit = () => {
        scale = phone.matches ? 1 : viewport.clientWidth / W;
        screen.style.setProperty('--s', scale);
        wallpaper.resize();
    };

    /* ---------- Clock ---------- */
    const clock = screen.querySelector('.os-clock');
    const tick = () => {
        const now = new Date();
        clock.textContent = now.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        clock.dateTime = now.toISOString();
    };
    tick();
    setInterval(tick, 20000);

    /* ---------- Network wallpaper ---------- */
    const wallpaper = (() => {
        const canvas = screen.querySelector('.os-wallpaper');
        const ctx = canvas.getContext('2d');
        const pointer = { x: -999, y: -999 };
        let nodes = [];
        let w = 0;
        let h = 0;
        let running = false;

        const seed = () => {
            const count = Math.round((w * h) / (phone.matches ? 9000 : 13000));
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.25,
                vy: (Math.random() - 0.5) * 0.25,
                r: Math.random() < 0.08 ? 2.6 : 1 + Math.random() * 1.2,
            }));
        };

        const resize = () => {
            w = canvas.offsetWidth;
            h = canvas.offsetHeight;
            const ratio = Math.min(window.devicePixelRatio || 1, 2) * scale;
            canvas.width = Math.max(1, Math.round(w * ratio));
            canvas.height = Math.max(1, Math.round(h * ratio));
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            if (!nodes.length || nodes.length < 5) seed();
            if (!running) draw();
        };

        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            const link = 130;
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < link) {
                        ctx.strokeStyle = `rgba(217,183,120,${(1 - d / link) * 0.28})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
                const dp = Math.hypot(a.x - pointer.x, a.y - pointer.y);
                if (dp < 170) {
                    ctx.strokeStyle = `rgba(243,223,174,${(1 - dp / 170) * 0.55})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(pointer.x, pointer.y);
                    ctx.stroke();
                }
            }
            for (const n of nodes) {
                ctx.fillStyle = n.r > 2 ? 'rgba(243,223,174,0.95)' : 'rgba(217,183,120,0.7)';
                if (n.r > 2) { ctx.shadowColor = 'rgba(217,183,120,0.9)'; ctx.shadowBlur = 10; }
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        };

        const step = () => {
            if (!running) return;
            for (const n of nodes) {
                n.x += n.vx;
                n.y += n.vy;
                if (n.x < 0 || n.x > w) n.vx *= -1;
                if (n.y < 0 || n.y > h) n.vy *= -1;
            }
            draw();
            requestAnimationFrame(step);
        };

        const setRunning = (on) => {
            if (reduceMotion || on === running) return;
            running = on;
            if (on) requestAnimationFrame(step);
        };

        screen.addEventListener('pointermove', (e) => {
            const r = screen.getBoundingClientRect();
            pointer.x = (e.clientX - r.left) / scale;
            pointer.y = (e.clientY - r.top) / scale;
        });
        screen.addEventListener('pointerleave', () => { pointer.x = pointer.y = -999; });

        return { resize, setRunning };
    })();

    new ResizeObserver(fit).observe(viewport);
    fit();

    let heroVisible = true;
    new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        wallpaper.setRunning(heroVisible && !document.hidden);
    }).observe(viewport);
    document.addEventListener('visibilitychange', () => wallpaper.setRunning(heroVisible && !document.hidden));

    /* ---------- Boot sequence ---------- */
    const boot = screen.querySelector('.os-boot');
    const powerOn = () => requestAnimationFrame(() => hero.classList.add('is-on'));

    const finishBoot = () => {
        if (boot.classList.contains('is-done')) return;
        boot.classList.add('is-done');
        setTimeout(() => boot.remove(), 600);
        try { sessionStorage.setItem('bichu-os-booted', '1'); } catch { /* storage blocked */ }
    };

    let booted = false;
    try { booted = sessionStorage.getItem('bichu-os-booted') === '1'; } catch { /* storage blocked */ }

    if (reduceMotion || booted) {
        boot.remove();
        powerOn();
    } else {
        powerOn();
        const log = boot.querySelector('.os-boot-log');
        const bar = boot.querySelector('.os-boot-bar span');
        const lines = [
            'BICHU OS v1.0',
            'loading flutter.engine ............ ok',
            'mounting /projects/tian ........... ok',
            'starting ai.services .............. ok',
            'welcome, visitor.',
        ];
        lines.forEach((line, i) => {
            setTimeout(() => {
                log.textContent += (i ? '\n' : '') + line;
                bar.style.width = `${((i + 1) / lines.length) * 100}%`;
            }, 250 + i * 300);
        });
        setTimeout(finishBoot, 250 + lines.length * 300 + 350);
        boot.addEventListener('click', finishBoot);
    }

    /* ---------- Window manager ---------- */
    const windows = new Map();
    let zTop = 10;
    let cascade = 0;
    const dockButtons = [...screen.querySelectorAll('.os-dock [data-open]')];
    const desk = () => ({ top: phone.matches ? 32 : 36, bottom: phone.matches ? 76 : 86 });

    const markDock = () => {
        dockButtons.forEach((b) => b.classList.toggle('is-open', windows.has(b.dataset.open)));
    };

    const focusWindow = (win) => {
        windows.forEach((w) => w.classList.toggle('is-focused', w === win));
        win.style.zIndex = ++zTop;
    };

    const closeWindow = (win) => {
        const id = win.dataset.app;
        win.dispatchEvent(new CustomEvent('os:close'));
        win.classList.add('is-closing');
        windows.delete(id);
        markDock();
        setTimeout(() => win.remove(), reduceMotion ? 0 : 180);
        const next = [...windows.values()].sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
        if (next) focusWindow(next);
    };

    const openApp = (id) => {
        const existing = windows.get(id);
        if (existing) {
            existing.classList.remove('is-min');
            focusWindow(existing);
            return existing;
        }
        const tpl = document.getElementById(`app-${id}`);
        if (!tpl) return null;

        const [w, h] = tpl.dataset.size.split('x').map(Number);
        const { top, bottom } = desk();
        const room = H - top - bottom;
        const height = Math.min(h, room - 20);
        const offset = (cascade++ % 5) * 26;

        const win = document.createElement('section');
        win.className = 'os-window is-opening';
        win.dataset.app = id;
        win.setAttribute('role', 'dialog');
        win.setAttribute('aria-label', tpl.dataset.title);
        win.style.width = `${w}px`;
        win.style.height = `${height}px`;
        win.style.left = `${Math.round((W - w) / 2 + offset - 40)}px`;
        win.style.top = `${Math.round(top + (room - height) / 2 + offset - 30)}px`;
        win.innerHTML = `
            <header class="os-titlebar">
                <div class="os-lights">
                    <button type="button" class="l-close" aria-label="Close"></button>
                    <button type="button" class="l-min" aria-label="Minimise"></button>
                    <button type="button" class="l-max" aria-label="Maximise"></button>
                </div>
                <button type="button" class="os-back" aria-label="Back to desktop"><i class="bi bi-chevron-left"></i> Home</button>
                <span class="os-title"><i class="bi ${tpl.dataset.icon}"></i>${tpl.dataset.title}</span>
            </header>
            <div class="os-body"></div>`;
        win.querySelector('.os-body').append(tpl.content.cloneNode(true));
        layer.append(win);
        windows.set(id, win);
        focusWindow(win);
        markDock();
        requestAnimationFrame(() => requestAnimationFrame(() => win.classList.remove('is-opening')));

        win.addEventListener('pointerdown', () => focusWindow(win));
        win.querySelector('.l-close').addEventListener('click', () => closeWindow(win));
        win.querySelector('.os-back').addEventListener('click', () => closeWindow(win));
        win.querySelector('.l-min').addEventListener('click', () => {
            win.classList.add('is-min');
            win.classList.remove('is-focused');
        });
        win.querySelector('.l-max').addEventListener('click', () => win.classList.toggle('is-max'));
        win.querySelector('.os-titlebar').addEventListener('dblclick', (e) => {
            if (!e.target.closest('button')) win.classList.toggle('is-max');
        });
        win.querySelectorAll('[data-close-os]').forEach((a) => a.addEventListener('click', () => closeWindow(win)));
        win.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openApp(b.dataset.open)));
        enableDrag(win);

        apps[id]?.(win);
        return win;
    };

    const enableDrag = (win) => {
        const bar = win.querySelector('.os-titlebar');
        bar.addEventListener('pointerdown', (e) => {
            if (phone.matches || win.classList.contains('is-max') || e.target.closest('button')) return;
            const startX = e.clientX;
            const startY = e.clientY;
            const left = parseFloat(win.style.left);
            const top = parseFloat(win.style.top);
            const { top: minTop, bottom } = desk();
            bar.setPointerCapture(e.pointerId);
            win.style.transition = 'none';

            const move = (ev) => {
                const x = left + (ev.clientX - startX) / scale;
                const y = top + (ev.clientY - startY) / scale;
                win.style.left = `${Math.min(Math.max(x, 80 - win.offsetWidth), W - 80)}px`;
                win.style.top = `${Math.min(Math.max(y, minTop), H - bottom - 38)}px`;
            };
            const up = () => {
                bar.removeEventListener('pointermove', move);
                bar.removeEventListener('pointerup', up);
                win.style.transition = '';
            };
            bar.addEventListener('pointermove', move);
            bar.addEventListener('pointerup', up);
        });
    };

    // Links that leave the OS (e.g. the drift game)
    screen.querySelectorAll('[data-link]').forEach((btn) => {
        btn.addEventListener('click', () => { location.href = btn.dataset.link; });
    });

    // Every [data-open] control on the desktop opens its app.
    screen.querySelectorAll(':scope > header [data-open], .os-desktop [data-open], .os-dock [data-open]').forEach((btn) => {
        btn.addEventListener('click', () => openApp(btn.dataset.open));
    });

    screen.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const top = [...windows.values()].find((w) => w.classList.contains('is-focused'));
        if (top) closeWindow(top);
    });

    /* ---------- Data: Medium articles and GitHub repos ---------- */
    const articles = fetch('data/medium.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => d.articles || [])
        .catch(() => []);

    articles.then((list) => {
        if (!list.length) return;
        screen.querySelector('[data-stat="articles"]').textContent = list.length;
        const latest = screen.querySelector('.os-latest-title');
        if (latest) latest.textContent = list[0].title;
    });

    fetch('https://api.github.com/users/bichu2913')
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((u) => { screen.querySelector('[data-stat="repos"]').textContent = u.public_repos; })
        .catch(() => { /* keep the dash */ });

    const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    /* ---------- App behaviour ---------- */
    const apps = {
        blog(win) {
            const box = win.querySelector('.app-blog-list');
            articles.then((list) => {
                if (!list.length) {
                    box.innerHTML = '<p class="app-muted">Articles could not load right now. Read them on Medium below.</p>';
                    return;
                }
                box.replaceChildren(...list.map((a) => {
                    const item = document.createElement('a');
                    item.className = 'blog-item';
                    item.href = a.url;
                    item.target = '_blank';
                    item.rel = 'noopener';
                    const img = document.createElement('img');
                    img.src = a.image;
                    img.alt = '';
                    img.loading = 'lazy';
                    const text = document.createElement('div');
                    const meta = document.createElement('span');
                    meta.className = 'blog-meta';
                    meta.textContent = `${formatDate(a.date)} · ${a.minutes} min read`;
                    const title = document.createElement('strong');
                    title.textContent = a.title;
                    const p = document.createElement('p');
                    p.textContent = a.summary;
                    text.append(meta, title, p);
                    item.append(img, text);
                    return item;
                }));
            });
        },

        terminal(win) {
            const out = win.querySelector('.term-output');
            const input = win.querySelector('.term-input');
            const body = win.querySelector('.os-body');
            const history = [];
            let cursor = 0;

            const print = (text, cls = 'term-res') => {
                const line = document.createElement('div');
                line.className = cls;
                line.textContent = text;
                out.append(line);
                return line;
            };
            const printLinks = (pairs) => pairs.forEach(([label, href]) => {
                const line = print(`${label.padEnd(10)} `);
                const a = document.createElement('a');
                a.href = href;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = href.replace(/^https?:\/\//, '');
                line.append(a);
            });

            const open = (app, msg) => { print(msg); setTimeout(() => openApp(app), 250); };

            const commands = {
                help: () => print([
                    'Available commands:',
                    '  whoami      who is Bichu',
                    '  about       open the About app',
                    '  projects    open Projects',
                    '  skills      open Skills',
                    '  blog        latest Medium articles',
                    '  resume      open the resume',
                    '  contact     ways to reach me',
                    '  social      links',
                    '  music, play, pause, next, lamp',
                    '  drift       play the drift game',
                    '  neofetch    system info',
                    '  ls, date, echo, clear, exit',
                ].join('\n')),
                whoami: () => print('Bichu B Nadhan: Flutter Developer Lead & AI Full Stack Developer.\nBuilds mobile apps, websites, backends and AI features, end to end.\nAlappuzha, Kerala, India.'),
                about: () => open('about', 'Opening About…'),
                projects: () => open('projects', 'Opening Projects… (featured: TIAN Gold & Diamond)'),
                skills: () => open('skills', 'Opening Skills…'),
                resume: () => open('resume', 'Opening Resume…'),
                contact: () => open('contact', 'Opening Contact… or email bichuamz@gmail.com'),
                hire: () => open('contact', 'Great choice. Opening Contact…'),
                blog: async () => {
                    const list = await articles;
                    if (!list.length) return print('Could not load articles. See medium.com/@bichuamz');
                    list.slice(0, 5).forEach((a, i) => print(`${i + 1}. ${a.title}`));
                    print("Type 'blog open' to browse them.", 'term-hi');
                },
                'blog open': () => open('blog', 'Opening Blog…'),
                social: () => printLinks([
                    ['github', 'https://github.com/bichu2913'],
                    ['linkedin', 'https://www.linkedin.com/in/bichu-b-nadhan-7a6523222/'],
                    ['medium', 'https://medium.com/@bichuamz'],
                    ['instagram', 'https://www.instagram.com/bourbon__b'],
                ]),
                neofetch: () => print([
                    '   ____     bichu@os',
                    '  | __ )    ---------',
                    "  |  _ \\    OS: Bichu OS v1.0",
                    '  | |_) |   Role: Flutter Developer Lead',
                    '  |____/    Stack: Flutter · Next.js · Python · Supabase',
                    '            AI: GenAI · LLMs · RAG · Multimodal',
                    '            Uptime: 4+ years shipping products',
                    '            Status: available for freelance',
                ].join('\n'), 'term-hi'),
                music: () => open('music', 'Opening Music…'),
                drift: () => { print('Starting Bichu Drift… start your engines.', 'term-hi'); setTimeout(() => { location.href = 'game.html'; }, 700); },
                play: () => { print(`Playing ${music.tracks[music.index]?.title || 'music'}…`, 'term-hi'); musicCommand('play'); },
                pause: () => { print('Paused.'); musicCommand('pause'); },
                next: () => { print('Next song.'); musicCommand('next'); },
                lamp: () => { setLamp(!hero.classList.contains('lamp-on')); print(`Lamp ${hero.classList.contains('lamp-on') ? 'on' : 'off'}.`); },
                ls: () => print('about.app   projects/   skills.txt   blog/   resume.pdf   contact.app'),
                date: () => print(new Date().toString()),
                clear: () => out.replaceChildren(),
                exit: () => closeWindow(win),
            };

            const run = (raw) => {
                const cmd = raw.trim();
                print(`bichu@os:~$ ${cmd}`, 'term-cmd');
                if (!cmd) return;
                history.push(cmd);
                cursor = history.length;
                const lower = cmd.toLowerCase();
                if (lower.startsWith('echo ')) return print(cmd.slice(5));
                if (lower.startsWith('sudo')) return print('Permission denied. Try: hire', 'term-hi');
                if (lower.startsWith('open ')) {
                    const app = lower.slice(5).trim();
                    return document.getElementById(`app-${app}`) ? open(app, `Opening ${app}…`) : print(`No app called "${app}".`);
                }
                const fn = commands[lower];
                if (fn) fn();
                else print(`command not found: ${cmd}. Type 'help'.`);
            };

            print("Bichu OS terminal. Type 'help' to see what I can do.", 'term-hi');
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    run(input.value);
                    input.value = '';
                    body.scrollTop = body.scrollHeight;
                } else if (e.key === 'ArrowUp' && history.length) {
                    cursor = Math.max(0, cursor - 1);
                    input.value = history[cursor];
                    e.preventDefault();
                } else if (e.key === 'ArrowDown' && history.length) {
                    cursor = Math.min(history.length, cursor + 1);
                    input.value = history[cursor] || '';
                    e.preventDefault();
                }
                if (e.key !== 'Escape') e.stopPropagation(); // typing stays in the terminal; Escape still closes it
            });
            body.addEventListener('click', () => input.focus({ preventScroll: true }));
            setTimeout(() => input.focus({ preventScroll: true }), 50);
        },
    };

    /* ---------- Desk hardware: lamp and power ---------- */
    const lampButtons = [...hero.querySelectorAll('.lamp-hit, .cpu-lamp')];
    const setLamp = (on) => {
        hero.classList.toggle('lamp-on', on);
        lampButtons.forEach((b) => b.setAttribute('aria-pressed', String(on)));
    };
    lampButtons.forEach((b) => b.addEventListener('click', () => setLamp(!hero.classList.contains('lamp-on'))));

    const setAsleep = (asleep) => {
        hero.classList.toggle('is-asleep', asleep);
        if (asleep && music.playing) musicCommand('pause');
    };
    hero.querySelector('.cpu-power')?.addEventListener('click', () => setAsleep(!hero.classList.contains('is-asleep')));
    viewport.addEventListener('click', () => { if (hero.classList.contains('is-asleep')) setAsleep(false); });

    /* ---------- Music: YouTube player + tempo-synced speaker lights ---------- */
    const music = {
        tracks: [],
        index: 0,
        player: null,
        ready: false,
        playing: false,
        pendingPlay: false,
        shuffle: false,
        volume: 70,
        win: null,
        clock: { base: 0, at: 0 },
        errors: 0,
        source: 'youtube', // which player is active: 'youtube' or 'spotify'
        sp: [],
        spIndex: 0,
        spController: null,
    };
    const PALETTE = ['217,183,120', '243,223,174', '255,189,116', '232,164,92', '201,154,78', '255,214,150'];
    const playlist = fetch('data/playlist.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => { music.tracks = d.tracks || []; music.sp = d.spotify || []; return music.tracks; })
        .catch(() => []);

    let ytApi = null;
    const loadYouTube = () => {
        if (ytApi) return ytApi;
        ytApi = new Promise((resolve) => {
            if (window.YT?.Player) return resolve(window.YT);
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
            const s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            document.head.append(s);
        });
        return ytApi;
    };

    const fmt = (sec) => {
        if (!Number.isFinite(sec) || sec < 0) sec = 0;
        return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    };

    const current = () => (music.source === 'spotify' ? music.sp[music.spIndex] : music.tracks[music.index]);

    let spApi = null;
    const loadSpotify = () => {
        if (spApi) return spApi;
        spApi = new Promise((resolve) => {
            window.onSpotifyIframeApiReady = (api) => resolve(api);
            const s = document.createElement('script');
            s.src = 'https://open.spotify.com/embed/iframe-api/v1';
            document.head.append(s);
        });
        return spApi;
    };

    const renderNowPlaying = () => {
        const t = current();
        if (!t) return;
        hero.querySelectorAll('[data-music="toggle"] i').forEach((i) => {
            i.className = `bi ${music.playing ? 'bi-pause-fill' : 'bi-play-fill'}`;
        });
        hero.classList.toggle('is-playing', music.playing);
        const chip = screen.querySelector('.os-np');
        chip.hidden = !music.player && !music.spController;
        chip.querySelector('.os-np-title').textContent = `${t.title} · ${t.artist}`;
        if (music.win) {
            music.win.querySelector('.music-title').textContent = t.title;
            music.win.querySelector('.music-artist').textContent = t.artist;
            music.win.querySelectorAll('.music-list:not(.music-sp-list) li').forEach((li, i) => li.classList.toggle('is-current', music.source === 'youtube' && i === music.index));
            music.win.querySelectorAll('.music-sp-list li').forEach((li, i) => li.classList.toggle('is-current', music.source === 'spotify' && i === music.spIndex));
        }
    };

    // Beat engine: extrapolates playback time locally (YouTube only reports it a few times a second).
    let beatRaf = null;
    let lastSync = 0;
    const beatLoop = (now) => {
        if (!music.playing) {
            hero.style.setProperty('--beat', 0);
            beatRaf = null;
            return;
        }
        if (music.source === 'youtube' && now - lastSync > 1000 && music.player?.getCurrentTime) {
            music.clock = { base: music.player.getCurrentTime(), at: now };
            lastSync = now;
        }
        const t = music.clock.base + (now - music.clock.at) / 1000;
        const beats = (t * (current()?.bpm || 120)) / 60;
        const phase = beats - Math.floor(beats);
        const beat = Math.pow(1 - phase, 2.4);
        hero.style.setProperty('--beat', beat.toFixed(3));
        hero.style.setProperty('--rgb', PALETTE[Math.floor(beats / 2) % PALETTE.length]);
        beatRaf = requestAnimationFrame(beatLoop);
    };
    const startBeat = () => { if (!beatRaf && !reduceMotion) beatRaf = requestAnimationFrame(beatLoop); };

    let progressTimer = null;
    const updateProgress = () => {
        if (!music.win || !music.player?.getDuration) return;
        const dur = music.player.getDuration();
        const cur = music.player.getCurrentTime();
        const seek = music.win.querySelector('.music-seek');
        if (!seek.matches(':active')) seek.value = dur ? Math.round((cur / dur) * 1000) : 0;
        music.win.querySelector('.music-cur').textContent = fmt(cur);
        music.win.querySelector('.music-dur').textContent = fmt(dur);
    };

    const playSpotify = (i) => {
        music.spIndex = (i + music.sp.length) % music.sp.length;
        music.source = 'spotify';
        if (music.ready && music.playing) music.player.pauseVideo();
        if (music.spController) {
            music.spController.loadUri(`spotify:track:${current().id}`);
            music.spController.play();
        }
        renderNowPlaying();
    };

    const loadTrack = (i, autoplay = true) => {
        if (music.source === 'spotify') { music.spController?.pause(); music.source = 'youtube'; }
        music.index = (i + music.tracks.length) % music.tracks.length;
        const t = current();
        if (music.ready) {
            autoplay ? music.player.loadVideoById(t.id) : music.player.cueVideoById(t.id);
        } else {
            music.pendingPlay = autoplay;
        }
        renderNowPlaying();
    };

    const nextIndex = (step) => {
        if (music.shuffle && music.tracks.length > 1) {
            let n;
            do { n = Math.floor(Math.random() * music.tracks.length); } while (n === music.index);
            return n;
        }
        return music.index + step;
    };

    function musicCommand(cmd) {
        if (!music.player) {
            // No player yet: open the Music app; it starts playing once ready.
            if (cmd === 'pause') return;
            music.pendingPlay = true;
            if (cmd === 'next') music.index = nextIndex(1) % Math.max(1, music.tracks.length);
            if (cmd === 'prev') music.index = Math.max(0, music.index - 1);
            openApp('music');
            return;
        }
        if (music.source === 'spotify' && music.spController) {
            const c = music.spController;
            if (cmd === 'toggle') c.togglePlay();
            else if (cmd === 'play') c.resume();
            else if (cmd === 'pause') c.pause();
            else if (cmd === 'next') playSpotify(music.spIndex + 1);
            else if (cmd === 'prev') playSpotify(music.spIndex - 1);
            return;
        }
        if (!music.ready) { music.pendingPlay = cmd !== 'pause'; return; }
        switch (cmd) {
            case 'play': music.player.playVideo(); break;
            case 'pause': music.player.pauseVideo(); break;
            case 'toggle': music.playing ? music.player.pauseVideo() : music.player.playVideo(); break;
            case 'next': loadTrack(nextIndex(1)); break;
            case 'prev':
                if (music.player.getCurrentTime() > 4) music.player.seekTo(0, true);
                else loadTrack(music.index - 1);
                break;
            default: break;
        }
    }

    hero.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-music]');
        if (btn) musicCommand(btn.dataset.music);
    });

    apps.music = async (win) => {
        music.win = win;
        await playlist;
        if (!music.tracks.length) {
            win.querySelector('.music-list').innerHTML = '<li class="app-muted">The playlist could not load.</li>';
            return;
        }

        const list = win.querySelector('.music-list');
        list.replaceChildren(...music.tracks.map((t, i) => {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            const text = document.createElement('span');
            const title = document.createElement('strong');
            title.textContent = t.title;
            const artist = document.createElement('small');
            artist.textContent = t.artist;
            text.append(title, artist);
            const bpm = document.createElement('em');
            bpm.textContent = `${t.bpm} bpm`;
            b.append(text, bpm);
            b.addEventListener('click', () => loadTrack(i));
            li.append(b);
            return li;
        }));

        // Spotify tab
        const spList = win.querySelector('.music-sp-list');
        spList.replaceChildren(...music.sp.map((t, i) => {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            const text = document.createElement('span');
            const title = document.createElement('strong');
            title.textContent = t.title;
            const artist = document.createElement('small');
            artist.textContent = t.artist;
            text.append(title, artist);
            const bpm = document.createElement('em');
            bpm.textContent = `${t.bpm} bpm`;
            b.append(text, bpm);
            b.addEventListener('click', () => playSpotify(i));
            li.append(b);
            return li;
        }));

        const startSpotify = async () => {
            if (music.spController || !music.sp.length) return;
            const api = await loadSpotify();
            if (!win.isConnected || music.spController) return;
            api.createController(win.querySelector('.music-sp-host'), {
                uri: `spotify:track:${music.sp[music.spIndex].id}`,
                width: '100%',
                height: 352,
            }, (controller) => {
                music.spController = controller;
                controller.addListener('playback_update', (e) => {
                    const { isPaused, position } = e.data;
                    if (!isPaused) {
                        if (music.source !== 'spotify' || !music.playing) {
                            music.source = 'spotify';
                            if (music.ready) music.player.pauseVideo();
                        }
                        music.playing = true;
                        music.clock = { base: position / 1000, at: performance.now() };
                        startBeat();
                    } else if (music.source === 'spotify') {
                        music.playing = false;
                    }
                    renderNowPlaying();
                });
                renderNowPlaying();
            });
        };

        win.querySelectorAll('.music-tabs [data-src]').forEach((tab) => {
            tab.addEventListener('click', () => {
                const src = tab.dataset.src;
                win.querySelectorAll('.music-tabs [data-src]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
                win.querySelectorAll('.music-pane').forEach((pane) => { pane.hidden = pane.dataset.pane !== src; });
                if (src === 'spotify') startSpotify();
            });
        });

        const shuffle = win.querySelector('.music-shuffle');
        shuffle.addEventListener('click', () => {
            music.shuffle = !music.shuffle;
            shuffle.setAttribute('aria-pressed', String(music.shuffle));
        });
        const vol = win.querySelector('.music-vol input');
        vol.value = music.volume;
        vol.addEventListener('input', () => {
            music.volume = Number(vol.value);
            music.player?.setVolume?.(music.volume);
        });
        win.querySelector('.music-seek').addEventListener('change', (e) => {
            const dur = music.player?.getDuration?.() || 0;
            if (dur) music.player.seekTo((Number(e.target.value) / 1000) * dur, true);
        });

        renderNowPlaying();
        const YT = await loadYouTube();
        if (!win.isConnected) return; // closed while loading

        music.player = new YT.Player(win.querySelector('.music-yt'), {
            host: 'https://www.youtube-nocookie.com',
            videoId: current().id,
            playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
            events: {
                onReady: () => {
                    music.ready = true;
                    music.player.setVolume(music.volume);
                    if (music.pendingPlay) music.player.playVideo();
                    music.pendingPlay = false;
                    renderNowPlaying();
                },
                onStateChange: (e) => {
                    const S = YT.PlayerState;
                    if (e.data === S.PLAYING) {
                        if (music.source === 'spotify') { music.spController?.pause(); music.source = 'youtube'; }
                        music.playing = true;
                        music.errors = 0;
                        music.clock = { base: music.player.getCurrentTime(), at: performance.now() };
                        startBeat();
                    } else if ((e.data === S.PAUSED || e.data === S.BUFFERING || e.data === S.CUED) && music.source === 'youtube') {
                        music.playing = false;
                    } else if (e.data === S.ENDED) {
                        music.playing = false;
                        loadTrack(nextIndex(1));
                    }
                    renderNowPlaying();
                },
                onError: () => {
                    // Blocked or unavailable: skip it, but stop after one full round so we never loop forever.
                    music.errors += 1;
                    const note = win.querySelector('.music-note');
                    if (music.errors >= music.tracks.length) {
                        music.playing = false;
                        note.textContent = "YouTube isn't allowing these songs to play here right now.";
                        renderNowPlaying();
                        return;
                    }
                    note.textContent = `"${current().title}" can't play outside YouTube, skipping…`;
                    loadTrack(nextIndex(1));
                },
            },
        });
        renderNowPlaying();
        progressTimer = setInterval(updateProgress, 500);

        // Closing the Music window stops the music.
        win.addEventListener('os:close', () => {
            clearInterval(progressTimer);
            music.player?.destroy?.();
            music.spController?.destroy?.();
            Object.assign(music, { player: null, ready: false, playing: false, win: null, spController: null, source: 'youtube' });
            renderNowPlaying();
            screen.querySelector('.os-np').hidden = true;
        }, { once: true });
    };
})();
