// Arcade drift physics on the ground plane (x, z). Heading 0 faces +Z; positive yaw turns left.
// Not a simulation: tuned so drifts are easy to start (handbrake / power oversteer)
// and satisfying to hold with counter-steer and throttle.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

export const TUNING = {
    maxSpeed: 46,        // m/s  (~165 km/h)
    accel: 26,           // m/s² at standstill
    brake: 42,
    reverseAccel: 12,
    maxReverse: 11,
    drag: 0.18,
    rolling: 1.6,
    wheelbase: 2.6,
    steerLow: 0.62,      // max steer angle (rad) at low speed
    steerHigh: 0.26,     // ...and at top speed
    steerRate: 9,        // how fast steering follows input
    gripNormal: 10,      // how strongly tyres kill sideways slide
    gripDrift: 2.6,
    gripHandbrake: 1.1,
    maxLatAccel: 30,     // tyre saturation: above this the car slides
    maxLatDrift: 15,
    yawResponse: 9,
    yawResponseDrift: 3.4,
    handbrakeKick: 2.4,  // extra rotation while the handbrake is held
    powerOversteer: 0.55,
    driftEnter: 0.22,    // rad of slip angle to count as drifting
    driftExit: 0.12,
};

export class Vehicle {
    constructor() {
        this.reset();
    }

    reset(x = 0, z = 0, heading = 0) {
        this.x = x;
        this.z = z;
        this.heading = heading;
        this.vx = 0;
        this.vz = 0;
        this.yawRate = 0;
        this.steer = 0;          // smoothed -1..1 (positive = left)
        this.forwardSpeed = 0;
        this.lateralSpeed = 0;
        this.latAccel = 0;
        this.longAccel = 0;
        this.slip = 0;           // drift angle (rad), signed
        this.drifting = false;
        this.handbrake = false;
        this.braking = false;
        this.wheelSpin = 0;
    }

    get speed() { return Math.hypot(this.vx, this.vz); }

    update(dt, input) {
        const T = TUNING;
        const fx = Math.sin(this.heading);
        const fz = Math.cos(this.heading);
        const lx = Math.cos(this.heading);   // left vector
        const lz = -Math.sin(this.heading);

        let vf = this.vx * fx + this.vz * fz;
        let vl = this.vx * lx + this.vz * lz;
        const vfBefore = vf;

        this.handbrake = input.handbrake;
        this.braking = input.brake > 0.1 && vf > 1;

        // ---- longitudinal: engine, brakes, drag
        if (input.throttle > 0) {
            if (vf < -0.5) vf += T.brake * input.throttle * dt; // throttle brakes when rolling back
            else vf += input.throttle * T.accel * (1 - clamp(vf / T.maxSpeed, 0, 1)) * dt;
        }
        if (input.brake > 0) {
            if (vf > 0.5) vf -= T.brake * input.brake * dt;
            else vf = Math.max(-T.maxReverse, vf - T.reverseAccel * input.brake * dt);
        }
        vf -= vf * T.drag * dt * (1 + Math.abs(vf) * 0.02);
        if (input.throttle === 0 && input.brake === 0) {
            const roll = Math.sign(vf) * Math.min(Math.abs(vf), T.rolling * dt);
            vf -= roll;
        }
        if (this.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);

        // ---- steering
        this.steer += (input.steer - this.steer) * Math.min(1, T.steerRate * dt);
        const speedRatio = clamp(Math.abs(vf) / T.maxSpeed, 0, 1);
        const steerAngle = this.steer * lerp(T.steerLow, T.steerHigh, speedRatio);

        // ---- drift state (with hysteresis)
        const speed = Math.hypot(vf, vl);
        this.slip = speed > 2 ? Math.atan2(vl, Math.abs(vf)) : 0;
        const absSlip = Math.abs(this.slip);
        if (!this.drifting && absSlip > T.driftEnter && speed > 7) this.drifting = true;
        else if (this.drifting && (absSlip < T.driftExit || speed < 4)) this.drifting = false;

        // ---- lateral: tyre grip with saturation
        let grip = T.gripNormal;
        let maxLat = T.maxLatAccel;
        if (this.handbrake) { grip = T.gripHandbrake; maxLat = T.maxLatDrift * 0.5; }
        else if (this.drifting) {
            grip = T.gripDrift * (1 - T.powerOversteer * input.throttle);
            maxLat = T.maxLatDrift;
        }
        const latAccel = clamp(-vl * grip, -maxLat, maxLat);
        vl += latAccel * dt;
        this.latAccel = latAccel;

        // ---- yaw
        const speedFactor = clamp(Math.abs(vf) / 8, 0, 1);
        let targetYaw = (vf / T.wheelbase) * Math.tan(steerAngle);
        if (this.handbrake) targetYaw += this.steer * T.handbrakeKick * speedFactor;
        if (this.drifting && input.throttle > 0) {
            // power oversteer: throttle keeps the rear stepping out in the direction of the slide
            targetYaw += Math.sign(this.slip) * input.throttle * 0.9 * speedFactor;
        }
        const response = this.drifting || this.handbrake ? T.yawResponseDrift : T.yawResponse;
        this.yawRate += (targetYaw - this.yawRate) * Math.min(1, response * dt);
        this.heading += this.yawRate * dt;

        // ---- integrate
        this.vx = fx * vf + lx * vl;
        this.vz = fz * vf + lz * vl;
        this.x += this.vx * dt;
        this.z += this.vz * dt;

        this.forwardSpeed = vf;
        this.lateralSpeed = vl;
        this.longAccel = (vf - vfBefore) / dt;
        this.wheelSpin += (vf / 0.36) * dt;
        this.steerAngle = steerAngle;
    }

    // Bounce off a wall with outward normal (nx, nz). Returns impact speed.
    collide(nx, nz, restitution = 0.35) {
        const vn = this.vx * nx + this.vz * nz;
        if (vn >= 0) return 0;
        this.vx -= (1 + restitution) * vn * nx;
        this.vz -= (1 + restitution) * vn * nz;
        this.vx *= 0.8;
        this.vz *= 0.8;
        this.yawRate *= 0.5;
        return -vn;
    }
}
