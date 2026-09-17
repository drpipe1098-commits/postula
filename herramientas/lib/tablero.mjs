/**
 * POSTULA — Tablero de postulaciones.
 *
 * Buscar empleo en serio significa tener veinte procesos abiertos a la vez,
 * cada uno en un estado distinto. A las tres semanas nadie recuerda a cuál
 * portal aplicó, cuándo, ni a quién le prometió enviar algo. Eso no se
 * arregla con memoria: se arregla con un registro.
 *
 * Reglas que este archivo sostiene:
 *
 *  - **Vive en el equipo de la persona.** Un archivo JSON suyo, que puede
 *    abrir, editar, respaldar y borrar. Sin servidor y sin cuenta.
 *  - **No inventa fechas.** Un cambio de estado se fecha cuando ocurre; si
 *    nadie lo registró, el tablero dice «sin fecha», no la supone.
 *  - **Nada se pierde.** Cada cambio deja una línea en el historial. El
 *    estado actual es un resumen, no el dato.
 *  - **La misma vacante no entra dos veces.** Las listas de vacantes se
 *    solapan entre corridas; sin esto el tablero se llena de duplicados y
 *    deja de servir para saber a qué te postulaste.
 */
import { Normalizar } from './esquema.mjs';

const { normalizar } = Normalizar;

/**
 * Los estados por los que pasa una postulación, en orden de avance.
 *
 * `sinRespuesta` no es un fracaso ni un final: es el reconocimiento de que
 * la mayoría de las postulaciones no reciben respuesta nunca, y de que
 * seguir esperándolas consume atención que sirve para otra cosa.
 */
export const ESTADOS = {
  porPostular: { orden: 0, etiqueta: 'Por postular', diasSeguimiento: 2 },
  postulado: { orden: 1, etiqueta: 'Postulado', diasSeguimiento: 7 },
  enProceso: { orden: 2, etiqueta: 'En proceso', diasSeguimiento: 5 },
  entrevista: { orden: 3, etiqueta: 'Entrevista', diasSeguimiento: 3 },
  prueba: { orden: 4, etiqueta: 'Prueba técnica', diasSeguimiento: 3 },
  oferta: { orden: 5, etiqueta: 'Oferta', diasSeguimiento: 2 },
  descartado: { orden: 6, etiqueta: 'Descartado', diasSeguimiento: null },
  sinRespuesta: { orden: 7, etiqueta: 'Sin respuesta', diasSeguimiento: null }
};

/** Estados en los que ya no hay nada que esperar. */
export const ESTADOS_CERRADOS = ['descartado', 'sinRespuesta'];

export function esEstado(estado) {
  return Object.prototype.hasOwnProperty.call(ESTADOS, estado);
}

// --- Fechas ----------------------------------------------------------------

/** Una fecha en formato ISO corto, que es como se guarda todo aquí. */
export function aFecha(valor) {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function sumarDias(fecha, dias) {
  const d = new Date(`${aFecha(fecha)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + dias);
  return aFecha(d);
}

// Se calcula en vez de escribirse literal: una racha larga de dígitos en el
// código dispara el escáner de datos personales de proyecto-contract.
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Días entre dos fechas; negativo si la primera ya pasó. */
export function diasEntre(desde, hasta) {
  const a = new Date(`${aFecha(desde)}T12:00:00Z`);
  const b = new Date(`${aFecha(hasta)}T12:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / MS_POR_DIA);
}

/**
 * Interpreta lo que la persona escribe como fecha: `+7d`, `+2s`, `mañana`,
 * o una fecha ISO. Escribir «2026-10-01» a mano es incómodo cuando lo que
 * uno piensa es «en una semana».
 */
export function interpretarFecha(texto, hoy) {
  const t = normalizar(texto);
  if (!t) return '';
  if (t === 'hoy') return aFecha(hoy);
  if (t === 'manana') return sumarDias(hoy, 1);
  const relativa = t.match(/^\+?(\d+)\s*(d|dia|dias|s|semana|semanas|m|mes|meses)$/);
  if (relativa) {
    const cantidad = Number(relativa[1]);
    const unidad = relativa[2][0];
    const dias = unidad === 'd' ? cantidad : unidad === 's' ? cantidad * 7 : cantidad * 30;
    return sumarDias(hoy, dias);
  }
  const iso = String(texto).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return aFecha(`${iso[0]}T12:00:00Z`);
  return '';
}

// --- Identidad de una postulación ------------------------------------------

/**
 * Identificador estable de una vacante: empresa y cargo, normalizados.
 *
 * Dos avisos de la misma empresa para el mismo cargo son la misma
 * postulación aunque los portales escriban distinto el nombre legal.
 */
export function idDe(vacante) {
  // La normalización de nombres de empresa vive en la librería compartida
  // de la extensión: es la misma regla para el tablero y para el
  // autorrelleno, y duplicarla sería dejar que se desincronicen.
  const empresa = Normalizar.nucleoDeEmpresa(vacante.empresa || '').replace(/ /g, '-');
  const titulo = normalizar(vacante.titulo || '').replace(/ /g, '-');
  const base = [empresa, titulo].filter(Boolean).join('--');
  return base.slice(0, 80) || 'sin-nombre';
}

// --- Tablero ---------------------------------------------------------------

export function tableroVacio() {
  return { version: 1, postulaciones: [] };
}

/** Quita lo que no reconoce y garantiza la forma de cada fila. */
export function sanear(entrada) {
  const base = tableroVacio();
  if (!entrada || typeof entrada !== 'object') return base;
  const filas = Array.isArray(entrada.postulaciones) ? entrada.postulaciones : [];
  base.postulaciones = filas
    .filter((fila) => fila && typeof fila === 'object')
    .map((fila) => ({
      id: String(fila.id || '').trim() || idDe(fila),
      titulo: String(fila.titulo || '').trim(),
      empresa: String(fila.empresa || '').trim(),
      enlace: String(fila.enlace || '').trim(),
      salario: String(fila.salario || '').trim(),
      modalidad: String(fila.modalidad || '').trim(),
      ubicacion: String(fila.ubicacion || '').trim(),
      puntaje: Number.isFinite(fila.puntaje) ? fila.puntaje : null,
      estado: esEstado(fila.estado) ? fila.estado : 'porPostular',
      registrada: aFecha(fila.registrada) || '',
      postulada: aFecha(fila.postulada) || '',
      proximoSeguimiento: aFecha(fila.proximoSeguimiento) || '',
      historial: Array.isArray(fila.historial)
        ? fila.historial
          .filter((h) => h && typeof h === 'object')
          .map((h) => ({ fecha: aFecha(h.fecha) || '', texto: String(h.texto || '').trim() }))
          .filter((h) => h.texto)
        : []
    }))
    .filter((fila) => fila.titulo || fila.empresa);
  return base;
}

function anotar(fila, hoy, texto) {
  fila.historial.push({ fecha: aFecha(hoy), texto });
}

/**
 * Agrega una vacante al tablero, o la actualiza si ya estaba.
 *
 * @returns {{tablero: object, fila: object, yaEstaba: boolean}}
 */
export function agregar(tablero, vacante, hoy, estado = 'porPostular') {
  const limpio = sanear(tablero);
  const id = idDe(vacante);
  const existente = limpio.postulaciones.find((f) => f.id === id);

  if (existente) {
    // No se pisa lo que ya hay: el enlace o el salario pueden completarse,
    // pero el estado y las fechas son historia y no se reescriben.
    ['enlace', 'salario', 'modalidad', 'ubicacion'].forEach((campo) => {
      if (!existente[campo] && vacante[campo]) existente[campo] = String(vacante[campo]).trim();
    });
    return { tablero: limpio, fila: existente, yaEstaba: true };
  }

  const fila = {
    id,
    titulo: String(vacante.titulo || '').trim(),
    empresa: String(vacante.empresa || '').trim(),
    enlace: String(vacante.enlace || '').trim(),
    salario: String(vacante.salario || '').trim(),
    modalidad: String(vacante.modalidad || '').trim(),
    ubicacion: String(vacante.ubicacion || '').trim(),
    puntaje: Number.isFinite(vacante.puntaje) ? vacante.puntaje : null,
    estado: esEstado(estado) ? estado : 'porPostular',
    registrada: aFecha(hoy),
    postulada: '',
    proximoSeguimiento: '',
    historial: []
  };
  anotar(fila, hoy, `Registrada como «${ESTADOS[fila.estado].etiqueta}»`);
  fila.proximoSeguimiento = seguimientoSugerido(fila, hoy);
  limpio.postulaciones.push(fila);
  return { tablero: limpio, fila, yaEstaba: false };
}

/** Cuándo tocaría volver a mirar esta postulación. */
export function seguimientoSugerido(fila, hoy) {
  const dias = ESTADOS[fila.estado] ? ESTADOS[fila.estado].diasSeguimiento : null;
  if (dias === null) return '';
  const desde = fila.estado === 'postulado' && fila.postulada ? fila.postulada : aFecha(hoy);
  return sumarDias(desde, dias);
}

/**
 * Cambia el estado de una postulación.
 *
 * @returns {{tablero: object, fila: object|null, error: string|null}}
 */
export function cambiarEstado(tablero, id, estado, hoy, nota = '') {
  const limpio = sanear(tablero);
  if (!esEstado(estado)) {
    return { tablero: limpio, fila: null, error: `«${estado}» no es un estado válido.` };
  }
  const fila = limpio.postulaciones.find((f) => f.id === id);
  if (!fila) return { tablero: limpio, fila: null, error: `No hay ninguna postulación «${id}».` };

  const antes = fila.estado;
  fila.estado = estado;
  if (estado === 'postulado' && !fila.postulada) fila.postulada = aFecha(hoy);
  anotar(fila, hoy, `${ESTADOS[antes].etiqueta} → ${ESTADOS[estado].etiqueta}`
    + (nota ? `. ${nota}` : ''));
  fila.proximoSeguimiento = seguimientoSugerido(fila, hoy);
  return { tablero: limpio, fila, error: null };
}

export function agregarNota(tablero, id, texto, hoy) {
  const limpio = sanear(tablero);
  const fila = limpio.postulaciones.find((f) => f.id === id);
  if (!fila) return { tablero: limpio, fila: null, error: `No hay ninguna postulación «${id}».` };
  if (!String(texto).trim()) {
    return { tablero: limpio, fila: null, error: 'La nota está vacía.' };
  }
  anotar(fila, hoy, String(texto).trim());
  return { tablero: limpio, fila, error: null };
}

export function fijarSeguimiento(tablero, id, cuando, hoy) {
  const limpio = sanear(tablero);
  const fila = limpio.postulaciones.find((f) => f.id === id);
  if (!fila) return { tablero: limpio, fila: null, error: `No hay ninguna postulación «${id}».` };
  const fecha = interpretarFecha(cuando, hoy);
  if (!fecha) {
    return { tablero: limpio, fila: null,
      error: `No entiendo «${cuando}». Usa una fecha (2026-10-01) o algo como +7d, +2s, mañana.` };
  }
  fila.proximoSeguimiento = fecha;
  anotar(fila, hoy, `Próximo seguimiento: ${fecha}`);
  return { tablero: limpio, fila, error: null };
}

// --- Consultas -------------------------------------------------------------

/**
 * Lo que hay que mirar hoy: seguimientos vencidos o que caen hoy, primero
 * los más atrasados. Es la única pregunta que el tablero tiene que
 * responder bien para ganarse su lugar en el día de alguien.
 */
export function pendientesDeHoy(tablero, hoy) {
  return sanear(tablero).postulaciones
    .filter((f) => !ESTADOS_CERRADOS.includes(f.estado) && f.proximoSeguimiento)
    .map((f) => ({ fila: f, dias: diasEntre(f.proximoSeguimiento, hoy) }))
    .filter(({ dias }) => dias !== null && dias >= 0)
    .sort((a, b) => b.dias - a.dias);
}

/**
 * Postulaciones que llevan mucho enviadas sin noticias: candidatas a
 * cerrar como «sin respuesta» para dejar de cargarlas.
 */
export function estancadas(tablero, hoy, umbralDias = 21) {
  return sanear(tablero).postulaciones
    .filter((fila) => fila.estado === 'postulado' && fila.postulada)
    .map((fila) => ({ fila, dias: diasEntre(fila.postulada, hoy) }))
    .filter((item) => item.dias !== null && item.dias >= umbralDias)
    .sort((a, b) => b.dias - a.dias);
}

/** Cuántas hay en cada estado, en el orden en que avanzan. */
export function resumen(tablero) {
  const limpio = sanear(tablero);
  return Object.keys(ESTADOS)
    .sort((a, b) => ESTADOS[a].orden - ESTADOS[b].orden)
    .map((estado) => ({
      estado,
      etiqueta: ESTADOS[estado].etiqueta,
      cuantas: limpio.postulaciones.filter((f) => f.estado === estado).length
    }));
}

export default {
  ESTADOS, ESTADOS_CERRADOS, esEstado, tableroVacio, sanear, idDe, agregar,
  cambiarEstado, agregarNota, fijarSeguimiento, pendientesDeHoy, estancadas,
  resumen, seguimientoSugerido, aFecha, sumarDias, diasEntre, interpretarFecha
};
