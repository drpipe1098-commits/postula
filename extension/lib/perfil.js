/**
 * POSTULA — Esquema del Perfil Único.
 *
 * El usuario llena estos datos una sola vez. Viven en chrome.storage.local,
 * en su equipo. Nunca salen de ahí: no hay servidor, no hay sincronización.
 *
 * Agregar un campo aquí lo hace aparecer automáticamente en la página de
 * Perfil. Para que además se rellene en los portales hay que agregarle
 * patrones en extension/content/matcher.js.
 */
(function (raiz) {
  'use strict';

  const GRUPOS = [
    {
      id: 'identidad',
      titulo: 'Identidad',
      ayuda: 'Lo que pide todo formulario al empezar.',
      campos: [
        { id: 'nombres', etiqueta: 'Nombres', tipo: 'text', requerido: true },
        { id: 'apellidos', etiqueta: 'Apellidos', tipo: 'text', requerido: true },
        { id: 'tipoDocumento', etiqueta: 'Tipo de documento', tipo: 'opcion',
          opciones: ['Cédula de ciudadanía', 'Cédula de extranjería', 'Pasaporte', 'Tarjeta de identidad', 'NIT'] },
        { id: 'numeroDocumento', etiqueta: 'Número de documento', tipo: 'text' },
        { id: 'fechaNacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'fecha' },
        { id: 'genero', etiqueta: 'Género', tipo: 'opcion', opciones: ['Masculino', 'Femenino', 'Prefiero no decirlo'] },
        { id: 'nacionalidad', etiqueta: 'Nacionalidad', tipo: 'text', valorSugerido: 'Colombiana' }
      ]
    },
    {
      id: 'contacto',
      titulo: 'Contacto',
      ayuda: 'Revisa que el correo y el celular estén perfectos: se van a copiar en cientos de formularios.',
      campos: [
        { id: 'email', etiqueta: 'Correo electrónico', tipo: 'email', requerido: true },
        { id: 'celular', etiqueta: 'Celular', tipo: 'tel', requerido: true },
        { id: 'telefono', etiqueta: 'Teléfono fijo', tipo: 'tel' },
        { id: 'direccion', etiqueta: 'Dirección', tipo: 'text' },
        { id: 'ciudad', etiqueta: 'Ciudad', tipo: 'text' },
        { id: 'departamento', etiqueta: 'Departamento', tipo: 'text' },
        { id: 'pais', etiqueta: 'País', tipo: 'text', valorSugerido: 'Colombia' },
        { id: 'codigoPostal', etiqueta: 'Código postal', tipo: 'text' }
      ]
    },
    {
      id: 'enlaces',
      titulo: 'Enlaces',
      ayuda: 'Opcional, pero LinkedIn sube mucho la tasa de respuesta.',
      campos: [
        { id: 'linkedin', etiqueta: 'Perfil de LinkedIn', tipo: 'url' },
        { id: 'portafolio', etiqueta: 'Portafolio o sitio web', tipo: 'url' },
        { id: 'github', etiqueta: 'GitHub', tipo: 'url' }
      ]
    },
    {
      id: 'profesional',
      titulo: 'Perfil profesional',
      ayuda: 'El resumen se usa en los campos de "cuéntanos sobre ti".',
      campos: [
        { id: 'titularProfesional', etiqueta: 'Cargo o titular profesional', tipo: 'text' },
        { id: 'resumenProfesional', etiqueta: 'Resumen profesional', tipo: 'parrafo' },
        { id: 'anosExperiencia', etiqueta: 'Años de experiencia', tipo: 'numero' },
        { id: 'pretensionSalarial', etiqueta: 'Aspiración salarial', tipo: 'text' },
        { id: 'disponibilidad', etiqueta: 'Disponibilidad', tipo: 'text', valorSugerido: 'Inmediata' },
        { id: 'modalidad', etiqueta: 'Modalidad preferida', tipo: 'opcion', opciones: ['Remoto', 'Híbrido', 'Presencial'] },
        { id: 'disponibilidadViajar', etiqueta: '¿Disponibilidad para viajar?', tipo: 'opcion', opciones: ['Sí', 'No'] },
        { id: 'licenciaConduccion', etiqueta: 'Licencia de conducción', tipo: 'text' },
        { id: 'tieneVehiculo', etiqueta: '¿Tiene vehículo?', tipo: 'opcion', opciones: ['Sí', 'No'] }
      ]
    },
    {
      id: 'educacion',
      titulo: 'Educación',
      ayuda: 'El título más alto que tengas terminado.',
      campos: [
        { id: 'nivelEducativo', etiqueta: 'Nivel educativo', tipo: 'opcion',
          opciones: ['Bachillerato', 'Técnico', 'Tecnólogo', 'Profesional', 'Especialización', 'Maestría', 'Doctorado'] },
        { id: 'titulo', etiqueta: 'Título obtenido', tipo: 'text' },
        { id: 'institucion', etiqueta: 'Institución', tipo: 'text' },
        { id: 'anoGrado', etiqueta: 'Año de grado', tipo: 'numero' }
      ]
    },
    {
      id: 'conocimientos',
      titulo: 'Conocimientos',
      ayuda: 'Lo que los portales piden como «habilidades», «conocimientos» o «certificaciones».',
      campos: [
        { id: 'habilidades', etiqueta: 'Habilidades y tecnologías', tipo: 'parrafo' },
        { id: 'certificaciones', etiqueta: 'Certificaciones y cursos', tipo: 'parrafo' }
      ]
    }
  ];

  /** Campos que además existen como lista repetible. */
  const LISTAS = [
    {
      id: 'experiencia',
      titulo: 'Experiencia laboral',
      campos: [
        { id: 'cargo', etiqueta: 'Cargo' },
        { id: 'empresa', etiqueta: 'Empresa' },
        { id: 'desde', etiqueta: 'Desde (mes y año)' },
        { id: 'hasta', etiqueta: 'Hasta (mes y año)' },
        { id: 'funciones', etiqueta: 'Funciones y logros', tipo: 'parrafo' }
      ]
    },
    {
      id: 'idiomas',
      titulo: 'Idiomas',
      campos: [
        { id: 'idioma', etiqueta: 'Idioma' },
        { id: 'nivel', etiqueta: 'Nivel' }
      ]
    }
  ];

  /** Todos los identificadores de campo simple, en orden. */
  function idsDeCampos() {
    return GRUPOS.flatMap((grupo) => grupo.campos.map((campo) => campo.id));
  }

  /** Perfil vacío con los valores sugeridos ya puestos. */
  function perfilVacio() {
    const perfil = {};
    GRUPOS.forEach((grupo) => {
      grupo.campos.forEach((campo) => {
        perfil[campo.id] = campo.valorSugerido || '';
      });
    });
    LISTAS.forEach((lista) => { perfil[lista.id] = []; });
    return perfil;
  }

  /** Quita claves desconocidas y garantiza que existan todas las esperadas. */
  function sanear(entrada) {
    const base = perfilVacio();
    if (!entrada || typeof entrada !== 'object') return base;
    idsDeCampos().forEach((id) => {
      if (typeof entrada[id] === 'string' || typeof entrada[id] === 'number') {
        base[id] = String(entrada[id]).trim();
      }
    });
    LISTAS.forEach((lista) => {
      if (!Array.isArray(entrada[lista.id])) return;
      base[lista.id] = entrada[lista.id]
        .filter((fila) => fila && typeof fila === 'object')
        .map((fila) => {
          const limpia = {};
          lista.campos.forEach((campo) => {
            limpia[campo.id] = typeof fila[campo.id] === 'string' ? fila[campo.id].trim() : '';
          });
          return limpia;
        })
        .filter((fila) => Object.values(fila).some(Boolean));
    });
    return base;
  }

  /** Valor derivado: nombre completo. */
  function nombreCompleto(perfil) {
    return [perfil.nombres, perfil.apellidos].filter(Boolean).join(' ').trim();
  }

  /** Errores que impiden que el autorrelleno sea útil. */
  function validar(perfil) {
    const errores = [];
    GRUPOS.forEach((grupo) => {
      grupo.campos.forEach((campo) => {
        if (campo.requerido && !String(perfil[campo.id] || '').trim()) {
          errores.push(`Falta ${campo.etiqueta}.`);
        }
      });
    });
    const email = String(perfil.email || '');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errores.push('El correo electrónico no tiene un formato válido.');
    }
    const celular = String(perfil.celular || '').replace(/\D/g, '');
    if (celular && celular.length < 7) {
      errores.push('El celular parece incompleto.');
    }
    return errores;
  }

  raiz.POSTULA_Perfil = {
    GRUPOS, LISTAS, idsDeCampos, perfilVacio, sanear, nombreCompleto, validar
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
