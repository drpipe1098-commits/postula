/**
 * CANDADO — Comportamiento del motor de autorrelleno sin navegador.
 *
 * Verifica las decisiones que no dependen del DOM: de dónde sale cada valor,
 * los respaldos y la elección de opciones en las listas desplegables.
 */
import { cargar, contrato } from './ayuda.mjs';

const ambito = cargar([
  'extension/lib/normalizar.js',
  'extension/lib/perfil.js',
  'extension/content/matcher.js',
  'extension/content/autofill.js'
]);
const { valorPara, elegirOpcion } = ambito.POSTULA_Autofill;
const P = ambito.POSTULA_Perfil;
const c = contrato('autofill-contract');

const perfil = Object.assign(P.perfilVacio(), {
  nombres: 'Ana María',
  apellidos: 'Gómez Ruiz',
  celular: '3001234567',
  telefono: '',
  ciudad: 'Pereira',
  modalidad: 'Remoto'
});

c.igual(valorPara('nombres', perfil), 'Ana María', 'valor directo del perfil');
c.igual(valorPara('nombreCompleto', perfil), 'Ana María Gómez Ruiz', 'nombre completo derivado');
c.igual(valorPara('telefono', perfil), '3001234567',
  'sin teléfono fijo se usa el celular, que es lo que la persona escribiría');
c.igual(valorPara('email', perfil), '', 'un campo sin dato no inventa nada');

// Listas desplegables: elegir la opción más parecida, sin forzar.
function selectFalso(opciones) {
  const eventos = [];
  return {
    value: '',
    options: opciones.map((o) => (typeof o === 'string' ? { textContent: o, value: o } : o)),
    dispatchEvent: (evento) => eventos.push(evento.type),
    eventos
  };
}
// El sandbox de vm no trae Event: se usa el del proceso de prueba.
ambito.Event = class { constructor(tipo) { this.type = tipo; } };

let sel = selectFalso(['Seleccione', 'Remoto', 'Híbrido', 'Presencial']);
c.exigir(elegirOpcion(sel, 'Remoto') === true, 'debe encontrar la opción exacta');
c.igual(sel.value, 'Remoto', 'debe seleccionar la opción exacta');

sel = selectFalso([{ textContent: 'Cédula de ciudadanía', value: 'CC' }, { textContent: 'Pasaporte', value: 'PA' }]);
c.exigir(elegirOpcion(sel, 'Cédula de ciudadanía') === true, 'debe emparejar por texto visible');
c.igual(sel.value, 'CC', 'debe guardar el value interno, no el texto');

sel = selectFalso(['Bogotá', 'Medellín', 'Cali']);
c.exigir(elegirOpcion(sel, 'Pereira') === false, 'si ninguna opción se parece, no se elige nada');
c.igual(sel.value, '', 'una lista sin coincidencia queda intacta');

sel = selectFalso(['Bogotá', 'Pereira']);
c.exigir(elegirOpcion(sel, '') === false, 'un valor vacío nunca selecciona nada');

c.cerrar();
