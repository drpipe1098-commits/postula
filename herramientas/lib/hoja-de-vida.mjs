/**
 * POSTULA — Hoja de vida en texto → Perfil Único.
 *
 * Regla central: **nunca inventar.** Un campo que no aparece en la hoja de
 * vida se queda vacío para que la persona lo llene. Un perfil con datos
 * adivinados es peor que un perfil incompleto, porque se copia tal cual en
 * los formularios de los portales y nadie lo revisa.
 *
 * El reconocimiento es genérico, igual que el del matcher (AGENTS.md §4.6):
 * se apoya en cómo están escritas las hojas de vida —títulos de sección,
 * rangos de fecha, etiquetas de contacto— y no en una plantilla concreta.
 */
import { Perfil, Normalizar } from './esquema.mjs';

const { normalizar } = Normalizar;

// --- Vocabulario -----------------------------------------------------------

/** Títulos de sección, por la sección a la que mandan. */
const SECCIONES = [
  ['perfil', ['perfil profesional', 'perfil', 'resumen profesional', 'resumen', 'acerca de mi',
    'sobre mi', 'objetivo profesional', 'presentacion']],
  ['experiencia', ['experiencia laboral', 'experiencia profesional', 'experiencia',
    'trayectoria profesional', 'historial laboral']],
  ['educacion', ['educacion', 'formacion academica', 'formacion', 'estudios',
    'educacion y formacion']],
  ['certificaciones', ['certificaciones destacadas', 'certificaciones', 'cursos',
    'cursos y certificaciones', 'diplomados']],
  ['habilidades', ['habilidades y tecnologias', 'habilidades', 'competencias',
    'conocimientos', 'tecnologias', 'aptitudes', 'skills']],
  ['idiomas', ['idiomas', 'idioma']],
  ['referencias', ['referencias', 'referencias personales', 'referencias laborales']]
];

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dic: 12
};

/**
 * Niveles educativos, del más alto al más bajo.
 *
 * Cada nivel lista sus dos formas: media Colombia escribe «Tecnóloga»,
 * «Ingeniera» o «Licenciada», y un reconocimiento que solo entienda el
 * masculino deja sin título a quien lo escribió en femenino.
 */
const NIVELES_EDUCATIVOS = [
  ['Doctorado', ['doctorado', 'doctora en', 'doctor en', 'phd']],
  ['Maestría', ['maestria', 'master', 'magister', 'magistra']],
  ['Especialización', ['especializacion', 'especialista en']],
  ['Profesional', ['profesional en', 'ingeniero', 'ingeniera', 'ingenieria',
    'licenciado', 'licenciada', 'licenciatura', 'administrador de empresas',
    'administradora de empresas', 'contador publico', 'contadora publica',
    'psicologo', 'psicologa', 'abogado', 'abogada']],
  ['Tecnólogo', ['tecnologo', 'tecnologa', 'tecnologia en']],
  ['Técnico', ['tecnico en', 'tecnica en', 'tecnico laboral', 'tecnica laboral',
    'bachiller tecnico', 'bachiller tecnica']],
  ['Bachillerato', ['bachiller', 'bachillerato']]
];

const SEPARADOR_FECHAS = '(?:\\s*(?:-|–|—|a|al|hasta)\\s*)';
const MES_ANO = '(?:[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,10}\\.?\\s+)?\\d{4}';
const ACTUAL = '(?:presente|actual|actualidad|hoy|la fecha)';

const RANGO_FECHAS = new RegExp(
  `^\\s*(${MES_ANO})${SEPARADOR_FECHAS}(${MES_ANO}|${ACTUAL})\\s*\\.?\\s*$`, 'i'
);

// --- Utilidades ------------------------------------------------------------

const VINETA = /^\s*[•·▪◦‣*\-–—]\s*/;

/** Pie de página del generador: no es contenido de la hoja de vida. */
const PIE_DE_PAGINA = /^(p[áa]gina|page)\s+\d+\s+(de|of)\s+\d+$/i;

function limpiar(linea) {
  return String(linea).replace(VINETA, '').replace(/\s+/g, ' ').trim();
}

/**
 * Une los renglones que el PDF partió a mitad de frase.
 *
 * Un PDF no guarda párrafos: guarda renglones. Un título como «Tecnólogo en
 * Análisis y Desarrollo de Sistemas de / Información» llega partido en dos,
 * y un paréntesis suelto como «(Freelance)» pertenece al renglón anterior.
 */
function unirRenglonesPartidos(lineas) {
  const salida = [];
  lineas.forEach((linea) => {
    const previa = salida[salida.length - 1];
    if (!previa) { salida.push(linea); return; }
    // «habla/» + «escritura» es una sola palabra partida por el renglón.
    if (/[/-]$/.test(previa)) { salida[salida.length - 1] = previa + linea; return; }
    const soloParentesis = /^\([^)]*\)[.,;]?$/.test(linea);
    // «... Sistemas de» + «Información»: la previa termina en preposición.
    const previaColgando = /\s(de|del|en|y|e|para|con|la|el|los|las|a)$/i.test(previa);
    if (soloParentesis || previaColgando) {
      salida[salida.length - 1] = `${previa} ${linea}`;
      return;
    }
    salida.push(linea);
  });
  return salida;
}

/** ¿Esta línea es un título de sección? Devuelve la sección o null. */
function seccionDe(linea) {
  const texto = normalizar(linea);
  if (!texto || texto.length > 40) return null;
  for (const [clave, titulos] of SECCIONES) {
    if (titulos.includes(texto)) return clave;
  }
  return null;
}

/** Parte el texto en secciones según sus títulos. */
export function partirEnSecciones(texto) {
  const secciones = { encabezado: [] };
  let actual = 'encabezado';
  String(texto).split(/\r?\n/).forEach((cruda) => {
    const linea = limpiar(cruda);
    if (!linea) return;
    const clave = seccionDe(linea);
    if (clave) {
      actual = clave;
      if (!secciones[actual]) secciones[actual] = [];
      return;
    }
    if (PIE_DE_PAGINA.test(linea)) return;
    if (!secciones[actual]) secciones[actual] = [];
    secciones[actual].push(linea);
  });
  Object.keys(secciones).forEach((clave) => {
    secciones[clave] = unirRenglonesPartidos(secciones[clave]);
  });
  return secciones;
}

/** ¿La línea parece el nombre de una persona y no un cargo ni un dato? */
function pareceNombre(linea) {
  if (/[@\d]/.test(linea)) return false;
  if (/[:;,/|()]/.test(linea)) return false;
  const palabras = linea.trim().split(/\s+/);
  if (palabras.length < 2 || palabras.length > 5) return false;
  // Un cargo casi siempre trae alguna de estas palabras; un nombre nunca.
  const texto = normalizar(linea);
  const delOficio = ['analista', 'ingeniero', 'desarrollador', 'tecnico', 'tecnologo',
    'asesor', 'gestor', 'soporte', 'coordinador', 'director', 'jefe', 'auxiliar',
    'especialista', 'profesional', 'hoja de vida', 'curriculum'];
  if (delOficio.some((p) => texto.includes(p))) return false;
  return palabras.every((p) => /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñÑ.'-]*$/.test(p)
    || /^[A-ZÁÉÍÓÚÑ.'-]+$/.test(p));
}

function partirNombre(completo) {
  const palabras = completo.trim().split(/\s+/);
  // En Colombia lo habitual son dos nombres y dos apellidos; con tres
  // palabras, el reparto usual es un nombre y dos apellidos.
  if (palabras.length >= 4) {
    return {
      nombres: palabras.slice(0, palabras.length - 2).join(' '),
      apellidos: palabras.slice(-2).join(' ')
    };
  }
  if (palabras.length === 3) {
    return { nombres: palabras[0], apellidos: palabras.slice(1).join(' ') };
  }
  return { nombres: palabras[0] || '', apellidos: palabras.slice(1).join(' ') };
}

/** Pasa «Junio 2026» a un número comparable (año*12+mes). */
function aMeses(fecha) {
  const texto = normalizar(fecha);
  if (new RegExp(ACTUAL).test(texto)) return null; // «Presente»: lo resuelve quien llama
  const ano = (texto.match(/\d{4}/) || [])[0];
  if (!ano) return null;
  const palabraMes = Object.keys(MESES).find((m) => texto.startsWith(m));
  const mes = palabraMes ? MESES[palabraMes] : 1;
  return Number(ano) * 12 + mes;
}

// --- Extractores por campo -------------------------------------------------

function extraerContacto(texto) {
  const salida = {};

  const correo = texto.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
  if (correo) salida.email = correo[0].replace(/[.,;]$/, '');

  // Celular colombiano: 10 dígitos que empiezan por 3, con o sin +57.
  const celular = texto.match(/(?:\+?57[\s.-]*)?\(?\s*3\d{2}\s*\)?[\s.-]*\d{3}[\s.-]*\d{4}\b/);
  if (celular) {
    const digitos = celular[0].replace(/\D/g, '').replace(/^57/, '');
    if (digitos.length === 10) salida.celular = digitos;
  }

  const enlaces = texto.match(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.[\w./-]{2,}/g) || [];
  enlaces.forEach((enlace) => {
    const bajo = enlace.toLowerCase();
    if (bajo.includes('@')) return;
    if (bajo.includes('linkedin.com') && !salida.linkedin) salida.linkedin = normalizarUrl(enlace);
    else if (bajo.includes('github.com') && !salida.github) salida.github = normalizarUrl(enlace);
  });

  return salida;
}

function normalizarUrl(enlace) {
  const limpio = enlace.replace(/[.,;)]$/, '');
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

/** Ciudad y departamento a partir de una línea «Ciudad, Departamento, País». */
function extraerUbicacion(lineas) {
  for (const linea of lineas) {
    const sinEtiqueta = linea.replace(/^\s*(ubicaci[oó]n|ciudad|direcci[oó]n|residencia)\s*:\s*/i, '');
    const partes = sinEtiqueta.split(',').map((p) => p.trim()).filter(Boolean);
    if (partes.length < 2 || partes.length > 4) continue;
    if (partes.some((p) => /[@\d]/.test(p) || p.length > 30)) continue;
    const ultimo = normalizar(partes[partes.length - 1]);
    if (ultimo === 'colombia' && partes.length >= 3) {
      return { ciudad: partes[0], departamento: partes[1], pais: partes[2] };
    }
    if (partes.length === 2 && /^[A-ZÁÉÍÓÚ]/.test(partes[0]) && /^[A-ZÁÉÍÓÚ]/.test(partes[1])) {
      return { ciudad: partes[0], departamento: partes[1] };
    }
  }
  return {};
}

function extraerModalidad(texto) {
  const t = normalizar(texto);
  const remoto = /teletrabajo|remoto|remota|home office|trabajo desde casa/.test(t);
  const hibrido = /hibrido|hibrida/.test(t);
  if (remoto) return 'Remoto';
  if (hibrido) return 'Híbrido';
  if (/presencial/.test(t)) return 'Presencial';
  return '';
}

/**
 * Experiencia laboral: cada rango de fechas cierra una entrada.
 *
 * La forma universal de una entrada es «cargo / empresa / fechas» seguida de
 * las funciones. Así que las fechas son el ancla: los renglones justo antes
 * son la cabecera, y los de después, las funciones —hasta la cabecera de la
 * entrada siguiente, que **no** le pertenecen.
 */
export function extraerExperiencia(lineas) {
  const indicesFecha = [];
  lineas.forEach((linea, indice) => {
    if (RANGO_FECHAS.test(linea)) indicesFecha.push(indice);
  });
  if (!indicesFecha.length) return [];

  // Cuántos renglones antes de la fecha son cabecera, y qué dicen.
  const cabeceraDe = (indiceFecha, limiteInferior) => {
    const disponibles = lineas.slice(Math.max(limiteInferior, indiceFecha - 3), indiceFecha);
    const tomadas = disponibles.slice(-2);
    return {
      cargo: tomadas.length === 2 ? tomadas[0] : (tomadas[0] || ''),
      empresa: tomadas.length === 2 ? tomadas[1] : '',
      cuantas: tomadas.length
    };
  };

  return indicesFecha.map((indiceFecha, orden) => {
    const anterior = orden === 0 ? 0 : indicesFecha[orden - 1] + 1;
    const cabecera = cabeceraDe(indiceFecha, anterior);
    const rango = lineas[indiceFecha].match(RANGO_FECHAS);

    const siguiente = indicesFecha[orden + 1];
    const finFunciones = siguiente === undefined
      ? lineas.length
      : siguiente - cabeceraDe(siguiente, indiceFecha + 1).cuantas;

    return {
      cargo: cabecera.cargo,
      empresa: cabecera.empresa,
      desde: rango[1].trim(),
      hasta: rango[2].trim(),
      funciones: lineas.slice(indiceFecha + 1, Math.max(finFunciones, indiceFecha + 1))
        .join(' ').replace(/\s+/g, ' ').trim()
    };
  }).filter((entrada) => entrada.cargo || entrada.empresa);
}

/** Años de experiencia: meses realmente trabajados, sin contar solapes. */
export function anosDeExperiencia(entradas, hoy = new Date()) {
  const ahora = hoy.getFullYear() * 12 + (hoy.getMonth() + 1);
  const tramos = entradas
    .map((entrada) => {
      const inicio = aMeses(entrada.desde);
      if (inicio === null) return null;
      const fin = aMeses(entrada.hasta);
      return [inicio, fin === null ? ahora : fin];
    })
    .filter(Boolean)
    .filter(([a, b]) => b >= a)
    .sort((a, b) => a[0] - b[0]);

  if (!tramos.length) return '';

  let meses = 0;
  let [desde, hasta] = tramos[0];
  tramos.slice(1).forEach(([a, b]) => {
    if (a <= hasta) { hasta = Math.max(hasta, b); return; }
    meses += hasta - desde;
    desde = a;
    hasta = b;
  });
  meses += hasta - desde;
  const anos = Math.floor(meses / 12);
  return anos > 0 ? String(anos) : '';
}

/** Estudios sin terminar: cuentan como formación, pero no como título. */
const EN_CURSO = /\ben curso\b|\bcursando\b|\bactualmente\b|\bestudios activos\b|\bincompleto\b/i;

/**
 * Educación: el título más alto **terminado**.
 *
 * Un diplomado en curso no es un título, y ponerlo en el formulario de un
 * portal como si lo fuera es afirmar algo falso sobre la persona.
 */
export function extraerEducacion(lineas) {
  let mejor = null;
  lineas.forEach((linea, indice) => {
    const texto = normalizar(linea);
    const posicion = NIVELES_EDUCATIVOS.findIndex(([, claves]) =>
      claves.some((clave) => texto.includes(clave)));
    if (posicion === -1) return;

    // La institución y el año van en los renglones siguientes, hasta el
    // próximo título; ahí mismo aparece el aviso de «en curso» si lo hay.
    const siguientes = lineas.slice(indice + 1, indice + 3);
    if (EN_CURSO.test(linea) || siguientes.some((l) => EN_CURSO.test(l))) return;
    if (mejor && mejor.posicion <= posicion) return;

    const conAno = [linea, ...siguientes].find((l) => /\b(19|20)\d{2}\b/.test(l));
    const ano = conAno ? conAno.match(/\b(19|20)\d{2}\b/)[0] : '';
    const institucion = (siguientes[0] || '').split('|')[0]
      .replace(/\b(19|20)\d{2}\b/, '').replace(/[|,;]\s*$/, '').trim();

    mejor = {
      posicion,
      nivelEducativo: NIVELES_EDUCATIVOS[posicion][0],
      titulo: linea.replace(/\s*\|\s*\d{4}\s*$/, '').trim(),
      institucion,
      anoGrado: ano
    };
  });
  if (!mejor) return {};
  const { posicion, ...datos } = mejor;
  return datos;
}

const IDIOMAS_CONOCIDOS = ['Inglés', 'Español', 'Francés', 'Portugués', 'Alemán',
  'Italiano', 'Mandarín', 'Japonés', 'Chino'];

/**
 * Idiomas: el nivel tal como lo escribió la persona.
 *
 * No se normaliza a «Básico/Intermedio/Avanzado» a propósito. «Nivel Medio en
 * lectura, Básico en habla» no es ningún escalón de esa escala, y reducirlo a
 * uno cambiaría lo que la persona declara saber.
 */
export function extraerIdiomas(lineas) {
  const texto = lineas.join(' ').replace(/\s+/g, ' ').trim();
  if (!texto) return [];

  const apariciones = [];
  IDIOMAS_CONOCIDOS.forEach((idioma) => {
    const posicion = texto.search(new RegExp(`\\b${idioma}\\b`, 'i'));
    if (posicion !== -1) apariciones.push({ idioma, posicion });
  });
  apariciones.sort((a, b) => a.posicion - b.posicion);

  return apariciones.map(({ idioma, posicion }, orden) => {
    const fin = orden + 1 < apariciones.length ? apariciones[orden + 1].posicion : texto.length;
    const tras = texto.slice(posicion + idioma.length, fin).replace(/^[\s:.\-–,]+/, '').trim();
    // Hasta donde termine la idea: una o dos frases bastan para un formulario.
    let nivel = tras;
    if (nivel.length > 120) {
      const corte = nivel.slice(0, 120).lastIndexOf('.');
      nivel = corte > 30 ? nivel.slice(0, corte + 1) : `${nivel.slice(0, 117).trim()}...`;
    }
    return { idioma, nivel: nivel.replace(/[,;]$/, '').trim() };
  }).filter((fila) => fila.nivel);
}

// --- Entrada pública -------------------------------------------------------

/**
 * Convierte el texto de una hoja de vida en un perfil de POSTULA.
 *
 * @param {string} texto texto plano de la hoja de vida
 * @returns {{perfil: object, encontrados: string[], vacios: string[], secciones: object}}
 */
export function aPerfil(texto, hoy = new Date()) {
  const secciones = partirEnSecciones(texto);
  const encabezado = secciones.encabezado || [];
  const perfil = Perfil.perfilVacio();
  const completo = String(texto);

  // Identidad y titular, desde las primeras líneas.
  const indiceNombre = encabezado.findIndex(pareceNombre);
  if (indiceNombre !== -1) {
    const { nombres, apellidos } = partirNombre(encabezado[indiceNombre]);
    perfil.nombres = nombres;
    perfil.apellidos = apellidos;
    const siguiente = encabezado[indiceNombre + 1];
    if (siguiente && !pareceNombre(siguiente) && !/[@]/.test(siguiente) && siguiente.length < 120) {
      perfil.titularProfesional = siguiente.replace(/\s*:\s*$/, '');
    }
  }

  Object.assign(perfil, extraerContacto(completo));
  Object.assign(perfil, extraerUbicacion(encabezado));

  const modalidad = extraerModalidad(encabezado.join(' '));
  if (modalidad) perfil.modalidad = modalidad;

  if (secciones.perfil && secciones.perfil.length) {
    perfil.resumenProfesional = secciones.perfil.join(' ').replace(/\s+/g, ' ').trim();
  }

  const experiencia = extraerExperiencia(secciones.experiencia || []);
  perfil.experiencia = experiencia;
  const anos = anosDeExperiencia(experiencia, hoy);
  if (anos) perfil.anosExperiencia = anos;

  Object.assign(perfil, extraerEducacion(secciones.educacion || []));
  perfil.idiomas = extraerIdiomas(secciones.idiomas || []);

  // Habilidades y certificaciones van tal cual: son listas, no prosa, y
  // resumirlas le quitaría a la persona palabras que el portal busca.
  if (secciones.habilidades && secciones.habilidades.length) {
    perfil.habilidades = secciones.habilidades.join(' ').replace(/\s+/g, ' ').trim();
  }
  if (secciones.certificaciones && secciones.certificaciones.length) {
    perfil.certificaciones = secciones.certificaciones.join(' ').replace(/\s+/g, ' ').trim();
  }

  const limpio = Perfil.sanear(perfil);

  // Informe: qué salió de la hoja de vida y qué queda por llenar a mano.
  const vacio = Perfil.perfilVacio();
  const encontrados = [];
  const vacios = [];
  Perfil.idsDeCampos().forEach((id) => {
    const valor = String(limpio[id] || '').trim();
    if (valor && valor !== String(vacio[id] || '')) encontrados.push(id);
    else if (!valor) vacios.push(id);
  });

  return { perfil: limpio, encontrados, vacios, secciones };
}

export default { aPerfil, partirEnSecciones, extraerExperiencia, extraerEducacion,
  extraerIdiomas, anosDeExperiencia };
