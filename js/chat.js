// "Ask Bichu" AI chatbot. One conversation, shown in two places: the floating chat panel
// and the "Ask Bichu" app in Bichu OS. Replies come from the Supabase Edge Function in
// supabase/functions/chat; leads it collects are also emailed through EmailJS.
(() => {
    const cfg = window.SITE_CONFIG || {};
    if (!cfg.chatEndpoint) return;

    const STORE = 'ask-bichu-chat';
    const GREETING = "Hi! I'm Bichu's AI assistant. Ask me about his work, services or availability, or tell me what you'd like to build.";
    const SUGGESTIONS = ['What does Bichu build?', 'Tell me about TIAN', 'Is he available for freelance?', 'I have an app idea'];
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- State (kept for this browser tab only) ---------- */
    let history = [];
    try { history = JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch { history = []; }
    let busy = false;
    let leadSent = false;
    const views = new Set();
    const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-30))); } catch { /* storage blocked */ } };

    /* ---------- View: renders the conversation into a mount point ---------- */
    const linkify = (text) => {
        const frag = document.createDocumentFragment();
        const re = /(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+\.[\w.]+|\+91 ?\d{10})/g;
        let last = 0;
        for (const m of text.matchAll(re)) {
            frag.append(text.slice(last, m.index));
            const a = document.createElement('a');
            const v = m[0];
            a.textContent = v;
            if (v.includes('@')) a.href = `mailto:${v}`;
            else if (v.startsWith('+')) a.href = `https://wa.me/${v.replace(/\D/g, '')}`;
            else a.href = v;
            if (!v.includes('@')) { a.target = '_blank'; a.rel = 'noopener'; }
            frag.append(a);
            last = m.index + v.length;
        }
        frag.append(text.slice(last));
        return frag;
    };

    function createView(mount) {
        mount.classList.add('chat');
        mount.innerHTML = `
            <div class="chat-log" role="log" aria-live="polite"></div>
            <div class="chat-suggest"></div>
            <form class="chat-form">
                <input class="chat-input" type="text" maxlength="1000" autocomplete="off" placeholder="Ask about Bichu's work…" aria-label="Your message">
                <button class="chat-send" type="submit" aria-label="Send"><i class="bi bi-send-fill"></i></button>
            </form>
            <p class="chat-note">AI can make mistakes. For anything important, contact Bichu directly.</p>`;
        const log = mount.querySelector('.chat-log');
        const suggest = mount.querySelector('.chat-suggest');
        const form = mount.querySelector('.chat-form');
        const input = mount.querySelector('.chat-input');

        const bubble = (role, text, extra = '') => {
            const el = document.createElement('div');
            el.className = `chat-msg chat-${role} ${extra}`.trim();
            el.append(linkify(text));
            return el;
        };

        const render = () => {
            log.replaceChildren(bubble('bot', GREETING), ...history.map((m) => bubble(m.role === 'user' ? 'user' : 'bot', m.content, m.error ? 'chat-error' : '')));
            if (busy) {
                const t = document.createElement('div');
                t.className = 'chat-msg chat-bot chat-typing';
                t.innerHTML = '<i></i><i></i><i></i>';
                log.append(t);
            }
            suggest.replaceChildren(...(history.length ? [] : SUGGESTIONS.map((q) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = q;
                b.addEventListener('click', () => send(q));
                return b;
            })));
            input.disabled = busy;
            form.querySelector('.chat-send').disabled = busy;
            log.scrollTop = log.scrollHeight;
        };

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            send(text);
        });
        // typing inside the OS window must not trigger desktop shortcuts
        input.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });

        const view = { render, focus: () => input.focus({ preventScroll: true }), mount };
        views.add(view);
        render();
        return view;
    }

    const renderAll = () => views.forEach((v) => (v.mount.isConnected ? v.render() : views.delete(v)));

    /* ---------- Talking to the server ---------- */
    async function send(text) {
        if (busy) return;
        history.push({ role: 'user', content: text.slice(0, 1000) });
        busy = true;
        renderAll();
        try {
            const payload = history.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
            const res = await fetch(cfg.chatEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: payload }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.reply) throw new Error(data.error || 'unavailable');
            history.push({ role: 'assistant', content: data.reply });
            if (data.lead && !leadSent) emailLead(data.lead);
        } catch (err) {
            history.push({
                role: 'assistant',
                error: true,
                content: `Sorry, I couldn't answer just now (${String(err.message || err).slice(0, 60)}). You can reach Bichu at ${cfg.email || 'bichuamz@gmail.com'}.`,
            });
        } finally {
            busy = false;
            save();
            renderAll();
        }
    }

    function emailLead(lead) {
        leadSent = true;
        const ej = cfg.emailjs || {};
        if (!window.emailjs || !ej.serviceId || !ej.templateId) return;
        const transcript = history.filter((m) => !m.error).map((m) => `${m.role === 'user' ? 'Visitor' : 'Bot'}: ${m.content}`).join('\n');
        window.emailjs.send(ej.serviceId, ej.templateId, {
            from_name: lead.name,
            from_email: lead.contact.includes('@') ? lead.contact : '',
            reply_to: lead.contact.includes('@') ? lead.contact : '',
            phone: lead.contact.includes('@') ? '' : lead.contact,
            subject: `New lead from Ask Bichu: ${lead.name}`,
            message: `Contact: ${lead.contact}\nProject: ${lead.project}\n\nConversation:\n${transcript}`,
        }, { publicKey: ej.publicKey }).catch(() => { leadSent = false; });
    }

    /* ---------- Floating launcher ---------- */
    const fab = document.querySelector('.chat-fab');
    const panel = document.getElementById('chat-panel');
    let panelView = null;
    const setPanel = (open) => {
        panel.hidden = !open;
        fab.setAttribute('aria-expanded', String(open));
        fab.classList.toggle('is-open', open);
        if (open) {
            if (!panelView) panelView = createView(panel.querySelector('.chat-mount'));
            panelView.render();
            if (!reduceMotion) panel.classList.add('is-entering');
            requestAnimationFrame(() => panel.classList.remove('is-entering'));
            setTimeout(() => panelView.focus(), 60);
        }
    };
    fab?.addEventListener('click', () => setPanel(panel.hidden));
    panel?.querySelector('.chat-close').addEventListener('click', () => { setPanel(false); fab.focus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) setPanel(false); });

    // On phones the Bichu OS dock already has "Ask Bichu", so hide the bubble while the hero is on screen
    const hero = document.getElementById('home');
    if (hero && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => document.body.classList.toggle('chat-hero-visible', e.intersectionRatio > 0.35), { threshold: [0, 0.35, 0.6] }).observe(hero);
    }

    /* ---------- Bichu OS app: js/os.js calls this when the window opens ---------- */
    window.mountAskBichu = (mount) => {
        const v = createView(mount);
        setTimeout(() => v.focus(), 80);
        return v;
    };
})();
