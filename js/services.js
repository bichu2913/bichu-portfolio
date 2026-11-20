// Services section: renders the service cards from js/services-data.js, handles filtering,
// cursor depth effects, the detail panel, and lazy-loads the 3D core (js/services-core.js).
(() => {
    const section = document.getElementById('services');
    const data = window.SERVICES_DATA;
    if (!section || !data) return;

    const grid = section.querySelector('.svc-grid');
    const filters = section.querySelector('.svc-filters');
    const panel = section.querySelector('.svc-panel');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g]));

    const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    };

    /* ---------- Reusable pieces ---------- */
    const icon3d = (iconClass, extra = '') => {
        const wrap = el('div', `svc-icon ${extra}`.trim());
        const face = el('span', 'svc-icon-face');
        face.append(el('i', `bi ${iconClass}`));
        wrap.append(el('span', 'svc-icon-back'), face);
        return wrap;
    };

    const tagList = (items, cls = 'svc-tags', limit = Infinity) => {
        const box = el('div', cls);
        items.slice(0, limit).forEach((t) => box.append(el('span', null, t)));
        if (items.length > limit) box.append(el('span', 'svc-tag-more', `+${items.length - limit}`));
        return box;
    };

    /* ---------- Mini AI chat demo for the featured AI card ---------- */
    const aiDemo = () => {
        const box = el('div', 'svc-ai-demo');
        box.setAttribute('aria-hidden', 'true');
        const q = el('div', 'svc-ai-msg svc-ai-user');
        const a = el('div', 'svc-ai-msg svc-ai-bot');
        const typing = el('div', 'svc-ai-typing');
        typing.append(el('i'), el('i'), el('i'));
        box.append(q, typing, a);
        const script = [
            ['Find a gold ring under ₹50,000 for an engagement.', 'Here are 3 rings from the Bridal collection, all 22K and within budget. Want them sorted by weight?'],
            ['Summarise this contract and flag the risky clauses.', 'Done. 2 clauses need attention: auto-renewal (§4) and unlimited liability (§9). Summary is ready.'],
            ['Which customers are likely to churn this month?', '18 customers show churn signals. The top reason is delayed delivery. I drafted a win-back message.'],
        ];
        let n = 0;
        let timer = null;
        const type = (node, text, done) => {
            node.textContent = '';
            let i = 0;
            const step = () => {
                node.textContent = text.slice(0, ++i);
                if (i < text.length) timer = setTimeout(step, 18);
                else done?.();
            };
            step();
        };
        const run = () => {
            const [question, answer] = script[n++ % script.length];
            box.classList.remove('is-answered');
            a.textContent = '';
            type(q, question, () => {
                box.classList.add('is-thinking');
                timer = setTimeout(() => {
                    box.classList.remove('is-thinking');
                    box.classList.add('is-answered');
                    type(a, answer, () => { timer = setTimeout(run, 3200); });
                }, 900);
            });
        };
        if (reduceMotion) {
            q.textContent = script[0][0];
            a.textContent = script[0][1];
            box.classList.add('is-answered');
        } else {
            // only animate while on screen
            new IntersectionObserver(([e]) => {
                clearTimeout(timer);
                if (e.isIntersecting) run();
            }).observe(box);
        }
        return box;
    };

    /* ---------- Service card component ---------- */
    const ServiceCard = (svc, index) => {
        const group = groupById[svc.group];
        const card = el('button', `svc-card${svc.featured ? ' svc-card-featured' : ''}${svc.wide ? ' svc-card-wide' : ''}`);
        card.type = 'button';
        card.dataset.group = svc.group;
        card.dataset.id = svc.id;
        card.style.setProperty('--i', index);
        card.setAttribute('aria-haspopup', 'dialog');
        card.setAttribute('aria-label', `${svc.title}: ${svc.summary} Open details`);

        const top = el('div', 'svc-card-top');
        top.append(icon3d(svc.icon), el('span', 'svc-card-num', String(index + 1).padStart(2, '0')));

        const body = el('div', 'svc-card-body');
        body.append(
            el('span', 'svc-card-group', group.name),
            el('h3', 'svc-card-title', svc.title),
            el('p', 'svc-card-summary', svc.summary),
        );
        if (svc.featured) {
            const list = el('ul', 'svc-card-list');
            svc.features.slice(0, 6).forEach((f) => list.append(el('li', null, f)));
            body.append(list, aiDemo());
        }

        const foot = el('div', 'svc-card-foot');
        const more = el('span', 'svc-card-more');
        more.innerHTML = 'Explore <i class="bi bi-arrow-up-right"></i>';
        foot.append(tagList(svc.tech, 'svc-tags', 3), more);

        card.append(el('span', 'svc-card-glow'), top, body, foot);
        card.addEventListener('click', () => openPanel(svc.id, card));
        return card;
    };

    /* ---------- Render ---------- */
    const cards = data.services.map(ServiceCard);
    grid.replaceChildren(...cards);

    data.groups.forEach((g) => {
        const count = data.services.filter((s) => s.group === g.id).length;
        const b = el('button', 'svc-filter');
        b.type = 'button';
        b.dataset.filter = g.id;
        b.setAttribute('aria-pressed', 'false');
        b.innerHTML = `<i class="bi ${g.icon}"></i> ${g.name} <span>${count}</span>`;
        filters.append(b);
    });

    /* ---------- Filtering (cards fade + lift; layout stays stable) ---------- */
    filters.addEventListener('click', (e) => {
        const btn = e.target.closest('.svc-filter');
        if (!btn) return;
        const f = btn.dataset.filter;
        filters.querySelectorAll('.svc-filter').forEach((b) => {
            const on = b === btn;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', String(on));
        });
        let shown = 0;
        cards.forEach((c) => {
            const match = f === 'all' || c.dataset.group === f;
            c.hidden = !match;
            if (match) {
                c.style.setProperty('--i', shown++);
                c.classList.remove('is-filtered-in');
                void c.offsetWidth; // restart the entrance animation
                c.classList.add('is-filtered-in');
            }
        });
    });

    /* ---------- Entrance: depth-based, time-based (always completes) ---------- */
    const revealOnce = (nodes, cls = 'is-in', margin = '0px 0px 10% 0px') => {
        if (reduceMotion || !('IntersectionObserver' in window)) {
            nodes.forEach((n) => n.classList.add(cls));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add(cls);
                io.unobserve(entry.target);
            });
        }, { threshold: 0, rootMargin: margin });
        nodes.forEach((n) => io.observe(n));

        // Safety net: a fast fling can skip an element entirely (it never "intersects"),
        // so anything already scrolled past is revealed at once and never stays hidden.
        let ticking = false;
        const sweep = () => {
            ticking = false;
            nodes.forEach((n) => {
                if (!n.classList.contains(cls) && n.getBoundingClientRect().top < innerHeight) {
                    n.classList.add(cls);
                    io.unobserve(n);
                }
            });
        };
        addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(sweep); } }, { passive: true });
    };
    revealOnce(cards);
    revealOnce([section.querySelector('.svc-intro'), section.querySelector('.svc-closing'), filters]);

    /* ---------- Cursor depth: tilt + glow follow the pointer ----------
       Hit-testing uses the cards' untilted layout boxes, so a tilting edge
       never "loses" the pointer and flickers. */
    if (finePointer && !reduceMotion) {
        let active = null;
        const reset = (c) => {
            c.style.setProperty('--rx', '0deg');
            c.style.setProperty('--ry', '0deg');
            c.classList.remove('is-hot');
        };
        grid.addEventListener('pointermove', (e) => {
            const g = grid.getBoundingClientRect();
            const px = e.clientX - g.left;
            const py = e.clientY - g.top;
            const hit = cards.find((c) => !c.hidden && px >= c.offsetLeft && px <= c.offsetLeft + c.offsetWidth
                && py >= c.offsetTop && py <= c.offsetTop + c.offsetHeight);
            if (active && active !== hit) reset(active);
            active = hit || null;
            if (!hit) return;
            const x = (px - hit.offsetLeft) / hit.offsetWidth;
            const y = (py - hit.offsetTop) / hit.offsetHeight;
            hit.classList.add('is-hot');
            hit.style.setProperty('--rx', `${(0.5 - y) * 9}deg`);
            hit.style.setProperty('--ry', `${(x - 0.5) * 11}deg`);
            hit.style.setProperty('--mx', `${x * 100}%`);
            hit.style.setProperty('--my', `${y * 100}%`);
        });
        grid.addEventListener('pointerleave', () => { if (active) reset(active); active = null; });

        // Floating background objects drift with the pointer (parallax)
        let raf = 0;
        section.addEventListener('pointermove', (e) => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                const r = section.getBoundingClientRect();
                section.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
                section.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
            });
        });
    }

    /* ---------- Detail panel ---------- */
    const p = {
        icon: panel.querySelector('.svc-panel-head .svc-icon i'),
        group: panel.querySelector('.svc-panel-group'),
        title: panel.querySelector('.svc-panel-title'),
        desc: panel.querySelector('.svc-panel-desc'),
        features: panel.querySelector('.svc-panel-features'),
        tech: panel.querySelector('.svc-panel-tech'),
        exTitle: panel.querySelector('.svc-panel-ex-title'),
        examples: panel.querySelector('.svc-panel-examples'),
        cta: panel.querySelector('.svc-panel-cta'),
    };
    let currentId = null;
    let opener = null;

    const visibleServices = () => cards.filter((c) => !c.hidden).map((c) => c.dataset.id);

    const fillPanel = (svc) => {
        const group = groupById[svc.group];
        panel.dataset.group = svc.group;
        p.icon.className = `bi ${svc.icon}`;
        p.group.textContent = group.name;
        p.title.textContent = svc.title;
        p.desc.textContent = svc.description;
        p.features.replaceChildren(...svc.features.map((f) => el('li', null, f)));
        p.tech.replaceChildren(...tagList(svc.tech, 'svc-tags').children);
        if (svc.examples.length) {
            p.exTitle.textContent = 'Work & writing';
            p.examples.replaceChildren(...svc.examples.map((ex) => {
                const li = el('li');
                const a = el('a', null, ex.label);
                a.href = ex.url;
                if (/^https?:/.test(ex.url)) { a.target = '_blank'; a.rel = 'noopener'; }
                else a.addEventListener('click', () => panel.close());
                li.append(a);
                return li;
            }));
        } else {
            p.exTitle.textContent = 'Examples';
            p.examples.replaceChildren(el('li', 'svc-panel-muted', 'Client work under NDA. Happy to walk you through it on a call.'));
        }
        p.cta.dataset.service = svc.title;
        const body = panel.querySelector('.svc-panel-inner');
        body.classList.remove('is-swapping');
        void body.offsetWidth;
        body.classList.add('is-swapping');
    };

    function openPanel(id, fromCard) {
        const svc = data.services.find((s) => s.id === id);
        if (!svc) return;
        currentId = id;
        opener = fromCard || opener;
        fillPanel(svc);
        if (!panel.open) {
            // grow out of the clicked card
            if (fromCard) {
                const r = fromCard.getBoundingClientRect();
                panel.style.setProperty('--ox', `${r.left + r.width / 2}px`);
                panel.style.setProperty('--oy', `${r.top + r.height / 2}px`);
            }
            panel.showModal();
            document.documentElement.classList.add('svc-locked');
        }
    }

    panel.addEventListener('close', () => {
        document.documentElement.classList.remove('svc-locked');
        opener?.focus({ preventScroll: true });
    });
    panel.querySelector('.svc-panel-close').addEventListener('click', () => panel.close());
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.close(); }); // backdrop
    panel.querySelectorAll('.svc-panel-nav').forEach((b) => b.addEventListener('click', () => {
        const list = visibleServices();
        const i = list.indexOf(currentId);
        const next = list[(i + Number(b.dataset.step) + list.length) % list.length];
        opener = cards.find((c) => c.dataset.id === next);
        openPanel(next);
    }));
    panel.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') panel.querySelector('[data-step="1"]').click();
        if (e.key === 'ArrowLeft') panel.querySelector('[data-step="-1"]').click();
    });

    // CTA: close, prefill the contact form subject, go to contact
    p.cta.addEventListener('click', () => {
        panel.close();
        const subject = document.getElementById('subject');
        if (subject) {
            subject.value = `Project enquiry: ${p.cta.dataset.service}`;
            subject.dispatchEvent(new Event('input', { bubbles: true }));
        }
        setTimeout(() => document.getElementById('name')?.focus({ preventScroll: true }), 700);
    });

    /* ---------- 3D core: load only when the section approaches ---------- */
    const coreBox = section.querySelector('.svc-core');
    const loadCore = () => {
        import('./services-core.js') // resolved against this script's URL (js/)
            .then((m) => m.mountCore(coreBox, { reduceMotion, finePointer }))
            .catch(() => coreBox.classList.add('no-webgl'));
    };
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            if (!entries[0].isIntersecting) return;
            io.disconnect();
            loadCore();
        }, { rootMargin: '400px 0px' });
        io.observe(coreBox);
    } else {
        loadCore();
    }
})();
