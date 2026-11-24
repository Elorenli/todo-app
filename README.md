# Lista de tareas — proyecto de pruebas de software

Una aplicación web sencilla (agregar, editar, completar, filtrar y eliminar tareas) hecha con
**HTML + CSS + JavaScript** y un pequeño servidor **Node.js**, pensada para practicar los distintos
tipos de pruebas. No usa librerías externas: no hay que instalar nada, solo tener Node 20 o superior.

## Cómo usarla

```bash
npm start
```

Abre http://localhost:3000. Las tareas se guardan en `data/tasks.json` (se crea solo).
Para guardarlas en otro lugar o usar otro puerto: `DATA_FILE=/ruta/tareas.json PORT=4000 npm start`.

## Cómo ejecutar las pruebas

| Comando | Qué ejecuta |
|---|---|
| `npm test` | Todas las pruebas |
| `npm run test:unit` | Pruebas unitarias |
| `npm run test:integration` | Pruebas de integración |
| `npm run test:functional` | Pruebas funcionales |
| `npm run test:regression` | Pruebas de regresión |
| `npm run test:coverage` | Todas, con informe de cobertura |

## Estructura

```
src/todo.js        Lógica pura (se usa en servidor y navegador)
src/store.js       Guarda y lee el archivo JSON
src/server.js      Servidor HTTP: API REST + archivos estáticos
public/            Lo que ve el usuario (index.html, style.css, app.js)
support/helpers.js Ayudante que arranca un servidor de prueba aislado
test/              Las pruebas (una carpeta, un archivo por tipo)
.github/workflows/ Pruebas automáticas con GitHub Actions
INFORME.md         Informe del proyecto con resultados
GUIA_USABILIDAD.md Guía para las pruebas con personas
```

## API

| Método y ruta | Qué hace | Respuesta |
|---|---|---|
| `GET /api/tasks?filter=all\|active\|completed` | Lista tareas | 200 |
| `POST /api/tasks` `{ "title": "..." }` | Crea una tarea | 201 |
| `PUT /api/tasks/:id` `{ "title"?, "done"? }` | Edita o completa | 200 |
| `DELETE /api/tasks/:id` | Elimina | 204 |

Errores: 400 (datos inválidos), 404 (no existe), 405 (método no permitido), 413 (petición demasiado grande).
