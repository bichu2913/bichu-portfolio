// "Ask Bichu" assistant: a free, scripted chatbot that runs entirely in the browser.
// It matches the visitor's message to topics below, answers from prepared facts, offers
// follow-up suggestions, and collects leads (name, contact, project) which are emailed via EmailJS.
// One conversation is shown in two places: the floating chat panel and the Bichu OS app.
(() => {
    const cfg = window.SITE_CONFIG || {};
    const EMAIL = cfg.email || 'bichuamz@gmail.com';
    const WA = cfg.whatsapp ? `+${cfg.whatsapp.slice(0, 2)} ${cfg.whatsapp.slice(2)}` : '+91 8606892913';
    const STORE = 'ask-bichu-chat';
    const GREETING = "Hi! I'm Bichu's assistant. Ask me about his work, services or availability, or tell me what you'd like to build.";
    const START = ['What does Bichu build?', 'Tell me about TIAN', 'Is he available?', 'I have an app idea'];
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Knowledge: topics, trigger words and answers ---------- */
    const TOPICS = [
        { id: 'hire', words: ['hire', 'hiring', 'work with', 'project for me', 'build for me', 'build me', 'need an app', 'need a website', 'need a developer', 'quote', 'start a project', 'get started', 'interested'],
          lead: true, answer: "Great, Bichu would love to hear about it. I'll take a few details so he can get back to you within 24 hours." },
        { id: 'idea', words: ['idea', 'startup', 'founder', 'co-build', 'cobuild', 'partner', 'partnership', 'equity', 'collaborat'],
          answer: "Bichu partners with founders on ideas with real potential. You share the idea, he evaluates it, you agree on scope and terms, then you build and grow it together. The proposed initial commitment is 15–20% of the agreed development contribution; any equity or revenue share is negotiated and documented in writing.",
          next: ['Share my idea', 'What does Bichu build?'] },
        { id: 'services', words: ['build', 'service', 'offer', 'what do you do', 'what does he do', 'can he make', 'can you make', 'develop'],
          answer: "Bichu builds complete products end to end:\n• Mobile apps (Flutter, Android, iOS)\n• Web apps and websites (Next.js, React, Django)\n• Backends and APIs\n• AI features: chatbots, RAG, agents, document and voice AI\n• Automation, IoT, data and ML, cloud and DevOps, browser extensions, desktop software and UI/UX design.",
          next: ['Tell me about TIAN', 'AI projects', 'I want to hire him'] },
        { id: 'tian', words: ['tian', 'jewel', 'gold', 'diamond', 'case study', 'project', 'portfolio work', 'example', 'previous work'],
          answer: "TIAN Gold & Diamond is a luxury jewellery platform Bichu built solo: the customer website, the mobile app, the backend and \"Ask TIAN\", an AI shopping assistant that can design from a picture. It has 16 collections, live IBJA gold rates and a gold value calculator. Stack: Flutter, Next.js, Supabase and generative AI. You can download the Android app from the TIAN card in the Projects section.",
          next: ['What else has he built?', 'I want something similar'] },
        { id: 'more-work', words: ['what else', 'other project', 'more project', 'apps built', 'how many'],
          answer: "Bichu has shipped 15+ apps. Most are company products under NDA, so the portfolio shows freelance work built from scratch: TIAN Gold & Diamond, this portfolio (Bichu OS) and Bichu Drift, a 3D racing game.",
          next: ['Tell me about the game', 'Tell me about TIAN'] },
        { id: 'ai', words: ['ai', 'gpt', 'llm', 'chatbot', 'rag', 'agent', 'openai', 'gemini', 'machine learning', 'ml', 'genai', 'generative'],
          answer: "AI is a big part of Bichu's work: chatbots and assistants grounded in your own data (RAG), AI agents, document and voice AI, and LLM features wired into apps. In TIAN he built \"Ask TIAN\", a shopping assistant with design-from-a-picture. He also writes about AI on Medium: medium.com/@bichuamz",
          next: ['I need an AI feature', 'Tell me about TIAN'] },
        { id: 'skills', words: ['skill', 'stack', 'tech', 'language', 'flutter', 'react', 'next', 'python', 'django', 'supabase', 'firebase', 'framework', 'tools'],
          answer: "Main stack: Flutter and Dart for mobile, Next.js and React for web, Python, Django and FastAPI for backends, Supabase and Firebase for data and auth, plus OpenAI, Gemini, LLMs and RAG for AI. Design in Figma; delivery with Git, Docker and GitHub Actions.",
          next: ['Experience', 'What does Bichu build?'] },
        { id: 'experience', words: ['experience', 'years', 'background', 'career', 'worked', 'company', 'companies', 'infigoes', 'sunrule', 'brototype', 'cv', 'resume'],
          answer: "Bichu has 4+ years of experience:\n• Independent product developer (current)\n• Flutter Developer Lead, Infigoes Techcon LLP (2024–2026)\n• Flutter Developer, SunRule (2023–2024)\n• Flutter Developer Intern, Brototype (2022–2023)\nHis resume is in the Resume app or the Resume button at the top of the site.",
          next: ['Is he available?', 'Skills'] },
        { id: 'available', words: ['available', 'availability', 'freelance', 'remote', 'job', 'open to', 'full time', 'full-time', 'part time', 'contract', 'role'],
          answer: "Yes. Bichu is available for remote roles, freelance projects and product collaborations. The fastest way to reach him is WhatsApp or email, and he replies within 24 hours.",
          next: ['I want to hire him', 'Contact details'] },
        { id: 'price', words: ['price', 'cost', 'rate', 'budget', 'charge', 'how much', 'fee', 'expensive', 'cheap', 'pricing'],
          answer: "Every project is quoted individually once Bichu understands the scope, features and timeline. Share a few details and he'll come back with an estimate.",
          next: ['Get a quote', 'What does Bichu build?'] },
        { id: 'time', words: ['how long', 'timeline', 'deadline', 'weeks', 'months', 'duration', 'when can'],
          answer: "Timelines depend on scope: a focused MVP is quicker than a full platform. Share what you need and Bichu will suggest a realistic plan.",
          next: ['Get a quote'] },
        { id: 'contact', words: ['contact', 'email', 'mail', 'phone', 'whatsapp', 'call', 'reach', 'linkedin', 'github', 'instagram', 'social'],
          answer: `You can reach Bichu at:\n• Email: ${EMAIL}\n• WhatsApp: ${WA}\n• LinkedIn: linkedin.com/in/bichu-b-nadhan-7a6523222\n• GitHub: github.com/bichu2913\nHe replies within 24 hours.`,
          next: ['Leave my details'] },
        { id: 'game', words: ['game', 'drift', 'race', 'racing', 'car', 'leaderboard', 'three.js', 'threejs', '3d'],
          answer: "Bichu Drift is a 3D drift racing game Bichu built from scratch in Three.js for this portfolio, with custom drift physics, a walled 2-lap race and a global leaderboard. Open the Drift app on the Bichu OS dock to play.",
          next: ['How was this site built?'] },
        { id: 'site', words: ['this site', 'portfolio', 'bichu os', 'website built', 'how was', 'made this', 'built this', 'operating system', 'terminal'],
          answer: "This portfolio is hand-built HTML, CSS and JavaScript: \"Bichu OS\" is a mini operating system with draggable windows, a terminal and a music player, plus Three.js for the 3D parts and the game. Try typing help in the Terminal app.",
          next: ['Tell me about the game', 'What does Bichu build?'] },
        { id: 'location', words: ['where', 'location', 'based', 'country', 'india', 'kerala', 'timezone', 'time zone'],
          answer: "Bichu is based in Alappuzha, Kerala, India (IST, UTC+5:30) and works remotely with clients anywhere.",
          next: ['Is he available?'] },
        { id: 'writing', words: ['blog', 'medium', 'article', 'write', 'writing'],
          answer: "Bichu writes about AI agents, multimodal AI and developer tools on Medium: medium.com/@bichuamz. The latest articles are also in the Blog app and the Writing section.",
          next: ['AI projects'] },
        { id: 'who', words: ['who is', 'about bichu', 'about him', 'introduce'],
          answer: "Bichu B Nadhan is a software developer and AI application developer from Kerala, India, with 4+ years of experience. He builds complete products, from mobile apps and websites to backends and AI features, and has shipped 15+ apps.",
          next: ['What does Bichu build?', 'Tell me about TIAN'] },
        { id: 'hello', words: ['hi', 'hello', 'hey', 'hai', 'good morning', 'good evening', 'namaste'],
          answer: "Hello! What would you like to know about Bichu's work?", next: START },
        { id: 'thanks', words: ['thank', 'thanks', 'great', 'awesome', 'cool', 'nice', 'ok', 'okay'],
          answer: "You're welcome! Anything else I can help with?", next: ['I want to hire him', 'Contact details'] },
    ];

    // Suggestion chips that map to a topic or action
    const CHIP_TO = {
        'Share my idea': 'lead', 'I want to hire him': 'lead', 'I want something similar': 'lead', 'Get a quote': 'lead',
        'Leave my details': 'lead', 'I need an AI feature': 'lead', 'I have an app idea': 'idea',
        'What else has he built?': 'more-work', 'AI projects': 'ai', 'Experience': 'experience', 'Skills': 'skills',
        'Contact details': 'contact', 'Tell me about the game': 'game', 'How was this site built?': 'site',
    };

    const normalise = (t) => ` ${t.toLowerCase().replace(/[^a-z0-9+@.\s-]/g, ' ').replace(/\s+/g, ' ')} `;
    const matchTopic = (text) => {
        const t = normalise(text);
        let best = null;
        let bestScore = 0;
        for (const topic of TOPICS) {
            let score = 0;
            for (const w of topic.words) {
                const word = w.toLowerCase();
                // short words must match whole words; longer ones may match inside ("collaborat")
                const hit = word.length <= 3 ? t.includes(` ${word} `) : t.includes(word);
                if (hit) score += word.split(' ').length + (word.length > 5 ? 0.5 : 0);
            }
            if (score > bestScore) { best = topic; bestScore = score; }
        }
        return best;
    };

    /* ---------- State (kept for this browser tab only) ---------- */
    let state = { history: [], lead: null, step: null, chips: START };
    try { state = { ...state, ...JSON.parse(sessionStorage.getItem(STORE) || '{}') }; } catch { /* storage blocked */ }
    let busy = false;
    const views = new Set();
    const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify({ ...state, history: state.history.slice(-40) })); } catch { /* storage blocked */ } };

    /* ---------- Lead capture (scripted steps) ---------- */
    const LEAD_STEPS = {
        name: { ask: "What's your name?", chips: [] },
        contact: { ask: 'What is the best email or WhatsApp number to reach you?', chips: [] },
        project: { ask: 'In a line or two, what would you like to build (or what role is it)?', chips: [] },
    };
    const startLead = (intro) => {
        state.lead = { name: '', contact: '', project: '' };
        state.step = 'name';
        return { text: `${intro ? `${intro} ` : ''}${LEAD_STEPS.name.ask}`, chips: ['Cancel'] };
    };
    const leadAnswer = (text) => {
        const v = text.trim();
        if (/^(cancel|stop|no|never ?mind)$/i.test(v)) {
            state.step = null;
            state.lead = null;
            return { text: 'No problem. Anything else I can help with?', chips: START };
        }
        if (state.step === 'name') {
            if (v.length < 2) return { text: "Could you tell me your name?", chips: ['Cancel'] };
            state.lead.name = v.slice(0, 80);
            state.step = 'contact';
            return { text: `Nice to meet you, ${state.lead.name.split(' ')[0]}! ${LEAD_STEPS.contact.ask}`, chips: ['Cancel'] };
        }
        if (state.step === 'contact') {
            const email = v.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
            const phone = v.replace(/[^\d+]/g, '');
            if (!email && phone.replace(/\D/g, '').length < 8) {
                return { text: "That doesn't look like an email or phone number. Could you check it?", chips: ['Cancel'] };
            }
            state.lead.contact = email ? email[0] : v.slice(0, 40);
            state.step = 'project';
            return { text: LEAD_STEPS.project.ask, chips: ['Cancel'] };
        }
        if (state.step === 'project') {
            if (v.length < 4) return { text: 'Could you add a few words about the project?', chips: ['Cancel'] };
            state.lead.project = v.slice(0, 1000);
            state.step = null;
            const lead = state.lead;
            state.lead = null;
            const ok = emailLead(lead);
            return {
                text: ok
                    ? `Thanks, ${lead.name.split(' ')[0]}! I've sent your details to Bichu. He'll get back to you at ${lead.contact} within 24 hours.`
                    : `Thanks, ${lead.name.split(' ')[0]}! Please also send this to Bichu directly at ${EMAIL} or WhatsApp ${WA}, so it reaches him for sure.`,
                chips: ['Tell me about TIAN', 'What does Bichu build?'],
            };
        }
        return null;
    };

    function emailLead(lead) {
        const ej = cfg.emailjs || {};
        if (!window.emailjs || !ej.serviceId || !ej.templateId) return false;
        const transcript = state.history.map((m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.content}`).join('\n');
        const isEmail = lead.contact.includes('@');
        window.emailjs.send(ej.serviceId, ej.templateId, {
            from_name: lead.name,
            from_email: isEmail ? lead.contact : '',
            reply_to: isEmail ? lead.contact : '',
            phone: isEmail ? '' : lead.contact,
            subject: `New lead from Ask Bichu: ${lead.name}`,
            message: `Contact: ${lead.contact}\nProject: ${lead.project}\n\nConversation:\n${transcript}`,
        }, { publicKey: ej.publicKey }).catch(() => {});
        return true;
    }

    /* ---------- The reply engine ---------- */
    function respond(text) {
        if (state.step) return leadAnswer(text);
        const chipTarget = CHIP_TO[text];
        if (chipTarget === 'lead') return startLead();
        const topic = chipTarget ? TOPICS.find((t) => t.id === chipTarget) : matchTopic(text);
        if (topic?.lead) return startLead(topic.answer);
        if (topic) return { text: topic.answer, chips: topic.next || START };
        return {
            text: `I'm not sure about that one, but I can tell you about Bichu's services, projects, experience or availability. For anything else, you can ask him directly at ${EMAIL}.`,
            chips: ['What does Bichu build?', 'Contact details', 'Leave my details'],
        };
    }

    /* ---------- View: renders the conversation into a mount point ---------- */
    const linkify = (text) => {
        const frag = document.createDocumentFragment();
        const re = /((?:https?:\/\/)?(?:medium\.com|linkedin\.com|github\.com)\/[^\s]+|[\w.+-]+@[\w-]+\.[\w.]+|\+91 ?\d{10})/g;
        let last = 0;
        for (const m of text.matchAll(re)) {
            frag.append(text.slice(last, m.index));
            const a = document.createElement('a');
            const v = m[0];
            a.textContent = v;
            if (v.includes('@') && !v.includes('/')) a.href = `mailto:${v}`;
            else if (v.startsWith('+')) a.href = `https://wa.me/${v.replace(/\D/g, '')}`;
            else a.href = v.startsWith('http') ? v : `https://${v}`;
            if (!a.href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
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
            <p class="chat-note">Automated assistant. For anything specific, contact Bichu directly.</p>`;
        const log = mount.querySelector('.chat-log');
        const suggest = mount.querySelector('.chat-suggest');
        const form = mount.querySelector('.chat-form');
        const input = mount.querySelector('.chat-input');

        const bubble = (role, text) => {
            const el = document.createElement('div');
            el.className = `chat-msg chat-${role}`;
            el.append(linkify(text));
            return el;
        };

        const render = () => {
            log.replaceChildren(bubble('bot', GREETING), ...state.history.map((m) => bubble(m.role === 'user' ? 'user' : 'bot', m.content)));
            if (busy) {
                const t = document.createElement('div');
                t.className = 'chat-msg chat-bot chat-typing';
                t.innerHTML = '<i></i><i></i><i></i>';
                log.append(t);
            }
            suggest.replaceChildren(...(busy ? [] : (state.chips || []).map((q) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = q;
                b.addEventListener('click', () => send(q));
                return b;
            })));
            input.placeholder = state.step === 'contact' ? 'Email or WhatsApp number…' : state.step ? 'Type your answer…' : "Ask about Bichu's work…";
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

    function send(text) {
        if (busy) return;
        state.history.push({ role: 'user', content: text.slice(0, 1000) });
        state.chips = [];
        busy = true;
        renderAll();
        const reply = respond(text);
        // a short "typing" pause so replies feel natural (instant with reduced motion)
        setTimeout(() => {
            state.history.push({ role: 'assistant', content: reply.text });
            state.chips = reply.chips;
            busy = false;
            save();
            renderAll();
        }, reduceMotion ? 0 : Math.min(1100, 350 + reply.text.length * 3));
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel && !panel.hidden) setPanel(false); });

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
