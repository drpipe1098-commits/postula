/**
 * POSTULA — Utilidades de prueba.
 *
 * Sin dependencias: las pruebas corren con Node puro, sin npm install.
 * Los archivos de extension/ se cargan en un sandbox de vm, igual que el
 * navegador los carga uno tras otro compartiendo el mismo ámbito global.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { join, relative } from 'node:path';

export const RAIZ = new URL('..', import.meta.url).pathname;

/** Carga varios archivos de la extensión en un mismo ámbito y lo devuelve. */
export function cargar(archivos) {
  const ambito = { console };
  createContext(ambito);
  archivos.forEach((archivo) => {
    const ruta = join(RAIZ, archivo);
    runInContext(readFileSync(ruta, 'utf8'), ambito, { filename: archivo });
  });
  return ambito;
}

export function leer(archivo) {
  return readFileSync(join(RAIZ, archivo), 'utf8');
}

/** Lista recursiva de archivos bajo un directorio del repositorio. */
export function archivosDe(directorio, extensiones) {
  const salida = [];
  const recorrer = (actual) => {
    readdirSync(actual).forEach((nombre) => {
      const ruta = join(actual, nombre);
      if (statSync(ruta).isDirectory()) return recorrer(ruta);
      if (!extensiones || extensiones.some((ext) => nombre.endsWith(ext))) {
        salida.push(relative(RAIZ, ruta));
      }
    });
  };
  recorrer(join(RAIZ, directorio));
  return salida.sort();
}

/** Acumulador de fallas de una prueba de contrato. */
export function contrato(nombre) {
  const fallas = [];
  return {
    exigir(condicion, mensaje) {
      if (!condicion) fallas.push(mensaje);
    },
    igual(obtenido, esperado, mensaje) {
      const a = JSON.stringify(obtenido);
      const b = JSON.stringify(esperado);
      if (a !== b) fallas.push(`${mensaje} — se obtuvo ${a}, se esperaba ${b}`);
    },
    cerrar() {
      if (fallas.length) {
        console.error(`\n✗ ${nombre} — ${fallas.length} falla(s):`);
        fallas.forEach((f) => console.error('   · ' + f));
        process.exitCode = 1;
        return false;
      }
      console.log(`✓ ${nombre}`);
      return true;
    }
  };
}
