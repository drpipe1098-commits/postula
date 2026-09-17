/**
 * POSTULA — Bloques de experiencia laboral.
 *
 * El motor de autorrelleno decide campo por campo y no sabe dónde está. Eso
 * basta para los datos que la persona tiene una sola vez —su correo, su
 * cédula— pero se rompe en el historial laboral, donde el mismo rótulo
 * aparece una vez por cada empleo.
 *
 * El fallo que obligó a escribir este archivo: en elempleo.com, el campo
 * «Nombre del cargo» de la fila de un empleo pasado se llenó con el titular
 * profesional de la hoja de vida. POSTULA declaró ante un empleador que el
 * cargo en esa empresa había sido otro. Un dato equivocado en un formulario
 * de postulación no es un detalle de interfaz: es una afirmación falsa sobre
 * la persona, hecha por la herramienta, en el peor sitio posible.
 *
 * Lo que este archivo aporta:
 *
 *  1. reconoce los campos que pertenecen a UNA fila de experiencia, que son
 *     otra cosa que los campos del perfil aunque se llamen parecido;
 *  2. los agrupa en bloques, un bloque por empleo;
 *  3. empareja cada bloque con la entrada correcta de `experiencia[]`,
 *     usando lo que el formulario ya tenga escrito.
 *
 * Emparejar por lo ya escrito es deliberado: cuando la persona abre el
 * formulario de «agregar experiencia» y escribe la empresa, eso es la señal
 * más confiable que existe sobre de cuál empleo está hablando.
 */
(function (raiz) {
  'use strict';

  const N = raiz.POSTULA_Normalizar;

  /**
   * Campos que pertenecen a una fila de experiencia.
   *
   * `veta` excluye lo aspiracional: «cargo al que aspiras» y «cargo actual»
   * son el titular profesional de la persona, no el empleo de una fila.
   */
  const CAMPOS_DE_FILA = {
    cargo: {
      fuertes: ['nombre del cargo', 'titulo del cargo', 'cargo desempenado',
                'cargo ocupado', 'puesto desempenado', 'job title', 'position title'],
      debiles: ['cargo', 'puesto', 'posicion'],
      // «requerid» sin terminación: cubre requerido, requerida y requeridas.
      veta: ['al que aspira', 'aspiras', 'deseado', 'actual', 'equivalente',
             'requerid', 'requisitos', 'habilidades', 'vacante', 'de la oferta']
    },
    empresa: {
      fuertes: ['nombre de la empresa', 'empresa', 'compania', 'organizacion',
                'razon social', 'company name', 'employer'],
      debiles: [],
      // La ubicación, el sector o el tamaño son datos SOBRE la empresa, no
      // su nombre. Importa porque los portales escriben el `name` del campo
      // como «ubicacionEmpresa», y comparar por subcadena los confundiría.
      veta: ['sector', 'tamano', 'tipo de empresa', 'actual empleador',
             'ubicacion', 'ciudad', 'pais', 'direccion', 'telefono']
    },
    desde: {
      fuertes: ['fecha de inicio', 'fecha inicio', 'mes de inicio', 'ano de inicio',
                'start date', 'desde'],
      debiles: ['inicio'],
      veta: ['estudios', 'educacion', 'curso']
    },
    hasta: {
      fuertes: ['fecha de finalizacion', 'fecha de fin', 'fecha final', 'mes de fin',
                'ano de fin', 'end date', 'hasta'],
      debiles: ['finalizacion', 'termino'],
      veta: ['estudios', 'educacion', 'curso']
    },
    funciones: {
      fuertes: ['logros y responsabilidades', 'tus logros y responsabilidades',
                'responsabilidades', 'funciones del cargo', 'funciones y logros',
                'descripcion del cargo', 'actividades realizadas', 'logros'],
      debiles: ['funciones', 'actividades'],
      veta: ['requerid', 'de la vacante', 'buscamos']
    }
  };

  /** Los campos que sirven para reconocer de qué empleo habla un bloque. */
  const CAMPOS_IDENTIFICADORES = ['empresa', 'desde', 'hasta'];

  /**
   * Campos que aparecen UNA sola vez por empleo.
   *
   * Sirven para saber dónde termina un bloque: un contenedor con dos cargos
   * adentro no es un empleo, es la lista entera. Las fechas quedan fuera a
   * propósito, porque los portales parten una sola fecha en dos casillas
   * —la lista de meses y el año— y ambas son del mismo empleo.
   */
  const CAMPOS_UNICOS = ['cargo', 'empresa'];

  const MESES = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
    agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8,
    sep: 9, sept: 9, oct: 10, nov: 11, dic: 12
  };

  const NOMBRES_DE_MES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  /**
   * ¿Este campo pertenece a una fila de experiencia? Devuelve cuál, o null.
   *
   * Solo mira las señales propias del campo, no el texto que lo rodea: en un
   * bloque de experiencia el texto cercano contiene los rótulos de todos los
   * demás campos del bloque, y eso haría que cualquiera pareciera cualquiera.
   */
  function detectarCampoDeFila(descriptor) {
    const d = descriptor || {};
    const propias = N.unir([d.etiqueta, d.ariaLabel, d.placeholder, d.nombre, d.id]);
    if (!propias) return null;

    let mejor = null;
    Object.keys(CAMPOS_DE_FILA).forEach((campo) => {
      const patron = CAMPOS_DE_FILA[campo];
      if (patron.veta.some((frase) => N.contiene(propias, frase))) return;
      let puntaje = 0;
      patron.fuertes.forEach((frase) => {
        if (N.contiene(propias, frase)) puntaje = Math.max(puntaje, 10 + frase.length);
      });
      patron.debiles.forEach((frase) => {
        if (N.contiene(propias, frase)) puntaje = Math.max(puntaje, 4 + frase.length);
      });
      if (puntaje && (!mejor || puntaje > mejor.puntaje)) mejor = { campo, puntaje };
    });
    return mejor;
  }

  /** «Octubre 2020» → { mes: 10, ano: 2020 }. «Presente» → en curso. */
  function partirFecha(texto) {
    const crudo = String(texto || '');
    const t = N.normalizar(crudo);
    if (!t) return { mes: null, ano: null, enCurso: false };
    if (/presente|actual|actualidad|hoy/.test(t)) {
      return { mes: null, ano: null, enCurso: true };
    }
    const ano = (crudo.match(/\b(19|20)\d{2}\b/) || [])[0];
    const palabra = Object.keys(MESES).find((m) => new RegExp(`\\b${m}`).test(t));
    return {
      mes: palabra ? MESES[palabra] : null,
      ano: ano ? Number(ano) : null,
      enCurso: false
    };
  }

  /**
   * El valor que le corresponde a ESTE campo concreto de fecha.
   *
   * Los portales parten las fechas de mil maneras: una lista de meses y una
   * casilla de año, un `type="month"`, un texto libre. El dato del perfil es
   * uno solo —«Octubre 2020»— y hay que darle a cada casilla su pedazo.
   */
  function valorDeFecha(descriptor, textoFecha) {
    const d = descriptor || {};
    const fecha = partirFecha(textoFecha);
    if (fecha.enCurso) return '';

    const propias = N.unir([d.etiqueta, d.ariaLabel, d.placeholder, d.nombre, d.id]);
    const tipo = String(d.tipo || 'text').toLowerCase();

    if (tipo === 'month') {
      return fecha.ano && fecha.mes
        ? `${fecha.ano}-${String(fecha.mes).padStart(2, '0')}` : '';
    }
    if (tipo === 'date') {
      return fecha.ano && fecha.mes
        ? `${fecha.ano}-${String(fecha.mes).padStart(2, '0')}-01` : '';
    }

    const pideAno = /\bano\b|\banio\b|\byear\b|\byyyy\b|\baaaa\b/.test(propias);
    const pideMes = /\bmes\b|\bmonth\b|\bmm\b/.test(propias) || d.esLista;
    if (pideAno && !pideMes) return fecha.ano ? String(fecha.ano) : '';
    if (pideMes) return fecha.mes ? NOMBRES_DE_MES[fecha.mes] : '';

    return String(textoFecha || '').trim();
  }

  /**
   * Empareja cada bloque del formulario con una entrada de `experiencia[]`.
   *
   * @param {Array<{empresa: string, anos: number[]}>} bloques lo que cada
   *        bloque YA tiene escrito
   * @param {Array<object>} experiencia entradas del perfil
   * @returns {Array<number|null>} para cada bloque, el índice de su entrada
   */
  function emparejar(bloques, experiencia) {
    const entradas = Array.isArray(experiencia) ? experiencia : [];
    const asignacion = bloques.map(() => null);
    const tomadas = new Set();

    const puntuar = (bloque, entrada) => {
      let puntaje = 0;
      if (bloque.empresa && entrada.empresa && N.mismaEmpresa(bloque.empresa, entrada.empresa)) {
        puntaje += 100;
      }
      const anosEntrada = [partirFecha(entrada.desde).ano, partirFecha(entrada.hasta).ano]
        .filter(Boolean);
      const comunes = (bloque.anos || []).filter((a) => anosEntrada.includes(a));
      puntaje += comunes.length * 20;
      return puntaje;
    };

    // Primero lo seguro: los bloques que ya dicen de qué empleo hablan.
    const candidatos = [];
    bloques.forEach((bloque, iBloque) => {
      entradas.forEach((entrada, iEntrada) => {
        const puntaje = puntuar(bloque, entrada);
        if (puntaje > 0) candidatos.push({ iBloque, iEntrada, puntaje });
      });
    });
    candidatos.sort((a, b) => b.puntaje - a.puntaje);
    candidatos.forEach(({ iBloque, iEntrada }) => {
      if (asignacion[iBloque] !== null || tomadas.has(iEntrada)) return;
      asignacion[iBloque] = iEntrada;
      tomadas.add(iEntrada);
    });

    // Lo que quede, en orden: los portales listan del más reciente al más
    // antiguo, igual que la hoja de vida.
    let siguiente = 0;
    asignacion.forEach((valor, iBloque) => {
      if (valor !== null) return;
      while (siguiente < entradas.length && tomadas.has(siguiente)) siguiente += 1;
      if (siguiente >= entradas.length) return;
      asignacion[iBloque] = siguiente;
      tomadas.add(siguiente);
      siguiente += 1;
    });

    return asignacion;
  }

  /** El dato de la entrada que le toca a un campo de fila. */
  function valorDeFila(campo, entrada, descriptor) {
    if (!entrada) return '';
    if (campo === 'desde' || campo === 'hasta') {
      return valorDeFecha(descriptor, entrada[campo]);
    }
    return String(entrada[campo] || '').trim();
  }

  raiz.POSTULA_Experiencia = {
    CAMPOS_DE_FILA, CAMPOS_IDENTIFICADORES, CAMPOS_UNICOS, detectarCampoDeFila,
    partirFecha, valorDeFecha, emparejar, valorDeFila, NOMBRES_DE_MES
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
