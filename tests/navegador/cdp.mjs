/**
 * POSTULA — Cliente mínimo del protocolo de Chrome (CDP).
 *
 * Permite manejar un Chromium real desde Node sin instalar ninguna
 * dependencia: Node 22 trae WebSocket nativo. Así las pruebas de navegador
 * respetan la regla del proyecto de no tener dependencias.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATOS = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium'
].filter(Boolean);

export function buscarNavegador() {
  // Si el entorno fija POSTULA_CHROME, esa ruta manda: una ruta explícita
  // que no existe debe fallar, no caer silenciosamente en otro navegador.
  if (process.env.POSTULA_CHROME) {
    return existsSync(process.env.POSTULA_CHROME) ? process.env.POSTULA_CHROME : null;
  }
  const directo = CANDIDATOS.find((ruta) => existsSync(ruta));
  if (directo) return directo;
  // Rutas con comodín: /opt/pw-browsers/chromium-*/chrome-linux/chrome
  try {
    const base = '/opt/pw-browsers';
    const carpeta = readdirSync(base).find((n) => n.startsWith('chromium-'));
    if (carpeta) {
      const ruta = `${base}/${carpeta}/chrome-linux/chrome`;
      if (existsSync(ruta)) return ruta;
    }
  } catch { /* sin navegador */ }
  return null;
}

function esperar(ms) {
  return new Promise((listo) => setTimeout(listo, ms));
}

/**
 * El puerto real que abrió el navegador.
 *
 * Chrome escribe en `DevToolsActivePort`, dentro del perfil, el puerto que
 * de verdad acabó usando. Preguntárselo al archivo en vez de asumir el que
 * se pidió evita el fallo silencioso cuando ese puerto ya estaba ocupado:
 * Chrome levanta igual, en otro puerto, y quien espera en el pedido se
 * queda esperando hasta agotar el tiempo.
 */
function puertoReal(perfil, puertoPedido) {
  try {
    const archivo = join(perfil, 'DevToolsActivePort');
    const primera = readFileSync(archivo, 'utf8').split('\n')[0].trim();
    const leido = Number(primera);
    if (Number.isInteger(leido) && leido > 0) return leido;
  } catch { /* todavía no lo ha escrito */ }
  return puertoPedido;
}

async function puntoDeEntrada(puertoPedido, perfil, diagnostico, intentos = 160) {
  let ultimoError = null;
  for (let i = 0; i < intentos; i += 1) {
    const puerto = puertoReal(perfil, puertoPedido);
    try {
      const respuesta = await fetch(`http://127.0.0.1:${puerto}/json/list`);
      const objetivos = await respuesta.json();
      const pagina = objetivos.find((o) => o.type === 'page' && o.webSocketDebuggerUrl);
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch (error) { ultimoError = error; }
    await esperar(250);
  }
  // Sin esto, un fallo en CI es indistinguible de cualquier otro: el error
  // decía solo «no expuso su punto de depuración» y la salida del navegador
  // se descartaba, así que no había forma de saber por qué.
  const salida = diagnostico().trim();
  throw new Error(
    'El navegador no expuso su punto de depuración a tiempo.'
    + `\n  binario: ${diagnostico.binario}`
    + `\n  puerto pedido: ${puertoPedido}, puerto real: ${puertoReal(perfil, puertoPedido)}`
    + `\n  último error de conexión: ${ultimoError ? ultimoError.message : 'ninguno'}`
    + (salida ? `\n  salida del navegador:\n${salida.split('\n').map((l) => `    ${l}`).join('\n')}` : '\n  el navegador no escribió nada')
  );
}

export async function abrirNavegador() {
  const binario = buscarNavegador();
  if (!binario) return null;

  // Puerto 0 = que lo escoja el sistema. Un puerto fijo o aleatorio puede
  // estar ocupado, y entonces Chrome abre otro sin avisar.
  const puerto = 0;
  // Un perfil nuevo por corrida: uno compartido en /tmp queda bloqueado por
  // el Chrome anterior si no alcanzó a cerrarse, y el siguiente no levanta.
  const perfil = mkdtempSync(join(tmpdir(), 'postula-chrome-'));

  const proceso = spawn(binario, [
    '--headless=new',
    `--remote-debugging-port=${puerto}`,
    '--remote-allow-origins=*',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--allow-file-access-from-files',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${perfil}`,
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  // Se guarda lo que diga el navegador para poder explicar un fallo.
  let dicho = '';
  const recoger = (trozo) => { dicho += trozo.toString(); };
  proceso.stdout.on('data', recoger);
  proceso.stderr.on('data', recoger);
  proceso.on('error', (error) => { dicho += `\nno se pudo ejecutar: ${error.message}`; });
  proceso.on('exit', (codigo, senal) => {
    dicho += `\nel navegador terminó (código ${codigo}, señal ${senal})`;
  });

  const diagnostico = () => dicho;
  diagnostico.binario = binario;

  const url = await puntoDeEntrada(puerto, perfil, diagnostico);
  const socket = new WebSocket(url);
  await new Promise((listo, falla) => {
    socket.onopen = listo;
    socket.onerror = () => falla(new Error('No se pudo conectar al navegador.'));
  });

  let siguiente = 0;
  const pendientes = new Map();
  const oyentes = [];

  socket.onmessage = (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (mensaje.id !== undefined) {
      const espera = pendientes.get(mensaje.id);
      if (!espera) return;
      pendientes.delete(mensaje.id);
      if (mensaje.error) espera.falla(new Error(mensaje.error.message));
      else espera.listo(mensaje.result);
      return;
    }
    oyentes.forEach((oyente) => oyente(mensaje));
  };

  function enviar(metodo, params = {}) {
    siguiente += 1;
    const id = siguiente;
    socket.send(JSON.stringify({ id, method: metodo, params }));
    return new Promise((listo, falla) => {
      pendientes.set(id, { listo, falla });
      setTimeout(() => {
        if (pendientes.delete(id)) falla(new Error(`Tiempo agotado en ${metodo}`));
      }, 20000);
    });
  }

  return {
    binario,
    enviar,
    alRecibir(oyente) { oyentes.push(oyente); },
    esperarEvento(nombre, tiempo = 15000) {
      return new Promise((listo, falla) => {
        const reloj = setTimeout(() => falla(new Error(`No llegó el evento ${nombre}`)), tiempo);
        oyentes.push(function propio(mensaje) {
          if (mensaje.method !== nombre) return;
          clearTimeout(reloj);
          listo(mensaje.params);
        });
      });
    },
    async cerrar() {
      try { socket.close(); } catch { /* ya cerrado */ }
      proceso.kill('SIGKILL');
      await esperar(120);
    }
  };
}
