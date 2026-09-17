/**
 * CANDADO — Leer la hoja de vida de la persona, sin instalarle nada.
 *
 * El extractor tiene que sacar el texto de los PDF que la gente realmente
 * tiene, no de un PDF ideal. Los dos casos que importan son la fuente simple
 * de un byte (Word, LibreOffice, imprimir desde el navegador) y la fuente
 * compuesta subsetada con ToUnicode (WeasyPrint, Canva, Chrome), donde los
 * bytes del contenido son identificadores de glifo y el texto solo se
 * recupera con el mapa de la fuente.
 *
 * Y cuando el PDF no se puede leer —un escaneo, por ejemplo— tiene que
 * decirlo. Devolver una cadena vacía en silencio haría que la herramienta
 * escribiera un perfil vacío como si eso fuera el resultado correcto.
 */
import { contrato } from './ayuda.mjs';
import { construirPdf } from './pdf/constructor.mjs';
import { extraerTexto } from '../herramientas/lib/pdf-texto.mjs';

const c = contrato('pdf-contract');

const PAGINAS = [
  ['ANDREA GÓMEZ RUIZ', 'ANALISTA DE SOPORTE TÉCNICO', 'Correo: andrea@ejemplo.com'],
  ['EXPERIENCIA LABORAL', 'Mesa de ayuda — Ejemplo SAS', 'Enero 2020 – Marzo 2023']
];

// --- 1. Las tres formas reales de escribir un PDF se leen igual ---
const FORMAS = [
  ['fuente simple de un byte', {}],
  ['fuente compuesta con ToUnicode', { cid: true }],
  ['fuente compuesta y flujos comprimidos', { cid: true, comprimir: true }],
  ['fuente simple y flujos comprimidos', { comprimir: true }]
];

FORMAS.forEach(([nombre, opciones]) => {
  const { texto, paginas, aviso } = extraerTexto(construirPdf(PAGINAS, opciones));
  c.exigir(aviso === null, `${nombre}: no debía avisar de error, avisó «${aviso}»`);
  c.igual(paginas.length, 2, `${nombre}: se perdieron páginas`);
  PAGINAS.flat().forEach((renglon) => {
    c.exigir(texto.includes(renglon), `${nombre}: falta el renglón «${renglon}»`);
  });
});

// --- 2. Las tildes y la eñe sobreviven ---
const conAcentos = extraerTexto(construirPdf([['Gestión de contenido: ñandú, áéíóú, ü']], { cid: true }));
c.exigir(conAcentos.texto.includes('ñandú, áéíóú, ü'),
  'los acentos y la eñe deben sobrevivir al mapa ToUnicode');

// --- 3. El orden de los renglones y de las páginas se respeta ---
const ordenado = extraerTexto(construirPdf([['uno', 'dos', 'tres'], ['cuatro']], { cid: true }));
c.igual(ordenado.texto.split('\n'), ['uno', 'dos', 'tres', 'cuatro'],
  'los renglones deben salir en el orden en que se leen');

// --- 4. Lo ilegible se reporta, no se devuelve vacío en silencio ---
const noEsPdf = extraerTexto(Buffer.from('esto es un .docx disfrazado', 'utf8'));
c.exigir(noEsPdf.aviso !== null, 'un archivo que no es PDF debe avisar');
c.igual(noEsPdf.texto, '', 'un archivo que no es PDF no debe inventar texto');

// Un PDF con páginas pero sin ninguna operación de texto: es un escaneo.
const soloImagen = construirPdf([[]], {});
const escaneado = extraerTexto(soloImagen);
c.exigir(escaneado.aviso !== null,
  'un PDF sin capa de texto debe avisar que probablemente es un escaneo');

// --- 5. Una fuente compuesta sin ToUnicode no se adivina ---
// Sin el mapa, los bytes son glifos: traducirlos como si fueran letras
// produciría texto falso, y ese texto terminaría en el perfil de la persona.
const sinMapa = construirPdf([['texto']], { cid: true })
  .toString('latin1')
  .replace('/ToUnicode 4 0 R', '                 ');
const ilegible = extraerTexto(Buffer.from(sinMapa, 'latin1'));
c.exigir(!/[a-z]{3}/.test(ilegible.texto),
  'sin ToUnicode no se puede adivinar el texto: mejor nada que texto falso');
c.exigir(ilegible.aviso !== null, 'sin ToUnicode legible hay que avisar');

c.cerrar();
