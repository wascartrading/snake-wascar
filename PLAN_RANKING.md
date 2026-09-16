# PLAN — Nombre del jugador y ranking global (SNAKE · Wáscar)

Estado: **HECHO y publicado** (16/09/2026). El jefe eligió la opción **B** (Railway,
el servicio del puente que antes servía a JARVIS).

## 1. Lo que pidió el jefe

1. Preguntar el nombre al inicio ("¿Cuál es tu nombre?").
2. Con ese nombre, guardar el récord de cada persona.
3. Mostrarlo como un ranking global: top 1, top 2, top 3...

## 2. Lo que quedó construido

1. **Pantalla de nombre** (al abrir el juego, antes de la primera partida)
   - Se guarda en el navegador: la próxima vez no vuelve a preguntar.
   - Botón "Cambiar nombre" en el panel del jugador.
   - 3 a 12 caracteres: letras (con tildes y ñ), números, espacios, punto,
     guion y guion bajo.
2. **Envío del récord**
   - Al morir se envía solo y la pantalla de fin dice el puesto:
     "¡Entró al ranking! Puesto 3 de 3 jugadores." o
     "Su récord sigue en 14. Va 1º de 3 jugadores."
   - Sin conexión avisa: "No pude guardar el puntaje".
3. **Ranking (botón 🏆 dentro del juego y sección en la portada)**
   - Top 10 con medallas, un registro por nombre (su mejor puntaje).
   - Enseña "tu puesto" y resalta tu fila.
   - La portada trae un top 3.
4. **Anti-abuso**
   - El servidor valida el nombre, el rango del puntaje (0 a 999) y calcula
     el nivel él mismo (no se cree al cliente).
   - Un registro por nombre: las mayúsculas y las tildes no duplican la ficha
     ("Wáscar", "wascar" y "WASCAR" son el mismo jugador).
   - Freno de 40 envíos por minuto por dirección.
   - Honesto: en un juego de navegador el puntaje siempre se puede falsificar;
     esto evita lo fácil, no al tramposo decidido.

## 3. Dónde vive (opción B, la que eligió el jefe)

- **Proyecto Railway**: `jarvis-puente` (el mismo de siempre), entorno
  `production`.
- **Servicio**: `jarvis-puente` — era el servicio viejo de JARVIS y ya estaba
  apagado (sin despliegue activo), así que se reutilizó en su lugar, con su
  misma dirección: `https://jarvis-puente-production-eaeb.up.railway.app`
- **Disco**: volumen `jarvis-puente-volume` montado en `/data`; la base de
  datos SQLite vive en `/data/ranking.db` y NO se borra en cada despliegue.
- **NO se tocó** el servicio `BOT-ESTADISTICO` (orden expresa del jefe).

## 4. API del servicio

| Ruta | Qué hace |
|------|----------|
| `GET /` | página sencilla con el top 10 (para mirar sin el juego) |
| `GET /salud` | estado y número de jugadores |
| `GET /ranking` | top 10 + total de jugadores |
| `POST /puntaje` | `{"nombre": "...", "puntos": 12}` → puesto, mejor y top |

## 5. Verificación hecha

- 17 pruebas automáticas en local (`pruebas_ranking.py`): nombres inválidos,
  groserías, puntajes absurdos, mejor por nombre, orden del top, página y 404.
- Pruebas reales contra la nube: dos jugadores, uno con tilde (UTF-8 correcto),
  intento de duplicar el nombre en minúsculas (no duplicó) y rechazo de nombre
  corto.
- Flujo completo desde el enlace público en tamaño de teléfono (390x844):
  pregunta el nombre → juega → muere → se envía el puntaje → panel del ranking
  con la fila propia resaltada.
- CORS comprobado (la web de GitHub Pages puede llamar al servicio de Railway).

## 6. Pendiente / opcional

- Quedó una fila de prueba en el ranking: `PruebaJARVIS` (1 punto), del propio
  ensayo. Se puede borrar si el jefe lo pide (no hay borrado público, a
  propósito).
- Ideas para más adelante: top del día o de la semana, y avisar al jefe por
  Telegram cuando alguien le quite el primer puesto.
