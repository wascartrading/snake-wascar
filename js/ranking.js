/* ranking.js — Nombre del jugador y ranking global (SNAKE · Wáscar y JARVIS)
 *
 * Se encarga de:
 *   1) preguntar el nombre la primera vez y recordarlo en el navegador
 *   2) enviar el puntaje al morir y decir en qué puesto quedó
 *   3) mostrar el panel del ranking (top 10) y el top 3 de la portada
 *
 * El servicio vive en Railway (mismo proyecto que usamos siempre) y solo
 * necesita estas dos rutas: GET /ranking y POST /puntaje.
 */
(() => {
  const API_POR_DEFECTO = "https://jarvis-puente-production-eaeb.up.railway.app";
  const CLAVE_NOMBRE = "snake_nombre";
  const CLAVE_PUESTO = "snake_puesto";

  /* se puede apuntar a otro servicio (pruebas): window.SNAKE_API o
     localStorage.setItem("snake_api", "http://127.0.0.1:8099") */
  function api() {
    return window.SNAKE_API || localStorage.getItem("snake_api") || API_POR_DEFECTO;
  }

  /* ---------- elementos (solo si existen en esta página) ---------- */
  const capaNombre = document.getElementById("capa-nombre");
  const campoNombre = document.getElementById("campo-nombre");
  const formNombre = document.getElementById("form-nombre");
  const avisoNombre = document.getElementById("aviso-nombre");
  const quien = document.getElementById("quien");
  const capaRanking = document.getElementById("capa-ranking");
  const listaRanking = document.getElementById("ranking-lista");
  const subRanking = document.getElementById("ranking-sub");
  const avisoRanking = document.getElementById("aviso-ranking");
  const elFinRanking = document.getElementById("fin-ranking");
  const elPortadaTop = document.getElementById("portada-top");

  const permitido = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ ._\-]+$/;
  const medallas = ["🥇", "🥈", "🥉"];

  let nombre = (localStorage.getItem(CLAVE_NOMBRE) || "").trim();
  let miPuesto = Number(localStorage.getItem(CLAVE_PUESTO) || 0);
  let bloqueando = false;

  /* ---------- ayudas ---------- */
  function escapar(t) {
    return String(t).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function nombreValido(n) {
    if (n.length < 3) return "El nombre necesita al menos 3 letras.";
    if (n.length > 12) return "Como mucho 12 caracteres.";
    if (!permitido.test(n)) return "Solo letras, números, espacios, punto, guion y guion bajo.";
    return null;
  }

  function esMio(otro) {
    return nombre && otro && otro.toLowerCase() === nombre.toLowerCase();
  }

  function mostrarAviso(elemento, texto) {
    if (!elemento) return;
    elemento.textContent = texto || "";
    elemento.hidden = !texto;
  }

  function pintarQuien() {
    if (quien) quien.textContent = nombre || "— sin nombre —";
  }

  /* pide al juego que enseñe una capa suya (inicio, pausa, fin...) */
  function capa(cual) {
    if (typeof window.pintarCapaJuego === "function") window.pintarCapaJuego(cual);
  }

  function bloquear(valor) {
    bloqueando = valor;
    if (typeof window.bloquearJuego === "function") window.bloquearJuego(valor);
  }

  /* ---------- red ---------- */
  async function traerRanking() {
    const r = await fetch(api() + "/ranking?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function enviarPuntaje(puntos) {
    const r = await fetch(api() + "/puntaje", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre, puntos: puntos }),
    });
    const datos = await r.json();
    if (!r.ok) throw new Error(datos.error || "HTTP " + r.status);
    return datos;
  }

  /* ---------- pintar listas ---------- */
  function pintarLista(top, jugadores) {
    if (!listaRanking) return;
    if (!top.length) {
      listaRanking.innerHTML = '<li class="vacio">Todavía no hay nadie. ¡Sea el primero!</li>';
    } else {
      listaRanking.innerHTML = top.map((e) => {
        const premio = medallas[e.puesto - 1] || e.puesto;
        return `<li class="${esMio(e.nombre) ? "yo" : ""}">` +
          `<span class="pos">${premio}</span>` +
          `<span class="nom">${escapar(e.nombre)}</span>` +
          `<span class="pts">${e.puntos}</span>` +
          `</li>`;
      }).join("");
    }
    if (subRanking) {
      const total = jugadores === 1 ? "1 jugador" : `${jugadores} jugadores`;
      let linea = `${total} en el ranking global`;
      if (miPuesto) linea += ` · usted va ${miPuesto}º`;
      subRanking.textContent = linea;
    }
  }

  async function abrirRanking() {
    if (!capaRanking) return;
    if (typeof window.pausarSiJugando === "function") window.pausarSiJugando();
    capa("ranking");
    capaRanking.hidden = false;
    if (subRanking) subRanking.textContent = "Cargando…";
    mostrarAviso(avisoRanking, "");
    try {
      const datos = await traerRanking();
      pintarLista(datos.top || [], datos.jugadores || 0);
    } catch (e) {
      if (listaRanking) listaRanking.innerHTML = "";
      mostrarAviso(avisoRanking, "No pude traer el ranking (¿sin conexión?). Pruebe otra vez.");
    }
  }

  function cerrarRanking() {
    if (capaRanking) capaRanking.hidden = true;
    if (typeof window.alCerrarRanking === "function") window.alCerrarRanking();
    else capa("inicio");
  }

  /* ---------- pantalla del nombre ---------- */
  function pedirNombre() {
    if (!capaNombre) return;
    capa("nombre");
    capaNombre.hidden = false;
    bloquear(true);
    if (campoNombre) {
      campoNombre.value = nombre;
      setTimeout(() => campoNombre.focus(), 120);
    }
    mostrarAviso(avisoNombre, "");
  }

  function aceptarNombre(texto) {
    const limpio = String(texto || "").replace(/\s+/g, " ").trim().slice(0, 12);
    const problema = nombreValido(limpio);
    if (problema) {
      mostrarAviso(avisoNombre, problema);
      return false;
    }
    nombre = limpio;
    localStorage.setItem(CLAVE_NOMBRE, nombre);
    pintarQuien();
    if (capaNombre) capaNombre.hidden = true;
    bloquear(false);
    capa("inicio");
    return true;
  }

  /* ---------- enganches con el juego ---------- */
  window.Ranking = {
    /* al cargar la página del juego */
    alArrancar() {
      pintarQuien();
      if (!nombre) pedirNombre();
    },

    /* el juego avisa cuando la culebrita muere */
    async alMorir(puntos) {
      if (!elFinRanking) return;
      if (!nombre) {
        elFinRanking.textContent = "Sin nombre no hay ranking. Ponga su nombre arriba.";
        return;
      }
      elFinRanking.textContent = "Guardando su puesto…";
      try {
        const d = await enviarPuntaje(puntos);
        miPuesto = d.puesto || 0;
        localStorage.setItem(CLAVE_PUESTO, String(miPuesto));
        const total = d.jugadores === 1 ? "1 jugador" : `${d.jugadores} jugadores`;
        elFinRanking.textContent = d.nuevo
          ? `¡Entró al ranking! Puesto ${d.puesto} de ${total}.`
          : `Su récord sigue en ${d.mejor}. Va ${d.puesto}º de ${total}.`;
      } catch (e) {
        elFinRanking.textContent = "No pude guardar el puntaje (¿sin conexión?).";
      }
    },

    abrir: abrirRanking,
    cerrar: cerrarRanking,
    cambiarNombre: pedirNombre,
    nombre: () => nombre,
    bloqueando: () => bloqueando,
  };

  /* ---------- botones y teclas ---------- */
  if (formNombre) {
    formNombre.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (aceptarNombre(campoNombre ? campoNombre.value : "")) {
        /* al guardar el nombre, si veníamos del panel del ranking, se cierra */
        if (capaRanking) capaRanking.hidden = true;
      }
    });
  }
  const btnGuardar = document.getElementById("btn-guardar-nombre");
  if (btnGuardar) {
    btnGuardar.addEventListener("click", (ev) => {
      ev.preventDefault();
      aceptarNombre(campoNombre ? campoNombre.value : "");
    });
  }
  const btnRanking = document.getElementById("btn-ranking");
  if (btnRanking) btnRanking.addEventListener("click", abrirRanking);
  const btnRefrescar = document.getElementById("btn-ranking-refrescar");
  if (btnRefrescar) btnRefrescar.addEventListener("click", abrirRanking);
  const btnCerrar = document.getElementById("btn-ranking-cerrar");
  if (btnCerrar) btnCerrar.addEventListener("click", cerrarRanking);
  const btnCambiar = document.getElementById("btn-cambiar-nombre");
  if (btnCambiar) btnCambiar.addEventListener("click", pedirNombre);

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && capaRanking && !capaRanking.hidden) cerrarRanking();
  });

  /* ---------- portada: pequeño top 3 ---------- */
  if (elPortadaTop) {
    (async () => {
      try {
        const datos = await traerRanking();
        const top = (datos.top || []).slice(0, 3);
        if (!top.length) {
          elPortadaTop.innerHTML = '<p class="vacio">Todavía no hay récords. ¡Sea el primero!</p>';
        } else {
          elPortadaTop.innerHTML = top.map((e) =>
            `<li><span class="pos">${medallas[e.puesto - 1] || e.puesto}</span>` +
            `<span class="nom">${escapar(e.nombre)}</span>` +
            `<span class="pts">${e.puntos}</span></li>`
          ).join("");
        }
      } catch (e) { /* sin conexión: no se enseña nada, sin ruido */ }
    })();
  }
})();
