/**
 * POSTULA — Reconocimiento de campos.
 *
 * Recibe un descriptor con todas las pistas visibles de un campo de
 * formulario (etiqueta, placeholder, name, id, autocomplete, tipo) y decide
 * qué dato del perfil le corresponde.
 *
 * Es genérico a propósito: debe acertar en portales que nunca hemos visto.
 * Las recetas por portal son un refuerzo posterior, no el mecanismo principal.
 *
 * Reglas duras que este archivo garantiza:
 *  - jamás reconoce contraseñas, medios de pago, captcha ni búsqueda;
 *  - ante la duda, devuelve null y el campo se deja intacto.
 */
(function (raiz) {
  'use strict';

  const N = raiz.POSTULA_Normalizar;

  /** Nada que empareje con esto se rellena nunca. */
  const EXCLUSIONES = [
    // credenciales
    'contrasena', 'contraseña', 'clave', 'password', 'passwd', 'pin',
    'nombre de usuario', 'username', 'user name',
    // pagos
    'tarjeta', 'numero de tarjeta', 'credito', 'debito', 'cvv', 'cvc',
    'card number', 'cuenta bancaria', 'iban', 'swift', 'cuenta de ahorros',
    // seguridad
    'captcha', 'codigo de verificacion', 'codigo de seguridad', 'token',
    'otp', 'codigo sms',
    // búsqueda y ruido del portal
    'buscar', 'busqueda', 'search', 'palabra clave', 'keyword',
    'que empleo', 'filtrar', 'cupon', 'promocional'
  ];

  /**
   * Palabras que solo excluyen cuando son TODO el rótulo. «Usuario» a secas
   * es un campo de acceso; pero «github.com/usuario» aparece como ejemplo
   * dentro de un placeholder y no debe descartar el campo.
   */
  const EXCLUSIONES_EXACTAS = [
    'usuario', 'user', 'clave', 'pin', 'codigo', 'token', 'id', 'donde', 'where'
  ];

  /**
   * Rótulos que describen LA VACANTE, no a la persona.
   *
   * «Habilidades requeridas para el cargo» pide lo que la empresa busca, no
   * lo que tú sabes; «Años de experiencia requeridos» pide el mínimo del
   * aviso, no el tuyo. Sin esto el motor los confunde con los campos del
   * perfil y escribe tus datos en la descripción del puesto: una afirmación
   * falsa sobre ti, puesta por POSTULA, en el formulario de un empleador.
   *
   * Se compara solo contra las señales directas del campo —su rótulo, su
   * `name`, su `id`— y nunca contra el texto cercano, porque un encabezado
   * de sección que diga «Requisitos» no puede dejar sin rellenar a los
   * campos legítimos que estén debajo.
   */
  const EXCLUSIONES_DE_VACANTE = [
    'requerid', 'requisitos', 'para el cargo', 'perfil del cargo',
    'descripcion del cargo', 'de la vacante', 'que buscamos', 'buscamos',
    'ofrecemos', 'solicitamos'
  ];

  /** Señales que vienen del campo mismo, no de lo que lo rodea. */
  const SENALES_DIRECTAS = ['etiqueta', 'ariaLabel', 'placeholder', 'nombre', 'id'];

  /** autocomplete estándar del navegador: la pista más confiable que existe. */
  const AUTOCOMPLETE = {
    'name': 'nombreCompleto',
    'given-name': 'nombres',
    'additional-name': 'nombres',
    'family-name': 'apellidos',
    'email': 'email',
    'tel': 'celular',
    'tel-national': 'celular',
    'mobile': 'celular',
    'street-address': 'direccion',
    'address-line1': 'direccion',
    'address-level2': 'ciudad',
    'address-level1': 'departamento',
    'country': 'pais',
    'country-name': 'pais',
    'postal-code': 'codigoPostal',
    'bday': 'fechaNacimiento',
    'sex': 'genero',
    'organization-title': 'titularProfesional'
  };

  /**
   * fuertes: frases que identifican el campo casi con certeza.
   * debiles: frases que suman pero no bastan solas.
   * veta:    si aparece, el campo queda descartado aunque haya coincidencia.
   * tipos:   type= del input que refuerza la decisión.
   */
  const PATRONES = {
    nombreCompleto: {
      fuertes: ['nombre completo', 'nombres y apellidos', 'nombre y apellidos',
                'nombre y apellido', 'full name', 'nombre del candidato'],
      debiles: [],
      veta: ['empresa', 'usuario', 'contacto de emergencia', 'referencia', 'institucion'],
      tipos: ['text']
    },
    nombres: {
      fuertes: ['nombres', 'primer nombre', 'first name', 'given name'],
      debiles: ['nombre'],
      veta: ['empresa', 'compania', 'organizacion', 'razon social', 'usuario',
             'vacante', 'contacto de emergencia', 'referencia', 'institucion',
             'universidad', 'colegio', 'archivo', 'documento adjunto'],
      tipos: ['text']
    },
    apellidos: {
      fuertes: ['apellidos', 'apellido', 'primer apellido', 'last name', 'surname', 'family name'],
      debiles: [],
      veta: ['contacto de emergencia', 'referencia'],
      tipos: ['text']
    },
    tipoDocumento: {
      fuertes: ['tipo de documento', 'tipo documento', 'tipo de identificacion', 'tipo doc'],
      debiles: [],
      veta: [],
      tipos: ['text']
    },
    numeroDocumento: {
      fuertes: ['numero de documento', 'numero de identificacion', 'cedula', 'documento de identidad',
                'no de documento', 'nro documento', 'identificacion', 'dni', 'nuip'],
      debiles: ['documento'],
      veta: ['tipo', 'archivo', 'adjuntar', 'tarjeta'],
      tipos: ['text', 'number']
    },
    fechaNacimiento: {
      fuertes: ['fecha de nacimiento', 'fecha nacimiento', 'birth date', 'date of birth', 'birthday'],
      debiles: ['nacimiento'],
      veta: [],
      tipos: ['date', 'text']
    },
    genero: {
      fuertes: ['genero', 'sexo', 'gender'],
      debiles: [],
      veta: [],
      tipos: ['text']
    },
    nacionalidad: {
      fuertes: ['nacionalidad', 'nationality'],
      debiles: [],
      veta: [],
      tipos: ['text']
    },
    email: {
      fuertes: ['correo electronico', 'correo', 'email', 'e mail', 'mail',
                'direccion de correo', 'correo de contacto'],
      debiles: [],
      veta: ['confirmar', 'repetir', 'verificar', 'empresa'],
      tipos: ['email']
    },
    celular: {
      fuertes: ['celular', 'telefono celular', 'telefono movil', 'movil', 'whatsapp',
                'numero de celular', 'mobile', 'cell phone'],
      debiles: ['telefono de contacto'],
      veta: ['contacto de emergencia', 'fijo'],
      tipos: ['tel']
    },
    telefono: {
      fuertes: ['telefono fijo', 'telefono de casa', 'fijo', 'landline'],
      debiles: ['telefono', 'phone'],
      veta: ['celular', 'movil', 'contacto de emergencia'],
      tipos: ['tel']
    },
    direccion: {
      fuertes: ['direccion de residencia', 'direccion', 'address', 'street address',
                'lugar de residencia', 'domicilio'],
      debiles: [],
      veta: ['correo', 'email', 'mail', 'ip', 'empresa', 'web', 'url'],
      tipos: ['text']
    },
    ciudad: {
      fuertes: ['ciudad', 'municipio', 'ciudad de residencia', 'city', 'localidad'],
      debiles: [],
      veta: ['empresa', 'vacante', 'nacimiento', 'expedicion'],
      tipos: ['text']
    },
    departamento: {
      fuertes: ['departamento de residencia', 'departamento', 'state', 'provincia', 'region'],
      debiles: [],
      veta: ['empresa', 'area', 'cargo', 'vacante'],
      tipos: ['text']
    },
    pais: {
      fuertes: ['pais de residencia', 'pais', 'country'],
      debiles: [],
      veta: ['nacimiento', 'empresa'],
      tipos: ['text']
    },
    codigoPostal: {
      fuertes: ['codigo postal', 'postal code', 'zip code', 'zip'],
      debiles: [],
      veta: [],
      tipos: ['text', 'number']
    },
    linkedin: {
      fuertes: ['linkedin', 'perfil de linkedin', 'linked in'],
      debiles: [],
      veta: [],
      tipos: ['url', 'text']
    },
    portafolio: {
      fuertes: ['portafolio', 'sitio web', 'pagina web', 'portfolio', 'website', 'blog personal'],
      debiles: [],
      veta: ['empresa'],
      tipos: ['url', 'text']
    },
    github: {
      fuertes: ['github', 'git hub', 'repositorio'],
      debiles: [],
      veta: [],
      tipos: ['url', 'text']
    },
    titularProfesional: {
      fuertes: ['cargo actual', 'cargo al que aspira', 'titular profesional', 'ocupacion',
                'profesion', 'puesto actual', 'job title', 'headline', 'cargo'],
      debiles: ['puesto', 'posicion'],
      veta: ['vacante', 'empresa', 'anterior', 'referencia'],
      tipos: ['text']
    },
    resumenProfesional: {
      fuertes: ['resumen profesional', 'perfil profesional', 'acerca de ti', 'acerca de mi',
                'cuentanos sobre ti', 'sobre ti', 'presentacion', 'carta de presentacion',
                'por que eres el candidato', 'mensaje al reclutador', 'descripcion del perfil',
                'cover letter', 'summary', 'about you'],
      debiles: ['mensaje', 'comentarios', 'observaciones', 'descripcion'],
      veta: ['empresa', 'vacante', 'funciones del cargo'],
      tipos: ['textarea']
    },
    habilidades: {
      fuertes: ['habilidades', 'competencias', 'conocimientos', 'aptitudes',
                'tecnologias', 'herramientas que manejas', 'skills', 'habilidades tecnicas',
                'conocimientos tecnicos', 'areas de conocimiento'],
      debiles: [],
      veta: ['idioma', 'requeridas', 'requisitos', 'que buscamos', 'del cargo'],
      tipos: ['textarea', 'text']
    },
    certificaciones: {
      fuertes: ['certificaciones', 'certificados', 'cursos realizados', 'cursos y certificaciones',
                'diplomados', 'formacion complementaria', 'otros estudios', 'certifications'],
      debiles: ['cursos'],
      veta: ['requeridas', 'requisitos', 'del cargo'],
      tipos: ['textarea', 'text']
    },
    anosExperiencia: {
      fuertes: ['anos de experiencia', 'años de experiencia', 'tiempo de experiencia',
                'experiencia en anos', 'years of experience'],
      debiles: [],
      veta: [],
      tipos: ['number', 'text']
    },
    pretensionSalarial: {
      fuertes: ['aspiracion salarial', 'pretension salarial', 'expectativa salarial',
                'salario esperado', 'salario deseado', 'expected salary', 'aspiracion economica'],
      debiles: ['salario'],
      veta: ['actual', 'ultimo', 'ofrecido', 'rango de la vacante'],
      tipos: ['text', 'number']
    },
    disponibilidad: {
      fuertes: ['disponibilidad para iniciar', 'disponibilidad de ingreso', 'disponibilidad'],
      debiles: [],
      veta: ['viajar', 'viaje', 'horario'],
      tipos: ['text']
    },
    modalidad: {
      fuertes: ['modalidad de trabajo', 'modalidad', 'tipo de jornada preferida',
                'trabajo remoto', 'presencial o remoto'],
      debiles: [],
      veta: ['vacante'],
      tipos: ['text']
    },
    disponibilidadViajar: {
      fuertes: ['disponibilidad para viajar', 'disponibilidad de viaje', 'puede viajar'],
      debiles: [],
      veta: [],
      tipos: ['text']
    },
    licenciaConduccion: {
      fuertes: ['licencia de conduccion', 'licencia de conducir', 'pase de conduccion',
                'driver license', 'categoria de licencia'],
      debiles: [],
      veta: [],
      tipos: ['text']
    },
    tieneVehiculo: {
      fuertes: ['tiene vehiculo', 'vehiculo propio', 'posee vehiculo', 'medio de transporte propio',
                'moto propia', 'carro propio'],
      debiles: ['vehiculo'],
      veta: [],
      tipos: ['text']
    },
    nivelEducativo: {
      fuertes: ['nivel educativo', 'nivel de estudios', 'nivel academico',
                'maximo nivel de estudios', 'formacion academica', 'education level'],
      debiles: [],
      veta: [],
      tipos: ['text']
    },
    titulo: {
      fuertes: ['titulo obtenido', 'titulo academico', 'carrera', 'programa academico',
                'nombre del programa', 'degree'],
      debiles: ['titulo', 'estudios'],
      veta: ['vacante', 'empleo', 'oferta', 'job'],
      tipos: ['text']
    },
    institucion: {
      fuertes: ['institucion educativa', 'institucion', 'universidad', 'centro de estudios',
                'colegio', 'school', 'university'],
      debiles: [],
      veta: [],
      tipos: ['text']
    },
    anoGrado: {
      fuertes: ['ano de grado', 'año de grado', 'ano de graduacion', 'año de graduacion',
                'fecha de grado', 'graduation year'],
      debiles: [],
      veta: [],
      tipos: ['number', 'text']
    }
  };

  /** Peso de cada pista según qué tan confiable es. */
  const PESO_SENAL = {
    etiqueta: 1.0,
    ariaLabel: 1.0,
    placeholder: 0.9,
    nombre: 0.85,
    id: 0.8,
    textoCercano: 0.55,
    nombreClase: 0.35
  };

  const UMBRAL = 22;

  function frasesDe(descriptor) {
    const senales = {};
    Object.keys(PESO_SENAL).forEach((clave) => {
      senales[clave] = N.normalizar(descriptor[clave] || '');
    });
    return senales;
  }

  function textoCompleto(senales) {
    return Object.values(senales).filter(Boolean).join(' ');
  }

  /** Puntaje de una frase: las frases largas y específicas valen más. */
  function pesoFrase(frase, esFuerte) {
    const palabras = N.normalizar(frase).split(' ').filter(Boolean).length;
    return (esFuerte ? 26 : 10) * (1 + 0.55 * (palabras - 1));
  }

  function puntajeCampo(patron, senales, tipo) {
    const todo = textoCompleto(senales);
    if (patron.veta.some((frase) => N.contiene(todo, frase))) return 0;

    let mejor = 0;
    Object.keys(PESO_SENAL).forEach((clave) => {
      const texto = senales[clave];
      if (!texto) return;
      const peso = PESO_SENAL[clave];
      patron.fuertes.forEach((frase) => {
        if (N.contiene(texto, frase)) mejor = Math.max(mejor, pesoFrase(frase, true) * peso);
      });
      patron.debiles.forEach((frase) => {
        if (N.contiene(texto, frase)) mejor = Math.max(mejor, pesoFrase(frase, false) * peso);
      });
    });

    if (mejor > 0 && patron.tipos.includes(tipo)) mejor += 8;
    return mejor;
  }

  /**
   * @param {object} descriptor
   * @returns {{campo:string, puntaje:number, via:string}|null}
   */
  function detectar(descriptor) {
    const d = descriptor || {};
    const tipo = String(d.tipo || 'text').toLowerCase();

    // 1. Exclusiones duras. Ante cualquier señal de credencial, pago o
    //    búsqueda, el campo no se toca.
    if (tipo === 'password' || tipo === 'hidden' || tipo === 'file'
      || tipo === 'search' || tipo === 'submit' || tipo === 'button') return null;
    if (d.deshabilitado || d.soloLectura) return null;

    const senales = frasesDe(d);
    const todo = textoCompleto(senales);
    if (EXCLUSIONES.some((frase) => N.contiene(todo, frase))) return null;
    const senalExcluyente = Object.keys(PESO_SENAL)
      .filter((clave) => clave !== 'textoCercano' && clave !== 'nombreClase')
      .some((clave) => EXCLUSIONES_EXACTAS.includes(senales[clave]));
    if (senalExcluyente) return null;

    // El campo describe la vacante, no a la persona: no es suyo que llenar.
    const describeLaVacante = SENALES_DIRECTAS.some((clave) =>
      EXCLUSIONES_DE_VACANTE.some((frase) => N.contiene(senales[clave], frase)));
    if (describeLaVacante) return null;

    // 2. autocomplete estándar: gana sobre cualquier heurística.
    const auto = String(d.autocomplete || '').toLowerCase().trim();
    if (AUTOCOMPLETE[auto]) {
      return { campo: AUTOCOMPLETE[auto], puntaje: 100, via: 'autocomplete' };
    }

    // 3. Puntaje por patrones.
    let ganador = null;
    Object.keys(PATRONES).forEach((campo) => {
      const puntaje = puntajeCampo(PATRONES[campo], senales, tipo);
      if (puntaje > 0 && (!ganador || puntaje > ganador.puntaje)) {
        ganador = { campo, puntaje, via: 'patron' };
      }
    });

    if (!ganador || ganador.puntaje < UMBRAL) return null;
    return ganador;
  }

  raiz.POSTULA_Matcher = {
    detectar, PATRONES, EXCLUSIONES, EXCLUSIONES_EXACTAS, EXCLUSIONES_DE_VACANTE,
    AUTOCOMPLETE, UMBRAL
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
