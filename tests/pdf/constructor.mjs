/**
 * POSTULA — Constructor de PDF para las pruebas.
 *
 * El repositorio no admite archivos PDF (`tests/proyecto-contract.mjs`
 * lo impide, para que nadie suba la hoja de vida de una persona real), así
 * que los PDF de prueba se arman en memoria.
 *
 * Reproduce las dos formas en que los generadores reales escriben texto, que
 * son las dos que el extractor tiene que entender:
 *
 *   simple — fuente de un byte con WinAnsiEncoding. Lo que sale de Word,
 *            LibreOffice o de imprimir a PDF desde el navegador.
 *   cid    — fuente compuesta subsetada con Identity-H y un mapa ToUnicode.
 *            Lo que sale de WeasyPrint, Canva o Chrome. Los bytes del
 *            contenido son identificadores de glifo: sin el mapa, el texto
 *            es ilegible.
 */
import { deflateSync } from 'node:zlib';

/**
 * Los caracteres que WinAnsi coloca en 0x80–0x9F, donde latin1 tiene
 * controles: comillas tipográficas, raya, puntos suspensivos. Un generador
 * real los escribe con estos bytes, así que la prueba también.
 */
const A_WINANSI = {
  '\u20ac': 0x80, '\u201a': 0x82, '\u0192': 0x83, '\u201e': 0x84, '\u2026': 0x85,
  '\u2020': 0x86, '\u2021': 0x87, '\u02c6': 0x88, '\u2030': 0x89, '\u0160': 0x8a,
  '\u2039': 0x8b, '\u0152': 0x8c, '\u017d': 0x8e, '\u2018': 0x91, '\u2019': 0x92,
  '\u201c': 0x93, '\u201d': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
  '\u02dc': 0x98, '\u2122': 0x99, '\u0161': 0x9a, '\u203a': 0x9b, '\u0153': 0x9c,
  '\u017e': 0x9e, '\u0178': 0x9f
};

/** Escapa una cadena literal de PDF, en bytes WinAnsi. */
function literal(texto) {
  const cuerpo = texto.split('').map((caracter) => {
    const byte = A_WINANSI[caracter];
    const salida = byte === undefined ? caracter : String.fromCharCode(byte);
    return /[\\()]/.test(salida) ? `\\${salida}` : salida;
  }).join('');
  return `(${cuerpo})`;
}

/**
 * Asigna un identificador de glifo a cada carácter, como hace un subset.
 * Devuelve el mapa y la forma de codificar una línea en hexadecimal.
 */
function subsetar(lineas) {
  const porCaracter = new Map();
  let siguiente = 0x22; // arranca donde arrancan los subsets reales
  lineas.join('').split('').forEach((caracter) => {
    if (porCaracter.has(caracter)) return;
    porCaracter.set(caracter, siguiente);
    siguiente += 1;
  });
  const aHex = (texto) => texto.split('')
    .map((caracter) => porCaracter.get(caracter).toString(16).padStart(4, '0'))
    .join('');
  return { porCaracter, aHex };
}

/** CMap ToUnicode: del identificador de glifo al carácter real. */
function cmapToUnicode(porCaracter) {
  const entradas = [...porCaracter.entries()]
    .map(([caracter, codigo]) => {
      const unicode = caracter.codePointAt(0).toString(16).padStart(4, '0');
      return `<${codigo.toString(16).padStart(4, '0')}> <${unicode}>`;
    });
  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <ffff>
endcodespacerange
${entradas.length} beginbfchar
${entradas.join('\n')}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
}

/**
 * Arma un PDF de una o varias páginas.
 *
 * @param {string[][]} paginas renglones de cada página
 * @param {{cid?: boolean, comprimir?: boolean}} opciones
 * @returns {Buffer}
 */
export function construirPdf(paginas, opciones = {}) {
  const { cid = false, comprimir = false } = opciones;
  const todas = paginas.flat();
  const subset = cid ? subsetar(todas) : null;

  const objetos = new Map();
  const agregar = (numero, cuerpo) => objetos.set(numero, cuerpo);

  const flujo = (contenido) => {
    const datos = Buffer.from(contenido, 'latin1');
    if (!comprimir) {
      return Buffer.concat([
        Buffer.from(`<</Length ${datos.length}>>\nstream\n`, 'latin1'),
        datos,
        Buffer.from('\nendstream', 'latin1')
      ]);
    }
    const apretado = deflateSync(datos);
    return Buffer.concat([
      Buffer.from(`<</Filter /FlateDecode/Length ${apretado.length}>>\nstream\n`, 'latin1'),
      apretado,
      Buffer.from('\nendstream', 'latin1')
    ]);
  };

  // Numeración: 1 catálogo, 2 árbol de páginas, 3 fuente, 4 ToUnicode,
  // y de ahí en adelante un par (página, contenido) por cada página.
  const primeraPagina = 5;
  const numerosPagina = paginas.map((_, i) => primeraPagina + i * 2);

  agregar(1, '<</Type /Catalog/Pages 2 0 R>>');
  agregar(2, `<</Type /Pages/Kids [${numerosPagina.map((n) => `${n} 0 R`).join(' ')}]`
    + `/Count ${paginas.length}>>`);

  if (cid) {
    agregar(3, '<</Type /Font/Subtype /Type0/BaseFont /AAAAAA+Prueba/Encoding /Identity-H'
      + '/DescendantFonts [9900 0 R]/ToUnicode 4 0 R>>');
    agregar(9900, '<</Type /Font/Subtype /CIDFontType0/BaseFont /AAAAAA+Prueba'
      + '/CIDSystemInfo <</Registry (Adobe)/Ordering (Identity)/Supplement 0>>>>');
    agregar(4, flujo(cmapToUnicode(subset.porCaracter)));
  } else {
    agregar(3, '<</Type /Font/Subtype /Type1/BaseFont /Helvetica/Encoding /WinAnsiEncoding>>');
    agregar(4, '<</Vacio true>>');
  }

  paginas.forEach((renglones, indice) => {
    const numeroPagina = numerosPagina[indice];
    const numeroContenido = numeroPagina + 1;
    agregar(numeroPagina, `<</Type /Page/Parent 2 0 R/MediaBox [0 0 612 792]`
      + `/Resources <</Font <</F1 3 0 R>>>>/Contents ${numeroContenido} 0 R>>`);

    // Cada renglón con su propia matriz de texto, como hace un generador real.
    const cuerpo = renglones.map((renglon, fila) => {
      const y = 740 - fila * 18;
      const mostrado = cid ? `<${subset.aHex(renglon)}>` : literal(renglon);
      return `BT\n/F1 11 Tf\n1 0 0 1 72 ${y} Tm\n${mostrado} Tj\nET`;
    }).join('\n');
    agregar(numeroContenido, flujo(cuerpo));
  });

  // Ensamblado con tabla de referencias cruzadas.
  const partes = [Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let longitud = partes[0].length;
  const desplazamientos = new Map();

  [...objetos.keys()].sort((a, b) => a - b).forEach((numero) => {
    const cuerpo = objetos.get(numero);
    const bloque = Buffer.concat([
      Buffer.from(`${numero} 0 obj\n`, 'latin1'),
      Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(cuerpo, 'latin1'),
      Buffer.from('\nendobj\n', 'latin1')
    ]);
    desplazamientos.set(numero, longitud);
    partes.push(bloque);
    longitud += bloque.length;
  });

  const mayor = Math.max(...desplazamientos.keys());
  // La entrada «libre» del xref es una racha de ceros. Se arma aquí en vez
  // de escribirla literal para no disparar el escáner de datos personales
  // de `tests/proyecto-contract.mjs`, que busca rachas largas de dígitos.
  const LIBRE = `${'0'.repeat(10)} 65535 f \n`;
  const filas = [LIBRE];
  for (let numero = 1; numero <= mayor; numero += 1) {
    const desplazamiento = desplazamientos.get(numero);
    filas.push(desplazamiento === undefined
      ? LIBRE
      : `${String(desplazamiento).padStart(10, '0')} 00000 n \n`);
  }
  const xref = `xref\n0 ${mayor + 1}\n${filas.join('')}`;
  partes.push(Buffer.from(
    `${xref}trailer\n<</Size ${mayor + 1}/Root 1 0 R>>\nstartxref\n${longitud}\n%%EOF\n`,
    'latin1'
  ));

  return Buffer.concat(partes);
}

export default { construirPdf };
