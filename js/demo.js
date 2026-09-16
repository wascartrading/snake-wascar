/* ============================================================
   demo.js — la culebrita que juega sola en la portada
   Serpiente autónoma (IA sencilla), movimiento interpolado.
   ============================================================ */

const REJILLA = 20;                 // tamaño de celda en px
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

let serpiente, direccion, siguiente, fruta, tAcum, tPaso, viva, aciertos;

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

/* --- dibujo --- */
function redondoRect(x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
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

  // fruta con brillo
  const fx = fruta.x * REJILLA, fy = fruta.y * REJILLA;
  const latido = 1 + Math.sin(performance.now() / 260) * 0.08;
  ctx.save();
  ctx.shadowColor = "rgba(251,146,60,.85)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#fb923c";
  ctx.beginPath();
  ctx.arc(fx + REJILLA / 2, fy + REJILLA / 2, (REJILLA / 2 - 2) * latido, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // cola + cabeza con interpolación hacia la celda siguiente
  // cinta continua: cada tramo se desliza hacia el de delante
  const cola = serpiente.map((p, i) => {
    if (i === 0) return { x: p.x + direccion.x * alfa, y: p.y + direccion.y * alfa };
    const ant = serpiente[i - 1];
    return { x: p.x + (ant.x - p.x) * alfa, y: p.y + (ant.y - p.y) * alfa };
  });

  const margen = REJILLA * 0.05;
  cola.forEach((p, i) => {
    const t = i / Math.max(cola.length - 1, 1);
    const verde = 210 - t * 90;
    ctx.fillStyle = `rgb(${Math.round(40 + t * 30)}, ${Math.round(verde)}, ${Math.round(120 - t * 40)})`;
    if (i === 0) {
      ctx.save();
      ctx.shadowColor = "rgba(74,222,128,.75)";
      ctx.shadowBlur = 16;
    }
    redondoRect(p.x * REJILLA + margen, p.y * REJILLA + margen, REJILLA - margen * 2, REJILLA - margen * 2, i === 0 ? REJILLA * 0.28 : REJILLA * 0.2);
    ctx.fill();
    if (i === 0) ctx.restore();
  });

  // ojos de la cabeza (alineados con la dirección)
  const c = cola[0];
  const cx = c.x * REJILLA + REJILLA / 2;
  const cy = c.y * REJILLA + REJILLA / 2;
  const sep = REJILLA * 0.2;                       // separación entre ojos
  const adelante = REJILLA * 0.16;                 // cuánto miran hacia delante
  const px = direccion.x !== 0 ? adelante * direccion.x : 0;
  const py = direccion.y !== 0 ? adelante * direccion.y : 0;
  const ojos = direccion.x !== 0
    ? [[cx + px, cy - sep], [cx + px, cy + sep]]
    : [[cx - sep, cy + py], [cx + sep, cy + py]];
  ctx.fillStyle = "#04120a";
  ojos.forEach(([ox, oy]) => {
    ctx.beginPath();
    ctx.arc(ox, oy, 2.1, 0, Math.PI * 2);
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

  dibujar(viva ? tAcum / tPaso : 0);
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
