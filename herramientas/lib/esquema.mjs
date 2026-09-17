/**
 * POSTULA — Puente entre las herramientas de terminal y el esquema del perfil.
 *
 * El esquema vive en `extension/lib/perfil.js` porque el navegador lo carga
 * tal cual, sin compilar. Las herramientas de terminal lo cargan en un
 * contexto de `vm`, igual que las pruebas, para que **exista una sola
 * definición del perfil** en todo el proyecto. Si el esquema cambia, estas
 * herramientas cambian con él y no hay forma de que se desincronicen.
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function cargarExtension(archivos) {
  const ambito = { console };
  createContext(ambito);
  archivos.forEach((archivo) => {
    runInContext(readFileSync(join(RAIZ, archivo), 'utf8'), ambito, { filename: archivo });
  });
  return ambito;
}

const ambito = cargarExtension([
  'extension/lib/normalizar.js',
  'extension/lib/perfil.js'
]);

export const Perfil = ambito.POSTULA_Perfil;
export const Normalizar = ambito.POSTULA_Normalizar;
export { RAIZ };
