// About photo: live code typing on the background laptop's screen.
// The overlay is pinned to the laptop screen inside the photo, following the image's
// object-fit crop, parallax shift and reveal animation.
(() => {
    const img = document.querySelector('.about-image');
    const screen = document.querySelector('.about-screen');
    if (!img || !screen) return;

    const box = screen.parentElement; // .about-visual
    const code = screen.querySelector('.about-code');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Laptop screen corners as fractions of the photo (measured on the 900×1200 source)
    const SCREEN = { left: 0.196, top: 0.548, right: 0.335, bottom: 0.604, tilt: -1.2 };
    const INNER_W = 300; // the editor is laid out at this size, then scaled down to the screen

    /* ---------- Keep the overlay glued to the laptop in the photo ---------- */
    const place = () => {
        const iw = img.naturalWidth || 900;
        const ih = img.naturalHeight || 1200;
        const r = img.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        if (!r.width) return;
        const s = Math.max(r.width / iw, r.height / ih); // object-fit: cover
        const ox = (r.width - iw * s) / 2;
        const oy = (r.height - ih * s) / 2;
        const x = r.left - b.left + ox + SCREEN.left * iw * s;
        const y = r.top - b.top + oy + SCREEN.top * ih * s;
        const w = (SCREEN.right - SCREEN.left) * iw * s;
        const h = (SCREEN.bottom - SCREEN.top) * ih * s;
        screen.style.transform = `translate(${x}px, ${y}px) rotate(${SCREEN.tilt}deg)`;
        screen.style.width = `${w}px`;
        screen.style.height = `${h}px`;
        screen.style.setProperty('--k', (w / INNER_W).toFixed(4));
        screen.style.setProperty('--inner-h', `${(h / w) * INNER_W}px`);
    };

    let raf = 0;
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); };
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    new ResizeObserver(schedule).observe(img);
    img.addEventListener('load', schedule);
    img.addEventListener('transitionend', schedule);
    // follow the reveal/parallax transitions while they run
    img.addEventListener('transitionrun', () => {
        const until = performance.now() + 900;
        const follow = () => { place(); if (performance.now() < until) requestAnimationFrame(follow); };
        follow();
    });
    place();

    /* ---------- The code that "runs" ---------- */
    // [text, class] tokens per line; classes map to editor colours in CSS
    const K = 'k', S = 's', F = 'f', C = 'c', N = 'n', T = 't';
    const SNIPPETS = [
        [[['class ', K], ['ProductScreen ', T], ['extends ', K], ['StatelessWidget ', T], ['{', '']]],
        [[['  @override', C]]],
        [[['  Widget ', T], ['build', F], ['(BuildContext ctx) {', '']]],
        [[['    return ', K], ['BlocBuilder', F], ['<CartBloc, CartState>(', '']]],
        [[['      builder: ', ''], ['(ctx, state) => ', K], ['ProductGrid', F], ['(', '']]],
        [[['        items: state.', ''], ['products', F], [',', '']]],
        [[['        onTap: ', ''], ['(p) => ', K], ['ctx.', ''], ['push', F], ['(', ''], ["'/product'", S], ['),', '']]],
        [[['      ),', '']]],
        [[['    );', '']]],
        [[['  }', '']]],
        [[['}', '']]],
        [[['', '']]],
        [[['# rag.py', C]]],
        [[['async def ', K], ['ask', F], ['(question: ', ''], ['str', T], ['):', '']]],
        [[['    docs = ', ''], ['await ', K], ['store.', ''], ['search', F], ['(question, k=', ''], ['4', N], [')', '']]],
        [[['    prompt = ', ''], ['build_prompt', F], ['(question, docs)', '']]],
        [[['    return ', K], ['await ', K], ['llm.', ''], ['complete', F], ['(prompt)', '']]],
        [[['', '']]],
        [[['$ flutter build apk --release', C]]],
        [[['✓ Built app-release.apk (18.4MB)', S]]],
        [[['$ git push origin main', C]]],
        [[['✓ Deployed to production', S]]],
        [[['', '']]],
    ].map((line) => line[0]);

    const MAX_LINES = 9;
    const lines = [];
    let li = 0;   // snippet line index
    let ci = 0;   // character index within the line
    let lineEl = null;

    const lineText = (tokens) => tokens.map((t) => t[0]).join('');

    const renderLine = (el, tokens, upto) => {
        el.replaceChildren();
        let left = upto;
        for (const [text, cls] of tokens) {
            if (left <= 0) break;
            const part = text.slice(0, left);
            left -= text.length;
            const span = document.createElement('span');
            if (cls) span.className = `tk-${cls}`;
            span.textContent = part;
            el.append(span);
        }
    };

    const newLine = () => {
        lineEl = document.createElement('div');
        lineEl.className = 'cl';
        code.append(lineEl);
        lines.push(lineEl);
        if (lines.length > MAX_LINES) lines.shift().remove();
    };

    const step = () => {
        const tokens = SNIPPETS[li];
        const full = lineText(tokens).length;
        if (!lineEl) newLine();
        ci = Math.min(full, ci + (full > 30 ? 3 : 2));
        renderLine(lineEl, tokens, ci);
        if (ci >= full) {
            lineEl.classList.add('done');
            li = (li + 1) % SNIPPETS.length;
            ci = 0;
            lineEl = null;
            return full === 0 ? 120 : 260; // brief pause at line end
        }
        return 45;
    };

    if (reduceMotion) {
        SNIPPETS.slice(0, MAX_LINES).forEach((tokens) => { newLine(); renderLine(lineEl, tokens, 999); });
        lineEl = null;
        return;
    }

    let timer = null;
    const loop = () => { timer = setTimeout(loop, step()); };
    new IntersectionObserver(([e]) => {
        clearTimeout(timer);
        if (e.isIntersecting) { place(); loop(); }
    }).observe(box);
})();
