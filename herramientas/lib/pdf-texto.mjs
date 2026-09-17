/**
 * POSTULA — Extractor de texto de PDF, sin dependencias.
 *
 * Existe porque la hoja de vida del usuario es un PDF y POSTULA no puede
 * pedirle que instale nada para leerla. Node trae `zlib`, que es lo único
 * que hace falta: en un PDF el texto vive en flujos comprimidos con
 * FlateDecode.
 *
 * No es un lector de PDF completo y no pretende serlo. Cubre las dos formas
 * en que los generadores reales escriben una hoja de vida:
 *
 *   1. Fuentes simples con codificación de un byte (Word, LibreOffice,
 *      impresión del navegador): el byte ya es el carácter.
 *   2. Fuentes CID subsetadas con `/ToUnicode` (WeasyPrint, Canva, Chrome):
 *      el byte es un identificador de glifo y solo el mapa `ToUnicode` de esa
 *      fuente dice qué carácter era.
 *
 * Lo que no cubre —PDF escaneado sin capa de texto, cifrado, o fuentes CID
 * sin `ToUnicode`— se detecta y se reporta como tal, para que la herramienta
 * pida el texto por otra vía en vez de entregar basura.
 */
import { inflateSync, inflateRawSync, unzipSync } from 'node:zlib';

// --- Lector de objetos PDF -------------------------------------------------

const ESPACIO = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIMITADOR = new Set('()<>[]{}/%'.split('').map((c) => c.charCodeAt(0)));

/** Referencia a otro objeto del documento: `12 0 R`. */
class Ref {
  constructor(numero) { this.numero = numero; }
}

/** Flujo: su diccionario más los bytes crudos, todavía comprimidos. */
class Flujo {
  constructor(dic, crudo) { this.dic = dic; this.crudo = crudo; }
}

/**
 * Analizador de la sintaxis de objetos PDF sobre un Buffer.
 * Trabaja en latin1 porque a este nivel el PDF son bytes, no texto.
 */
class Lector {
  constructor(buffer, posicion = 0) {
    this.b = buffer;
    this.i = posicion;
  }

  finDeDatos() { return this.i >= this.b.length; }

  saltarBlancos() {
    while (this.i < this.b.length) {
      const c = this.b[this.i];
      if (ESPACIO.has(c)) { this.i += 1; continue; }
      if (c === 0x25) { // comentario % hasta fin de línea
        while (this.i < this.b.length && this.b[this.i] !== 0x0a && this.b[this.i] !== 0x0d) this.i += 1;
        continue;
      }
      break;
    }
  }

  /** Lee el siguiente objeto. Devuelve `undefined` al agotar los datos. */
  leer() {
    this.saltarBlancos();
    if (this.finDeDatos()) return undefined;
    const c = this.b[this.i];

    if (c === 0x2f) return this.leerNombre();
    if (c === 0x28) return this.leerCadenaLiteral();
    if (c === 0x5b) return this.leerArreglo();
    if (c === 0x3c) {
      if (this.b[this.i + 1] === 0x3c) return this.leerDiccionario();
      return this.leerCadenaHex();
    }
    if (c === 0x5d || c === 0x3e || c === 0x7d || c === 0x29) { // cierre suelto
      this.i += 1;
      return this.leer();
    }
    return this.leerSimbolo();
  }

  leerNombre() {
    this.i += 1; // '/'
    let salida = '';
    while (this.i < this.b.length) {
      const c = this.b[this.i];
      if (ESPACIO.has(c) || DELIMITADOR.has(c)) break;
      if (c === 0x23 && this.i + 2 < this.b.length) { // #XX escapado
        const hex = this.b.slice(this.i + 1, this.i + 3).toString('latin1');
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          salida += String.fromCharCode(parseInt(hex, 16));
          this.i += 3;
          continue;
        }
      }
      salida += String.fromCharCode(c);
      this.i += 1;
    }
    return { nombre: salida };
  }

  leerCadenaLiteral() {
    this.i += 1; // '('
    const bytes = [];
    let profundidad = 1;
    while (this.i < this.b.length) {
      let c = this.b[this.i];
      if (c === 0x5c) { // barra invertida
        this.i += 1;
        c = this.b[this.i];
        const escapes = { 0x6e: 0x0a, 0x72: 0x0d, 0x74: 0x09, 0x62: 0x08, 0x66: 0x0c };
        if (escapes[c] !== undefined) { bytes.push(escapes[c]); this.i += 1; continue; }
        if (c >= 0x30 && c <= 0x37) { // octal de hasta 3 dígitos
          let octal = '';
          while (octal.length < 3 && this.b[this.i] >= 0x30 && this.b[this.i] <= 0x37) {
            octal += String.fromCharCode(this.b[this.i]);
            this.i += 1;
          }
          bytes.push(parseInt(octal, 8) & 0xff);
          continue;
        }
        if (c === 0x0a) { this.i += 1; continue; } // corte de línea escapado
        bytes.push(c);
        this.i += 1;
        continue;
      }
      if (c === 0x28) profundidad += 1;
      if (c === 0x29) {
        profundidad -= 1;
        if (profundidad === 0) { this.i += 1; break; }
      }
      bytes.push(c);
      this.i += 1;
    }
    return { cadena: Buffer.from(bytes) };
  }

  leerCadenaHex() {
    this.i += 1; // '<'
    let hex = '';
    while (this.i < this.b.length && this.b[this.i] !== 0x3e) {
      const c = String.fromCharCode(this.b[this.i]);
      if (/[0-9a-fA-F]/.test(c)) hex += c;
      this.i += 1;
    }
    this.i += 1; // '>'
    if (hex.length % 2) hex += '0';
    return { cadena: Buffer.from(hex, 'hex') };
  }

  leerArreglo() {
    this.i += 1; // '['
    const salida = [];
    while (this.i < this.b.length) {
      this.saltarBlancos();
      if (this.b[this.i] === 0x5d) { this.i += 1; break; }
      const valor = this.leer();
      if (valor === undefined) break;
      salida.push(valor);
    }
    return this.plegarReferencias(salida);
  }

  leerDiccionario() {
    this.i += 2; // '<<'
    const bruto = [];
    while (this.i < this.b.length) {
      this.saltarBlancos();
      if (this.b[this.i] === 0x3e && this.b[this.i + 1] === 0x3e) { this.i += 2; break; }
      const valor = this.leer();
      if (valor === undefined) break;
      bruto.push(valor);
    }
    const plano = this.plegarReferencias(bruto);
    const dic = {};
    for (let k = 0; k < plano.length; k += 2) {
      const clave = plano[k];
      if (!clave || !clave.nombre) continue;
      dic[clave.nombre] = plano[k + 1];
    }
    return this.quizasFlujo(dic);
  }

  /** Tras un diccionario puede venir `stream`; si viene, captura sus bytes. */
  quizasFlujo(dic) {
    const guardado = this.i;
    this.saltarBlancos();
    if (this.b.slice(this.i, this.i + 6).toString('latin1') !== 'stream') {
      this.i = guardado;
      return dic;
    }
    this.i += 6;
    if (this.b[this.i] === 0x0d) this.i += 1;
    if (this.b[this.i] === 0x0a) this.i += 1;
    const inicio = this.i;
    let fin = this.b.indexOf('endstream', inicio, 'latin1');
    if (fin === -1) fin = this.b.length;
    // /Length puede ser una referencia todavía sin resolver: el marcador manda.
    let corte = fin;
    while (corte > inicio && ESPACIO.has(this.b[corte - 1])) corte -= 1;
    this.i = fin + 9;
    return new Flujo(dic, this.b.slice(inicio, corte));
  }

  /** Números sueltos, `true`, `null`, operadores y referencias `N G R`. */
  leerSimbolo() {
    let texto = '';
    while (this.i < this.b.length) {
      const c = this.b[this.i];
      if (ESPACIO.has(c) || DELIMITADOR.has(c)) break;
      texto += String.fromCharCode(c);
      this.i += 1;
    }
    if (texto === '') { this.i += 1; return this.leer(); }
    if (texto === 'true') return true;
    if (texto === 'false') return false;
    if (texto === 'null') return null;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(texto)) return Number(texto);
    return { operador: texto };
  }

  /** Convierte las ternas `numero generacion R` en referencias. */
  plegarReferencias(lista) {
    const salida = [];
    for (let k = 0; k < lista.length; k += 1) {
      const a = lista[k];
      const b = lista[k + 1];
      const c = lista[k + 2];
      if (typeof a === 'number' && typeof b === 'number' && c && c.operador === 'R') {
        salida.push(new Ref(a));
        k += 2;
        continue;
      }
      salida.push(a);
    }
    return salida;
  }
}

// --- Documento -------------------------------------------------------------

/** Descomprime un flujo según su `/Filter`. Devuelve null si no sabe. */
function descomprimir(flujo) {
  const filtro = flujo.dic.Filter;
  const nombres = (Array.isArray(filtro) ? filtro : [filtro])
    .filter(Boolean)
    .map((f) => (f && f.nombre) || '');
  if (nombres.length === 0) return flujo.crudo;
  if (nombres.some((n) => n !== 'FlateDecode')) return null; // DCT, JPX, LZW: no es texto
  for (const intento of [inflateSync, unzipSync, inflateRawSync]) {
    try { return intento(flujo.crudo); } catch { /* siguiente estrategia */ }
  }
  return null;
}

/**
 * Reúne todos los objetos indirectos del archivo.
 *
 * No se recorre la tabla de referencias cruzadas a propósito: barrer el
 * archivo entero es más corto y sobrevive a los PDF con xref rota, que son
 * frecuentes entre los que exporta la gente. Después se expanden los
 * `/ObjStm`, donde los generadores modernos esconden casi todo.
 */
function reunirObjetos(buffer) {
  const objetos = new Map();
  const patron = /(\d+)\s+(\d+)\s+obj\b/g;
  const texto = buffer.toString('latin1');
  let coincidencia;
  while ((coincidencia = patron.exec(texto)) !== null) {
    const numero = Number(coincidencia[1]);
    const lector = new Lector(buffer, coincidencia.index + coincidencia[0].length);
    const valor = lector.leer();
    if (valor !== undefined && !objetos.has(numero)) objetos.set(numero, valor);
  }

  // Objetos empaquetados dentro de flujos /ObjStm.
  [...objetos.values()].forEach((valor) => {
    if (!(valor instanceof Flujo)) return;
    if (!valor.dic.Type || valor.dic.Type.nombre !== 'ObjStm') return;
    const datos = descomprimir(valor);
    if (!datos) return;
    const primero = typeof valor.dic.First === 'number' ? valor.dic.First : 0;
    const cuantos = typeof valor.dic.N === 'number' ? valor.dic.N : 0;
    const cabecera = datos.slice(0, primero).toString('latin1').trim().split(/\s+/).map(Number);
    for (let k = 0; k < cuantos; k += 1) {
      const numero = cabecera[k * 2];
      const desplazamiento = cabecera[k * 2 + 1];
      if (!Number.isInteger(numero) || !Number.isInteger(desplazamiento)) continue;
      if (objetos.has(numero)) continue;
      const leido = new Lector(datos, primero + desplazamiento).leer();
      if (leido !== undefined) objetos.set(numero, leido);
    }
  });

  return objetos;
}

/** Sigue las referencias hasta llegar a un valor real. */
function resolver(objetos, valor, saltos = 0) {
  if (valor instanceof Ref && saltos < 32) {
    return resolver(objetos, objetos.get(valor.numero), saltos + 1);
  }
  return valor;
}

// --- Mapas ToUnicode -------------------------------------------------------

function codigoAEntero(hex) {
  return parseInt(hex, 16);
}

function hexAtexto(hex) {
  // Los destinos de un CMap son UTF-16BE, y pueden ser varios caracteres.
  let salida = '';
  for (let k = 0; k + 3 < hex.length + 1; k += 4) {
    const trozo = hex.slice(k, k + 4);
    if (trozo.length < 4) break;
    salida += String.fromCharCode(parseInt(trozo, 16));
  }
  return salida;
}

/**
 * Lee un CMap `/ToUnicode`: la tabla que traduce el identificador de glifo
 * que hay en el flujo de contenido al carácter que el lector humano ve.
 */
function leerToUnicode(texto) {
  const mapa = new Map();
  let anchoCodigo = 2;

  const rangoCodigos = /begincodespacerange([\s\S]*?)endcodespacerange/g;
  let m;
  while ((m = rangoCodigos.exec(texto)) !== null) {
    const primero = m[1].match(/<([0-9a-fA-F]+)>/);
    if (primero) anchoCodigo = Math.max(1, Math.ceil(primero[1].length / 2));
  }

  const bloquesChar = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((m = bloquesChar.exec(texto)) !== null) {
    const pares = m[1].match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g) || [];
    pares.forEach((par) => {
      const partes = par.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/);
      mapa.set(codigoAEntero(partes[1]), hexAtexto(partes[2]));
    });
  }

  const bloquesRango = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bloquesRango.exec(texto)) !== null) {
    const cuerpo = m[1];
    // Forma 1: <inicio> <fin> <destino>
    const simple = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g;
    let r;
    while ((r = simple.exec(cuerpo)) !== null) {
      const desde = codigoAEntero(r[1]);
      const hasta = codigoAEntero(r[2]);
      const destino = r[3];
      if (hasta - desde > 65535) continue;
      for (let cod = desde; cod <= hasta; cod += 1) {
        // Solo el último bloque de 16 bits avanza, que es lo que hace un lector real.
        const base = destino.slice(0, -4);
        const cola = destino.slice(-4);
        const avanzado = (parseInt(cola, 16) + (cod - desde)).toString(16).padStart(4, '0');
        mapa.set(cod, hexAtexto(base + avanzado));
      }
    }
    // Forma 2: <inicio> <fin> [ <a> <b> <c> ]
    const conArreglo = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g;
    while ((r = conArreglo.exec(cuerpo)) !== null) {
      const desde = codigoAEntero(r[1]);
      const destinos = r[3].match(/<([0-9a-fA-F]*)>/g) || [];
      destinos.forEach((d, indice) => {
        mapa.set(desde + indice, hexAtexto(d.replace(/[<>]/g, '')));
      });
    }
  }

  return { mapa, anchoCodigo };
}

/** Tabla de la fuente: cómo traducir sus bytes a caracteres. */
function leerFuentes(objetos, recursos) {
  const fuentes = new Map();
  const dicRecursos = resolver(objetos, recursos);
  if (!dicRecursos || dicRecursos instanceof Flujo) return fuentes;
  const dicFuentes = resolver(objetos, dicRecursos.Font);
  if (!dicFuentes || typeof dicFuentes !== 'object') return fuentes;

  Object.keys(dicFuentes).forEach((nombre) => {
    const fuente = resolver(objetos, dicFuentes[nombre]);
    if (!fuente || typeof fuente !== 'object') return;
    let tabla = null;
    const aUnicode = resolver(objetos, fuente.ToUnicode);
    if (aUnicode instanceof Flujo) {
      const datos = descomprimir(aUnicode);
      if (datos) tabla = leerToUnicode(datos.toString('latin1'));
    }
    const subtipo = (fuente.Subtype && fuente.Subtype.nombre) || '';
    const esCompuesta = subtipo === 'Type0';
    fuentes.set(nombre, {
      tabla,
      // Sin tabla, una fuente compuesta es ilegible: sus bytes son glifos.
      anchoCodigo: tabla ? tabla.anchoCodigo : (esCompuesta ? 2 : 1),
      esCompuesta
    });
  });
  return fuentes;
}

// --- Codificación de fuentes simples ---------------------------------------

/**
 * WinAnsi en el tramo 0x80–0x9F, donde NO coincide con latin1.
 *
 * Ahí viven las comillas tipográficas, la raya y los puntos suspensivos:
 * exactamente lo que un procesador de texto pone en una hoja de vida al
 * escribir «Enero 2020 – Marzo 2023» o «"Analista"». Leerlos como latin1
 * devolvería caracteres de control en medio del texto.
 */
const WINANSI_ALTO = {
  0x80: '\u20ac', 0x82: '\u201a', 0x83: '\u0192', 0x84: '\u201e', 0x85: '\u2026',
  0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02c6', 0x89: '\u2030', 0x8a: '\u0160',
  0x8b: '\u2039', 0x8c: '\u0152', 0x8e: '\u017d', 0x91: '\u2018', 0x92: '\u2019',
  0x93: '\u201c', 0x94: '\u201d', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02dc', 0x99: '\u2122', 0x9a: '\u0161', 0x9b: '\u203a', 0x9c: '\u0153',
  0x9e: '\u017e', 0x9f: '\u0178'
};

/** Un byte de una fuente simple, ya como carácter. */
function caracterSimple(byte) {
  const alto = WINANSI_ALTO[byte];
  if (alto) return alto;
  return String.fromCharCode(byte);
}

/** Todos los bytes de una fuente simple. */
function textoSimple(bytes) {
  let salida = '';
  for (let k = 0; k < bytes.length; k += 1) salida += caracterSimple(bytes[k]);
  return salida;
}

// --- Flujo de contenido ----------------------------------------------------

/** Traduce los bytes de una cadena mostrada según la fuente activa. */
function decodificar(bytes, fuente) {
  if (!fuente) return textoSimple(bytes);
  const { tabla, anchoCodigo, esCompuesta } = fuente;
  if (!tabla) {
    // Fuente simple sin ToUnicode: el byte es el carácter (WinAnsi/Standard).
    if (!esCompuesta) return textoSimple(bytes);
    return ''; // compuesta sin tabla: no se puede saber, y adivinar sería mentir
  }
  let salida = '';
  for (let k = 0; k < bytes.length; k += anchoCodigo) {
    let codigo = 0;
    for (let b = 0; b < anchoCodigo && k + b < bytes.length; b += 1) {
      codigo = (codigo << 8) | bytes[k + b];
    }
    const traducido = tabla.mapa.get(codigo);
    if (traducido !== undefined) salida += traducido;
    else if (!esCompuesta) salida += caracterSimple(codigo);
  }
  return salida;
}

/**
 * Recorre un flujo de contenido y reconstruye el texto con sus saltos.
 *
 * La posición vertical es la que dice dónde termina un renglón: un PDF no
 * guarda párrafos, guarda cada trozo de texto con sus coordenadas.
 */
function textoDeContenido(datos, fuentes) {
  const lector = new Lector(datos);
  const pila = [];
  const renglones = [];
  let fuente = null;
  let y = null;
  let x = 0;
  let renglon = '';

  const cerrarRenglon = () => {
    if (renglon.trim()) renglones.push(renglon.replace(/\s+/g, ' ').trim());
    renglon = '';
  };

  const mostrar = (bytes) => {
    renglon += decodificar(bytes, fuente);
  };

  while (!lector.finDeDatos()) {
    const ficha = lector.leer();
    if (ficha === undefined) break;
    if (!ficha || !ficha.operador) { pila.push(ficha); continue; }

    const op = ficha.operador;
    const args = pila.splice(0, pila.length);

    if (op === 'Tf') {
      const nombre = args.find((a) => a && a.nombre);
      fuente = nombre ? fuentes.get(nombre.nombre) || null : fuente;
    } else if (op === 'Tj' || op === "'" || op === '"') {
      if (op !== 'Tj') cerrarRenglon();
      const cadena = args.reverse().find((a) => a && a.cadena);
      if (cadena) mostrar(cadena.cadena);
    } else if (op === 'TJ') {
      const arreglo = args.find((a) => Array.isArray(a));
      (arreglo || []).forEach((parte) => {
        if (parte && parte.cadena) mostrar(parte.cadena);
        // Un desplazamiento negativo grande es un espacio que el generador
        // no escribió como carácter; por debajo de ese umbral es kerning.
        else if (typeof parte === 'number' && parte <= -120) renglon += ' ';
      });
    } else if (op === 'Td' || op === 'TD') {
      const dy = typeof args[1] === 'number' ? args[1] : 0;
      const dx = typeof args[0] === 'number' ? args[0] : 0;
      if (Math.abs(dy) > 0.01) cerrarRenglon();
      else if (dx > 0 && renglon && !renglon.endsWith(' ')) renglon += ' ';
    } else if (op === 'Tm') {
      const nuevaY = typeof args[5] === 'number' ? args[5] : null;
      const nuevaX = typeof args[4] === 'number' ? args[4] : 0;
      if (y !== null && nuevaY !== null && Math.abs(nuevaY - y) > 0.01) cerrarRenglon();
      else if (y !== null && nuevaX > x + 0.01 && renglon && !renglon.endsWith(' ')) renglon += ' ';
      y = nuevaY;
      x = nuevaX;
    } else if (op === 'T*' || op === 'ET') {
      cerrarRenglon();
    }
  }
  cerrarRenglon();
  return renglones;
}

// --- Entrada pública -------------------------------------------------------

/** Recorre el árbol de páginas en orden. */
function paginasEnOrden(objetos) {
  const catalogo = [...objetos.values()].find(
    (v) => v && !(v instanceof Flujo) && v.Type && v.Type.nombre === 'Catalog'
  );
  const paginas = [];
  const visitados = new Set();

  const recorrer = (nodo) => {
    const dic = resolver(objetos, nodo);
    if (!dic || typeof dic !== 'object' || dic instanceof Flujo) return;
    const tipo = (dic.Type && dic.Type.nombre) || '';
    if (tipo === 'Page') { paginas.push(dic); return; }
    const hijos = resolver(objetos, dic.Kids);
    if (Array.isArray(hijos)) {
      hijos.forEach((hijo) => {
        const clave = hijo instanceof Ref ? hijo.numero : hijo;
        if (visitados.has(clave)) return;
        visitados.add(clave);
        recorrer(hijo);
      });
    }
  };

  if (catalogo) recorrer(catalogo.Pages);
  if (paginas.length === 0) {
    // Sin catálogo utilizable: tomar las páginas en el orden del archivo.
    [...objetos.values()].forEach((v) => {
      if (v && !(v instanceof Flujo) && v.Type && v.Type.nombre === 'Page') paginas.push(v);
    });
  }
  return paginas;
}

/**
 * Extrae el texto de un PDF.
 *
 * @param {Buffer} buffer contenido del archivo
 * @returns {{texto: string, paginas: string[][], aviso: string|null}}
 *   `aviso` no es nulo cuando el PDF no trae texto extraíble —escaneado,
 *   cifrado o con fuentes sin mapa—, para que quien llame no confunda
 *   «no hay texto» con «la hoja de vida está vacía».
 */
export function extraerTexto(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('extraerTexto espera un Buffer');
  if (buffer.slice(0, 5).toString('latin1') !== '%PDF-') {
    return { texto: '', paginas: [], aviso: 'El archivo no es un PDF.' };
  }

  const objetos = reunirObjetos(buffer);

  const cifrado = [...objetos.values()].some(
    (v) => v && !(v instanceof Flujo) && typeof v === 'object' && v.Filter
      && v.Filter.nombre === 'Standard' && v.V !== undefined
  );

  const paginas = paginasEnOrden(objetos).map((pagina) => {
    const fuentes = leerFuentes(objetos, pagina.Resources);
    const contenidos = resolver(objetos, pagina.Contents);
    const lista = Array.isArray(contenidos) ? contenidos : [contenidos];
    const partes = [];
    lista.forEach((referencia) => {
      const flujo = resolver(objetos, referencia);
      if (!(flujo instanceof Flujo)) return;
      const datos = descomprimir(flujo);
      if (!datos) return;
      partes.push(...textoDeContenido(datos, fuentes));
    });
    return partes;
  });

  const texto = paginas.map((p) => p.join('\n')).join('\n').trim();

  let aviso = null;
  if (!texto) {
    if (cifrado) aviso = 'El PDF está protegido con contraseña y no se puede leer.';
    else if (paginas.length === 0) aviso = 'No se encontraron páginas legibles en el PDF.';
    else aviso = 'El PDF no tiene capa de texto: probablemente es un escaneo o una imagen.';
  }

  return { texto, paginas, aviso };
}

export default { extraerTexto };
