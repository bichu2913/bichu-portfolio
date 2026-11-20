// "Have an Idea?" section: CTA links from SITE_CONFIG, the idea form (sent through EmailJS,
// with a pre-filled email fallback), the entrance and the pointer parallax on the illustration.
(() => {
    const section = document.getElementById('idea');
    if (!section) return;

    const cfg = window.SITE_CONFIG || {};
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dialog = section.querySelector('.idea-dialog');
    const form = section.querySelector('.idea-form');
    const status = form.querySelector('.idea-status');
    const submit = form.querySelector('[type="submit"]');

    /* ---------- Contact links from config ---------- */
    const waText = encodeURIComponent("Hi Bichu, I have a product idea I'd like to discuss with you.");
    section.querySelectorAll('[data-idea-whatsapp]').forEach((a) => {
        if (cfg.whatsapp) a.href = `https://wa.me/${cfg.whatsapp}?text=${waText}`;
        else a.hidden = true;
    });
    section.querySelectorAll('[data-idea-email]').forEach((a) => {
        if (!cfg.email) { a.closest('.idea-mail').hidden = true; return; }
        a.href = `mailto:${cfg.email}?subject=${encodeURIComponent('Product idea enquiry')}`;
        a.textContent = cfg.email;
    });

    /* ---------- Dialog ---------- */
    const open = () => {
        dialog.showModal();
        document.documentElement.classList.add('svc-locked');
        setTimeout(() => form.elements.name.focus(), 60);
    };
    section.querySelectorAll('[data-idea-open]').forEach((b) => b.addEventListener('click', open));
    dialog.addEventListener('close', () => document.documentElement.classList.remove('svc-locked'));
    dialog.querySelector('.idea-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    if (location.hash === '#share-idea') setTimeout(open, 400);

    /* ---------- Validation ---------- */
    const fields = [...form.querySelectorAll('input:not(.honeypot), select, textarea')];
    const messages = {
        name: 'Please enter your name.',
        email: 'Please enter a valid email address.',
        whatsapp: 'Please enter a valid number, or leave it empty.',
        type: 'Please choose a product type.',
        idea: 'Please describe your idea (at least 20 characters).',
        problem: 'Please describe the problem it solves.',
        audience: 'Please describe your target audience.',
    };
    const check = (f) => {
        let ok = f.checkValidity();
        if (f.name === 'whatsapp' && f.value.trim()) ok = /^[+()\-.\s\d]{7,}$/.test(f.value.trim());
        const field = f.closest('.idea-field');
        field.classList.toggle('is-invalid', !ok);
        let err = field.querySelector('.idea-err');
        if (!ok) {
            if (!err) { err = document.createElement('small'); err.className = 'idea-err'; field.append(err); }
            err.textContent = messages[f.name];
        } else if (err) err.remove();
        return ok;
    };
    fields.forEach((f) => {
        f.addEventListener('blur', () => check(f));
        f.addEventListener('input', () => { if (f.closest('.is-invalid')) check(f); });
    });

    const setStatus = (msg, type = '') => {
        status.className = `idea-status${type ? ` is-${type}` : ''}`;
        status.innerHTML = msg;
    };

    /* ---------- Submit ---------- */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (form.elements.website.value) return; // bot
        const allOk = fields.map(check).every(Boolean);
        if (!allOk) {
            setStatus('Please fix the highlighted fields.', 'error');
            form.querySelector('.is-invalid input, .is-invalid select, .is-invalid textarea')?.focus();
            return;
        }

        const v = Object.fromEntries(new FormData(form).entries());
        const message = [
            `Product type: ${v.type}`,
            `WhatsApp: ${v.whatsapp || 'not given'}`,
            '',
            'IDEA',
            v.idea,
            '',
            'PROBLEM IT SOLVES',
            v.problem,
            '',
            'TARGET AUDIENCE',
            v.audience,
        ].join('\n');
        const subject = `New product idea (${v.type}) from ${v.name}`;

        const ej = cfg.emailjs || {};
        const canSend = window.emailjs && ej.publicKey && ej.serviceId && ej.templateId;
        submit.disabled = true;
        submit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending…';
        setStatus('');

        try {
            if (!canSend) throw new Error('EmailJS not available');
            await window.emailjs.send(ej.serviceId, ej.templateId, {
                from_name: v.name,
                from_email: v.email,
                reply_to: v.email,
                phone: v.whatsapp || '',
                subject,
                message,
            }, { publicKey: ej.publicKey });
            form.reset();
            setStatus('<i class="bi bi-check-circle-fill"></i> Thank you! Your idea has been sent. We will get back to you within 48 hours.', 'success');
        } catch {
            // Fallback: open the visitor's email app with everything pre-filled
            const mail = `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Name: ${v.name}\nEmail: ${v.email}\n${message}`)}`;
            setStatus(`Sending failed. <a href="${mail}">Send it by email instead</a>, or use WhatsApp.`, 'error');
        } finally {
            submit.disabled = false;
            submit.innerHTML = '<i class="bi bi-send-fill me-2"></i>Send my idea';
        }
    });

    /* ---------- Entrance (time-based, always completes) ---------- */
    const panel = section.querySelector('.idea-panel');
    if (reduceMotion || !('IntersectionObserver' in window)) {
        panel.classList.add('is-in');
    } else {
        const io = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            panel.classList.add('is-in');
            io.disconnect();
        }, { rootMargin: '0px 0px 10% 0px' });
        io.observe(panel);
        addEventListener('scroll', () => {
            if (!panel.classList.contains('is-in') && panel.getBoundingClientRect().top < innerHeight) panel.classList.add('is-in');
        }, { passive: true });
    }

    /* ---------- Pointer parallax on the illustration ---------- */
    const scene = section.querySelector('.idea-scene');
    if (!reduceMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
        let raf = 0;
        panel.addEventListener('pointermove', (e) => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                const r = panel.getBoundingClientRect();
                scene.style.setProperty('--tx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
                scene.style.setProperty('--ty', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
                panel.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
                panel.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
            });
        });
        panel.addEventListener('pointerleave', () => {
            scene.style.setProperty('--tx', 0);
            scene.style.setProperty('--ty', 0);
        });
    }
})();
