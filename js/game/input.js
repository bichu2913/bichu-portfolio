// Keyboard + gamepad + touch input, merged into one { throttle, brake, steer, handbrake } state.
export function createInput() {
    const keys = new Set();
    const pressed = new Set(); // one-shot keys this frame

    const onDown = (e) => {
        if (e.target?.closest?.('input, textarea')) return; // typing a name, not driving
        const k = e.key.toLowerCase();
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
        if (!keys.has(k)) pressed.add(k);
        keys.add(k);
    };
    const onUp = (e) => keys.delete(e.key.toLowerCase());
    addEventListener('keydown', onDown);
    addEventListener('keyup', onUp);
    addEventListener('blur', () => keys.clear());

    /* ---------- Touch: steering pad on the left, pedals on the right ---------- */
    const touch = { steer: 0, throttle: 0, brake: 0, handbrake: false };
    const root = document.querySelector('.touch');
    if (root) {
        const pad = root.querySelector('.touch-steer');
        const knob = pad.querySelector('.touch-knob');
        let steerId = null;
        let originX = 0;

        const setSteer = (clientX) => {
            const r = pad.getBoundingClientRect();
            const max = r.width / 2 - 10;
            const dx = Math.max(-max, Math.min(max, clientX - originX));
            touch.steer = -dx / max; // positive = left
            knob.style.transform = `translateX(${dx}px)`;
        };
        pad.addEventListener('pointerdown', (e) => {
            steerId = e.pointerId;
            pad.setPointerCapture(e.pointerId);
            const r = pad.getBoundingClientRect();
            originX = r.left + r.width / 2;
            setSteer(e.clientX);
            e.preventDefault();
        });
        pad.addEventListener('pointermove', (e) => { if (e.pointerId === steerId) setSteer(e.clientX); });
        const releaseSteer = (e) => {
            if (e.pointerId !== steerId) return;
            steerId = null;
            touch.steer = 0;
            knob.style.transform = '';
        };
        pad.addEventListener('pointerup', releaseSteer);
        pad.addEventListener('pointercancel', releaseSteer);

        root.querySelectorAll('[data-pedal]').forEach((btn) => {
            const key = btn.dataset.pedal;
            const set = (on) => {
                btn.classList.toggle('is-down', on);
                if (key === 'handbrake') touch.handbrake = on;
                else touch[key] = on ? 1 : 0;
                if (on && navigator.vibrate && key === 'handbrake') navigator.vibrate(12);
            };
            btn.addEventListener('pointerdown', (e) => { btn.setPointerCapture(e.pointerId); set(true); e.preventDefault(); });
            btn.addEventListener('pointerup', () => set(false));
            btn.addEventListener('pointercancel', () => set(false));
            btn.addEventListener('lostpointercapture', () => set(false));
        });
        root.querySelector('[data-touch="reset"]')?.addEventListener('pointerdown', (e) => { pressed.add('r'); e.preventDefault(); });
        root.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    const state = { throttle: 0, brake: 0, steer: 0, handbrake: false };

    return {
        state,
        // call once per frame
        poll() {
            const has = (...k) => k.some((x) => keys.has(x));
            let throttle = Math.max(has('w', 'arrowup') ? 1 : 0, touch.throttle);
            let brake = Math.max(has('s', 'arrowdown') ? 1 : 0, touch.brake);
            let steer = (has('a', 'arrowleft') ? 1 : 0) - (has('d', 'arrowright') ? 1 : 0) || touch.steer;
            let handbrake = has(' ') || touch.handbrake;

            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (const p of pads) {
                if (!p) continue;
                const rt = p.buttons[7]?.value || 0;
                const lt = p.buttons[6]?.value || 0;
                const sx = Math.abs(p.axes[0]) > 0.12 ? p.axes[0] : 0;
                throttle = Math.max(throttle, rt);
                brake = Math.max(brake, lt);
                if (sx) steer = -sx;
                if (p.buttons[0]?.pressed || p.buttons[2]?.pressed) handbrake = true;
                if (p.buttons[3]?.pressed) pressed.add('r');
                break;
            }
            Object.assign(state, { throttle, brake, steer, handbrake });
        },
        consume(key) {
            const had = pressed.has(key);
            pressed.delete(key);
            return had;
        },
        endFrame() { pressed.clear(); },
    };
}
