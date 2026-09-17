#!/usr/bin/env node
/**
 * POSTULA — Hoja de vida en PDF → Perfil Único.
 *
 *   node herramientas/hv-a-perfil.mjs mi-hoja-de-vida.pdf
 *
 * Deja un JSON que se importa desde la página de Perfil de la extensión.
 * El archivo tiene datos personales: vive en el equipo de la persona y
 * `.gitignore` lo mantiene fuera del repositorio.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { extraerTexto } from './lib/pdf-texto.mjs';
import { aPerfil } from './lib/hoja-de-vida.mjs';
import { Perfil } from './lib/esquema.mjs';

const AYUDA = `
POSTULA — de tu hoja de vida al Perfil Único

  node herramientas/hv-a-perfil.mjs <hoja-de-vida.pdf> [opciones]

Opciones
  --salida <archivo>   Dónde escribir el perfil (por defecto: mi-perfil-postula.json)
  --texto              Muestra el texto extraído del PDF y no escribe nada
  --ayuda              Esta ayuda

Después: abre POSTULA → Perfil → Importar, y escoge el archivo generado.
Revisa siempre lo que quedó antes de usarlo: lo que la hoja de vida no dice,
queda vacío a propósito.
`;

function opciones(argv) {
  const salida = { archivo: '', destino: 'mi-perfil-postula.json', soloTexto: false, ayuda: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ayuda' || arg === '-h' || arg === '--help') salida.ayuda = true;
    else if (arg === '--texto') salida.soloTexto = true;
    else if (arg === '--salida') { salida.destino = argv[i + 1] || salida.destino; i += 1; }
    else if (!arg.startsWith('-') && !salida.archivo) salida.archivo = arg;
  }
  return salida;
}

function textoDeArchivo(ruta) {
  const datos = readFileSync(ruta);
  if (extname(ruta).toLowerCase() === '.pdf') {
    const { texto, aviso } = extraerTexto(datos);
    if (aviso) {
      console.error(`\n  No se pudo leer el PDF: ${aviso}`);
      console.error('  Copia el texto de tu hoja de vida a un archivo .txt y pásalo en su lugar.\n');
      process.exit(1);
    }
    return texto;
  }
  return datos.toString('utf8');
}

function main() {
  const opc = opciones(process.argv.slice(2));
  if (opc.ayuda || !opc.archivo) {
    console.log(AYUDA);
    process.exit(opc.ayuda ? 0 : 1);
  }

  const texto = textoDeArchivo(opc.archivo);
  if (opc.soloTexto) {
    console.log(texto);
    return;
  }

  const { perfil, encontrados, vacios } = aPerfil(texto);
  const etiquetas = new Map();
  Perfil.GRUPOS.forEach((grupo) => {
    grupo.campos.forEach((campo) => etiquetas.set(campo.id, campo.etiqueta));
  });

  console.log(`\n  POSTULA — ${basename(opc.archivo)}\n`);
  console.log(`  Se llenaron ${encontrados.length} campos desde la hoja de vida:`);
  encontrados.forEach((id) => {
    const valor = String(perfil[id]).replace(/\s+/g, ' ');
    const corto = valor.length > 58 ? `${valor.slice(0, 55)}...` : valor;
    console.log(`    · ${(etiquetas.get(id) || id).padEnd(28)} ${corto}`);
  });

  console.log(`\n  Experiencia laboral: ${perfil.experiencia.length} cargos`);
  perfil.experiencia.forEach((e) => {
    console.log(`    · ${e.cargo} — ${e.empresa} (${e.desde} a ${e.hasta})`);
  });
  if (perfil.idiomas.length) {
    console.log(`\n  Idiomas: ${perfil.idiomas.map((i) => i.idioma).join(', ')}`);
  }

  console.log(`\n  Quedaron ${vacios.length} campos vacíos porque la hoja de vida no los dice.`);
  console.log(`  Los llenas una sola vez en la página de Perfil:`);
  console.log(`    ${vacios.map((id) => etiquetas.get(id) || id).join(', ')}`);

  const errores = Perfil.validar(perfil);
  if (errores.length) {
    console.log('\n  Falta algo importante antes de que el autorrelleno sirva:');
    errores.forEach((e) => console.log(`    · ${e}`));
  }

  writeFileSync(opc.destino, `${JSON.stringify(perfil, null, 2)}\n`, 'utf8');
  console.log(`\n  Perfil escrito en ${opc.destino}`);
  console.log('  Ese archivo tiene tus datos personales: no lo subas a ningún repositorio.');
  console.log('  Ábrelo en POSTULA → Perfil → Importar.\n');
}

main();
