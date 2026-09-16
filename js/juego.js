/* ============================================================
   juego.js — SNAKE · La Culebrita (motor completo)
   Paso fijo con dibujo interpolado, velocidad progresiva,
   récord guardado, sonido al vuelo y controles de teclado,
   deslizamiento y cruceta.
   ============================================================ */

const COLS = 24;                       // tablero 24 x 24
const PASO_BASE = 0.15;                // segundos por celda al empezar
const PASO_MIN = 0.062;                // tope de rapidez
const CADA_NIVEL = 5;                  // frutas por nivel

const canvas = document.getElementById("tablero");
const ctx = canvas.getContext("2d");
const capaInicio = document.getElementById("capa-inicio");
const capaPausa = document.getElementById("capa-pausa");
const capaFin = document.getElementById("capa-fin");
const elPuntos = document.getElementById("puntos");
const elRecord = document.getElementById("record");
const elNivel = document.getElementById("nivel");
const elVelocidad = document.getElementById("velocidad");
const elFinPuntos = document.getElementById("fin-puntos");
const elFinMensaje = document.getElementById("fin-mensaje");
const marcaTablero = document.getElementById("marco");
const btnSonido = document.getElementById("btn-sonido");
const btnPausa = document.getElementById("btn-pausa");

/* ---------- estado ---------- */
let serpiente = [];
let serpientePrevia = [];              // donde estaba cada tramo antes del paso
let alfaActual = 0;                    // progreso del paso, congelado al morir
let direccion = { x: 1, y: 0 };
let giros = [];                        // giros en cola (para no perder ninguno)
let fruta = { x: 0, y: 0 };
let puntos = 0;
let nivel = 1;
let tPaso = PASO_BASE;
let tAcum = 0;
let estado = "listo";                  // listo | jugando | pausado | fin
let particulas = [];
let ultimoInstante = performance.now();
let sonidoActivo = true;

const claveRecord = "snake_record";
const clavePartidas = "snake_partidas";
const claveUltima = "snake_ultima";

function leerNumero(clave) {
  const n = Number(localStorage.getItem(clave));
  return Number.isFinite(n) ? n : 0;
}
let record = leerNumero(claveRecord);

/* ---------- escala nítida ---------- */
function ajustarNitidez() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const lado = canvas.clientWidth || 720;
  canvas.width = lado * dpr;
  canvas.height = lado * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
ajustarNitidez();
window.addEventListener("resize", ajustarNitidez);

const lado = () => canvas.clientWidth;
const celda = () => lado() / COLS;

/* ---------- partida ---------- */
function nuevaPartida() {
  const medio = Math.floor(COLS / 2);
  serpiente = [
    { x: medio, y: medio }, { x: medio - 1, y: medio },
    { x: medio - 2, y: medio }, { x: medio - 3, y: medio },
  ];
  direccion = { x: 1, y: 0 };
  giros = [];
  puntos = 0;
  nivel = 1;
  tPaso = PASO_BASE;
  tAcum = 0;
  particulas = [];
  serpientePrevia = serpiente.map((p) => ({ x: p.x, y: p.y }));
  alfaActual = 1;
  ponerFruta();
  actualizarHUD();
  pintarCapa("inicio");
  estado = "listo";
}

function ponerFruta() {
  const ocupadas = new Set(serpiente.map((p) => p.x + "," + p.y));
  let candidata, intentos = 0;
  do {
    candidata = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * COLS) };
    intentos++;
  } while (ocupadas.has(candidata.x + "," + candidata.y) && intentos < 600);
  fruta = candidata;
}

function actualizarHUD() {
  elPuntos.textContent = String(puntos);
  elRecord.textContent = String(record);
  elNivel.textContent = String(nivel);
  elVelocidad.textContent = (PASO_BASE / tPaso).toFixed(1) + "x";
}

function pintarCapa(cual) {
  capaInicio.hidden = cual !== "inicio";
  capaPausa.hidden = cual !== "pausa";
  capaFin.hidden = cual !== "fin";
}

/* ---------- avance de un paso ---------- */
function avanzar() {
  serpientePrevia = serpiente.map((p) => ({ x: p.x, y: p.y }));
  if (giros.length) {
    const g = giros.shift();
    if (!(g.x === -direccion.x && g.y === -direccion.y)) direccion = g;
  }

  const cabeza = { x: serpiente[0].x + direccion.x, y: serpiente[0].y + direccion.y };

  const chocaMuro = cabeza.x < 0 || cabeza.y < 0 || cabeza.x >= COLS || cabeza.y >= COLS;
  const chocaCola = serpiente.some((p, i) => i < serpiente.length - 1 && p.x === cabeza.x && p.y === cabeza.y);

  if (chocaMuro || chocaCola) {
    morir(chocaMuro ? "muro" : "cola");
    return;
  }

  serpiente.unshift(cabeza);

  if (cabeza.x === fruta.x && cabeza.y === fruta.y) {
    puntos++;
    crearParticulas(fruta.x, fruta.y);
    sonando(560 + Math.min(puntos, 12) * 28, 0.07, "square", 0.05);
    nivel = 1 + Math.floor(puntos / CADA_NIVEL);
    tPaso = Math.max(PASO_MIN, PASO_BASE - (nivel - 1) * 0.007);
    ponerFruta();
    actualizarHUD();
  } else {
    serpiente.pop();
  }
}

function morir(causa) {
  estado = "fin";
  sonando(150, 0.35, "sawtooth", 0.06);
  setTimeout(() => sonando(96, 0.4, "sawtooth", 0.05), 130);
  marcaTablero.classList.add("flash");
  setTimeout(() => marcaTablero.classList.remove("flash"), 480);

  const partidas = leerNumero(clavePartidas) + 1;
  localStorage.setItem(clavePartidas, String(partidas));
  localStorage.setItem(claveUltima, String(puntos));

  let mensaje = causa === "muro"
    ? "Se estrelló contra el muro. Sin rencor."
    : "Se enredó con su propia cola. Clásico.";
  if (puntos > record) {
    record = puntos;
    localStorage.setItem(claveRecord, String(record));
    mensaje = "¡Nuevo récord, jefe! " + mensaje;
  }
  elFinPuntos.textContent = puntos + (puntos === 1 ? " punto" : " puntos");
  elFinMensaje.textContent = mensaje;
  elRecord.textContent = String(record);
  actualizarHUD();
  pintarCapa("fin");
}

/* ---------- partículas ---------- */
function crearParticulas(cx, cy) {
  const c = celda();
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 90;
    particulas.push({
      x: (cx + .5) * c, y: (cy + .5) * c,
      vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
      vida: 0.5 + Math.random() * 0.25, edad: 0,
      tono: Math.random() < .5 ? "#fb923c" : "#fbbf24",
    });
  }
}

function moverParticulas(dt) {
  particulas = particulas.filter((p) => (p.edad += dt) < p.vida);
  particulas.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; });
}

function dibujar(alfa) {
  const L = lado();
  const c = celda();
  ctx.clearRect(0, 0, L, L);

  // fondo con un halo tenue en el centro
  const g = ctx.createRadialGradient(L / 2, L * 0.35, L * 0.05, L / 2, L / 2, L * 0.75);
  g.addColorStop(0, "#07160f");
  g.addColorStop(1, "#04100a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L, L);

  // rejilla
  ctx.strokeStyle = "rgba(74,222,128,.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) {
    const p = i * c;
    ctx.beginPath(); ctx.moveTo(p + .5, 0); ctx.lineTo(p + .5, L); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p + .5); ctx.lineTo(L, p + .5); ctx.stroke();
  }

  // marco interior
  ctx.strokeStyle = "rgba(74,222,128,.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, L - 2, L - 2);

  // fruta
  const fx = (fruta.x + .5) * c;
  const fy = (fruta.y + .5) * c;
  const latido = 1 + Math.sin(performance.now() / 240) * 0.07;
  ctx.save();
  ctx.shadowColor = "rgba(251,146,60,.9)";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#fb923c";
  ctx.beginPath();
  ctx.arc(fx, fy, (c / 2 - c * 0.16) * latido, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // hojita
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = Math.max(1.4, c * 0.09);
  ctx.beginPath();
  ctx.moveTo(fx, fy - c * 0.32);
  ctx.quadraticCurveTo(fx + c * 0.16, fy - c * 0.5, fx + c * 0.3, fy - c * 0.34);
  ctx.stroke();

  // ---- la culebrita: una cinta continua curvada ----
  // Cada tramo se dibuja entre su celda anterior y la actual: TODA la
  // serpiente avanza al mismo ritmo (nada se despega) y el giro nace en
  // la cabeza, que es la punta de la cinta.
  const n = serpiente.length;
  const puntos = [];
  for (let i = 0; i < n; i++) {
    const act = serpiente[i];
    const prev = serpientePrevia[i] || serpientePrevia[serpientePrevia.length - 1] || act;
    puntos.push({
      x: (prev.x + (act.x - prev.x) * alfa + 0.5) * c,
      y: (prev.y + (act.y - prev.y) * alfa + 0.5) * c,
    });
  }

  const cabezaPt = puntos[0];
  const colaPt = puntos[puntos.length - 1];

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = c * 0.84;

  // degradado a lo largo del cuerpo: cola apagada, cabeza luminosa
  const deg = ctx.createLinearGradient(colaPt.x, colaPt.y, cabezaPt.x, cabezaPt.y);
  deg.addColorStop(0, "#1c7f47");
  deg.addColorStop(0.5, "#2fc46a");
  deg.addColorStop(1, "#86efac");
  ctx.strokeStyle = deg;
  ctx.shadowColor = "rgba(74,222,128,.40)";
  ctx.shadowBlur = 12;

  // trazo con curvas suaves: los giros se redondean y salen desde la cabeza
  ctx.beginPath();
  ctx.moveTo(colaPt.x, colaPt.y);
  for (let i = n - 2; i >= 1; i--) {
    const mx = (puntos[i].x + puntos[i - 1].x) / 2;
    const my = (puntos[i].y + puntos[i - 1].y) / 2;
    ctx.quadraticCurveTo(puntos[i].x, puntos[i].y, mx, my);
  }
  ctx.lineTo(cabezaPt.x, cabezaPt.y);
  ctx.stroke();
  ctx.restore();

  // la cabeza: la punta de la cinta, más clara y con brillo
  ctx.save();
  ctx.fillStyle = "#b9f7d3";
  ctx.shadowColor = "rgba(134,239,172,.85)";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cabezaPt.x, cabezaPt.y, c * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ojos (mirando hacia donde va)
  const sep = c * 0.17;
  const adelante = c * 0.14;
  const px2 = direccion.x !== 0 ? adelante * direccion.x : 0;
  const py2 = direccion.y !== 0 ? adelante * direccion.y : 0;
  ctx.fillStyle = "#04120a";
  const ojos = direccion.x !== 0
    ? [[cabezaPt.x + px2, cabezaPt.y - sep], [cabezaPt.x + px2, cabezaPt.y + sep]]
    : [[cabezaPt.x - sep, cabezaPt.y + py2], [cabezaPt.x + sep, cabezaPt.y + py2]];
  ojos.forEach(([ox, oy]) => {
    ctx.beginPath();
    ctx.arc(ox, oy, Math.max(1.6, c * 0.085), 0, Math.PI * 2);
    ctx.fill();
  });

  // partículas
  particulas.forEach((p) => {
    const a = 1 - p.edad / p.vida;
    ctx.globalAlpha = Math.max(a, 0);
    ctx.fillStyle = p.tono;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, c * 0.09 * a), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ---------- bucle ---------- */
function bucle(ahora) {
  const dt = Math.min((ahora - ultimoInstante) / 1000, 0.2);
  ultimoInstante = ahora;

  if (estado === "jugando") {
    tAcum += dt;
    while (tAcum >= tPaso && estado === "jugando") {
      tAcum -= tPaso;
      avanzar();
    }
    if (estado === "jugando") alfaActual = Math.min(tAcum / tPaso, 1);
  }
  moverParticulas(dt);
  dibujar(alfaActual);
  requestAnimationFrame(bucle);
}

/* ---------- sonido ---------- */
let audio = null;
function sonando(frecuencia, duracion, tipo = "square", volumen = 0.05) {
  if (!sonidoActivo) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const gan = audio.createGain();
    osc.type = tipo;
    osc.frequency.value = frecuencia;
    gan.gain.value = volumen;
    gan.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duracion);
    osc.connect(gan).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duracion);
  } catch (e) { /* sin audio disponible */ }
}

/* ---------- controles ---------- */
function pedirGiro(nueva) {
  if (estado === "listo") empezar();
  if (estado !== "jugando") return;
  const ultima = giros.length ? giros[giros.length - 1] : direccion;
  if (nueva.x === -ultima.x && nueva.y === -ultima.y) return;   // no se puede volver sobre sí
  if (nueva.x === ultima.x && nueva.y === ultima.y) return;      // ni repetir
  if (giros.length < 3) giros.push(nueva);
}

function empezar() {
  if (estado === "jugando") return;
  if (estado === "fin" || estado === "listo") {
    if (estado === "fin") nuevaPartida();
    estado = "jugando";
    pintarCapa(null);
    ultimoInstante = performance.now();
  } else if (estado === "pausado") {
    estado = "jugando";
    pintarCapa(null);
    ultimoInstante = performance.now();
  }
}

function alternarPausa() {
  if (estado === "jugando") {
    estado = "pausado";
    pintarCapa("pausa");
    sonando(420, 0.06, "triangle", 0.035);
  } else if (estado === "pausado") {
    empezar();
  }
}

document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "spacebar"].includes(k)) e.preventDefault();
  if (k === "arrowup" || k === "w") pedirGiro({ x: 0, y: -1 });
  else if (k === "arrowdown" || k === "s") pedirGiro({ x: 0, y: 1 });
  else if (k === "arrowleft" || k === "a") pedirGiro({ x: -1, y: 0 });
  else if (k === "arrowright" || k === "d") pedirGiro({ x: 1, y: 0 });
  else if (k === " " || k === "spacebar") { estado === "jugando" || estado === "pausado" ? alternarPausa() : empezar(); }
  else if (k === "enter") { if (estado === "fin") nuevaPartida(); empezar(); }
  else if (k === "r") { nuevaPartida(); empezar(); }
  else if (k === "m") alternarSonido();
});

/* deslizamiento y toque */
let toque = null;
canvas.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  toque = { x: t.clientX, y: t.clientY, t: performance.now() };
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
  if (!toque) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - toque.x;
  const dy = t.clientY - toque.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 22) {
    if (estado === "listo" || estado === "fin") empezar();
    else alternarPausa();
  } else if (Math.abs(dx) > Math.abs(dy)) {
    pedirGiro({ x: dx > 0 ? 1 : -1, y: 0 });
  } else {
    pedirGiro({ x: 0, y: dy > 0 ? 1 : -1 });
  }
  toque = null;
}, { passive: true });

/* clic con el ratón: empezar o pausar */
canvas.addEventListener("click", () => {
  if (estado === "listo" || estado === "fin") empezar();
  else alternarPausa();
});

/* cruceta y botones */
document.querySelectorAll(".cruceta button").forEach((b) => {
  b.addEventListener("click", () => {
    const d = b.dataset.dir;
    if (d === "pausa") { estado === "pausado" ? empezar() : alternarPausa(); return; }
    if (d === "arriba") pedirGiro({ x: 0, y: -1 });
    else if (d === "abajo") pedirGiro({ x: 0, y: 1 });
    else if (d === "izquierda") pedirGiro({ x: -1, y: 0 });
    else if (d === "derecha") pedirGiro({ x: 1, y: 0 });
  });
});

document.getElementById("btn-empezar").addEventListener("click", empezar);
document.getElementById("btn-seguir").addEventListener("click", empezar);
document.getElementById("btn-otra").addEventListener("click", () => { nuevaPartida(); empezar(); });
document.getElementById("btn-reiniciar").addEventListener("click", () => { nuevaPartida(); empezar(); });
btnPausa.addEventListener("click", alternarPausa);

function alternarSonido() {
  sonidoActivo = !sonidoActivo;
  btnSonido.textContent = sonidoActivo ? "Sonido: sí" : "Sonido: no";
  btnSonido.setAttribute("aria-pressed", sonidoActivo ? "false" : "true");
  if (sonidoActivo) sonando(660, 0.07, "triangle", 0.04);
}
btnSonido.addEventListener("click", alternarSonido);

/* pantalla completa (muy útil en el teléfono) */
const btnPantalla = document.getElementById("btn-pantalla");
btnPantalla.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (e) { /* el navegador no lo permite: se queda como está */ }
});
document.addEventListener("fullscreenchange", () => {
  btnPantalla.textContent = document.fullscreenElement ? "Salir de pantalla" : "Pantalla completa";
  ajustarNitidez();
});

/* pausa automática si se sale de la pestaña */
document.addEventListener("visibilitychange", () => {
  if (document.hidden && estado === "jugando") {
    estado = "pausado";
    pintarCapa("pausa");
  }
});

/* ---------- arranque ---------- */
nuevaPartida();
requestAnimationFrame(bucle);
actualizarHUD();

/* puente para comprobaciones automáticas */
window.__snake = {
  estado: () => estado,
  puntos: () => puntos,
  record: () => record,
  nivel: () => nivel,
  velocidad: () => PASO_BASE / tPaso,
  longitud: () => serpiente.length,
  empezar,
  nuevaPartida,
  pausar: alternarPausa,
  girar: pedirGiro,
  fruta: () => ({ ...fruta }),
  cabeza: () => ({ ...serpiente[0] }),
  tablero: () => COLS,
  colocarFruta: (x, y) => { fruta = { x, y }; },   // para las pruebas automáticas
  /* avanza el juego sin depender del dibujo ni del reloj (pruebas automáticas) */
  unPaso: () => avanzar(),
  simular: (segundos) => {
    const pasos = Math.max(1, Math.floor(segundos / tPaso));
    for (let i = 0; i < pasos && estado === "jugando"; i++) avanzar();
    return { estado, puntos, largo: serpiente.length, nivel };
  },
};
