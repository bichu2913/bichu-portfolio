// Keyboard + gamepad input, merged into one { throttle, brake, steer, handbrake } state.
export function createInput() {
    const keys = new Set();
    const pressed = new Set(); // one-shot keys this frame

    const onDown = (e) => {
        const k = e.key.toLowerCase();
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
        if (!keys.has(k)) pressed.add(k);
        keys.add(k);
    };
    const onUp = (e) => keys.delete(e.key.toLowerCase());
    addEventListener('keydown', onDown);
    addEventListener('keyup', onUp);
    addEventListener('blur', () => keys.clear());

    const state = { throttle: 0, brake: 0, steer: 0, handbrake: false };

    return {
        state,
        // call once per frame
        poll() {
            const has = (...k) => k.some((x) => keys.has(x));
            let throttle = has('w', 'arrowup') ? 1 : 0;
            let brake = has('s', 'arrowdown') ? 1 : 0;
            let steer = (has('a', 'arrowleft') ? 1 : 0) - (has('d', 'arrowright') ? 1 : 0);
            let handbrake = has(' ');

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
