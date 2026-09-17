/**
 * POSTULA — Popup.
 *
 * Inyecta el motor en la pestaña activa solo cuando la persona hace clic.
 * No hay content script permanente: la extensión no observa tu navegación.
 */
'use strict';

const ARCHIVOS = [
  'lib/normalizar.js',
  'lib/perfil.js',
  'content/matcher.js',
  'content/experiencia.js',
  'content/autofill.js'
];

const $ = (id) => document.getElementById(id);

function mostrar(contenedor, clase, html) {
  contenedor.innerHTML = `<div class="aviso ${clase}">${html}</div>`;
}

async function cargarPerfil() {
  const { perfil } = await chrome.storage.local.get('perfil');
  return perfil || null;
}

function resumirInforme(informes) {
  const total = { llenados: [], omitidos: [], sinCoincidencia: 0 };
  informes.forEach((r) => {
    if (!r || !r.result) return;
    total.llenados.push(...r.result.llenados);
    total.omitidos.push(...r.result.omitidos);
    total.sinCoincidencia += r.result.sinCoincidencia;
  });
  return total;
}

function pintarInforme(informe) {
  const caja = $('informe');
  if (!informe.llenados.length && !informe.omitidos.length) {
    mostrar(caja, 'ojo', 'No se encontró ningún campo reconocible en esta página. '
      + 'Si es un formulario de postulación, avísame cuál portal es para agregarlo.');
    return;
  }

  let html = `<div class="aviso bien"><strong>${informe.llenados.length}</strong> `
    + `campo${informe.llenados.length === 1 ? '' : 's'} rellenado`
    + `${informe.llenados.length === 1 ? '' : 's'}. Revisa antes de enviar.</div>`;

  if (informe.omitidos.length) {
    const agrupados = {};
    informe.omitidos.forEach((o) => {
      agrupados[o.razon] = (agrupados[o.razon] || 0) + 1;
    });
    html += '<div class="sutil">Sin rellenar:<ul>'
      + Object.entries(agrupados).map(([razon, n]) => `<li>${n} · ${razon}</li>`).join('')
      + '</ul></div>';
  }
  caja.innerHTML = html;
}

async function rellenar() {
  const caja = $('informe');
  caja.innerHTML = '';

  const perfil = await cargarPerfil();
  if (!perfil) {
    mostrar(caja, 'mal', 'Todavía no has creado tu perfil. Abre <strong>Editar mi perfil</strong> y llénalo una sola vez.');
    return;
  }

  const [pestana] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!pestana || /^(chrome|edge|about|chrome-extension):/i.test(pestana.url || '')) {
    mostrar(caja, 'ojo', 'Esta página del navegador no permite extensiones. Abre el portal de empleo e inténtalo ahí.');
    return;
  }

  $('rellenar').disabled = true;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: pestana.id, allFrames: true },
      files: ARCHIVOS
    });
    const sobrescribir = $('sobrescribir').checked;
    const resultados = await chrome.scripting.executeScript({
      target: { tabId: pestana.id, allFrames: true },
      func: (p, s) => globalThis.POSTULA_Autofill.rellenar(p, { sobrescribir: s }),
      args: [perfil, sobrescribir]
    });
    pintarInforme(resumirInforme(resultados));
  } catch (error) {
    mostrar(caja, 'mal', 'No se pudo trabajar en esta página: ' + String(error.message || error));
  } finally {
    $('rellenar').disabled = false;
  }
}

async function iniciar() {
  const perfil = await cargarPerfil();
  if (!perfil) {
    mostrar($('estado'), 'ojo', 'Primer paso: crea tu perfil. Solo se hace una vez.');
    $('rellenar').disabled = true;
  }
  $('rellenar').addEventListener('click', rellenar);
  $('perfil').addEventListener('click', () => chrome.runtime.openOptionsPage());
}

iniciar();
