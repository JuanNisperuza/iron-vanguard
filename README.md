# Iron Vanguard

Juego de acción lateral tipo run and gun hecho con Phaser 3. No usa recursos externos: los gráficos se dibujan con Canvas2D al arrancar, los personajes se animan con un esqueleto procedural y el audio se sintetiza con WebAudio.

## Ejecutar

Abrir `index.html` en el navegador. Si el navegador bloquea algo al abrirlo como archivo, servir la carpeta:

```
npx serve .
```

o

```
python -m http.server
```

## Controles

| Acción | Teclado | Gamepad |
| --- | --- | --- |
| Mover | Flechas o A D | Stick o cruceta |
| Apuntar arriba | Arriba o W | Arriba |
| Agacharse, apuntar abajo en el aire | Abajo o S | Abajo |
| Disparar (cuchillo si el enemigo está pegado) | J o Z | X o RB |
| Saltar (Abajo + saltar baja de plataformas) | K, X o Espacio | A |
| Granada | L o C | B o Y |
| Sonido | M | |
| Pausa | P o Esc | |

El juego se pausa solo al perder el foco de la ventana. La puntuación máxima se guarda en el navegador.

## Nivel

- Soldados con comportamiento propio: fusileros, granaderos, cuchilleros y paracaidistas.
- Tres prisioneros que entregan armas o bombas, cajas con objetos y barriles explosivos.
- Tanque R-07 a mitad del nivel.
- Helicóptero H-3 antes del tramo final.
- Jefe final ARACNE-9, un caminante de cuatro patas con varios ataques y una segunda fase.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `src/main.js` | Configuración de Phaser y arranque |
| `src/scenes.js` | Carga, título y HUD |
| `src/game.js` | Escena principal, entrada, cámara y proyectiles |
| `src/world.js` | Datos del nivel, terreno y fondos |
| `src/entities.js` | Jugador, soldados, cajas, barriles, prisioneros y objetos |
| `src/bosses.js` | Tanque, helicóptero, misiles y jefe final |
| `src/rig.js` | Esqueleto humanoide, cinemática inversa y ragdoll |
| `src/fx.js` | Partículas, escombros y textos flotantes |
| `src/audio.js` | Efectos y música sintetizados |
| `src/textures.js` | Generación de todas las texturas |

El formato del código sigue la configuración de `.prettierrc`.
