/**
 * POSTULA — Filtros de vacantes.
 *
 * Decide si una vacante merece que la persona gaste tiempo en ella. Es un
 * filtro de descarte, no de selección: ante la duda **la vacante pasa**, y
 * es la persona quien la mira. Un filtro demasiado listo esconde la oferta
 * buena por una palabra mal escrita en el aviso.
 */
import { Normalizar } from './esquema.mjs';

const { normalizar } = Normalizar;

/** Criterios de búsqueda; se sobreescriben con un archivo del usuario. */
export const CRITERIOS_POR_DEFECTO = {
  cargos: [
    'analista de mesa de ayuda',
    'soporte remoto nivel 2',
    'asistente virtual tecnico',
    'moderador de contenido',
    'automations assistant'
  ],
  salarioMinimo: 2500000,
  modalidades: ['remoto', 'teletrabajo', 'hibrido'],
  ciudadesPresenciales: ['pereira'],
  descartarInglesHablado: true,
  descartarTrabajoEnTerreno: true
};

// --- Salario ---------------------------------------------------------------

/** Salario mínimo legal, para los avisos que se expresan en SMMLV. */
const SMMLV_2026 = 1623500;

/**
 * Lee el salario de un aviso colombiano.
 *
 * Los portales lo escriben de todas las formas imaginables: «$2.500.000»,
 * «2'500.000», «COP 3.000.000 a 4.000.000», «2 a 3 SMMLV», «A convenir».
 *
 * @returns {{minimo: number|null, maximo: number|null, publicado: boolean}}
 */
export function leerSalario(texto) {
  const crudo = String(texto || '');
  const t = normalizar(crudo);
  if (!t) return { minimo: null, maximo: null, publicado: false };

  if (/a convenir|no especificado|confidencial|segun experiencia|a negociar/.test(t)) {
    return { minimo: null, maximo: null, publicado: false };
  }

  const enSalarios = /smmlv|salarios? minimos?|slmv/.test(t);

  // Los separadores de miles colombianos son punto, coma y apóstrofe.
  const numeros = (crudo.match(/\d[\d.,'’\s]*\d|\d/g) || [])
    .map((n) => {
      const digitos = n.replace(/[.,'’\s]/g, '');
      return digitos ? Number(digitos) : NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!numeros.length) return { minimo: null, maximo: null, publicado: false };

  const valores = enSalarios
    ? numeros.filter((n) => n <= 20).map((n) => n * SMMLV_2026)
    // Por debajo de cien mil no es un sueldo mensual: es un año, un número
    // de vacantes o el «2» de «nivel 2».
    : numeros.filter((n) => n >= 100000);

  if (!valores.length) return { minimo: null, maximo: null, publicado: false };

  return {
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
    publicado: true
  };
}

// --- Descartes -------------------------------------------------------------

/**
 * Inglés hablado exigido.
 *
 * Distingue el inglés que la persona sí tiene —lectura de documentación—
 * del que no: conversación fluida, B2 o superior, atención a cliente en
 * inglés. Un aviso que solo pide «inglés técnico» o «inglés lectura» no
 * descarta.
 */
export function exigeInglesHablado(texto) {
  const t = normalizar(texto);
  if (!/ingles|english|bilingue|bilingual/.test(t)) return false;

  const soloLectura = /ingles tecnico|ingles de lectura|ingles lectura|lectura de ingles|ingles escrito|comprension de lectura/.test(t);
  const nivelAlto = /\bb2\b|\bc1\b|\bc2\b|ingles avanzado|ingles fluido|fluent|advanced english|proficiency|bilingue|bilingual|ingles conversacional|conversational english/.test(t);
  const hablado = /hablado|conversacion|fluidez verbal|atencion en ingles|llamadas en ingles|speaking|spoken/.test(t);

  if (nivelAlto && !soloLectura) return true;
  if (hablado && !soloLectura) return true;
  return false;
}

/** Tareas operativas en terreno: no son teletrabajo por definición. */
export function exigeTrabajoEnTerreno(texto) {
  const t = normalizar(texto);
  return /cableado|canalizacion|ponchado|cableado estructurado|mantenimiento fisico|trabajo en campo|trabajo en alturas|visitas a clientes|visitas en sitio|instalacion en sitio|desplazamiento a sedes|moto propia|licencia de conduccion vigente|servicio tecnico en sitio/.test(t);
}

/** Modalidad declarada por el aviso. */
export function leerModalidad(texto) {
  const t = normalizar(texto);
  if (/teletrabajo|remoto|remota|home office|desde casa|100 virtual|work from home/.test(t)) return 'remoto';
  if (/hibrido|hibrida|mixto/.test(t)) return 'hibrido';
  if (/presencial|en sitio|on site|en oficina/.test(t)) return 'presencial';
  return '';
}

// --- Evaluación ------------------------------------------------------------

/** Todo el texto de una vacante, para buscar sobre él una sola vez. */
export function textoDeVacante(vacante) {
  return [
    vacante.titulo, vacante.empresa, vacante.ubicacion,
    vacante.modalidad, vacante.salario, vacante.descripcion
  ].filter(Boolean).join(' \n ');
}

/**
 * ¿Esta vacante pasa los filtros?
 *
 * @returns {{pasa: boolean, descartes: string[], avisos: string[], modalidad: string, salario: object}}
 */
export function evaluar(vacante, criterios = CRITERIOS_POR_DEFECTO) {
  const texto = textoDeVacante(vacante);
  const descartes = [];
  const avisos = [];

  const salario = leerSalario(vacante.salario || texto);
  if (salario.publicado && salario.maximo < criterios.salarioMinimo) {
    descartes.push(
      `Paga hasta ${moneda(salario.maximo)}, por debajo de ${moneda(criterios.salarioMinimo)}`
    );
  } else if (!salario.publicado) {
    avisos.push('No publica salario: hay que preguntarlo');
  }

  const modalidad = leerModalidad(vacante.modalidad || '') || leerModalidad(texto);
  const ubicacion = normalizar(vacante.ubicacion || '');
  const enCiudadPermitida = criterios.ciudadesPresenciales
    .some((ciudad) => ubicacion.includes(normalizar(ciudad)) || texto.toLowerCase().includes(ciudad));

  if (modalidad === 'presencial' && !enCiudadPermitida) {
    descartes.push('Es presencial fuera de las ciudades aceptadas');
  } else if (modalidad === 'hibrido' && !enCiudadPermitida) {
    descartes.push('Es híbrida fuera de las ciudades aceptadas');
  } else if (!modalidad) {
    avisos.push('No dice la modalidad: confirmar que admita teletrabajo');
  }

  if (criterios.descartarInglesHablado && exigeInglesHablado(texto)) {
    descartes.push('Exige inglés hablado o nivel B2+');
  }
  if (criterios.descartarTrabajoEnTerreno && exigeTrabajoEnTerreno(texto)) {
    descartes.push('Incluye tareas operativas en terreno');
  }

  return { pasa: descartes.length === 0, descartes, avisos, modalidad, salario };
}

/** Formato de pesos colombianos. */
export function moneda(valor) {
  if (!Number.isFinite(valor)) return 'sin publicar';
  return '$' + Math.round(valor).toLocaleString('es-CO');
}

export default { CRITERIOS_POR_DEFECTO, evaluar, leerSalario, leerModalidad,
  exigeInglesHablado, exigeTrabajoEnTerreno, textoDeVacante, moneda };
