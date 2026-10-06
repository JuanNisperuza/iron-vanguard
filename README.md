# IRON VANGUARD — Misión 1: Operation Sunset

Run 'n gun estilo Metal Slug hecho en **Phaser 3**, sin ningún asset externo:
todo el arte se dibuja con Canvas2D al arrancar, los personajes se animan con
huesos + IK procedural, y el sonido/música se sintetizan con WebAudio.

## Cómo jugar
Abre `index.html` directamente en el navegador (Chrome/Edge/Firefox). No necesita servidor.
Si tu navegador bloquea algo con `file://`, sirve la carpeta: `npx serve .` o `python -m http.server`.

| Acción | Teclado | Gamepad |
|---|---|---|
| Mover | ← → / A D | Stick / D-pad |
| Apuntar arriba | ↑ / W | Arriba |
| Agacharse / apuntar abajo en el aire | ↓ / S | Abajo |
| Disparar (cuchillo si el enemigo está pegado) | J / Z | X / RB |
| Saltar (↓ + saltar baja de plataformas) | K / X / Espacio | A |
| Granada | L / C | B / Y |
| Sonido / Pausa | M / P o Esc | — |

## Contenido del nivel
- Soldados con IA (fusileros, granaderos, cuchilleros, paracaidistas): reaccionan con "!", a veces entran en pánico y huyen gritando.
- 3 prisioneros que dan Heavy Machine Gun / bombas; cajas con escopeta, medallas y comida; barriles explosivos en cadena.
- Mini-jefe tanque R-07 (orugas con eslabones animados, torreta que apunta, ametralladora baja → agáchate).
- Helicóptero H-3 (dispara ráfagas y suelta bombas).
- Jefe final ARACNE-9: caminante de 4 patas con IK y pasos procedurales; cañón de plasma, misiles teledirigidos (se pueden derribar), pisotón con ondas de choque (salta) y rayo láser bajo/alto (salta o agáchate). A mitad de vida pierde el blindaje.

## Estructura
- `src/rig.js` — esqueleto humanoide: ciclo de marcha, IK de 2 huesos, apuntado, acciones y ragdoll Verlet
- `src/audio.js` — SFX y música sintetizados
- `src/world.js` — datos del nivel, terreno horneado por trozos, parallax
- `src/entities.js` — jugador, soldados, cajas, barriles, prisioneros, pickups
- `src/bosses.js` — tanque, helicóptero, caminante
- `src/game.js` — escena principal (cámara que solo avanza, bloqueos de jefe, proyectiles)
- `src/scenes.js` — título, HUD, continuar, misión cumplida
