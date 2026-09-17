/**
 * POSTULA — Motor de autorrelleno.
 *
 * Se inyecta en la pestaña activa SOLO cuando el usuario hace clic en el
 * botón de la extensión. Recorre el formulario, pregunta al matcher qué es
 * cada campo y escribe el dato correspondiente del perfil.
 *
 * GARANTÍA DE PRODUCTO: este archivo nunca envía el formulario.
 * No hace clic en botones, no llama submit() y no dispara eventos de envío.
 * El usuario revisa y envía.
 */
(function (raiz) {
  'use strict';

  const N = raiz.POSTULA_Normalizar;
  const M = raiz.POSTULA_Matcher;
  const P = raiz.POSTULA_Perfil;
  const X = raiz.POSTULA_Experiencia;

  const TIPOS_RELLENABLES = ['text', 'email', 'tel', 'url', 'number', 'date', 'month', 'textarea'];

  /** ¿El elemento está visible para la persona? */
  function esVisible(el) {
    if (!el || !el.getClientRects) return false;
    if (el.getClientRects().length === 0) return false;
    const estilo = el.ownerDocument.defaultView.getComputedStyle(el);
    return estilo.visibility !== 'hidden' && estilo.display !== 'none' && estilo.opacity !== '0';
  }

  /** Texto de la etiqueta visible asociada al campo. */
  function etiquetaDe(el) {
    const doc = el.ownerDocument;
    const partes = [];

    if (el.id) {
      const porFor = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (porFor) partes.push(porFor.textContent);
    }
    const envolvente = el.closest('label');
    if (envolvente) partes.push(envolvente.textContent);

    const etiquetada = el.getAttribute('aria-labelledby');
    if (etiquetada) {
      etiquetada.split(/\s+/).forEach((id) => {
        const ref = doc.getElementById(id);
        if (ref) partes.push(ref.textContent);
      });
    }
    return partes.join(' ').slice(0, 300);
  }

  /** Texto cercano: muchos portales ponen el rótulo en un div hermano. */
  function textoCercano(el) {
    const contenedor = el.closest('div, li, td, fieldset, section');
    if (!contenedor) return '';
    const clon = contenedor.cloneNode(true);
    clon.querySelectorAll('input, textarea, select, script, style, button').forEach((n) => n.remove());
    return (clon.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  function descriptorDe(el) {
    const esTextarea = el.tagName === 'TEXTAREA';
    const esSelect = el.tagName === 'SELECT';
    return {
      etiqueta: etiquetaDe(el),
      ariaLabel: el.getAttribute('aria-label') || '',
      placeholder: el.getAttribute('placeholder') || '',
      nombre: el.getAttribute('name') || '',
      id: el.id || '',
      nombreClase: el.className && typeof el.className === 'string' ? el.className : '',
      textoCercano: textoCercano(el),
      autocomplete: el.getAttribute('autocomplete') || '',
      tipo: esTextarea ? 'textarea' : (esSelect ? 'text' : String(el.type || 'text').toLowerCase()),
      esLista: esSelect,
      deshabilitado: !!el.disabled,
      soloLectura: !!el.readOnly
    };
  }

  /**
   * Valor del perfil para un campo detectado, con respaldos sensatos.
   * Si el perfil no trae teléfono fijo, se usa el celular; es lo que la
   * persona haría a mano.
   */
  function valorPara(campo, perfil) {
    if (campo === 'nombreCompleto') return P.nombreCompleto(perfil);
    const valor = String(perfil[campo] || '').trim();
    if (valor) return valor;
    if (campo === 'telefono') return String(perfil.celular || '').trim();
    if (campo === 'celular') return String(perfil.telefono || '').trim();
    return '';
  }

  /** Escribe en el elemento de forma que React, Vue y Angular se enteren. */
  function escribir(el, valor) {
    const prototipo = el.tagName === 'TEXTAREA'
      ? raiz.HTMLTextAreaElement.prototype
      : raiz.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototipo, 'value');
    if (setter && setter.set) {
      setter.set.call(el, valor);
    } else {
      el.value = valor;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Elige la opción de un <select> que más se parezca al valor del perfil. */
  function elegirOpcion(el, valor) {
    const objetivo = N.normalizar(valor);
    if (!objetivo) return false;
    let mejor = null;
    Array.from(el.options).forEach((opcion) => {
      const texto = N.normalizar(opcion.textContent);
      const propio = N.normalizar(opcion.value);
      if (!texto && !propio) return;
      let puntaje = 0;
      if (texto === objetivo || propio === objetivo) puntaje = 100;
      else if (texto.includes(objetivo) || objetivo.includes(texto)) puntaje = 60;
      else if (propio.includes(objetivo) || objetivo.includes(propio)) puntaje = 50;
      if (puntaje && (!mejor || puntaje > mejor.puntaje)) mejor = { opcion, puntaje };
    });
    if (!mejor) return false;
    el.value = mejor.opcion.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  /**
   * Agrupa los campos de experiencia en bloques, uno por empleo.
   *
   * El bloque de un campo es el ancestro MÁS PEQUEÑO que contenga al menos
   * dos clases distintas de campo de fila. Con eso, en un formulario que
   * lista cuatro empleos cada fila encuentra su propio contenedor, y en un
   * formulario de «agregar experiencia» —que muestra uno solo— el bloque
   * acaba siendo el formulario entero. Las dos formas son correctas.
   */
  function agruparEnBloques(detectados) {
    const conteoPorNodo = new Map();
    detectados.forEach(({ el, campo }) => {
      let nodo = el.parentElement;
      while (nodo) {
        if (!conteoPorNodo.has(nodo)) conteoPorNodo.set(nodo, new Map());
        const conteo = conteoPorNodo.get(nodo);
        conteo.set(campo, (conteo.get(campo) || 0) + 1);
        nodo = nodo.parentElement;
      }
    });

    /**
     * Un bloque es UN empleo: no puede contener dos cargos ni dos empresas.
     * Un contenedor con dos «nombre del cargo» adentro no es un empleo, es
     * la lista entera.
     *
     * Sin esta regla, un campo de fila suelto —«Habilidades requeridas para
     * el cargo», que ni siquiera es del historial— sube por el DOM hasta
     * `body`, encuentra allí campos de sobra y adopta el documento completo
     * como si fuera su bloque.
     *
     * Las fechas sí pueden repetirse: los portales parten una sola fecha en
     * una lista de meses y una casilla de año, y las dos son del mismo
     * empleo.
     */
    const esBloque = (nodo) => {
      const conteo = conteoPorNodo.get(nodo);
      if (!conteo || conteo.size < 2) return false;
      return X.CAMPOS_UNICOS.every((campo) => (conteo.get(campo) || 0) <= 1);
    };

    const bloquePorNodo = new Map();
    detectados.forEach((item) => {
      let nodo = item.el.parentElement;
      while (nodo && !esBloque(nodo)) nodo = nodo.parentElement;
      if (!nodo) return; // campo suelto: no pertenece a ningún empleo
      if (!bloquePorNodo.has(nodo)) bloquePorNodo.set(nodo, []);
      bloquePorNodo.get(nodo).push(item);
    });

    return Array.from(bloquePorNodo.entries()).map(([nodo, campos]) => ({ nodo, campos }));
  }

  /** Lo que un bloque YA dice sobre de qué empleo habla. */
  function señasDelBloque(bloque) {
    let empresa = '';
    const anos = [];
    bloque.campos.forEach(({ el, campo }) => {
      const valor = String(el.value || '').trim();
      if (!valor) return;
      if (campo === 'empresa') empresa = valor;
      if (campo === 'desde' || campo === 'hasta' || campo === 'empresa') {
        const encontrados = valor.match(/\b(19|20)\d{2}\b/g) || [];
        encontrados.forEach((a) => anos.push(Number(a)));
      }
    });
    return { empresa, anos };
  }

  /** Un formulario con campo de contraseña es un login: no se toca. */
  function esFormularioDeAcceso(el) {
    const form = el.closest('form');
    if (!form) return false;
    return !!form.querySelector('input[type="password"]');
  }

  function marcar(el, exito) {
    const previo = el.style.outline;
    el.style.outline = exito ? '2px solid #16a34a' : '2px solid #f59e0b';
    el.style.outlineOffset = '1px';
    raiz.setTimeout(() => { el.style.outline = previo; }, 2600);
  }

  /** ¿Se puede escribir en este control? */
  function esRellenable(el) {
    const esSelect = el.tagName === 'SELECT';
    const esTextarea = el.tagName === 'TEXTAREA';
    const tipo = esTextarea ? 'textarea' : (esSelect ? 'text' : String(el.type || 'text').toLowerCase());
    if (!esSelect && !TIPOS_RELLENABLES.includes(tipo)) return false;
    if (el.disabled || el.readOnly) return false;
    if (!esVisible(el)) return false;
    if (esFormularioDeAcceso(el)) return false;
    return true;
  }

  /**
   * Intenta poner un valor en un control, con la política de siempre: no se
   * pisa lo que la persona ya escribió salvo que lo pida.
   */
  function intentarEscribir(el, valor, campo, informe, config) {
    if (!valor) {
      informe.omitidos.push({ campo, razon: 'sin dato en el perfil' });
      return false;
    }
    if (String(el.value || '').trim() && !config.sobrescribir) {
      informe.omitidos.push({ campo, razon: 'ya tenía un valor escrito' });
      marcar(el, false);
      return false;
    }
    if (el.tagName === 'SELECT') {
      if (!elegirOpcion(el, valor)) {
        informe.omitidos.push({ campo, razon: 'la lista no tiene una opción parecida' });
        marcar(el, false);
        return false;
      }
    } else {
      escribir(el, valor);
    }
    marcar(el, true);
    return true;
  }

  /**
   * Rellena el formulario visible de la página.
   *
   * Va en dos pasadas y el orden importa. Primero el historial laboral, que
   * necesita saber de qué empleo habla cada bloque; después todo lo demás.
   * Los campos que pertenecen a un bloque quedan fuera del alcance de la
   * segunda pasada **aunque no se hayan podido llenar**: así el motor
   * general no puede volver a meter el titular profesional dentro de la fila
   * de un empleo pasado, que es el fallo que obligó a escribir esto.
   *
   * @param {object} perfil
   * @param {{sobrescribir?: boolean}} [opciones]
   * @returns {{llenados: Array, omitidos: Array, sinCoincidencia: number, bloques: number}}
   */
  function rellenar(perfil, opciones) {
    const config = opciones || {};
    const doc = raiz.document;
    const informe = { llenados: [], omitidos: [], sinCoincidencia: 0, bloques: 0 };
    const candidatos = Array.from(doc.querySelectorAll('input, textarea, select'))
      .filter(esRellenable);

    // --- Pasada 1: bloques de experiencia laboral ---
    const deFila = [];
    const descriptores = new Map();
    candidatos.forEach((el) => {
      const descriptor = descriptorDe(el);
      descriptores.set(el, descriptor);
      const fila = X.detectarCampoDeFila(descriptor);
      if (fila) deFila.push({ el, campo: fila.campo, descriptor });
    });

    const bloques = agruparEnBloques(deFila);
    const experiencia = Array.isArray(perfil.experiencia) ? perfil.experiencia : [];
    const asignacion = X.emparejar(bloques.map(señasDelBloque), experiencia);
    const enBloque = new Set();
    informe.bloques = bloques.length;

    bloques.forEach((bloque, indice) => {
      const entrada = experiencia[asignacion[indice]];
      bloque.campos.forEach(({ el, campo, descriptor }) => {
        enBloque.add(el);
        if (!entrada) {
          informe.omitidos.push({ campo: `experiencia.${campo}`, razon: 'no se supo de qué empleo habla el bloque' });
          marcar(el, false);
          return;
        }
        const valor = X.valorDeFila(campo, entrada, descriptor);
        if (intentarEscribir(el, valor, `experiencia.${campo}`, informe, config)) {
          informe.llenados.push({ campo: `experiencia.${campo}`, puntaje: 100, via: 'bloque' });
        }
      });
    });

    // --- Pasada 2: el resto del perfil ---
    candidatos.forEach((el) => {
      if (enBloque.has(el)) return;
      const deteccion = M.detectar(descriptores.get(el));
      if (!deteccion) { informe.sinCoincidencia += 1; return; }
      const valor = valorPara(deteccion.campo, perfil);
      if (intentarEscribir(el, valor, deteccion.campo, informe, config)) {
        informe.llenados.push({
          campo: deteccion.campo,
          puntaje: Math.round(deteccion.puntaje),
          via: deteccion.via
        });
      }
    });

    return informe;
  }

  raiz.POSTULA_Autofill = {
    rellenar, descriptorDe, valorPara, elegirOpcion, esFormularioDeAcceso,
    agruparEnBloques, señasDelBloque, esRellenable
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
