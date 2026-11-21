// Synthesised engine + tyre screech (Web Audio, no audio files).
export function createAudio() {
    let ctx = null;
    let master, engineGain, engineFilter, osc1, osc2, screechGain, screechFilter;
    let muted = false;
    try { muted = localStorage.getItem('drift-muted') === '1'; } catch { /* storage blocked */ }

    const start = () => {
        if (ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ctx.destination);

        // engine: two detuned oscillators through a low-pass
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 600;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.12;
        osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2 = ctx.createOscillator();
        osc2.type = 'square';
        osc1.connect(engineFilter);
        osc2.connect(engineFilter);
        engineFilter.connect(engineGain).connect(master);
        osc1.start();
        osc2.start();

        // screech: band-passed noise
        const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        noise.loop = true;
        screechFilter = ctx.createBiquadFilter();
        screechFilter.type = 'bandpass';
        screechFilter.frequency.value = 1400;
        screechFilter.Q.value = 3;
        screechGain = ctx.createGain();
        screechGain.gain.value = 0;
        noise.connect(screechFilter).connect(screechGain).connect(master);
        noise.start();
    };

    // fake gearbox: rpm climbs within a gear and drops on shift
    const GEARS = [0, 9, 17, 25, 33, 41, 99];
    const rpmFor = (speed) => {
        let g = 1;
        while (speed > GEARS[g] && g < GEARS.length - 1) g++;
        const lo = GEARS[g - 1];
        const hi = GEARS[g];
        return 0.25 + 0.75 * Math.min(1, (speed - lo) / (hi - lo));
    };

    return {
        start,
        get muted() { return muted; },
        toggle() {
            muted = !muted;
            try { localStorage.setItem('drift-muted', muted ? '1' : '0'); } catch { /* storage blocked */ }
            if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
            return muted;
        },
        update(speed, throttle, driftAmount) {
            if (!ctx) return;
            const t = ctx.currentTime;
            const rpm = rpmFor(Math.abs(speed));
            const f = 55 + rpm * 150 + (throttle > 0 ? 12 : 0);
            osc1.frequency.setTargetAtTime(f, t, 0.05);
            osc2.frequency.setTargetAtTime(f * 0.5 + 3, t, 0.05);
            engineFilter.frequency.setTargetAtTime(400 + rpm * 1400 + throttle * 600, t, 0.08);
            engineGain.gain.setTargetAtTime(0.07 + throttle * 0.07 + rpm * 0.03, t, 0.1);
            screechGain.gain.setTargetAtTime(Math.min(0.22, driftAmount * 0.22), t, 0.06);
            screechFilter.frequency.setTargetAtTime(1100 + driftAmount * 700, t, 0.1);
        },
        suspend() { ctx?.suspend(); },
        resume() { ctx?.resume(); },
    };
}
