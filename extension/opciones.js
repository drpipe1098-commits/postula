/**
 * POSTULA — Página de Perfil Único.
 *
 * Dibuja el formulario a partir del esquema de lib/perfil.js: agregar un
 * campo allá lo hace aparecer aquí sin tocar este archivo.
 *
 * Guarda en chrome.storage.local. No hay servidor, no hay sincronización,
 * no hay envío de nada a ninguna parte.
 */
'use strict';

const P = globalThis.POSTULA_Perfil;
const $ = (id) => document.getElementById(id);

let perfil = P.perfilVacio();

function campoHTML(campo, valor, prefijo) {
  const nombre = prefijo ? `${prefijo}.${campo.id}` : campo.id;
  const ancho = (campo.tipo === 'parrafo') ? ' ancho' : '';
  const seguro = String(valor || '').replace(/"/g, '&quot;');
  const textoSeguro = String(valor || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let control;
  if (campo.tipo === 'parrafo') {
    control = `<textarea id="${nombre}" data-campo="${nombre}">${textoSeguro}</textarea>`;
  } else if (campo.tipo === 'opcion') {
    const opciones = ['<option value="">— Sin especificar —</option>']
      .concat(campo.opciones.map((o) => {
        const sel = String(valor) === o ? ' selected' : '';
        return `<option value="${o.replace(/"/g, '&quot;')}"${sel}>${o}</option>`;
      }));
    control = `<select id="${nombre}" data-campo="${nombre}">${opciones.join('')}</select>`;
  } else {
    const tipos = { email: 'email', tel: 'tel', url: 'url', numero: 'number', fecha: 'date' };
    const tipo = tipos[campo.tipo] || 'text';
    control = `<input type="${tipo}" id="${nombre}" data-campo="${nombre}" value="${seguro}">`;
  }

  const marca = campo.requerido ? ' <span style="color:#dc2626">*</span>' : '';
  return `<div class="${ancho.trim()}"><label for="${nombre}">${campo.etiqueta}${marca}</label>${control}</div>`;
}

function filaListaHTML(lista, fila, indice) {
  const campos = lista.campos
    .map((campo) => campoHTML(campo, fila[campo.id], `${lista.id}[${indice}]`))
    .join('');
  return `<div class="fila-lista" data-lista="${lista.id}" data-indice="${indice}">
      <div class="rejilla">${campos}</div>
      <button type="button" class="quitar" data-quitar="${lista.id}" data-indice="${indice}">Quitar</button>
    </div>`;
}

function dibujar() {
  const partes = P.GRUPOS.map((grupo) => `
    <section class="grupo">
      <h2>${grupo.titulo}</h2>
      <div class="sutil">${grupo.ayuda}</div>
      <div class="rejilla">${grupo.campos.map((c) => campoHTML(c, perfil[c.id], '')).join('')}</div>
    </section>`);

  P.LISTAS.forEach((lista) => {
    const filas = (perfil[lista.id] || []).map((f, i) => filaListaHTML(lista, f, i)).join('');
    partes.push(`
      <section class="grupo">
        <h2>${lista.titulo}</h2>
        <div class="sutil">Agrega las que quieras. Se usan para los formularios largos.</div>
        <div id="lista-${lista.id}">${filas}</div>
        <button type="button" style="margin-top:12px" data-agregar="${lista.id}">Agregar ${lista.titulo.toLowerCase()}</button>
      </section>`);
  });

  $('formulario').innerHTML = partes.join('');
}

function leerFormulario() {
  const nuevo = P.perfilVacio();
  P.LISTAS.forEach((lista) => { nuevo[lista.id] = (perfil[lista.id] || []).map(() => ({})); });

  $('formulario').querySelectorAll('[data-campo]').forEach((el) => {
    const clave = el.getAttribute('data-campo');
    const enLista = clave.match(/^([a-zA-Z]+)\[(\d+)\]\.(.+)$/);
    if (enLista) {
      const [, listaId, indice, campoId] = enLista;
      if (!nuevo[listaId][indice]) nuevo[listaId][indice] = {};
      nuevo[listaId][indice][campoId] = el.value;
    } else {
      nuevo[clave] = el.value;
    }
  });
  return P.sanear(nuevo);
}

function avisar(clase, texto) {
  $('estado').innerHTML = texto ? `<div class="aviso ${clase}">${texto}</div>` : '';
}

async function guardar() {
  perfil = leerFormulario();
  const errores = P.validar(perfil);
  await chrome.storage.local.set({ perfil });

  if (errores.length) {
    avisar('ojo', '<strong>Guardado.</strong> Faltan datos que casi todos los portales piden:<br>'
      + errores.map((e) => '· ' + e).join('<br>'));
  } else {
    avisar('bien', '<strong>Guardado.</strong> Ya puedes rellenar formularios desde cualquier portal.');
  }
  $('mensaje').textContent = 'Guardado ' + new Date().toLocaleTimeString('es-CO');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exportar() {
  perfil = leerFormulario();
  const blob = new Blob([JSON.stringify(perfil, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'mi-perfil-postula.json';
  enlace.click();
  URL.revokeObjectURL(url);
  $('mensaje').textContent = 'Copia descargada. Guárdala en un lugar seguro.';
}

function importar(archivo) {
  const lector = new FileReader();
  lector.onload = async () => {
    try {
      perfil = P.sanear(JSON.parse(String(lector.result)));
      await chrome.storage.local.set({ perfil });
      dibujar();
      avisar('bien', 'Copia cargada correctamente.');
    } catch (error) {
      avisar('mal', 'Ese archivo no es una copia válida de POSTULA.');
    }
  };
  lector.readAsText(archivo);
}

function conectarEventos() {
  $('formulario').addEventListener('click', (evento) => {
    const agregar = evento.target.getAttribute('data-agregar');
    const quitar = evento.target.getAttribute('data-quitar');
    if (!agregar && !quitar) return;

    perfil = leerFormulario();
    if (agregar) {
      perfil[agregar] = (perfil[agregar] || []).concat([{}]);
    } else {
      const indice = Number(evento.target.getAttribute('data-indice'));
      perfil[quitar] = (perfil[quitar] || []).filter((_, i) => i !== indice);
    }
    dibujar();
  });

  $('guardar').addEventListener('click', guardar);
  $('exportar').addEventListener('click', exportar);
  $('importar').addEventListener('click', () => $('archivo').click());
  $('archivo').addEventListener('change', (evento) => {
    if (evento.target.files[0]) importar(evento.target.files[0]);
  });
}

async function iniciar() {
  const guardado = await chrome.storage.local.get('perfil');
  perfil = P.sanear(guardado.perfil);
  if (!(perfil.experiencia || []).length) perfil.experiencia = [{}];
  if (!(perfil.idiomas || []).length) perfil.idiomas = [{}];
  dibujar();
  conectarEventos();
}

iniciar();
