/**
 * POSTULA — Normalización de texto.
 *
 * Los portales colombianos mezclan español con y sin tildes, mayúsculas,
 * dos puntos, asteriscos de campo obligatorio e inglés. Todo el
 * reconocimiento de campos compara sobre texto normalizado.
 */
(function (raiz) {
  'use strict';

  /** Quita tildes, pasa a minúsculas y deja solo letras, números y espacios. */
  function normalizar(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /** Une varios textos ya normalizados en una sola cadena comparable. */
  function unir(partes) {
    return (partes || [])
      .map(normalizar)
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Cuenta cuántas de las frases aparecen en el texto normalizado.
   * Una frase de varias palabras solo cuenta si aparece completa y seguida.
   */
  function contiene(textoNormalizado, frase) {
    const objetivo = normalizar(frase);
    if (!objetivo) return false;
    return (' ' + textoNormalizado + ' ').includes(' ' + objetivo + ' ')
      || textoNormalizado.includes(objetivo);
  }

  /**
   * Formas jurídicas: no identifican a nadie y se escriben de cualquier
   * manera. «Ejemplo SAS», «Ejemplo S.A.S», «Ejemplo S.A.S.» y «Ejemplo
   * S A S» son la misma empresa, y hay que poder reconocerlo para no
   * duplicarla ni confundirla con otra.
   */
  const FORMAS_JURIDICAS = [
    'sas', 'sa', 'ltda', 'limitada', 'eu', 'sca', 'cia', 'compania',
    'inc', 'llc', 'ltd', 'corp', 'srl', 'spa', 'bic', 'group', 'grupo',
    's', 'a', 'c', 'u', 'e', 'en', 'y'
  ];

  /**
   * El nombre de una empresa reducido a lo que de verdad la identifica.
   * Nunca devuelve vacío: una empresa que se llama como una forma jurídica
   * conserva su nombre.
   */
  function nucleoDeEmpresa(nombre) {
    const palabras = normalizar(nombre).split(' ').filter(Boolean);
    while (palabras.length > 1 && FORMAS_JURIDICAS.includes(palabras[palabras.length - 1])) {
      palabras.pop();
    }
    return palabras.join(' ');
  }

  /** ¿Dos nombres de empresa se refieren a la misma? */
  function mismaEmpresa(unNombre, otroNombre) {
    const una = nucleoDeEmpresa(unNombre);
    const otra = nucleoDeEmpresa(otroNombre);
    if (!una || !otra) return false;
    return una === otra || una.includes(otra) || otra.includes(una);
  }

  raiz.POSTULA_Normalizar = {
    normalizar, unir, contiene, nucleoDeEmpresa, mismaEmpresa, FORMAS_JURIDICAS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
