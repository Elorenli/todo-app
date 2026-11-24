# Informe: Pruebas para asegurar que mi aplicación funcione bien

**Proyecto:** Lista de tareas (HTML + CSS + JavaScript + servidor Node.js)
**Fecha de las pruebas automáticas:** 22 de noviembre de 2026 · **Node:** 22.23.5
**Autor/a:** _[escribe tu nombre]_

> Las secciones 1 a 7 y 9 contienen resultados reales de las pruebas ejecutadas. Los apartados marcados
> con _[completa]_ dependen de ti (pruebas con personas y tus conclusiones personales).

---

## 1. Resumen

Construí una lista de tareas donde se puede **agregar, editar, completar, filtrar y eliminar** tareas, y
las tareas se guardan en un archivo, así que no se pierden al recargar. Escribí **79 pruebas automáticas**
de cuatro tipos (unitarias, de integración, funcionales y de regresión). **Todas pasan** y ejecutan
entre el **95 % y el 98 %** de las líneas de cada archivo de la aplicación. Para no fiarme solo de que "todo está en verde", rompí el código
a propósito de 12 maneras distintas: las pruebas detectaron 11. Eso reveló un hueco real en una de mis pruebas,
que corregí (sección 6).

## 2. La aplicación

| Parte | Archivos | Para qué sirve |
|---|---|---|
| Lógica | `src/todo.js` | Reglas de las tareas (validar títulos, agregar, editar, filtrar…). No toca archivos ni red. |
| Almacenamiento | `src/store.js` | Lee y escribe `data/tasks.json`. |
| Servidor | `src/server.js` | API (`/api/tasks`) y entrega de las páginas. |
| Interfaz | `public/` | Lo que ve y toca el usuario. |

Decisiones pensadas para poder probarla bien:
- **La lógica está separada** del servidor y de la pantalla, por eso se prueba sin levantar nada.
- **Nada modifica los datos que recibe**: cada función devuelve una copia nueva, lo que evita errores difíciles de rastrear.
- **Los ids nunca se reutilizan** (hay un contador aparte que solo sube).
- **El texto del usuario nunca se interpreta como HTML** (se usa `textContent`), para evitar ataques XSS.

## 3. Estrategia de pruebas

| Tipo | Qué comprueba | Archivo | Pruebas | Resultado |
|---|---|---|---|---|
| **Unitarias** | Cada función de `todo.js` por separado, con casos normales y casos raros (vacío, 100/101 caracteres, tipos incorrectos, ids inexistentes) | `test/unit.test.js` | 34 | ✅ 34 / 34 |
| **Integración** | Que servidor, lógica y archivo trabajen juntos: lo que se guarda llega al archivo, sobrevive a un reinicio, y los errores salen bien (400, 404, 405, 500) | `test/integration.test.js` | 21 | ✅ 21 / 21 |
| **Funcionales** | Recorridos completos como los haría una persona: abrir la página, agregar, completar, filtrar, editar, eliminar | `test/functional.test.js` | 9 | ✅ 9 / 9 |
| **Regresión** | Que no se rompa lo que ya funcionaba (REG-001 a REG-015: ids, seguridad, estado de las tareas…) | `test/regression.test.js` | 15 | ✅ 15 / 15 |
| **Usabilidad** | Si la app es fácil de usar, con personas reales | `GUIA_USABILIDAD.md` | — | _[completa]_ (sección 8) |
| | | **Total automáticas** | **79** | **✅ 79 / 79** |

Cada prueba usa un servidor propio con un archivo de datos temporal, así que no se afectan entre sí ni tocan datos reales.

## 4. Resultados y cobertura

La cobertura mide qué porcentaje del código se ejecutó durante las pruebas (`npm run test:coverage`):

| Archivo | Líneas | Ramas | Funciones |
|---|---|---|---|
| `src/todo.js` | 98,4 % | 96,5 % | 100 % |
| `src/store.js` | 95,2 % | 90,9 % | 100 % |
| `src/server.js` | 95,0 % | 90,4 % | 92,9 % |

Lo que no se ejecuta: el bloque que arranca el servidor de verdad (`npm start`) y unas pocas ramas poco
comunes (por ejemplo, el error 405 en `/api/tasks/:id`). Una **prueba de humo** manual con el servidor real
(abrir `/`, crear una tarea con `POST`, listarla con `GET`) también dio el resultado esperado.

> Ojo: una cobertura alta dice que el código *se ejecutó*, no que las pruebas lo *verifiquen bien*. Por eso la sección siguiente.

## 5. ¿Mis pruebas realmente detectan errores? (pruebas de mutación)

Copié el proyecto, introduje **un error a propósito** cada vez y ejecuté toda la batería. Si ninguna prueba
falla, ese error pasaría desapercibido en la vida real.

| # | Error introducido | ¿Detectado? | Pruebas que fallaron (ejemplo) |
|---|---|---|---|
| M1 | Los ids se reutilizan al borrar tareas | ✅ (tras corregir, ver sección 6) | REG-015 |
| M2 | No se recortan los espacios del título | ✅ | 8, p. ej. REG-005 |
| M3 | `updateTask` modifica la tarea original | ✅ | REG-003 y una unitaria |
| M4 | Se quita la protección contra *path traversal* | ✅ | REG-010 |
| M5 | El frontend usa `innerHTML` con el título | ✅ | REG-013 |
| M6 | El filtro "pendientes" devuelve las completadas | ✅ | 4, incluido el flujo funcional |
| M7 | Se quita el límite de tamaño de la petición | ✅ | REG-009 |
| M8 | No se valida el tipo del campo `done` | ✅ | unitaria de `updateTask` |
| M9 | `toggleTask` siempre marca como completada | ✅ | 2 unitarias |
| M10 | El almacenamiento no escribe el archivo | ✅ | 17 pruebas |
| M11 | El **servidor** deja pasar campos extra en `PUT` | ❌ | — (explicado abajo) |
| M12 | **Servidor y lógica** dejan pasar campos extra (se podría cambiar el `id`) | ✅ | REG-006 y REG-007 |

**Resultado: 11 de 12 detectados.** M11 es un *mutante equivalente*: el servidor y la lógica son dos barreras
contra el mismo problema, y si solo falla una, el comportamiento visible no cambia, así que ninguna prueba
puede notarlo. No es un hueco de las pruebas; M12 (fallan las dos barreras a la vez) demuestra que sí se detectaría el problema real.

## 6. Problemas encontrados y cómo los solucioné

| # | Problema | Cómo apareció | Solución |
|---|---|---|---|
| 1 | **Hueco en la prueba REG-004**: solo comprobaba que no se repitiera un id al borrar la *última* tarea. Si se borraba una del principio y luego se creaban dos tareas, el error pasaba desapercibido (M1 no fue detectada en la primera ronda). | Pruebas de mutación | Agregué **REG-015**: crear A, B, C; borrar la primera; crear D y E; comprobar ids 4 y 5 sin repetidos. Segunda ronda: M1 detectada. |
| 2 | **La primera ejecución salió 78/78 en verde, sin fallos reales.** Eso me hizo desconfiar en lugar de celebrar. | Primera ejecución | Verifiqué las pruebas con mutaciones (sección 5). Los errores típicos (ids, inmutabilidad, XSS, *path traversal*) ya estaban prevenidos al diseñar la app, y ahora existen pruebas que los vigilan. |
| 3 | La app no permitía elegir dónde guardar los datos, y una prueba de humo habría ensuciado la carpeta del proyecto. | Prueba de humo | Agregué la variable `DATA_FILE` (y `PORT`) al arrancar el servidor. |

_[completa: añade aquí cualquier problema que encuentres tú al hacer la guía de usabilidad]_

## 7. Automatización con GitHub Actions

El archivo `.github/workflows/ci.yml` le dice a GitHub: *"cada vez que se suban cambios (push) o se abra un
pull request, descarga el código, instala Node (versiones 20 y 22) y ejecuta las cuatro baterías de pruebas"*.
Si alguna falla, GitHub marca el cambio con una ❌ y avisa por correo.

Para activarlo: sube la carpeta a un repositorio de GitHub; en la pestaña **Actions** aparecerá "Pruebas automáticas".

**Estado honesto:** el archivo del flujo **no se ejecutó en GitHub** durante este trabajo (no tengo repositorio
conectado). Sí comprobé que cada comando que usa (`npm run test:unit`, `test:integration`, `test:functional`,
`test:regression`) funciona localmente con Node 22. No lo probé con Node 20.
_[completa: cuando lo subas, pega aquí una captura de la ejecución en verde.]_

## 8. Pruebas de usabilidad

Seguí/seguiré el plan de `GUIA_USABILIDAD.md`: 7 tareas con 3 a 5 voluntarios, más una lista de revisión manual
del frontend.

_[completa: voluntarios, resultados por tarea, problemas que se repitieron, y qué cambiarías.]_

| Problema observado | ¿Cuántas personas? | Gravedad | Cambio propuesto |
|---|---|---|---|
| _[ejemplo]_ | | | |

## 9. Limitaciones y próximos pasos

- **No hay pruebas en un navegador real.** Los clics, la edición en línea, el cuadro de confirmación y el
  aspecto en móvil se revisan a mano (lista de la Parte B de la guía). Lo único automático en el frontend
  son comprobaciones del código fuente (REG-013 y REG-014) y que todos los recursos de la página se carguen.
  Siguiente paso: herramientas como Playwright, que abren un navegador de verdad.
- **Un solo usuario y un archivo.** Dos peticiones simultáneas podrían pisarse al escribir el archivo. Para más
  usuarios haría falta una base de datos.
- **No hay inicio de sesión:** cualquiera que abra la página ve todas las tareas.
- **Solo se probó localmente con Node 22.**

## 10. Conclusiones

_[completa con tus palabras. Ideas: qué tipo de prueba te resultó más útil; por qué "todo en verde" no basta;
qué cambiarías al diseñar la próxima app para que sea más fácil de probar.]_

---

### Anexo: cómo reproducir todo

```bash
npm test                  # las 79 pruebas
npm run test:coverage     # con cobertura
npm start                 # la app en http://localhost:3000
```

Para repetir una mutación a mano: en `src/todo.js` cambia `!task.done` por `task.done` dentro de
`filterTasks`, ejecuta `npm test`, observa los fallos y deshaz el cambio.
