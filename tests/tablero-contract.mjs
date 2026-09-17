/**
 * CANDADO — Tablero de postulaciones.
 *
 * Lo que este archivo protege:
 *
 *  1. **No se inventan fechas.** Una postulación sin fecha de envío no tiene
 *     una supuesta. El tablero es el registro de lo que pasó, y un registro
 *     que rellena huecos por su cuenta deja de servir para decidir.
 *  2. **Nada se pierde.** Cada cambio deja su línea en el historial; el
 *     estado actual es un resumen, no el dato.
 *  3. **La misma vacante no entra dos veces.** Las listas de vacantes se
 *     solapan entre corridas, y los portales escriben el nombre de la misma
 *     empresa de cinco maneras distintas.
 *  4. **«Qué toca hoy» es correcto.** Es la única pregunta que el tablero
 *     tiene que responder bien para ganarse un lugar en el día de alguien.
 *
 * Todos los datos son ficticios.
 */
import { contrato } from './ayuda.mjs';
import * as T from '../herramientas/lib/tablero.mjs';

const c = contrato('tablero-contract');
const HOY = '2026-09-16';

// --- 1. Alta de una vacante ---
let tablero = T.tableroVacio();
const alta = T.agregar(tablero, {
  titulo: 'Analista de Mesa de Ayuda', empresa: 'Soluciones Ejemplo SAS',
  enlace: 'https://ejemplo.com/1', salario: '$3.200.000', modalidad: 'Remoto', puntaje: 88
}, HOY);
tablero = alta.tablero;

c.igual(alta.yaEstaba, false, 'una vacante nueva no estaba antes');
c.igual(alta.fila.estado, 'porPostular', 'entra como pendiente de postular');
c.igual(alta.fila.registrada, HOY, 'se registra con la fecha de hoy');
c.igual(alta.fila.postulada, '', 'todavía no se ha postulado: la fecha queda vacía');
c.exigir(alta.fila.historial.length === 1, 'el alta deja su línea en el historial');

// --- 2. La misma vacante no entra dos veces, aunque cambie la forma jurídica ---
[
  'Soluciones Ejemplo SAS', 'Soluciones Ejemplo S.A.S', 'Soluciones Ejemplo S.A.S.',
  'SOLUCIONES EJEMPLO sas', 'Soluciones Ejemplo S A S'
].forEach((empresa) => {
  const repetida = T.agregar(tablero, { titulo: 'ANALISTA DE MESA DE AYUDA', empresa }, HOY);
  c.igual(repetida.yaEstaba, true, `«${empresa}» es la misma empresa que ya estaba`);
  c.igual(repetida.tablero.postulaciones.length, 1, `«${empresa}» no debe duplicar la fila`);
});

// Pero dos empresas distintas siguen siendo distintas.
const otra = T.agregar(tablero, { titulo: 'Analista de Mesa de Ayuda', empresa: 'Otra Ejemplo SAS' }, HOY);
c.igual(otra.tablero.postulaciones.length, 2, 'otra empresa es otra postulación');
c.exigir(T.idDe({ empresa: 'SAS', titulo: 'Analista' }) !== '--analista',
  'una empresa que se llama como una forma jurídica no se queda sin nombre');

// --- 3. Cambio de estado: fecha, historial y seguimiento ---
const id = T.idDe({ titulo: 'Analista de Mesa de Ayuda', empresa: 'Soluciones Ejemplo SAS' });
const enviada = T.cambiarEstado(tablero, id, 'postulado', HOY, 'Enviada por el portal');
tablero = enviada.tablero;

c.igual(enviada.error, null, 'el cambio de estado válido no da error');
c.igual(enviada.fila.estado, 'postulado', 'queda postulada');
c.igual(enviada.fila.postulada, HOY, 'la fecha de envío se registra al cambiar el estado');
c.igual(enviada.fila.proximoSeguimiento, '2026-09-23', 'se propone seguimiento a los 7 días');
c.exigir(enviada.fila.historial.length === 2, 'el cambio deja su propia línea');
c.exigir(enviada.fila.historial[1].texto.includes('Enviada por el portal'),
  'la nota del cambio se conserva');

// Un estado inventado se rechaza, y el tablero no cambia.
const invalido = T.cambiarEstado(tablero, id, 'contratadoYa', HOY);
c.exigir(invalido.error !== null, 'un estado que no existe se rechaza');
c.igual(invalido.tablero.postulaciones.find((f) => f.id === id).estado, 'postulado',
  'un cambio rechazado no toca el estado');

const inexistente = T.cambiarEstado(tablero, 'no-existe', 'postulado', HOY);
c.exigir(inexistente.error !== null, 'cambiar una postulación que no existe da error');

// --- 4. La fecha de envío no se reescribe ---
const reenviada = T.cambiarEstado(tablero, id, 'enProceso', '2026-10-01');
c.igual(reenviada.fila.postulada, HOY,
  'avanzar de estado no puede reescribir cuándo se postuló');

// --- 5. Nada se pierde ---
const conNota = T.agregarNota(reenviada.tablero, id, 'Llamó la reclutadora', '2026-10-02');
c.igual(conNota.error, null, 'se puede anotar');
c.exigir(conNota.fila.historial.length === 4, 'el historial acumula, no reemplaza');
c.exigir(conNota.fila.historial.every((h) => h.fecha && h.texto),
  'toda línea del historial tiene fecha y texto');
c.exigir(T.agregarNota(conNota.tablero, id, '   ', HOY).error !== null,
  'una nota vacía se rechaza');

// --- 6. Qué toca hoy ---
const conVencidos = T.sanear({
  postulaciones: [
    { id: 'a', titulo: 'Vencida hace mucho', empresa: 'Ejemplo Uno', estado: 'postulado',
      postulada: '2026-08-12', proximoSeguimiento: '2026-08-19' },
    { id: 'b', titulo: 'Vencida hace poco', empresa: 'Ejemplo Dos', estado: 'entrevista',
      proximoSeguimiento: '2026-09-14' },
    { id: 'c', titulo: 'Para dentro de días', empresa: 'Ejemplo Tres', estado: 'porPostular',
      proximoSeguimiento: '2026-09-30' },
    { id: 'd', titulo: 'Ya cerrada', empresa: 'Ejemplo Cuatro', estado: 'descartado',
      proximoSeguimiento: '2026-08-01' }
  ]
});

const pendientes = T.pendientesDeHoy(conVencidos, HOY);
c.igual(pendientes.map((p) => p.fila.id), ['a', 'b'],
  'solo lo vencido o de hoy, y lo más atrasado primero');
c.exigir(!pendientes.some((p) => p.fila.estado === 'descartado'),
  'lo cerrado no vuelve a pedir atención');
c.igual(pendientes[0].dias, 28, 'los días de atraso se cuentan bien');

// --- 7. Estancadas: postuladas hace mucho sin noticias ---
const quedadas = T.estancadas(conVencidos, HOY);
c.igual(quedadas.map((q) => q.fila.id), ['a'], 'solo las postuladas hace más de tres semanas');
c.igual(quedadas[0].dias, 35, 'los días desde el envío se cuentan bien');
c.igual(T.estancadas(conVencidos, HOY, 60), [], 'con otro umbral, otro resultado');

// --- 8. Fechas escritas como las escribe una persona ---
c.igual(T.interpretarFecha('+7d', HOY), '2026-09-23', '+7d');
c.igual(T.interpretarFecha('+2s', HOY), '2026-09-30', '+2s');
c.igual(T.interpretarFecha('mañana', HOY), '2026-09-17', 'mañana');
c.igual(T.interpretarFecha('hoy', HOY), HOY, 'hoy');
c.igual(T.interpretarFecha('2026-10-01', HOY), '2026-10-01', 'una fecha ISO');
c.igual(T.interpretarFecha('el jueves', HOY), '', 'lo que no se entiende no se adivina');
c.igual(T.interpretarFecha('', HOY), '', 'vacío es vacío');

const conSeguimiento = T.fijarSeguimiento(conVencidos, 'a', '+3d', HOY);
c.igual(conSeguimiento.fila.proximoSeguimiento, '2026-09-19', 'el seguimiento se puede mover');
c.exigir(T.fijarSeguimiento(conVencidos, 'a', 'cuando sea', HOY).error !== null,
  'una fecha que no se entiende se rechaza en vez de inventarse');

// --- 9. Un archivo dañado no rompe ni inventa ---
c.igual(T.sanear(null).postulaciones, [], 'null da un tablero vacío');
c.igual(T.sanear({ postulaciones: 'no soy una lista' }).postulaciones, [],
  'una forma inesperada da un tablero vacío');
const basura = T.sanear({
  postulaciones: [
    { titulo: 'Válida', empresa: 'Ejemplo', estado: 'inventado', registrada: 'no es fecha' },
    { nada: 'que ver' },
    null
  ]
});
c.igual(basura.postulaciones.length, 1, 'las filas sin datos se descartan');
c.igual(basura.postulaciones[0].estado, 'porPostular', 'un estado desconocido cae al inicial');
c.igual(basura.postulaciones[0].registrada, '', 'una fecha ilegible queda vacía, no inventada');

// --- 10. El resumen cubre todos los estados y suma bien ---
const conteo = T.resumen(conVencidos);
c.igual(conteo.length, Object.keys(T.ESTADOS).length, 'el resumen nombra todos los estados');
c.igual(conteo.reduce((suma, r) => suma + r.cuantas, 0), 4,
  'el resumen cuenta todas las postulaciones, sin perder ninguna');

c.cerrar();
