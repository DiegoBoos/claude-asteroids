'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.points = POINTS[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    if (this.novaDelay !== undefined) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur  = 16;
    }
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// Silueta cóncava fija (con muesca) para el asteroide afilado, normalizada a radio 1
const SHARP_VERTS = [
  [-15, -140], [70, -110], [60, -25], [130, -5], [110, 75],
  [50, 75], [5, 145], [-90, 100], [-145, 5], [-125, -70],
].map(([x, y]) => [x / 150, y / 150]);

// Variante de asteroide grande con forma cóncava puntiaguda: vale más puntos
// y se rompe en tres fragmentos en vez de dos.
class SharpAsteroid extends Asteroid {
  constructor(x, y) {
    super(x, y, 3);
    this.points = POINTS[3] * 2;
    this.verts = SHARP_VERTS.map(([nx, ny]) => [nx * this.radius, ny * this.radius]);
  }

  split() {
    return [
      new Asteroid(this.x, this.y, 2),
      new Asteroid(this.x, this.y, 2),
      new Asteroid(this.x, this.y, 2),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#ff5533';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    if (this.novaDelay !== undefined) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur  = 16;
    }
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-Up ──────────────────────────────────────────────────────────────────
const PU_TTL     = 10;   // segundos que la cápsula espera en pantalla
const PU_SIDES   = { triple: 3, nova: 6 };
const PU_LABELS  = { triple: 'T', nova: 'N' };
const PU_COLORS  = { triple: '#ffe600', nova: '#ff4de0' };
const PU_DROP    = { triple: 0.25, nova: 0.07 };  // nova = ítem escaso

const TRIPLE_DURATION = 5;     // tope de duración del efecto activo
const TRIPLE_SPREAD   = 0.22;  // rad de separación entre balas del abanico
const NOVA_FLASH      = 0.35;  // duración del destello blanco al detonar
const NOVA_KEY        = 'KeyB';
const NOVA_WAVE_STEP  = 0.1;   // segundos entre cada asteroide de la oleada

class PowerUp {
  constructor(x, y, type) {
    this.x      = x;
    this.y      = y;
    this.type   = type;
    this.radius = 12;
    this.ttl    = PU_TTL;
    this.rot    = rand(0, Math.PI * 2);
    this.rotSpeed = rand(0.6, 1.4) * (Math.random() < 0.5 ? 1 : -1);
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 45);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.dead = false;
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadea cuando está por expirar
    if (this.ttl < 3 && Math.floor(this.ttl * 6) % 2 === 0) return;

    const sides = PU_SIDES[this.type];
    const color = PU_COLORS[this.type];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * this.radius;
      const y = Math.sin(a) * this.radius;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.shadowBlur   = 0;
    ctx.fillStyle    = color;
    ctx.font         = 'bold 9px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PU_LABELS[this.type], 0, 0);

    ctx.restore();

    // Barra de tiempo restante antes de que la cápsula desaparezca (sin rotar)
    const pct  = Math.max(0, this.ttl / PU_TTL);
    const barW = 22, barH = 3;
    const barX = this.x - barW / 2;
    const barY = this.y + this.radius + 6;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * pct, barH);
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    const shots = [new Bullet(ox, oy, this.angle)];
    if (tripleTimer > 0) {
      shots.push(new Bullet(ox, oy, this.angle - TRIPLE_SPREAD));
      shots.push(new Bullet(ox, oy, this.angle + TRIPLE_SPREAD));
    }
    return shots;
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Fragmentos (desintegración de la Bomba Nova) ─────────────────────────────
class Shard {
  constructor(x, y, verts, vx, vy) {
    this.x = x;
    this.y = y;
    this.verts = verts;   // 2 puntos, relativos al origen del fragmento
    this.vx = vx;
    this.vy = vy;
    this.rot      = rand(0, Math.PI * 2);
    this.rotSpeed = rand(-4, 4);
    this.life = rand(0.5, 0.9);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x   += this.vx * dt;
    this.y   += this.vy * dt;
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    ctx.lineTo(this.verts[1][0], this.verts[1][1]);
    ctx.stroke();
    ctx.restore();
  }
}

// Rompe un asteroide en fragmentos de su propio contorno que salen volando
// hacia afuera (usado por la Bomba Nova en vez de split()).
function shatterAsteroid(a) {
  const n = a.verts.length;
  const cos = Math.cos(a.rot), sin = Math.sin(a.rot);
  const spin = ([vx, vy]) => [vx * cos - vy * sin, vx * sin + vy * cos];

  for (let i = 0; i < n; i += 2) {
    const [r1x, r1y] = spin(a.verts[i]);
    const [r2x, r2y] = spin(a.verts[(i + 1) % n]);
    const mx  = (r1x + r2x) / 2;
    const my  = (r1y + r2y) / 2;
    const mag = Math.hypot(mx, my) || 1;
    const outSpeed = rand(50, 150);
    const vx = a.vx + (mx / mag) * outSpeed;
    const vy = a.vy + (my / mag) * outSpeed;
    shards.push(new Shard(
      a.x + mx, a.y + my,
      [[r1x - mx, r1y - my], [r2x - mx, r2y - my]],
      vx, vy
    ));
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups, shards;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let tripleUsed;   // true una vez RECOGIDA -> ya no vuelve a caer en la partida
let tripleTimer;  // segundos restantes de disparo triple activo
let novaUsed;     // true una vez RECOGIDA -> ya no vuelve a caer en la partida
let novaReady;    // true = carga de Bomba Nova disponible sin detonar
let novaFlash;    // segundos restantes del destello blanco al detonar

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(Math.random() < 0.25 ? new SharpAsteroid(x, y) : new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups  = [];
  shards    = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  tripleUsed  = false;
  tripleTimer = 0;
  novaUsed    = false;
  novaReady   = false;
  novaFlash   = 0;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  // powerups y particles NO se limpian: la cápsula sin recoger, el efecto
  // triple activo, la carga Nova y las explosiones de una Nova recién
  // detonada deben sobrevivir al cambio de nivel.
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

// Sortea la caída de un power-up al destruir un asteroide. Como máximo una
// cápsula en pantalla a la vez; la Nova (más escasa) tiene prioridad.
function rollPowerUp(x, y) {
  if (powerups.length > 0) return;
  if (!novaUsed && Math.random() < PU_DROP.nova)
    powerups.push(new PowerUp(x, y, 'nova'));
  else if (!tripleUsed && Math.random() < PU_DROP.triple)
    powerups.push(new PowerUp(x, y, 'triple'));
}

// Marca todos los asteroides en pantalla para desintegrarse en oleada, del más
// cercano a la nave al más lejano. No se fragmentan con split(): cada uno se
// rompe en fragmentos de su propio contorno (shatterAsteroid) al llegarle su turno.
function detonateNova() {
  novaReady = false;
  novaFlash = NOVA_FLASH;
  const doomed = [...asteroids].sort((a, b) => dist(ship, a) - dist(ship, b));
  doomed.forEach((a, i) => { a.novaDelay = i * NOVA_WAVE_STEP; });
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    shards.forEach(s => s.update(dt));
    shards = shards.filter(s => !s.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerups.forEach(p => p.update(dt));
    powerups = powerups.filter(p => !p.dead);
    shards.forEach(s => s.update(dt));
    shards = shards.filter(s => !s.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  if (tripleTimer > 0) tripleTimer -= dt;
  if (novaFlash   > 0) novaFlash   -= dt;

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Detonar Bomba Nova
  if (novaReady && pressed(NOVA_KEY)) detonateNova();

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerups.forEach(p => p.update(dt));
  shards.forEach(s => s.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerups  = powerups.filter(p => !p.dead);
  shards    = shards.filter(s => !s.dead);

  // Oleada de la Bomba Nova: cada asteroide marcado se desintegra a su turno
  for (const a of asteroids) {
    if (a.novaDelay === undefined) continue;
    a.novaDelay -= dt;
    if (a.novaDelay <= 0) {
      score += a.points;
      explode(a.x, a.y, a.size * 4);
      shatterAsteroid(a);
      a.dead = true;
    }
  }
  asteroids = asteroids.filter(a => !a.dead);

  // Bala vs asteroide (los marcados por la Nova ya están en su propia oleada)
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (a.novaDelay !== undefined) continue;
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += a.points;
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        rollPowerUp(a.x, a.y);
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs power-up
  for (const p of powerups) {
    if (dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === 'nova') {
        novaUsed  = true;
        novaReady = true;
      } else {
        tripleUsed  = true;
        tripleTimer = TRIPLE_DURATION;
      }
    }
  }
  powerups = powerups.filter(p => !p.dead);

  // Nave vs asteroide (los marcados por la Nova ya no pueden chocar)
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (a.novaDelay !== undefined) continue;
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  ctx.textAlign = 'left';
  ctx.font      = '13px monospace';

  if (novaReady) {
    ctx.fillStyle = PU_COLORS.nova;
    ctx.fillText(`NOVA  [B] LISTA`, 14, H - 40);
  }

  if (tripleTimer > 0 && !(tripleTimer < 2 && Math.floor(tripleTimer * 6) % 2 === 0)) {
    ctx.fillStyle = PU_COLORS.triple;
    ctx.fillText(`TRIPLE  ${Math.ceil(tripleTimer)}s`, 14, H - 20);

    const pct  = Math.max(0, tripleTimer / TRIPLE_DURATION);
    const barW = 90, barH = 4, barX = 14, barY = H - 12;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = PU_COLORS.triple;
    ctx.fillRect(barX, barY, barW * pct, barH);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  shards.forEach(s => s.draw());
  powerups.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (novaFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(novaFlash / NOVA_FLASH).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
