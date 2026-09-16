/* ============================================================
   juego.js — SNAKE · La Culebrita (motor completo)
   Paso fijo con dibujo interpolado, velocidad progresiva,
   récord guardado, sonido al vuelo y controles de teclado,
   deslizamiento y cruceta.
   ============================================================ */

/* ZOOM GRANDE (orden del jefe, 16/09/2026): el tablero baja de 24 a 16
   casillas, así cada casilla ocupa ~un 50 % más de pantalla que antes y la
   culebrita y la manzana se ven grandes de verdad, en el celular y en la PC.
   El tiempo por casilla se ajusta a la baja para que la serpiente no vaya ni
   más lenta ni más rápida: solo se ve más grande. */
const COLS = 16;                       // tablero 16 x 16
const PASO_BASE = 0.135;               // segundos por celda al empezar
const PASO_MIN = 0.05;                 // tope de rapidez
const CADA_NIVEL = 5;                  // frutas por nivel
const SALTO_NIVEL = 0.006;             // cuánto se acelera con cada nivel
const GROSOR_CUERPO = 0.94;            // ancho de la culebra (era 0.84)
const RADIO_CABEZA = 0.48;             // cabeza (era 0.42)
const RADIO_FRUTA = 0.45;              // manzana (era 0.34)
/* Tiempo MÁXIMO que un giro puede esperar para aplicarse. Antes el giro
   esperaba a que terminara la casilla entera (hasta 135 ms) y eso era lo que
   se sentía lento en el celular. Con esto la culebrita aprieta el paso un
   momento y el giro sale casi al instante. */
const ESPERA_GIRO_MAX = 0.045;
const PRISA_GIRO = 3.2;                // cuánto aprieta el paso mientras gira

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
let frutaPendiente = null;   // manzana que la cabeza ya tocó y se cobra al dibujarse
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

/* ---------- escala nítida ----------
   En el celular la pantalla tiene 2,5 o 3 puntos por píxel: dibujar a esa
   resolución multiplica por 9 el trabajo de cada cuadro y es lo que hacía
   que el juego se sintiera lento al girar. Se dibuja a 1,5 en táctil (se ve
   igual de nítido) y hasta 2 en la PC. */
const TACTIL = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
function topeDpr() { return TACTIL ? 1.5 : 2; }

function ajustarNitidez() {
  const dpr = Math.min(window.devicePixelRatio || 1, topeDpr());
  const ancho = canvas.clientWidth || 720;
  const alto = canvas.clientHeight || ancho;
  const medida = Math.min(ancho, alto);
  canvas.width = Math.round(medida * dpr);
  canvas.height = Math.round(medida * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  prepararFondo();
}
window.addEventListener("resize", ajustarNitidez);

const lado = () => Math.min(canvas.clientWidth || 720, canvas.clientHeight || canvas.clientWidth || 720);
const celda = () => lado() / COLS;

/* El fondo (halo, rejilla y marco) no cambia nunca: se dibuja UNA vez en un
   lienzo aparte y en cada cuadro se pega de golpe. Antes se repintaban 46
   líneas y un degradado en cada cuadro — eso sobraba en el celular. */
let fondoCapa = null;
function prepararFondo() {
  const L = lado();
  const dpr = Math.min(window.devicePixelRatio || 1, topeDpr());
  fondoCapa = document.createElement("canvas");
  fondoCapa.width = Math.round(L * dpr);
  fondoCapa.height = Math.round(L * dpr);
  const f = fondoCapa.getContext("2d");
  f.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = L / COLS;

  const g = f.createRadialGradient(L / 2, L * 0.35, L * 0.05, L / 2, L / 2, L * 0.75);
  g.addColorStop(0, "#07160f");
  g.addColorStop(1, "#04100a");
  f.fillStyle = g;
  f.fillRect(0, 0, L, L);

  f.strokeStyle = "rgba(74,222,128,.07)";
  f.lineWidth = 1;
  for (let i = 1; i < COLS; i++) {
    const p = i * c;
    f.beginPath(); f.moveTo(p + .5, 0); f.lineTo(p + .5, L); f.stroke();
    f.beginPath(); f.moveTo(0, p + .5); f.lineTo(L, p + .5); f.stroke();
  }

  f.strokeStyle = "rgba(74,222,128,.18)";
  f.lineWidth = 2;
  f.strokeRect(1, 1, L - 2, L - 2);
}
ajustarNitidez();

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
  frutaPendiente = null;
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

const capaNombre = document.getElementById("capa-nombre");
const capaRanking = document.getElementById("capa-ranking");

function pintarCapa(cual) {
  capaInicio.hidden = cual !== "inicio";
  capaPausa.hidden = cual !== "pausa";
  capaFin.hidden = cual !== "fin";
  if (capaNombre) capaNombre.hidden = cual !== "nombre";
  if (capaRanking) capaRanking.hidden = cual !== "ranking";
}

/* el módulo del ranking (ranking.js) usa estas tres puertas */
let bloqueado = false;          // mientras se pide el nombre, el juego no arranca
let estabaJugando = false;

window.pintarCapaJuego = pintarCapa;
window.bloquearJuego = (valor) => { bloqueado = Boolean(valor); };
window.pausarSiJugando = () => {
  estabaJugando = estado === "jugando";
  if (estabaJugando) estado = "pausado";
};
window.alCerrarRanking = () => {
  if (estabaJugando) {
    estabaJugando = false;
    pintarCapa("pausa");
  } else if (estado === "pausado") {
    pintarCapa("pausa");
  } else if (estado === "fin") {
    pintarCapa("fin");
  } else {
    pintarCapa("inicio");
  }
};

/* ---------- avance de un paso ---------- */
function avanzar() {
  serpientePrevia = serpiente.map((p) => ({ x: p.x, y: p.y }));

  // El dibujo va un paso por detrás de la cabeza lógica. Por eso la manzana
  // se cobra AQUÍ, al empezar el paso siguiente: es justo el instante en que
  // la cabeza dibujada llega a la manzana. Así el punto cuenta cuando la
  // cabeza la toca, no cuando la toca el cuello.
  if (frutaPendiente) {
    const m = frutaPendiente;
    frutaPendiente = null;
    puntos++;
    crearParticulas(m.x, m.y);
    sonando(560 + Math.min(puntos, 12) * 28, 0.07, "square", 0.05);
    nivel = 1 + Math.floor(puntos / CADA_NIVEL);
    tPaso = Math.max(PASO_MIN, PASO_BASE - (nivel - 1) * SALTO_NIVEL);
    ponerFruta();
    actualizarHUD();
  }

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
    // la cabeza ya está en la manzana: crece ahora, y el punto y la manzana
    // nueva se cobran cuando la cabeza dibujada llegue a tocarla
    frutaPendiente = { x: fruta.x, y: fruta.y };
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
  if (window.Ranking) window.Ranking.alMorir(puntos);   // guarda el puesto en el ranking
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
  if (!fondoCapa) prepararFondo();
  ctx.clearRect(0, 0, L, L);
  ctx.drawImage(fondoCapa, 0, 0, L, L);   // fondo ya pintado: cuesta casi nada

  // fruta (más grande: RADIO_FRUTA) con halo hecho a mano, sin sombras caras
  const fx = (fruta.x + .5) * c;
  const fy = (fruta.y + .5) * c;
  const latido = 1 + Math.sin(performance.now() / 240) * 0.07;
  const rf = c * RADIO_FRUTA * latido;
  ctx.fillStyle = "rgba(251,146,60,.20)";
  ctx.beginPath();
  ctx.arc(fx, fy, rf * 1.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fb923c";
  ctx.beginPath();
  ctx.arc(fx, fy, rf, 0, Math.PI * 2);
  ctx.fill();
  // brillo de la manzana (para que se vea de cerca, con volumen)
  ctx.fillStyle = "rgba(255,224,178,.55)";
  ctx.beginPath();
  ctx.arc(fx - rf * 0.3, fy - rf * 0.34, rf * 0.26, 0, Math.PI * 2);
  ctx.fill();
  // hojita
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = Math.max(1.6, c * 0.1);
  ctx.beginPath();
  ctx.moveTo(fx, fy - c * 0.38);
  ctx.quadraticCurveTo(fx + c * 0.18, fy - c * 0.58, fx + c * 0.34, fy - c * 0.4);
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

  // trazo con curvas suaves: los giros se redondean y salen desde la cabeza
  ctx.beginPath();
  ctx.moveTo(colaPt.x, colaPt.y);
  for (let i = n - 2; i >= 1; i--) {
    const mx = (puntos[i].x + puntos[i - 1].x) / 2;
    const my = (puntos[i].y + puntos[i - 1].y) / 2;
    ctx.quadraticCurveTo(puntos[i].x, puntos[i].y, mx, my);
  }
  ctx.lineTo(cabezaPt.x, cabezaPt.y);

  // El brillo se hace con DOS pasadas del mismo trazo (una ancha y tenue),
  // no con sombras difusas: se ve igual y en el celular cuesta la mitad.
  ctx.strokeStyle = "rgba(74,222,128,.17)";
  ctx.lineWidth = c * (GROSOR_CUERPO + 0.34);
  ctx.stroke();

  // degradado a lo largo del cuerpo: cola apagada, cabeza luminosa
  const deg = ctx.createLinearGradient(colaPt.x, colaPt.y, cabezaPt.x, cabezaPt.y);
  deg.addColorStop(0, "#1c7f47");
  deg.addColorStop(0.5, "#2fc46a");
  deg.addColorStop(1, "#86efac");
  ctx.strokeStyle = deg;
  ctx.lineWidth = c * GROSOR_CUERPO;
  ctx.stroke();
  ctx.restore();

  // la cabeza: la punta de la cinta, más clara y con su halo
  ctx.fillStyle = "rgba(134,239,172,.18)";
  ctx.beginPath();
  ctx.arc(cabezaPt.x, cabezaPt.y, c * (RADIO_CABEZA + 0.26), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b9f7d3";
  ctx.beginPath();
  ctx.arc(cabezaPt.x, cabezaPt.y, c * RADIO_CABEZA, 0, Math.PI * 2);
  ctx.fill();

  // ojos: miran hacia donde va... pero si hay un giro pedido, miran YA hacia
  // el lado nuevo. Es la señal de que el juego escuchó al dedo al instante.
  const mirada = giros.length ? giros[0] : direccion;
  const sep = c * 0.18;
  const adelante = c * 0.15;
  const px2 = mirada.x !== 0 ? adelante * mirada.x : 0;
  const py2 = mirada.y !== 0 ? adelante * mirada.y : 0;
  ctx.fillStyle = "#04120a";
  const ojos = mirada.x !== 0
    ? [[cabezaPt.x + px2, cabezaPt.y - sep], [cabezaPt.x + px2, cabezaPt.y + sep]]
    : [[cabezaPt.x - sep, cabezaPt.y + py2], [cabezaPt.x + sep, cabezaPt.y + py2]];
  ojos.forEach(([ox, oy]) => {
    ctx.beginPath();
    ctx.arc(ox, oy, Math.max(1.8, c * 0.098), 0, Math.PI * 2);
    ctx.fill();
  });

  // partículas
  particulas.forEach((p) => {
    const a = 1 - p.edad / p.vida;
    ctx.globalAlpha = Math.max(a, 0);
    ctx.fillStyle = p.tono;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, c * 0.1 * a), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ---------- bucle ---------- */
let cuadros = 0, fpsMedido = 0, marcaFps = performance.now();
function bucle(ahora) {
  const dt = Math.min((ahora - ultimoInstante) / 1000, 0.2);
  ultimoInstante = ahora;

  cuadros++;
  if (ahora - marcaFps >= 1000) {      // medidor de fluidez (para comprobarlo)
    fpsMedido = Math.round(cuadros * 1000 / (ahora - marcaFps));
    cuadros = 0;
    marcaFps = ahora;
  }

  if (estado === "jugando") {
    // Si hay un giro esperando en la cola, la culebrita aprieta el paso lo
    // justo para llegar a la casilla y girar: el giro nunca tarda más de
    // ESPERA_GIRO_MAX. Va acelerando el dibujo de forma continua (no salta),
    // por eso se ve como un impulso natural hacia la curva.
    let paso = dt;
    if (giros.length && tPaso - tAcum > ESPERA_GIRO_MAX) paso = dt * PRISA_GIRO;
    tAcum += paso;
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
  if (giros.length < 2) giros.push(nueva);   // cola corta: obedece antes
}

function empezar() {
  if (bloqueado) return;               // se está pidiendo el nombre
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

/* ---------- deslizamiento y toque (tiempo de reacción, 16/09/2026) ----------
   Antes el giro se decidía al LEVANTAR el dedo (touchend): entre que el jefe
   deslizaba y la culebra giraba pasaban 300-400 ms. Ahora el giro sale en el
   mismo instante en que el dedo recorre RADIO_GIRO píxeles (touchmove), sin
   soltar nada, y al reanclar el origen se pueden encadenar varios giros con
   un solo deslizamiento continuo (como un joystick). */
const RADIO_GIRO = 12;      // px de recorrido para reconocer un giro
const TOQUE_CORTO = 12;     // px: por debajo de esto es un toque, no un giro
let gesto = null;           // origen actual del gesto
let giroEnGesto = false;
let ultimoGestoMs = -9999;

canvas.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  gesto = { x: t.clientX, y: t.clientY };
  giroEnGesto = false;
  ultimoGestoMs = performance.now();
}, { passive: true });

canvas.addEventListener("touchmove", (e) => {
  if (!gesto) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - gesto.x;
  const dy = t.clientY - gesto.y;
  if (Math.hypot(dx, dy) < RADIO_GIRO) return;
  if (Math.abs(dx) > Math.abs(dy)) pedirGiro({ x: dx > 0 ? 1 : -1, y: 0 });
  else pedirGiro({ x: 0, y: dy > 0 ? 1 : -1 });
  giroEnGesto = true;
  gesto = { x: t.clientX, y: t.clientY };   // reancla: giros encadenados
  ultimoGestoMs = performance.now();
  if (e.cancelable) e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const corto = gesto ? Math.hypot(t.clientX - gesto.x, t.clientY - gesto.y) < TOQUE_CORTO : true;
  if (!giroEnGesto && corto) {           // toque seco: empezar o pausar
    if (estado === "listo" || estado === "fin") empezar();
    else alternarPausa();
  }
  gesto = null;
  giroEnGesto = false;
  ultimoGestoMs = performance.now();
}, { passive: true });

/* clic con el ratón: empezar o pausar (se ignora el clic fantasma que el
   navegador dispara DESPUÉS de un toque; si no, un toque pausaba al instante) */
canvas.addEventListener("click", () => {
  if (performance.now() - ultimoGestoMs < 700) return;
  if (estado === "listo" || estado === "fin") empezar();
  else alternarPausa();
});

/* ---------- cruceta ---------- */
/* Antes respondía al "click", que en el celular solo llega al LEVANTAR el
   dedo. Ahora responde al apoyar el dedo (pointerdown): respuesta inmediata. */
function atenderCruceta(d) {
  if (d === "pausa") { estado === "pausado" ? empezar() : alternarPausa(); return; }
  if (d === "arriba") pedirGiro({ x: 0, y: -1 });
  else if (d === "abajo") pedirGiro({ x: 0, y: 1 });
  else if (d === "izquierda") pedirGiro({ x: -1, y: 0 });
  else if (d === "derecha") pedirGiro({ x: 1, y: 0 });
}

document.querySelectorAll(".cruceta button").forEach((b) => {
  const d = b.dataset.dir;
  let tocado = -9999;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    tocado = performance.now();
    atenderCruceta(d);
  }, { passive: false });
  b.addEventListener("click", (e) => {
    if (performance.now() - tocado < 600) { e.preventDefault(); return; }  // ya se atendió
    atenderCruceta(d);
  });
  b.addEventListener("contextmenu", (e) => e.preventDefault());
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
if (window.Ranking) window.Ranking.alArrancar();   // nombre y ranking global

/* puente para comprobaciones automáticas */
window.__snake = {
  estado: () => estado,
  puntos: () => puntos,
  record: () => record,
  nivel: () => nivel,
  velocidad: () => PASO_BASE / tPaso,
  paso: () => tPaso,
  alfa: () => alfaActual,
  longitud: () => serpiente.length,
  empezar,
  nuevaPartida,
  pausar: alternarPausa,
  girar: pedirGiro,
  girosEnCola: () => giros.length,
  direccion: () => ({ ...direccion }),
  fruta: () => ({ ...fruta }),
  cabeza: () => ({ ...serpiente[0] }),
  /* dónde está dibujada la cabeza AHORA (para comprobar que el punto cae
     justo cuando la cabeza toca la manzana) */
  cabezaDibujo: () => {
    const act = serpiente[0];
    const prev = serpientePrevia[0] || act;
    return {
      x: prev.x + (act.x - prev.x) * alfaActual,
      y: prev.y + (act.y - prev.y) * alfaActual,
    };
  },
  pendiente: () => (frutaPendiente ? { ...frutaPendiente } : null),
  tablero: () => COLS,
  /* medidas reales del tablero en pantalla (zoom) y fluidez del dibujo */
  medidas: () => ({
    lado: Math.round(lado()),
    celda: Math.round(celda() * 10) / 10,
    cuerpo: Math.round(celda() * GROSOR_CUERPO * 10) / 10,
    dpr: Math.min(window.devicePixelRatio || 1, topeDpr()),
    tactil: TACTIL,
    fps: fpsMedido,
  }),
  colocarFruta: (x, y) => { fruta = { x, y }; },   // para las pruebas automáticas
  /* avanza el juego sin depender del dibujo ni del reloj (pruebas automáticas) */
  unPaso: () => avanzar(),
  simular: (segundos) => {
    const pasos = Math.max(1, Math.floor(segundos / tPaso));
    for (let i = 0; i < pasos && estado === "jugando"; i++) avanzar();
    return { estado, puntos, largo: serpiente.length, nivel };
  },
};
