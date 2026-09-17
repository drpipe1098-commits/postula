/**
 * CANDADO — Los datos del usuario no salen de su computador.
 *
 * Esta es la promesa central del producto y la razón por la que POSTULA no
 * queda sujeto a las obligaciones de un responsable de tratamiento de datos
 * personales. Si alguien agrega una llamada de red, esta prueba lo bloquea.
 */
import { leer, archivosDe, contrato } from './ayuda.mjs';

const c = contrato('privacidad-contract');

const PROHIBIDO_EN_CODIGO = [
  ['fetch(', 'la extensión no puede hacer peticiones de red'],
  ['XMLHttpRequest', 'la extensión no puede hacer peticiones de red'],
  ['WebSocket', 'la extensión no puede abrir conexiones permanentes'],
  ['sendBeacon', 'la extensión no puede enviar telemetría'],
  ['EventSource', 'la extensión no puede abrir conexiones permanentes'],
  ['chrome.storage.sync', 'el perfil vive solo en este equipo, nunca en la nube'],
  ['importScripts', 'no se carga código externo'],
  ['eval(', 'no se ejecuta código dinámico']
];

archivosDe('extension', ['.js']).forEach((archivo) => {
  const codigo = leer(archivo);
  PROHIBIDO_EN_CODIGO.forEach(([aguja, razon]) => {
    c.exigir(!codigo.includes(aguja), `${archivo} usa «${aguja}»: ${razon}`);
  });
  // Ninguna URL absoluta a un servidor: ni analítica, ni CDN, ni API.
  const urls = codigo.match(/https?:\/\/[^\s'"`)]+/g) || [];
  const fueraDeEjemplos = urls.filter((url) => !/ejemplo|example|localhost/i.test(url));
  c.exigir(fueraDeEjemplos.length === 0,
    `${archivo} apunta a un host externo: ${fueraDeEjemplos.join(', ')}`);
});

const manifiesto = JSON.parse(leer('extension/manifest.json'));

c.exigir(!manifiesto.host_permissions,
  'el manifiesto no debe pedir permisos de host: la extensión solo actúa en la pestaña activa cuando el usuario hace clic');
c.exigir(!manifiesto.content_scripts,
  'no debe haber content scripts permanentes: la extensión no observa la navegación del usuario');
c.exigir(!manifiesto.background,
  'no debe haber proceso en segundo plano');

const permisos = manifiesto.permissions || [];
const PERMITIDOS = ['storage', 'activeTab', 'scripting'];
permisos.forEach((permiso) => {
  c.exigir(PERMITIDOS.includes(permiso),
    `permiso no autorizado en el manifiesto: «${permiso}»`);
});
c.exigir(!permisos.includes('tabs'), 'el permiso «tabs» daría acceso al historial de navegación');
c.exigir(!permisos.includes('webRequest'), 'el permiso «webRequest» daría acceso al tráfico del usuario');

c.cerrar();
