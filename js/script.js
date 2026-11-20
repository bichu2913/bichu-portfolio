document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    body.classList.add('is-loaded');

    const emailJsSettings = (window.SITE_CONFIG && window.SITE_CONFIG.emailjs) || {};
    const EMAILJS_PUBLIC_KEY = emailJsSettings.publicKey || '';
    const EMAILJS_SERVICE_ID = emailJsSettings.serviceId || '';
    const EMAILJS_TEMPLATE_ID = emailJsSettings.templateId || '';
    const emailJsConfigured = ![
        EMAILJS_PUBLIC_KEY,
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID
    ].some((value) => !value || value.includes('EMAILJS_') || value.includes('YOUR_'));

    if (emailJsConfigured && window.emailjs) {
        emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    }

    const navbar = document.querySelector('.custom-navbar');
    const navLinks = [...document.querySelectorAll('.nav-link[href^="#"]')];
    const sections = navLinks
        .map((link) => document.querySelector(link.getAttribute('href')))
        .filter(Boolean);

    const customCursor = document.querySelector('.cursor');
    const customCursorRing = document.querySelector('.cursor-ring') || document.createElement('div');

    if (customCursorRing && !customCursorRing.classList.contains('cursor-ring')) {
        customCursorRing.classList.add('cursor-ring');
        document.body.appendChild(customCursorRing);
    }

    function setupCursor() {
        if (!customCursor || !customCursorRing || prefersReducedMotion || hasCoarsePointer) {
            if (customCursor) customCursor.style.display = 'none';
            if (customCursorRing) customCursorRing.style.display = 'none';
            return;
        }

        body.classList.add('has-custom-cursor');

        const targetPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const pointer = { x: targetPointer.x, y: targetPointer.y };
        let rafId = null;

        function updateCursor() {
            pointer.x += (targetPointer.x - pointer.x) * 0.18;
            pointer.y += (targetPointer.y - pointer.y) * 0.18;

            customCursor.style.left = `${pointer.x}px`;
            customCursor.style.top = `${pointer.y}px`;
            customCursorRing.style.left = `${pointer.x}px`;
            customCursorRing.style.top = `${pointer.y}px`;

            rafId = requestAnimationFrame(updateCursor);
        }

        function showCursor() {
            customCursor.classList.add('is-visible');
            customCursorRing.classList.add('is-visible');
        }

        function hideCursor() {
            customCursor.classList.remove('is-visible');
            customCursorRing.classList.remove('is-visible');
        }

        document.addEventListener('pointermove', (event) => {
            targetPointer.x = event.clientX;
            targetPointer.y = event.clientY;
            showCursor();
        });

        ['pointerdown', 'mousedown'].forEach((eventName) => {
            document.addEventListener(eventName, () => {
                customCursor.classList.add('is-active');
                customCursorRing.classList.add('is-active');
            });
        });

        ['pointerup', 'mouseup', 'pointerleave'].forEach((eventName) => {
            document.addEventListener(eventName, () => {
                customCursor.classList.remove('is-active');
                customCursorRing.classList.remove('is-active');
            });
        });

        document.querySelectorAll('a, button, .project-card, .skill-card, .process-strip-item, .contact-item, .social-icons a, .hero-image-wrapper, .floating, .form-control').forEach((element) => {
            element.addEventListener('pointerenter', () => {
                customCursor.classList.add('is-active');
                customCursorRing.classList.add('is-active');
            });

            element.addEventListener('pointerleave', () => {
                customCursor.classList.remove('is-active');
                customCursorRing.classList.remove('is-active');
            });
        });

        document.addEventListener('pointerleave', hideCursor);
        document.addEventListener('pointerenter', showCursor);

        if (rafId) cancelAnimationFrame(rafId);
        updateCursor();
    }

    setupCursor();

    function updateNavbar() {
        navbar?.classList.toggle('scrolled', window.scrollY > 50);
    }

    window.addEventListener('scroll', updateNavbar, { passive: true });
    updateNavbar();

    if (sections.length && navLinks.length) {
        // Active section = the last one whose top has passed 35% of the viewport.
        let activeId = '';
        let navTicking = false;

        function updateActiveNav() {
            navTicking = false;
            const line = window.innerHeight * 0.35;
            const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
            let current = sections[0];

            sections.forEach((section) => {
                if (section.getBoundingClientRect().top <= line) current = section;
            });
            if (atBottom) current = sections[sections.length - 1];
            if (current.id === activeId) return;

            activeId = current.id;
            navLinks.forEach((link) => {
                link.classList.toggle('active', link.getAttribute('href') === `#${activeId}`);
            });
        }

        window.addEventListener('scroll', () => {
            if (!navTicking) {
                navTicking = true;
                requestAnimationFrame(updateActiveNav);
            }
        }, { passive: true });
        window.addEventListener('resize', updateActiveNav);
        updateActiveNav();
    }

    document.querySelectorAll('.navbar-collapse .nav-link').forEach((link) => {
        link.addEventListener('click', () => {
            const menu = document.querySelector('.navbar-collapse.show');
            if (menu && window.bootstrap) {
                bootstrap.Collapse.getOrCreateInstance(menu).hide();
            }
        });
    });

    const typingElement = document.querySelector('.typing');
    const roles = ['Flutter applications', 'AI-powered products', 'scalable backend systems'];
    let roleIndex = 0;
    let characterIndex = 0;
    let deleting = false;

    function typeRole() {
        if (!typingElement) return;

        const role = roles[roleIndex];
        typingElement.textContent = deleting ? role.slice(0, characterIndex--) : role.slice(0, characterIndex++);

        if (!deleting && characterIndex > role.length) {
            deleting = true;
            setTimeout(typeRole, 1300);
            return;
        }

        if (deleting && characterIndex < 0) {
            deleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            characterIndex = 0;
        }

        setTimeout(typeRole, deleting ? 45 : 85);
    }

    if (!prefersReducedMotion) {
        typeRole();
    }

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -4% 0px' });

    function observeRevealTargets() {
        const targetSelectors = [
            '.section-tag',
            '.section-title',
            '.section-description',
            '.hero-badge',
            '.hero-title',
            '.typing',
            '.hero-text',
            '.hero-buttons',
            '.hero .row.text-center',
            '.hero-image-wrapper',
            '.about-image',
            '.about-copy',
            '.skill-card',
            '.process-step',
            '.timeline-item',
            '.project-card',
            '.work-note',
            '.contact-card',
            '.contact-form',
            '.footer .row',
            '.footer .text-center'
        ];

        targetSelectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                element.classList.add('reveal');
                revealObserver.observe(element);
            });
        });
    }

    observeRevealTargets();

    // Safety net for fast flings: reveal anything already scrolled past, so nothing stays hidden.
    let revealTicking = false;
    window.addEventListener('scroll', () => {
        if (revealTicking) return;
        revealTicking = true;
        requestAnimationFrame(() => {
            revealTicking = false;
            document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => {
                if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-visible');
            });
        });
    }, { passive: true });

    const timeline = document.querySelector('.timeline');
    if (timeline) {
        const timelineObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        timelineObserver.observe(timeline);
    }

    const heroImageWrapper = document.querySelector('.hero-image-wrapper');
    const heroImage = document.querySelector('.hero-image');
    const floatingBadges = [...document.querySelectorAll('.floating')];

    function applyTilt(element, event, options = {}) {
        const rect = element.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const { maxX = 0, maxY = 0, rotateX = 0, rotateY = 0 } = options;

        const tiltX = (0.5 - y) * maxX;
        const tiltY = (x - 0.5) * maxY;

        element.style.setProperty('--card-rotate-x', `${rotateX + tiltX}deg`);
        element.style.setProperty('--card-rotate-y', `${rotateY + tiltY}deg`);
    }

    function applyHeroMotion(event) {
        if (!heroImageWrapper || !heroImage) return;

        const rect = heroImageWrapper.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;

        heroImageWrapper.style.setProperty('--wrapper-rotate-x', `${(-y * 10).toFixed(2)}deg`);
        heroImageWrapper.style.setProperty('--wrapper-rotate-y', `${(x * 12).toFixed(2)}deg`);
        heroImage.style.setProperty('--hero-rotate-x', `${(2 - y * 5).toFixed(2)}deg`);
        heroImage.style.setProperty('--hero-rotate-y', `${(-8 + x * 10).toFixed(2)}deg`);

        floatingBadges.forEach((badge, index) => {
            const depth = (index + 1) * 7;
            const bx = (x * depth * 2).toFixed(2);
            const by = (y * depth * 2).toFixed(2);
            badge.style.setProperty('--shift-x', `${bx}px`);
            badge.style.setProperty('--shift-y', `${by}px`);
        });
    }

    function resetMotion() {
        document.querySelectorAll('.project-card, .skill-card').forEach((card) => {
            card.style.setProperty('--card-rotate-x', '0deg');
            card.style.setProperty('--card-rotate-y', '0deg');
        });

        if (heroImageWrapper) {
            heroImageWrapper.style.setProperty('--wrapper-rotate-x', '0deg');
            heroImageWrapper.style.setProperty('--wrapper-rotate-y', '0deg');
        }

        if (heroImage) {
            heroImage.style.setProperty('--hero-rotate-x', '2deg');
            heroImage.style.setProperty('--hero-rotate-y', '-8deg');
        }

        floatingBadges.forEach((badge) => {
            badge.style.setProperty('--shift-x', '0px');
            badge.style.setProperty('--shift-y', '0px');
        });
    }

    if (!prefersReducedMotion && !hasCoarsePointer) {
        document.addEventListener('pointermove', applyHeroMotion);

        document.addEventListener('pointerleave', resetMotion);
    }

    const statElements = [...document.querySelectorAll('.hero .row.text-center h2')];
    const statObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const element = entry.target;
            const rawText = element.textContent.trim();
            const match = rawText.match(/\d+/);

            if (!match) {
                observer.unobserve(element);
                return;
            }

            const target = Number(match[0]);
            const suffix = rawText.includes('+') ? '+' : '';
            const duration = 1400;
            const start = performance.now();

            function frame(now) {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const value = Math.round(target * eased);
                element.textContent = `${value}${suffix}`;

                if (progress < 1) {
                    requestAnimationFrame(frame);
                } else {
                    element.textContent = `${target}${suffix}`;
                    observer.unobserve(element);
                }
            }

            requestAnimationFrame(frame);
        });
    }, { threshold: 0.6 });

    statElements.forEach((element) => statObserver.observe(element));

    const parallaxItems = [...document.querySelectorAll('.hero-image-wrapper, .about-image, .project-card')];

    function updateParallax() {
        if (prefersReducedMotion || hasCoarsePointer) return;

        const viewportCenter = window.innerHeight / 2;

        parallaxItems.forEach((element) => {
            const rect = element.getBoundingClientRect();
            const speed = element.classList.contains('project-card') ? 0.08 : element.classList.contains('about-image') ? 0.06 : 0.05;
            const delta = rect.top + rect.height / 2 - viewportCenter;
            const shift = delta * speed;
            element.style.setProperty('--scroll-shift', `${shift.toFixed(2)}px`);
        });
    }

    let ticking = false;

    function requestParallaxUpdate() {
        if (ticking) return;

        ticking = true;
        window.requestAnimationFrame(() => {
            updateParallax();
            ticking = false;
        });
    }

    window.addEventListener('scroll', requestParallaxUpdate, { passive: true });
    window.addEventListener('resize', requestParallaxUpdate);
    requestParallaxUpdate();

    document.querySelectorAll('.skill-card').forEach((card) => {
        card.addEventListener('pointermove', (event) => {
            if (prefersReducedMotion || hasCoarsePointer) return;
            const rect = card.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--spotlight-x', `${x}%`);
            card.style.setProperty('--spotlight-y', `${y}%`);
        });
    });

    document.querySelectorAll('.btn').forEach((button) => {
        button.addEventListener('pointermove', (event) => {
            if (prefersReducedMotion || hasCoarsePointer) return;
            const rect = button.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const offsetX = (x / rect.width - 0.5) * 8;
            const offsetY = (y / rect.height - 0.5) * 8;
            button.style.setProperty('--mx', `${offsetX}px`);
            button.style.setProperty('--my', `${offsetY}px`);
            button.style.setProperty('--scale', '1.02');
        });

        button.addEventListener('pointerleave', () => {
            button.style.setProperty('--mx', '0px');
            button.style.setProperty('--my', '0px');
            button.style.setProperty('--scale', '1');
        });
    });

    document.querySelectorAll('.project-card').forEach((card) => {
        card.addEventListener('pointermove', (event) => {
            if (prefersReducedMotion || hasCoarsePointer) return;
            applyTilt(card, event, { maxX: 5.5, maxY: 7 });
        });

        card.addEventListener('pointerleave', () => {
            card.style.setProperty('--card-rotate-x', '0deg');
            card.style.setProperty('--card-rotate-y', '0deg');
        });
    });

    document.querySelectorAll('.skill-card').forEach((card) => {
        card.addEventListener('pointermove', (event) => {
            if (prefersReducedMotion || hasCoarsePointer) return;
            applyTilt(card, event, { maxX: 3, maxY: 3 });
        });

        card.addEventListener('pointerleave', () => {
            card.style.setProperty('--card-rotate-x', '0deg');
            card.style.setProperty('--card-rotate-y', '0deg');
        });
    });

    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const statusBox = document.getElementById('form-status');
        const honeypot = contactForm.querySelector('input[name="website"]');
        const fields = [...contactForm.querySelectorAll('.form-control')];
        const originalButtonText = submitButton ? submitButton.textContent.trim() : 'Send Message';

        const errorNodes = new Map(
            fields.map((field) => [field, field.closest('.form-field')?.querySelector('.field-error')])
        );

        function setStatus(message, type = '') {
            if (!statusBox) return;

            statusBox.textContent = message || '';
            statusBox.classList.remove('is-visible', 'is-success', 'is-error');

            if (message) {
                statusBox.classList.add('is-visible', type === 'success' ? 'is-success' : 'is-error');
            }
        }

        function clearFieldError(field) {
            field.classList.remove('is-invalid');
            const errorNode = errorNodes.get(field);
            if (errorNode) {
                errorNode.textContent = '';
            }
        }

        function setFieldError(field, message) {
            field.classList.add('is-invalid');
            const errorNode = errorNodes.get(field);
            if (errorNode) {
                errorNode.textContent = message;
            }
        }

        function validateField(field) {
            const value = field.value.trim();
            let message = '';

            switch (field.name) {
                case 'name':
                    if (!value) {
                        message = 'Please enter your name.';
                    } else if (value.length < 2) {
                        message = 'Name must be at least 2 characters long.';
                    }
                    break;
                case 'email':
                    if (!value) {
                        message = 'Please enter your email address.';
                    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                        message = 'Please enter a valid email address.';
                    }
                    break;
                case 'phone':
                    if (value && !/^[+()\-\.\s\d]{7,}$/.test(value)) {
                        message = 'Please enter a valid phone number.';
                    }
                    break;
                case 'subject':
                    if (!value) {
                        message = 'Please enter a subject.';
                    } else if (value.length < 3) {
                        message = 'Subject must be at least 3 characters long.';
                    }
                    break;
                case 'message':
                    if (!value) {
                        message = 'Please enter your message.';
                    } else if (value.length < 10) {
                        message = 'Message must be at least 10 characters long.';
                    }
                    break;
                default:
                    break;
            }

            if (message) {
                setFieldError(field, message);
                return false;
            }

            clearFieldError(field);
            return true;
        }

        function validateForm() {
            let isValid = true;

            fields.forEach((field) => {
                if (!validateField(field)) {
                    isValid = false;
                }
            });

            return isValid;
        }

        fields.forEach((field) => {
            field.addEventListener('input', () => {
                validateField(field);
                setStatus('', '');
            });

            field.addEventListener('blur', () => {
                validateField(field);
            });
        });

        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (honeypot && honeypot.value.trim()) {
                setStatus('Spam detected. Please try again.', 'error');
                return;
            }

            const isValid = validateForm();

            if (!isValid) {
                setStatus('Please correct the highlighted fields and try again.', 'error');
                return;
            }

            if (!emailJsConfigured || !window.emailjs) {
                setStatus('EmailJS is not configured yet. Please add the EmailJS Public Key, Service ID, and Template ID in js/script.js.', 'error');
                return;
            }

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
            }

            setStatus('', '');

            try {
                const formData = Object.fromEntries(new FormData(contactForm).entries());

                await emailjs.send(
                    EMAILJS_SERVICE_ID,
                    EMAILJS_TEMPLATE_ID,
                    {
                        from_name: String(formData.name || '').trim(),
                        from_email: String(formData.email || '').trim(),
                        phone: String(formData.phone || '').trim(),
                        subject: String(formData.subject || '').trim(),
                        message: String(formData.message || '').trim(),
                        reply_to: String(formData.email || '').trim()
                    }
                );

                contactForm.reset();
                fields.forEach((field) => clearFieldError(field));
                setStatus("Message sent successfully. I'll get back to you soon.", 'success');
            } catch (error) {
                console.error('EmailJS error:', error);
                setStatus('Something went wrong. Please try again or contact me directly.', 'error');
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
            }
        });
    }
});
