#!/usr/bin/env node
/**
 * POSTULA — Tablero de postulaciones.
 *
 *   node herramientas/tablero.mjs                      → qué toca hoy
 *   node herramientas/tablero.mjs listar
 *   node herramientas/tablero.mjs estado <id> postulado
 *
 * Un archivo JSON en el equipo de la persona. Sin servidor, sin cuenta y sin
 * red: el tablero sabe a qué te postulaste, y eso no tiene por qué saberlo
 * nadie más.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as T from './lib/tablero.mjs';

const ARCHIVO_POR_DEFECTO = 'mis-postulaciones.json';

const AYUDA = `
POSTULA — tablero de postulaciones

  node herramientas/tablero.mjs [orden] [opciones]

Órdenes
  (ninguna)                    Qué toca hoy: seguimientos vencidos y resumen
  listar                       Todas las postulaciones abiertas
  agregar                      Registra una vacante a mano
  estado <id> <estado>         Mueve una postulación de estado
  nota <id> "texto"            Anota algo en su historial
  seguimiento <id> <cuando>    Fija el próximo seguimiento (+7d, +2s, mañana, 2026-10-01)

Estados
  ${Object.keys(T.ESTADOS).join(', ')}

Opciones
  --archivo <ruta>   Dónde vive el tablero (por defecto: ${ARCHIVO_POR_DEFECTO})
  --titulo, --empresa, --enlace, --salario, --modalidad, --ubicacion   (para «agregar»)
  --nota "texto"     Nota que acompaña un cambio de estado
  --todas            En «listar», incluye las cerradas
  --ayuda

Las postulaciones entran solas cuando marcas una vacante con «s» en
  node herramientas/vacantes.mjs
`;

// --- Presentación ----------------------------------------------------------

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  tenue: (t) => (color ? `\x1b[2m${t}\x1b[0m` : t),
  fuerte: (t) => (color ? `\x1b[1m${t}\x1b[0m` : t),
  verde: (t) => (color ? `\x1b[32m${t}\x1b[0m` : t),
  amarillo: (t) => (color ? `\x1b[33m${t}\x1b[0m` : t),
  rojo: (t) => (color ? `\x1b[31m${t}\x1b[0m` : t)
};

function pintarAtraso(dias) {
  if (dias === 0) return c.amarillo('hoy');
  if (dias === 1) return c.amarillo('1 día tarde');
  return c.rojo(`${dias} días tarde`);
}

function unaLinea(fila) {
  const datos = [fila.empresa, fila.modalidad, fila.salario, fila.ubicacion]
    .filter(Boolean).join(' · ');
  return `  ${c.fuerte(fila.titulo || '(sin título)')}\n`
    + (datos ? `     ${c.tenue(datos)}\n` : '')
    + `     ${c.tenue(fila.id)}`;
}

// --- Órdenes ---------------------------------------------------------------

function hoyISO() {
  return T.aFecha(new Date());
}

function leer(ruta) {
  if (!existsSync(ruta)) return T.tableroVacio();
  try {
    return T.sanear(JSON.parse(readFileSync(ruta, 'utf8')));
  } catch (error) {
    console.error(`\n  El tablero ${ruta} no se pudo leer: ${error.message}`);
    console.error('  Es un archivo tuyo: ábrelo y arréglalo, o muévelo para empezar de cero.\n');
    process.exit(1);
  }
}

function guardar(ruta, tablero) {
  writeFileSync(ruta, `${JSON.stringify(tablero, null, 2)}\n`, 'utf8');
}

function vistaDeHoy(tablero, hoy) {
  const pendientes = T.pendientesDeHoy(tablero, hoy);
  const quedadas = T.estancadas(tablero, hoy);
  const abiertas = tablero.postulaciones
    .filter((f) => !T.ESTADOS_CERRADOS.includes(f.estado)).length;

  if (!tablero.postulaciones.length) {
    console.log(`\n  El tablero está vacío.`);
    console.log(`  Se llena solo cuando marcas vacantes con «s» en:`);
    console.log(`    node herramientas/vacantes.mjs mis-vacantes.txt\n`);
    return;
  }

  console.log(`\n  ${c.fuerte('POSTULA — tablero')}   ${c.tenue(hoy)}`);
  console.log(`  ${abiertas} postulación(es) abiertas de ${tablero.postulaciones.length}.`);

  if (pendientes.length) {
    console.log(`\n  ${c.fuerte('Para hoy:')}`);
    pendientes.forEach(({ fila, dias }) => {
      console.log('');
      console.log(unaLinea(fila));
      console.log(`     ${T.ESTADOS[fila.estado].etiqueta} · ${pintarAtraso(dias)}`);
      if (fila.enlace) console.log(`     ${fila.enlace}`);
    });
  } else {
    console.log(`\n  ${c.verde('Nada vencido para hoy.')}`);
  }

  if (quedadas.length) {
    console.log(`\n  ${c.tenue('Sin noticias hace más de 3 semanas:')}`);
    quedadas.forEach(({ fila, dias }) => {
      console.log(`   · ${fila.titulo} — ${fila.empresa} ${c.tenue(`(${dias} días)`)}`);
      console.log(`     ${c.tenue(`node herramientas/tablero.mjs estado ${fila.id} sinRespuesta`)}`);
    });
  }

  const conteo = T.resumen(tablero).filter((r) => r.cuantas > 0);
  console.log(`\n  ${conteo.map((r) => `${r.etiqueta}: ${c.fuerte(String(r.cuantas))}`).join('  ·  ')}\n`);
}

function listar(tablero, todas) {
  const filas = tablero.postulaciones
    .filter((f) => todas || !T.ESTADOS_CERRADOS.includes(f.estado))
    .sort((a, b) => T.ESTADOS[a.estado].orden - T.ESTADOS[b.estado].orden);

  if (!filas.length) {
    console.log('\n  No hay postulaciones que mostrar.\n');
    return;
  }
  console.log('');
  filas.forEach((fila) => {
    console.log(unaLinea(fila));
    const partes = [T.ESTADOS[fila.estado].etiqueta];
    if (fila.postulada) partes.push(`postulada ${fila.postulada}`);
    if (fila.proximoSeguimiento) partes.push(`seguimiento ${fila.proximoSeguimiento}`);
    if (Number.isFinite(fila.puntaje)) partes.push(`${fila.puntaje}% de match`);
    console.log(`     ${partes.join(' · ')}`);
    const ultima = fila.historial[fila.historial.length - 1];
    if (ultima) console.log(`     ${c.tenue(`${ultima.fecha} — ${ultima.texto}`)}`);
    console.log('');
  });
}

// --- Entrada ---------------------------------------------------------------

function opciones(argv) {
  const o = { orden: '', posicionales: [], archivo: ARCHIVO_POR_DEFECTO,
    todas: false, ayuda: false, campos: {}, nota: '' };
  const CAMPOS = ['titulo', 'empresa', 'enlace', 'salario', 'modalidad', 'ubicacion'];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ayuda' || arg === '-h' || arg === '--help') o.ayuda = true;
    else if (arg === '--todas') o.todas = true;
    else if (arg === '--archivo') { o.archivo = argv[i + 1] || o.archivo; i += 1; }
    else if (arg === '--nota') { o.nota = argv[i + 1] || ''; i += 1; }
    else if (arg.startsWith('--') && CAMPOS.includes(arg.slice(2))) {
      o.campos[arg.slice(2)] = argv[i + 1] || '';
      i += 1;
    } else if (!arg.startsWith('-')) {
      if (!o.orden) o.orden = arg;
      else o.posicionales.push(arg);
    }
  }
  return o;
}

function main() {
  const o = opciones(process.argv.slice(2));
  if (o.ayuda) { console.log(AYUDA); return; }

  const hoy = hoyISO();
  let tablero = leer(o.archivo);

  if (!o.orden) { vistaDeHoy(tablero, hoy); return; }

  if (o.orden === 'listar') { listar(tablero, o.todas); return; }

  if (o.orden === 'agregar') {
    if (!o.campos.titulo && !o.campos.empresa) {
      console.error('\n  Para agregar hace falta al menos --titulo o --empresa.\n');
      process.exit(1);
    }
    const { tablero: nuevo, fila, yaEstaba } = T.agregar(tablero, o.campos, hoy);
    guardar(o.archivo, nuevo);
    console.log(`\n  ${yaEstaba ? 'Ya estaba registrada' : c.verde('Registrada')}: ${fila.titulo} — ${fila.empresa}`);
    console.log(`  ${c.tenue(fila.id)}\n`);
    return;
  }

  const [id, valor] = o.posicionales;
  if (!id) {
    console.error(`\n  A «${o.orden}» le falta el identificador de la postulación.`);
    console.error('  Los ves con: node herramientas/tablero.mjs listar\n');
    process.exit(1);
  }

  let resultado = null;
  if (o.orden === 'estado') resultado = T.cambiarEstado(tablero, id, valor, hoy, o.nota);
  else if (o.orden === 'nota') resultado = T.agregarNota(tablero, id, valor, hoy);
  else if (o.orden === 'seguimiento') resultado = T.fijarSeguimiento(tablero, id, valor, hoy);
  else {
    console.error(`\n  No conozco la orden «${o.orden}». Usa --ayuda.\n`);
    process.exit(1);
  }

  if (resultado.error) {
    console.error(`\n  ${resultado.error}\n`);
    process.exit(1);
  }
  guardar(o.archivo, resultado.tablero);
  const fila = resultado.fila;
  console.log(`\n  ${c.verde('Listo')}: ${fila.titulo} — ${fila.empresa}`);
  console.log(`  ${T.ESTADOS[fila.estado].etiqueta}`
    + (fila.proximoSeguimiento ? ` · próximo seguimiento ${fila.proximoSeguimiento}` : '') + '\n');
}

main();
