# PLAN — Nombre del jugador y ranking global (SNAKE · Wáscar)

Estado: **propuesta, esperando luz verde**. Nada de esto está implementado todavía.

## 1. Lo que pidió el jefe

1. Preguntar el nombre al inicio ("¿Cuál es tu nombre?").
2. Con ese nombre, guardar el récord de cada persona.
3. Mostrarlo como un ranking global: top 1, top 2, top 3...

## 2. Lo que se va a construir

1. **Pantalla de nombre** (al abrir el juego, antes de la primera partida)
   - Se guarda en el navegador: la próxima vez no vuelve a preguntar.
   - Botón "cambiar nombre" en el menú.
   - Reglas del nombre: 3 a 12 letras o números (tildes y ñ permitidas);
     se recortan los espacios; se rechazan groserías con una lista simple.
2. **Envío del récord**
   - Al morir, si el puntaje es mejor que el que ya tenía ese nombre, se envía solo.
   - Aviso en la pantalla de fin: "quedaste en el puesto 7 de 42 jugadores".
3. **Ranking (botón "Ranking" dentro del juego)**
   - Top 10: puesto, nombre, puntaje, nivel y fecha.
   - Un solo registro por nombre (se queda su mejor puntaje).
   - Debajo del top 10: "tu puesto" si estás fuera.
   - En la portada, un pequeño "top 3" de muestra.
4. **Anti-abuso (mínimo, honesto)**
   - El servidor valida: nombre permitido, puntaje entre 0 y 999.
   - Un registro por nombre (no se puede llenar la lista repitiendo el nombre).
   - Aviso honesto: en un juego de navegador el puntaje siempre se puede
     falsificar; con esto se evita lo fácil, no al tramposo decidido.

## 3. Decisiones que necesito del jefe

| # | Decisión | Opciones | Mi recomendación |
|---|----------|----------|------------------|
| 1 | Dónde vive el ranking | (A) Supabase nuevo · (B) Railway servicio nuevo · (C) dentro del puente actual | (A) Supabase |
| 2 | Cuándo pide el nombre | al abrir el juego · antes de cada partida | al abrir, y se recuerda |
| 3 | Cómo se envía | automático al morir · con botón "Enviar" | automático, con botón para reintentar |
| 4 | Alcance de la lista | top 10 de siempre · también top del día/semana | top 10 de siempre + tu puesto |

### Opciones de dónde vive (detalle)

- **(A) Supabase nuevo** — base de datos gratis, se crea una tabla y una
  función que valida el puntaje. Cero riesgo para lo que ya funciona. El
  navegador usa la clave pública "anon" (normal en apps públicas) y las
  reglas de la tabla impiden borrar o editar datos ajenos.
  Requiere: crear el proyecto en supabase.com (5 minutos, con un correo).
- **(B) Railway, servicio nuevo** — ya paga Railway. Sería un servicio
  pequeño aparte (API + base de datos), la clave queda secreta en el
  servidor y se puede validar mejor. Requiere desplegar y consumir créditos.
- **(C) Dentro del puente actual** — más barato, pero se toca el servicio
  que usa la app del teléfono: si algo sale mal, el puente se cae. No lo
  recomiendo.
- **(D) Solo en el navegador** — el ranking sería por teléfono, no global.
  Descartado (no cumple "de todas las personas"), salvo como paso 1.

## 4. Plan de trabajo (cuando haya luz verde)

1. Crear la nube (según decisión 1) y la tabla del ranking.
2. Pantalla de nombre + memoria en el navegador.
3. Envío del récord y cálculo del puesto.
4. Pantalla de ranking (top 10 + tu puesto) y top 3 en la portada.
5. Pruebas: nombre largo/corto/con groserías, puntaje absurdo, top con
   pocos y con muchos jugadores, teléfono 390x844, y prueba real de dos
   nombres distintos compitiendo.
6. Publicar y verificar en el enlace público.

## 5. Ya hecho y probado (pendiente solo de publicar)

- El punto cuenta cuando la **cabeza** toca la manzana: la manzana se queda
  visible hasta que la cabeza dibujada llega a ella y ahí desaparece, suena
  y sube el marcador (antes se cobraba un paso antes, cuando lo que se veía
  encima era el cuello). Probado paso a paso con la herramienta de pruebas.
