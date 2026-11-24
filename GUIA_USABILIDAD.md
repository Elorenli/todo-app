# Guía de pruebas de usabilidad y revisión manual

Las pruebas automáticas no pueden decir si la app es **fácil de usar**, ni comprobar clics, teclado
o el aspecto en un móvil. Esta guía cubre eso. Los resultados los completas tú: aquí no hay datos inventados.

## Parte A — Prueba con personas (3 a 5 voluntarios)

**Preparación:** ejecuta `npm start` y abre http://localhost:3000 en tu computadora (o en un móvil
conectado a la misma red). Borra `data/tasks.json` para empezar con la lista vacía.

**Reglas para quien observa:**
1. Di: "Estoy probando la app, no a ti. Si algo te confunde, es culpa de la app."
2. Da las tareas de una en una, **sin explicar cómo se hace**.
3. Callado y observando: anota dónde duda, qué botón busca, qué errores comete.
4. Mide el tiempo aproximado y si lo logró solo, con ayuda o no pudo.

**Tareas para la persona:**

| # | Tarea |
|---|---|
| 1 | Agrega la tarea "Comprar leche". |
| 2 | Agrega otras dos tareas que quieras. |
| 3 | Marca una tarea como completada. |
| 4 | Corrige el texto de una tarea (por ejemplo, cambia "leche" por "pan"). |
| 5 | Muestra solo las tareas que faltan por hacer. |
| 6 | Elimina una tarea. |
| 7 | Intenta agregar una tarea sin escribir nada. ¿Entiendes qué pasó? |

**Registro por voluntario** (copia una tabla por persona):

| Tarea | ¿Lo logró? (solo / con ayuda / no) | Tiempo | Dudas o errores observados |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |

**Preguntas finales** (puntuar de 1 = nada de acuerdo a 5 = totalmente de acuerdo):
1. Me resultó fácil agregar y completar tareas.
2. Siempre entendí qué estaba pasando en la pantalla.
3. Los mensajes de error me ayudaron.
4. Lo volvería a usar.

Y dos preguntas abiertas: **¿Qué fue lo más confuso?** y **¿Qué cambiarías?**

**Cómo analizar:** busca lo que se repite. Si 2 o más personas dudaron en el mismo paso, es un problema
de la app, no de las personas. Anota cada problema, su gravedad (alta / media / baja) y qué cambiarías.

## Parte B — Lista de revisión manual (lo que no cubren las pruebas automáticas)

Marca ✅ / ❌ y anota la fecha. Repítela cada vez que cambies `public/app.js` o `public/style.css`
(es la prueba de regresión del frontend).

| Revisión | Resultado |
|---|---|
| Escribir una tarea y pulsar **Enter** la agrega | |
| Después de agregar, el cursor vuelve al campo de texto | |
| Pulsar **Editar** (o doble clic en el texto) abre el campo de edición con el texto actual | |
| **Enter** guarda la edición y **Escape** la cancela sin cambios | |
| Editar con un título vacío muestra un mensaje y no pierde la edición | |
| **Eliminar** pide confirmación y **Cancelar** no borra nada | |
| El contador ("2 pendientes de 3") cambia al completar, agregar o eliminar | |
| Los filtros Todas / Pendientes / Completadas muestran lo correcto y el activo se distingue | |
| Con la lista vacía aparece el mensaje "No hay tareas aquí" | |
| Al recargar la página (F5) las tareas siguen ahí | |
| Un título con `<b>hola</b>` se ve tal cual, sin poner negrita | |
| Se puede usar **solo con teclado** (Tab, Espacio, Enter) y siempre se ve dónde está el foco | |
| En pantalla de móvil (ancho ~375 px) nada se sale ni se corta | |
| Si apagas el servidor y pulsas Agregar, aparece "No se pudo conectar con el servidor." | |

## Parte C — Guion para presentar el proyecto (5 a 7 minutos)

1. **Qué hice** (1 min): muestra la app funcionando; agrega, completa, filtra y elimina una tarea.
2. **Por qué probar** (1 min): una app sin pruebas puede romperse sin que nadie lo note cuando se cambia algo.
3. **Los 4 tipos de pruebas** (2 min): ejecuta `npm test` en vivo y explica con un ejemplo cada tipo
   (unitaria: `normalizeTitle`; integración: guardar en el archivo; funcional: el recorrido completo;
   regresión: que un id no se repita).
4. **¿Y si las pruebas no sirven?** (1 min): enseña una mutación — cambia `!task.done` por `task.done` en
   `src/todo.js`, ejecuta `npm test`, mira cómo fallan, y deshaz el cambio. Es la mejor forma de demostrar
   que las pruebas "ven" los errores.
5. **Automatización** (1 min): muestra `.github/workflows/ci.yml` y una ejecución verde en la pestaña *Actions* de GitHub.
6. **Lo que aprendí y lo que falta** (1 min): usa las secciones 6 y 9 del informe.
