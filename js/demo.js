/* ============================================================
   demo.js — la culebrita que juega sola en la portada
   Serpiente autónoma (IA sencilla), movimiento interpolado.
   ============================================================ */

const REJILLA = 30;                 // tamaño de celda en px (celdas grandes,
                                    // como en el juego: la culebrita se ve)
const canvas = document.getElementById("demo");
const ctx = canvas.getContext("2d");

/* --- escala nítida según la pantalla --- */
function ajustarNitidez() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
ajustarNitidez();
window.addEventListener("resize", ajustarNitidez);

const COLS = () => Math.floor(canvas.clientWidth / REJILLA);
const FILAS = () => Math.floor(canvas.clientHeight / REJILLA);

let serpiente, serpientePrevia = [], direccion, siguiente, fruta, tAcum, tPaso, viva, aciertos;

function azar(max) { return Math.floor(Math.random() * max); }

function nuevaFruta() {
  const ocupadas = new Set(serpiente.map(p => p.x + "," + p.y));
  let p;
  let guardia = 0;
  do {
    p = { x: azar(COLS()), y: azar(FILAS()) };
    guardia++;
  } while (ocupadas.has(p.x + "," + p.y) && guardia < 400);
  fruta = p;
}

function reiniciar() {
  const cx = Math.floor(COLS() / 2);
  const cy = Math.floor(FILAS() / 2);
  serpiente = [
    { x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy },
    { x: cx - 3, y: cy }, { x: cx - 4, y: cy },
  ];
  direccion = { x: 1, y: 0 };
  siguiente = { x: 1, y: 0 };
  viva = true;
  aciertos = 0;
  tPaso = 0.14;                    // segundos por celda
  tAcum = 0;
  serpientePrevia = serpiente.map((p) => ({ x: p.x, y: p.y }));
  nuevaFruta();
}

/* ¿choca la cabeza ahí? */
function choque(x, y) {
  if (x < 0 || y < 0 || x >= COLS() || y >= FILAS()) return true;
  return serpiente.some((p, i) => i < serpiente.length - 1 && p.x === x && p.y === y);
}

/* IA: elige el eje que más acerca a la fruta, sin chocar */
function pensar() {
  const cabeza = serpiente[0];
  const dx = fruta.x - cabeza.x;
  const dy = fruta.y - cabeza.y;

  const opciones = [];
  const horizontal = dx > 0 ? { x: 1, y: 0 } : dx < 0 ? { x: -1, y: 0 } : null;
  const vertical   = dy > 0 ? { x: 0, y: 1 } : dy < 0 ? { x: 0, y: -1 } : null;

  // no revertir sobre sí misma
  const permitido = (d) => !(d.x === -direccion.x && d.y === -direccion.y);
  const mayor = Math.abs(dx) >= Math.abs(dy);

  const orden = mayor ? [horizontal, vertical] : [vertical, horizontal];
  orden.filter(Boolean).forEach(d => { if (permitido(d)) opciones.push(d); });
  // alternativas para esquivar
  [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].forEach(d => {
    if (permitido(d) && !opciones.some(o => o.x === d.x && o.y === d.y)) opciones.push(d);
  });

  for (const d of opciones) {
    if (!choque(cabeza.x + d.x, cabeza.y + d.y)) return d;
  }
  return direccion;
}

function paso() {
  serpientePrevia = serpiente.map((p) => ({ x: p.x, y: p.y }));
  direccion = siguiente;
  siguiente = pensar();

  const cabeza = { x: serpiente[0].x + direccion.x, y: serpiente[0].y + direccion.y };

  if (cabeza.x < 0 || cabeza.y < 0 || cabeza.x >= COLS() || cabeza.y >= FILAS() ||
      serpiente.some((p, i) => i < serpiente.length - 1 && p.x === cabeza.x && p.y === cabeza.y)) {
    viva = false;
    return;
  }

  serpiente.unshift(cabeza);

  if (cabeza.x === fruta.x && cabeza.y === fruta.y) {
    aciertos++;
    nuevaFruta();
    if (tPaso > 0.075) tPaso -= 0.004;              // se acelera poco a poco
    if (serpiente.length > 26) serpiente.pop();      // no crece sin fin
  } else {
    serpiente.pop();
  }
}

function dibujar(alfa) {
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  ctx.clearRect(0, 0, ancho, alto);

  // fondo
  ctx.fillStyle = "#04100a";
  ctx.fillRect(0, 0, ancho, alto);

  // rejilla
  ctx.strokeStyle = "rgba(74,222,128,.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= ancho; x += REJILLA) {
    ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, alto); ctx.stroke();
  }
  for (let y = 0; y <= alto; y += REJILLA) {
    ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(ancho, y + .5); ctx.stroke();
  }

  // fruta grande con halo hecho a mano (sin sombras difusas: más fluido)
  const fx = fruta.x * REJILLA + REJILLA / 2;
  const fy = fruta.y * REJILLA + REJILLA / 2;
  const latido = 1 + Math.sin(performance.now() / 260) * 0.08;
  const rf = REJILLA * 0.42 * latido;
  ctx.fillStyle = "rgba(251,146,60,.2)";
  ctx.beginPath();
  ctx.arc(fx, fy, rf * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fb923c";
  ctx.beginPath();
  ctx.arc(fx, fy, rf, 0, Math.PI * 2);
  ctx.fill();

  // cola + cabeza con interpolación hacia la celda siguiente
  // cinta continua con curvas suaves (misma tecnica que el juego)
  const n = serpiente.length;
  const puntos = [];
  for (let i = 0; i < n; i++) {
    const act = serpiente[i];
    const prev = serpientePrevia[i] || serpientePrevia[serpientePrevia.length - 1] || act;
    puntos.push({
      x: (prev.x + (act.x - prev.x) * alfa + 0.5) * REJILLA,
      y: (prev.y + (act.y - prev.y) * alfa + 0.5) * REJILLA,
    });
  }

  const cabezaPt = puntos[0];
  const colaPt = puntos[puntos.length - 1];

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(colaPt.x, colaPt.y);
  for (let i = n - 2; i >= 1; i--) {
    const mx = (puntos[i].x + puntos[i - 1].x) / 2;
    const my = (puntos[i].y + puntos[i - 1].y) / 2;
    ctx.quadraticCurveTo(puntos[i].x, puntos[i].y, mx, my);
  }
  ctx.lineTo(cabezaPt.x, cabezaPt.y);
  // halo con una segunda pasada ancha y tenue (sin sombras caras)
  ctx.strokeStyle = "rgba(74,222,128,.16)";
  ctx.lineWidth = REJILLA * 1.2;
  ctx.stroke();
  const deg = ctx.createLinearGradient(colaPt.x, colaPt.y, cabezaPt.x, cabezaPt.y);
  deg.addColorStop(0, "#1c7f47");
  deg.addColorStop(0.5, "#2fc46a");
  deg.addColorStop(1, "#86efac");
  ctx.strokeStyle = deg;
  ctx.lineWidth = REJILLA * 0.92;
  ctx.stroke();
  ctx.restore();

  // cabeza
  ctx.fillStyle = "rgba(134,239,172,.18)";
  ctx.beginPath();
  ctx.arc(cabezaPt.x, cabezaPt.y, REJILLA * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b9f7d3";
  ctx.beginPath();
  ctx.arc(cabezaPt.x, cabezaPt.y, REJILLA * 0.46, 0, Math.PI * 2);
  ctx.fill();

  // ojos de la cabeza (alineados con la dirección)
  const sep = REJILLA * 0.17;
  const adelante = REJILLA * 0.14;
  const px2 = direccion.x !== 0 ? adelante * direccion.x : 0;
  const py2 = direccion.y !== 0 ? adelante * direccion.y : 0;
  const ojos = direccion.x !== 0
    ? [[cabezaPt.x + px2, cabezaPt.y - sep], [cabezaPt.x + px2, cabezaPt.y + sep]]
    : [[cabezaPt.x - sep, cabezaPt.y + py2], [cabezaPt.x + sep, cabezaPt.y + py2]];
  ctx.fillStyle = "#04120a";
  ojos.forEach(([ox, oy]) => {
    ctx.beginPath();
    ctx.arc(ox, oy, Math.max(1.4, REJILLA * 0.08), 0, Math.PI * 2);
    ctx.fill();
  });
}

/* --- bucle --- */
let anterior = performance.now();
function bucle(ahora) {
  const dt = Math.min((ahora - anterior) / 1000, 0.25);
  anterior = ahora;

  if (viva) {
    tAcum += dt;
    while (tAcum >= tPaso) {
      tAcum -= tPaso;
      paso();
      if (!viva) break;
    }
  } else {
    // se quedó atascada: tras un instante, tablero limpio
    tAcum += dt;
    if (tAcum > 1.1) reiniciar();
  }

  dibujar(viva ? Math.min(tAcum / tPaso, 1) : 1);
  requestAnimationFrame(bucle);
}

reiniciar();
requestAnimationFrame(bucle);

/* --- datos reales del jugador en la portada --- */
try {
  const record = localStorage.getItem("snake_record");
  const partidas = localStorage.getItem("snake_partidas");
  const ultima = localStorage.getItem("snake_ultima");
  const el = (id) => document.getElementById(id);
  el("dato-record").textContent = record ? record + " pts" : "sin estrenar";
  el("dato-partidas").textContent = partidas || "0";
  el("dato-ultima").textContent = ultima ? ultima + " pts" : "—";
} catch (e) { /* modo privado: sin datos */ }
