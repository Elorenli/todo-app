'use strict';

const fs = require('node:fs');
const path = require('node:path');

/*
 * Almacenamiento en un archivo JSON.
 * Guarda { tasks: [...], nextId: N }. El contador nextId solo sube, así un id
 * nunca se reutiliza aunque se borre la última tarea.
 */
class Store {
  constructor(file) {
    this.file = file;
  }

  load() {
    if (!fs.existsSync(this.file)) {
      return { tasks: [], nextId: 1 };
    }
    let data;
    try {
      data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      throw new Error('El archivo de datos está dañado.');
    }
    if (!data || !Array.isArray(data.tasks) || !Number.isInteger(data.nextId)) {
      throw new Error('El archivo de datos tiene un formato inválido.');
    }
    return data;
  }

  save(data) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // Se escribe en un archivo temporal y luego se renombra: así un corte a mitad
    // de la escritura no deja el archivo real a medias.
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store };
