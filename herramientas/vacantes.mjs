#!/usr/bin/env node
/**
 * POSTULA — Filtra, puntúa y ordena las vacantes que la persona recogió.
 *
 *   node herramientas/vacantes.mjs vacantes.txt --perfil mi-perfil-postula.json
 *
 * Qué hace y qué no:
 *
 *   sí — descarta lo que no cumple los criterios, calcula compatibilidad
 *        contra la hoja de vida, ordena y explica cada puntaje;
 *   no — entrar a los portales a buscar vacantes, ni iniciar sesión, ni
 *        enviar una postulación. Cuando la persona dice que sí, la
 *        herramienta le entrega el enlace; ella abre, revisa y envía.
 *
 * No es una limitación técnica: es la arquitectura del producto
 * (AGENTS.md §2 y §4). Un robot que postula solo consigue que bloqueen la
 * cuenta y manda postulaciones que ningún reclutador lee.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { leerVacantes } from './lib/vacantes.mjs';
import { CRITERIOS_POR_DEFECTO, evaluar, moneda } from './lib/criterios.mjs';
import { calcular } from './lib/puntaje.mjs';
import { Perfil } from './lib/esquema.mjs';
import * as Tablero from './lib/tablero.mjs';

const AYUDA = `
POSTULA — revisión de vacantes

  node herramientas/vacantes.mjs <vacantes.txt|vacantes.json> [opciones]

Opciones
  --perfil <archivo>      Perfil exportado de POSTULA (por defecto: mi-perfil-postula.json)
  --criterios <archivo>   JSON con tus filtros; si no, usa los de por defecto
  --minimo <pesos>        Salario mínimo aceptable (por defecto: 2500000)
  --descartadas           Muestra también las que no pasaron el filtro y por qué
  --reporte               Solo imprime el informe, sin preguntar nada
  --tablero <archivo>     Dónde registrar lo que marques (por defecto: mis-postulaciones.json)
  --sin-tablero           No registrar nada
  --ayuda                 Esta ayuda

El archivo de vacantes se arma a mano con lo que llega a tu correo desde las
alertas de los portales. Formato de texto, separando cada aviso con ---:

  Cargo: Analista de Mesa de Ayuda
  Empresa: Ejemplo SAS
  Salario: $3.200.000
  Modalidad: Remoto
  Enlace: https://...
  Descripción: Atención de incidentes en primer y segundo nivel...
  ---
`;

function opciones(argv) {
  const o = { archivo: '', perfil: 'mi-perfil-postula.json', criterios: '',
    minimo: null, descartadas: false, reporte: false, ayuda: false,
    tablero: 'mis-postulaciones.json', sinTablero: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ayuda' || arg === '-h' || arg === '--help') o.ayuda = true;
    else if (arg === '--descartadas') o.descartadas = true;
    else if (arg === '--reporte') o.reporte = true;
    else if (arg === '--sin-tablero') o.sinTablero = true;
    else if (arg === '--tablero') { o.tablero = argv[i + 1] || o.tablero; i += 1; }
    else if (arg === '--perfil') { o.perfil = argv[i + 1] || o.perfil; i += 1; }
    else if (arg === '--criterios') { o.criterios = argv[i + 1] || ''; i += 1; }
    else if (arg === '--minimo') { o.minimo = Number(argv[i + 1]); i += 1; }
    else if (!arg.startsWith('-') && !o.archivo) o.archivo = arg;
  }
  return o;
}

/** Colores solo si la terminal los admite; si no, texto pelado. */
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  tenue: (t) => (color ? `\x1b[2m${t}\x1b[0m` : t),
  fuerte: (t) => (color ? `\x1b[1m${t}\x1b[0m` : t),
  verde: (t) => (color ? `\x1b[32m${t}\x1b[0m` : t),
  amarillo: (t) => (color ? `\x1b[33m${t}\x1b[0m` : t),
  rojo: (t) => (color ? `\x1b[31m${t}\x1b[0m` : t)
};

function pintarPuntaje(puntaje) {
  const texto = `${String(puntaje).padStart(3)}%`;
  if (puntaje >= 70) return c.verde(c.fuerte(texto));
  if (puntaje >= 45) return c.amarillo(texto);
  return c.tenue(texto);
}

function tarjeta(item, indice, total) {
  const { vacante, filtro, puntuacion } = item;
  const NOMBRE_MODALIDAD = { remoto: 'Remoto', hibrido: 'Híbrido', presencial: 'Presencial' };
  const linea = [
    vacante.empresa,
    NOMBRE_MODALIDAD[filtro.modalidad] || 'Modalidad sin decir',
    filtro.salario.publicado ? moneda(filtro.salario.maximo) : 'Salario sin publicar',
    vacante.ubicacion
  ].filter(Boolean).join(' · ');

  const partes = [];
  partes.push('');
  partes.push(`  ${pintarPuntaje(puntuacion.puntaje)}  ${c.fuerte(vacante.titulo)}  ${c.tenue(`(${indice}/${total})`)}`);
  partes.push(`       ${c.tenue(linea)}`);
  puntuacion.razones.forEach((razon) => partes.push(`       ${razon}`));
  filtro.avisos.forEach((aviso) => partes.push(`       ${c.amarillo('⚠')} ${aviso}`));
  if (vacante.enlace) partes.push(`       ${vacante.enlace}`);
  return partes.join('\n');
}

function preguntar(rl, texto) {
  return new Promise((resolver) => rl.question(texto, (respuesta) => resolver(respuesta.trim().toLowerCase())));
}

async function revisar(aprobadas) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const escogidas = [];

  for (let i = 0; i < aprobadas.length; i += 1) {
    console.log(tarjeta(aprobadas[i], i + 1, aprobadas.length));
    const respuesta = await preguntar(rl, '       ¿Te interesa esta vacante? (s/n/q para salir) ');
    if (respuesta === 'q' || respuesta === 'salir') break;
    if (respuesta === 's' || respuesta === 'si' || respuesta === 'sí') {
      escogidas.push(aprobadas[i]);
      console.log(c.verde('       ✓ Anotada.'));
    }
  }
  rl.close();
  return escogidas;
}

/**
 * Deja las vacantes marcadas en el tablero, como «por postular».
 *
 * Se registran aquí y no al final del proceso porque el momento en que la
 * persona dice «esta sí» es el único en que tiene el contexto fresco; si hay
 * que acordarse de anotarlas después, no se anotan.
 */
function registrarEnTablero(escogidas, ruta) {
  let tablero = Tablero.tableroVacio();
  if (existsSync(ruta)) {
    try {
      tablero = Tablero.sanear(JSON.parse(readFileSync(ruta, 'utf8')));
    } catch (error) {
      console.error(`\n  ${c.amarillo('Aviso')}: el tablero ${ruta} no se pudo leer `
        + `(${error.message}); no se registró nada para no dañarlo.\n`);
      return { nuevas: 0, repetidas: 0 };
    }
  }

  const hoy = Tablero.aFecha(new Date());
  let nuevas = 0;
  let repetidas = 0;
  escogidas.forEach(({ vacante, puntuacion }) => {
    const resultado = Tablero.agregar(
      tablero, { ...vacante, puntaje: puntuacion.puntaje }, hoy
    );
    tablero = resultado.tablero;
    if (resultado.yaEstaba) repetidas += 1; else nuevas += 1;
  });

  writeFileSync(ruta, `${JSON.stringify(tablero, null, 2)}\n`, 'utf8');
  return { nuevas, repetidas };
}

function despedida(escogidas, opcionesTablero) {
  if (!escogidas.length) {
    console.log('\n  No escogiste ninguna vacante esta vez.\n');
    return;
  }
  console.log(`\n  ${c.fuerte(`${escogidas.length} vacante(s) para postularte:`)}\n`);
  escogidas.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.vacante.titulo} — ${item.vacante.empresa}`);
    if (item.vacante.enlace) console.log(`      ${item.vacante.enlace}`);
  });
  if (opcionesTablero && !opcionesTablero.sinTablero) {
    const { nuevas, repetidas } = registrarEnTablero(escogidas, opcionesTablero.tablero);
    const partes = [];
    if (nuevas) partes.push(`${nuevas} nueva(s)`);
    if (repetidas) partes.push(`${repetidas} ya estaba(n)`);
    if (partes.length) {
      console.log(`\n  Anotadas en ${opcionesTablero.tablero}: ${partes.join(', ')}.`);
      console.log(c.tenue('  Míralas con: node herramientas/tablero.mjs'));
    }
  }

  console.log(`
  Para cada una: abre el enlace, entra al formulario de postulación y dale
  al botón de POSTULA para llenar tus datos. Revisa lo que quedó escrito y
  ${c.fuerte('envía tú')} la postulación.

  Cuando la hayas enviado, márcala:
  ${c.tenue('  node herramientas/tablero.mjs estado <id> postulado')}

  ${c.tenue('POSTULA no envía formularios: quien manda la postulación eres tú.')}
`);
}

async function main() {
  const o = opciones(process.argv.slice(2));
  if (o.ayuda || !o.archivo) {
    console.log(AYUDA);
    process.exit(o.ayuda ? 0 : 1);
  }

  if (!existsSync(o.archivo)) {
    console.error(`\n  No encuentro el archivo de vacantes: ${o.archivo}\n`);
    process.exit(1);
  }

  let perfil = Perfil.perfilVacio();
  if (existsSync(o.perfil)) {
    perfil = Perfil.sanear(JSON.parse(readFileSync(o.perfil, 'utf8')));
  } else {
    console.error(`\n  ${c.amarillo('No encuentro el perfil')} en ${o.perfil}.`);
    console.error('  Genéralo con: node herramientas/hv-a-perfil.mjs tu-hoja-de-vida.pdf');
    console.error('  Sin perfil se puede filtrar, pero no calcular compatibilidad.\n');
  }

  const criterios = { ...CRITERIOS_POR_DEFECTO };
  if (o.criterios && existsSync(o.criterios)) {
    Object.assign(criterios, JSON.parse(readFileSync(o.criterios, 'utf8')));
  }
  if (Number.isFinite(o.minimo) && o.minimo > 0) criterios.salarioMinimo = o.minimo;

  const vacantes = leerVacantes(readFileSync(o.archivo, 'utf8'));
  if (!vacantes.length) {
    console.error('\n  El archivo no tiene vacantes que pueda leer. Revisa el formato con --ayuda.\n');
    process.exit(1);
  }

  const evaluadas = vacantes.map((vacante) => {
    const filtro = evaluar(vacante, criterios);
    return { vacante, filtro, puntuacion: calcular(vacante, perfil, criterios) };
  });

  const aprobadas = evaluadas.filter((i) => i.filtro.pasa)
    .sort((a, b) => b.puntuacion.puntaje - a.puntuacion.puntaje);
  const descartadas = evaluadas.filter((i) => !i.filtro.pasa);

  console.log(`\n  POSTULA — ${vacantes.length} vacantes leídas, `
    + `${c.fuerte(String(aprobadas.length))} pasan tus filtros, ${descartadas.length} descartadas.`);
  console.log(c.tenue(`  Filtros: desde ${moneda(criterios.salarioMinimo)} · `
    + `${criterios.modalidades.join(', ')} · presencial solo en ${criterios.ciudadesPresenciales.join(', ')}`));

  if (o.descartadas && descartadas.length) {
    console.log(`\n  ${c.tenue('Descartadas:')}`);
    descartadas.forEach((i) => {
      console.log(`   ${c.rojo('✗')} ${i.vacante.titulo} — ${c.tenue(i.filtro.descartes.join('; '))}`);
    });
  }

  if (!aprobadas.length) {
    console.log('\n  Ninguna vacante pasó los filtros. Usa --descartadas para ver por qué.\n');
    return;
  }

  if (o.reporte || !process.stdin.isTTY) {
    aprobadas.forEach((item, i) => console.log(tarjeta(item, i + 1, aprobadas.length)));
    console.log('');
    return;
  }

  despedida(await revisar(aprobadas), { tablero: o.tablero, sinTablero: o.sinTablero });
}

main().catch((error) => {
  console.error(`\n  Algo falló: ${error.message}\n`);
  process.exit(1);
});
