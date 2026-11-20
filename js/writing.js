// Writing section: Medium articles from data/medium.json (refreshed weekly by
// .github/workflows/medium.yml), shown as gold-toned 3D cards.
(() => {
    const section = document.getElementById('writing');
    const grid = section?.querySelector('.writing-grid');
    if (!grid) return;

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text) node.textContent = text;
        return node;
    };

    const card = (a, i) => {
        const link = el('a', `wcard${i === 0 ? ' wcard-feature' : ''}`);
        link.href = a.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.setProperty('--i', i);

        const media = el('div', 'wcard-media');
        if (a.image) {
            const img = el('img');
            img.src = a.image;
            img.alt = '';
            img.loading = 'lazy';
            img.decoding = 'async';
            media.append(img);
        }
        media.append(el('span', 'wcard-num', String(i + 1).padStart(2, '0')));

        const body = el('div', 'wcard-body');
        body.append(
            el('span', 'wcard-meta', `${formatDate(a.date)} · ${a.minutes} min read`),
            el('h3', null, a.title),
        );
        if (i === 0 || i > 2) body.append(el('p', null, a.summary));
        const tags = el('div', 'wcard-tags');
        (a.tags || []).slice(0, 2).forEach((t) => tags.append(el('span', null, t.replace(/-/g, ' '))));
        const more = el('span', 'wcard-more');
        more.innerHTML = 'Read article <i class="bi bi-arrow-up-right"></i>';
        body.append(tags, more);

        link.append(media, body, el('span', 'wcard-glare'));
        return link;
    };

    /* 3D tilt toward the cursor, with a moving glare.
       Hit-testing uses each card's untilted layout box: a tilted card's edge swings away from the
       pointer, which would otherwise fire pointerleave and make the card flicker. */
    const enableTilt = (cards) => {
        if (reduceMotion || !finePointer) return;
        let active = null;
        const reset = (c) => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); c.classList.remove('is-tilting'); };

        grid.addEventListener('pointermove', (e) => {
            const g = grid.getBoundingClientRect();
            const px = e.clientX - g.left;
            const py = e.clientY - g.top;
            const hit = cards.find((c) => px >= c.offsetLeft && px <= c.offsetLeft + c.offsetWidth
                && py >= c.offsetTop && py <= c.offsetTop + c.offsetHeight);
            if (active && active !== hit) reset(active);
            active = hit || null;
            if (!hit) return;
            const x = (px - hit.offsetLeft) / hit.offsetWidth;
            const y = (py - hit.offsetTop) / hit.offsetHeight;
            hit.classList.add('is-tilting');
            hit.style.setProperty('--ry', `${(x - 0.5) * 12}deg`);
            hit.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
            hit.style.setProperty('--gx', `${x * 100}%`);
            hit.style.setProperty('--gy', `${y * 100}%`);
        });
        grid.addEventListener('pointerleave', () => { if (active) reset(active); active = null; });
    };

    /* Entrance: each card flips up from depth once, with a short stagger (time-based, always completes) */
    const reveal = (cards) => {
        if (reduceMotion || !('IntersectionObserver' in window)) {
            cards.forEach((c) => c.classList.add('is-in'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            });
        }, { threshold: 0, rootMargin: '0px 0px 12% 0px' }); // start a little early: the 3D start pose sits below its slot
        cards.forEach((c) => io.observe(c));

        // Safety net for fast flings: anything already scrolled past is shown at once.
        let ticking = false;
        addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                cards.forEach((c) => { if (!c.classList.contains('is-in') && c.getBoundingClientRect().top < innerHeight) c.classList.add('is-in'); });
            });
        }, { passive: true });
    };

    /* Decorative only: the grid leans slightly as the section scrolls past */
    const lean = () => {
        if (reduceMotion) return;
        let ticking = false;
        const update = () => {
            ticking = false;
            const r = section.getBoundingClientRect();
            const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1 around centre
            grid.style.setProperty('--lean', `${Math.max(-1, Math.min(1, p)) * 6}deg`);
        };
        addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
        update();
    };

    fetch('data/medium.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(({ articles = [] }) => {
            if (!articles.length) throw new Error('empty');
            const cards = articles.slice(0, 5).map(card); // feature + 4 fills the 3×2 grid exactly
            grid.replaceChildren(...cards);
            enableTilt(cards);
            reveal(cards);
            lean();
        })
        .catch(() => {
            grid.innerHTML = '<p class="writing-empty">Articles could not load right now. Read them on Medium below.</p>';
        });
})();
