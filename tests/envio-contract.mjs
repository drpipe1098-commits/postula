/**
 * CANDADO — POSTULA nunca envía el formulario.
 *
 * El usuario revisa y envía. Esta decisión no se revisa: es lo que separa a
 * POSTULA de un bot que hace que le bloqueen la cuenta a la persona y lo que
 * mantiene el producto dentro de los términos de los portales de empleo.
 */
import { leer, archivosDe, contrato } from './ayuda.mjs';

const c = contrato('envio-contract');

const PROHIBIDO = [
  ['.submit(', 'enviaría el formulario'],
  ['requestSubmit', 'enviaría el formulario'],
  ['.click(', 'haría clic por el usuario'],
  ["new event('submit'", 'dispararía el evento de envío'],
  ['new event("submit"', 'dispararía el evento de envío'],
  ['submitevent', 'dispararía el evento de envío'],
  ['[type="submit"]', 'buscaría el botón de enviar'],
  ['postular', 'buscaría el botón de postular'],
  ['aplicar ahora', 'buscaría el botón de aplicar']
];

// Solo se revisa el código que se inyecta en la página del portal.
const inyectados = archivosDe('extension/content', ['.js'])
  .concat(['extension/lib/normalizar.js', 'extension/lib/perfil.js']);

inyectados.forEach((archivo) => {
  const codigo = leer(archivo).toLowerCase();
  PROHIBIDO.forEach(([aguja, razon]) => {
    c.exigir(!codigo.includes(aguja.toLowerCase()),
      `${archivo} contiene «${aguja}»: ${razon}`);
  });
});

// --- Las herramientas de terminal tampoco entran a los portales ---
//
// Son el lugar donde más fácil se colaría un bot: en una terminal no hay
// políticas de la extensión que lo impidan. Bastaría con un `fetch` a
// Computrabajo o con arrancar un navegador automatizado. Estas prohibiciones
// son la única cosa que separa a POSTULA de eso.
const AUTOMATIZACION_PROHIBIDA = [
  ['fetch(', 'haría peticiones a los portales'],
  ["node:http", 'abriría conexiones de red'],
  ["node:https", 'abriría conexiones de red'],
  ["node:net", 'abriría conexiones de red'],
  ["node:dgram", 'abriría conexiones de red'],
  ['websocket', 'abriría una conexión persistente'],
  ['child_process', 'podría arrancar un navegador o un script externo'],
  ['playwright', 'automatizaría el navegador'],
  ['puppeteer', 'automatizaría el navegador'],
  ['selenium', 'automatizaría el navegador'],
  ['webdriver', 'automatizaría el navegador'],
  // Se prohíbe la URL, no el nombre: reconocer «linkedin.com» dentro de la
  // hoja de vida para llenar el campo del perfil es legítimo; construir una
  // dirección hacia el portal para visitarlo, no.
  ['//linkedin', 'navegaría a un portal'],
  ['//www.linkedin', 'navegaría a un portal'],
  ['//computrabajo', 'navegaría a un portal'],
  ['//www.computrabajo', 'navegaría a un portal'],
  ['//elempleo', 'navegaría a un portal'],
  ['//www.elempleo', 'navegaría a un portal'],
  ['//magneto365', 'navegaría a un portal'],
  ['//www.magneto365', 'navegaría a un portal'],
  ['process.env.pass', 'leería una contraseña guardada'],
  ['process.env.clave', 'leería una contraseña guardada'],
  ['dotenv', 'leería credenciales de un archivo .env']
];

const herramientas = archivosDe('herramientas', ['.mjs']);
c.exigir(herramientas.length > 0, 'las herramientas de terminal deben existir para poder revisarlas');

herramientas.forEach((archivo) => {
  const codigo = leer(archivo).toLowerCase();
  AUTOMATIZACION_PROHIBIDA.forEach(([aguja, razon]) => {
    c.exigir(!codigo.includes(aguja.toLowerCase()),
      `${archivo} contiene «${aguja}»: ${razon}`);
  });
});

const revisor = leer('herramientas/vacantes.mjs');
c.exigir(revisor.includes('POSTULA no envía formularios'),
  'vacantes.mjs debe recordarle a la persona que la postulación la envía ella');

const autofill = leer('extension/content/autofill.js');
c.exigir(autofill.includes('nunca envía el formulario'),
  'autofill.js debe declarar la garantía de no envío en su encabezado');
c.exigir(autofill.includes('esFormularioDeAcceso'),
  'autofill.js debe saltarse los formularios de inicio de sesión');

c.cerrar();
