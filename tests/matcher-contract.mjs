/**
 * CANDADO — Reconocimiento de campos.
 *
 * Cada caso que falle en un portal real debe entrar aquí para que no vuelva
 * a romperse. Los casos con esperado `null` son la parte más importante del
 * archivo: garantizan que POSTULA jamás toque contraseñas, medios de pago,
 * buscadores ni campos de otra persona.
 */
import { cargar, contrato } from './ayuda.mjs';

const ambito = cargar(['extension/lib/normalizar.js', 'extension/content/matcher.js']);
const { detectar } = ambito.POSTULA_Matcher;
const c = contrato('matcher-contract');

const CASOS = [
  // --- identidad ---
  [{ etiqueta: 'Nombres *', tipo: 'text' }, 'nombres'],
  [{ etiqueta: 'Primer nombre', tipo: 'text' }, 'nombres'],
  [{ nombre: 'first_name', tipo: 'text' }, 'nombres'],
  [{ etiqueta: 'Apellidos', tipo: 'text' }, 'apellidos'],
  [{ autocomplete: 'family-name', tipo: 'text' }, 'apellidos'],
  [{ etiqueta: 'Nombre completo', tipo: 'text' }, 'nombreCompleto'],
  [{ etiqueta: 'Nombres y apellidos', tipo: 'text' }, 'nombreCompleto'],
  [{ etiqueta: 'Tipo de documento', tipo: 'text' }, 'tipoDocumento'],
  [{ etiqueta: 'Número de documento', tipo: 'text' }, 'numeroDocumento'],
  [{ placeholder: 'Cédula de ciudadanía', tipo: 'text' }, 'numeroDocumento'],
  [{ nombre: 'identificacion', tipo: 'number' }, 'numeroDocumento'],
  [{ etiqueta: 'Fecha de nacimiento', tipo: 'date' }, 'fechaNacimiento'],
  [{ etiqueta: 'Sexo', tipo: 'text' }, 'genero'],
  [{ etiqueta: 'Nacionalidad', tipo: 'text' }, 'nacionalidad'],

  // --- contacto ---
  [{ etiqueta: 'Correo electrónico', tipo: 'email' }, 'email'],
  [{ placeholder: 'tucorreo@ejemplo.com', nombre: 'email', tipo: 'email' }, 'email'],
  [{ etiqueta: 'Dirección de correo electrónico', tipo: 'text' }, 'email'],
  [{ etiqueta: 'Celular', tipo: 'tel' }, 'celular'],
  [{ nombre: 'telefonoCelular', tipo: 'tel' }, 'celular'],
  [{ etiqueta: 'Teléfono móvil', tipo: 'text' }, 'celular'],
  [{ etiqueta: 'WhatsApp', tipo: 'tel' }, 'celular'],
  [{ etiqueta: 'Teléfono fijo', tipo: 'tel' }, 'telefono'],
  [{ etiqueta: 'Dirección de residencia', tipo: 'text' }, 'direccion'],
  [{ etiqueta: 'Ciudad', tipo: 'text' }, 'ciudad'],
  [{ etiqueta: 'Municipio de residencia', tipo: 'text' }, 'ciudad'],
  [{ placeholder: 'Ciudad donde resides', tipo: 'text' }, 'ciudad'],
  [{ etiqueta: 'Ciudad donde deseas trabajar', tipo: 'text' }, 'ciudad'],
  [{ etiqueta: 'Departamento', tipo: 'text' }, 'departamento'],
  [{ etiqueta: 'País', tipo: 'text' }, 'pais'],
  [{ etiqueta: 'Código postal', tipo: 'text' }, 'codigoPostal'],

  // --- enlaces ---
  [{ etiqueta: 'Perfil de LinkedIn', tipo: 'url' }, 'linkedin'],
  [{ placeholder: 'https://github.com/usuario', etiqueta: 'GitHub', tipo: 'url' }, 'github'],
  [{ etiqueta: 'Sitio web o portafolio', tipo: 'url' }, 'portafolio'],

  // --- profesional ---
  [{ etiqueta: 'Cargo actual', tipo: 'text' }, 'titularProfesional'],
  [{ etiqueta: 'Profesión u ocupación', tipo: 'text' }, 'titularProfesional'],
  [{ etiqueta: 'Cuéntanos sobre ti', tipo: 'textarea' }, 'resumenProfesional'],
  [{ etiqueta: 'Carta de presentación', tipo: 'textarea' }, 'resumenProfesional'],
  [{ etiqueta: 'Perfil profesional', tipo: 'textarea' }, 'resumenProfesional'],
  [{ etiqueta: 'Años de experiencia', tipo: 'number' }, 'anosExperiencia'],
  [{ etiqueta: 'Aspiración salarial', tipo: 'text' }, 'pretensionSalarial'],
  [{ etiqueta: 'Expectativa salarial', tipo: 'number' }, 'pretensionSalarial'],
  [{ etiqueta: 'Disponibilidad para iniciar', tipo: 'text' }, 'disponibilidad'],
  [{ etiqueta: 'Disponibilidad para viajar', tipo: 'text' }, 'disponibilidadViajar'],
  [{ etiqueta: 'Licencia de conducción', tipo: 'text' }, 'licenciaConduccion'],
  [{ etiqueta: '¿Tiene vehículo propio?', tipo: 'text' }, 'tieneVehiculo'],

  // --- educación ---
  [{ etiqueta: 'Nivel educativo', tipo: 'text' }, 'nivelEducativo'],
  [{ etiqueta: 'Máximo nivel de estudios', tipo: 'text' }, 'nivelEducativo'],
  [{ etiqueta: 'Título obtenido', tipo: 'text' }, 'titulo'],
  [{ etiqueta: 'Institución educativa', tipo: 'text' }, 'institucion'],
  [{ etiqueta: 'Universidad', tipo: 'text' }, 'institucion'],
  [{ etiqueta: 'Año de grado', tipo: 'number' }, 'anoGrado'],

  // --- LO QUE NUNCA SE DEBE TOCAR ---
  [{ etiqueta: 'Contraseña', tipo: 'password' }, null],
  [{ etiqueta: 'Confirmar contraseña', tipo: 'password' }, null],
  [{ etiqueta: 'Clave de acceso', tipo: 'text' }, null],
  [{ etiqueta: 'Nombre de usuario', tipo: 'text' }, null],
  [{ etiqueta: 'Usuario', tipo: 'text' }, null],
  [{ etiqueta: 'Número de tarjeta', tipo: 'text' }, null],
  [{ etiqueta: 'CVV', tipo: 'text' }, null],
  [{ etiqueta: 'Cuenta bancaria', tipo: 'text' }, null],
  [{ etiqueta: 'Buscar empleo', tipo: 'text' }, null],
  [{ placeholder: '¿Qué empleo buscas?', tipo: 'text' }, null],
  [{ etiqueta: 'Palabra clave', tipo: 'text' }, null],
  [{ etiqueta: '¿Dónde?', tipo: 'text' }, null],
  [{ etiqueta: 'Nombre', tipo: 'search' }, null],
  [{ etiqueta: 'Código de verificación', tipo: 'text' }, null],
  [{ etiqueta: 'Captcha', tipo: 'text' }, null],
  [{ etiqueta: 'Cupón de descuento', tipo: 'text' }, null],
  [{ etiqueta: 'Adjuntar hoja de vida', tipo: 'file' }, null],
  [{ etiqueta: 'Correo electrónico', tipo: 'email', deshabilitado: true }, null],
  [{ etiqueta: 'Celular', tipo: 'tel', soloLectura: true }, null],

  // --- campos que describen LA VACANTE, no a la persona ---
  //
  // Encontrados al verificar la Entrega 3: el motor los confundía con
  // campos del perfil y escribía los datos del usuario dentro de la
  // descripción del puesto. «Habilidades requeridas para el cargo» pide lo
  // que la empresa busca; «Años de experiencia requeridos» pide el mínimo
  // del aviso. Rellenarlos pone una afirmación falsa sobre la persona en el
  // formulario de un empleador.
  [{ etiqueta: 'Habilidades requeridas para el cargo', tipo: 'textarea' }, null],
  [{ etiqueta: 'Cargo requerido', tipo: 'text' }, null],
  [{ etiqueta: 'Requisitos del cargo', tipo: 'textarea' }, null],
  [{ etiqueta: 'Perfil del cargo', tipo: 'textarea' }, null],
  [{ etiqueta: 'Años de experiencia requeridos', tipo: 'number' }, null],
  [{ etiqueta: 'Nivel educativo requerido', tipo: 'text' }, null],
  [{ etiqueta: 'Experiencia requerida', tipo: 'text' }, null],
  [{ etiqueta: 'Certificaciones requeridas', tipo: 'textarea' }, null],
  [{ etiqueta: 'Idiomas requeridos', tipo: 'text' }, null],
  [{ etiqueta: 'Descripción de la vacante', tipo: 'textarea' }, null],
  [{ etiqueta: 'Ciudad de la vacante', tipo: 'text' }, null],
  [{ etiqueta: 'Salario ofrecido', tipo: 'text' }, null],
  [{ etiqueta: 'Lo que buscamos', tipo: 'textarea' }, null],
  [{ etiqueta: 'Lo que ofrecemos', tipo: 'textarea' }, null],
  [{ nombre: 'requisitos_cargo', tipo: 'textarea' }, null],

  // Pero el campo del cargo AL QUE ASPIRA la persona sí es suyo: la palabra
  // «cargo» no puede bastar para descartar.
  [{ etiqueta: 'Cargo al que aspiras', tipo: 'text' }, 'titularProfesional'],
  [{ etiqueta: 'Nombre del cargo al que aspira', tipo: 'text' }, 'titularProfesional'],

  // Un encabezado de sección «Requisitos» cerca del campo no puede dejar
  // sin rellenar a los campos legítimos que estén debajo.
  [{ etiqueta: 'Celular', textoCercano: 'Requisitos del cargo', tipo: 'tel' }, 'celular'],
  [{ etiqueta: 'Correo electrónico', textoCercano: 'Lo que buscamos', tipo: 'email' }, 'email'],

  // --- datos que son de OTROS, no del usuario ---
  [{ etiqueta: 'Nombre de la empresa', tipo: 'text' }, null],
  [{ etiqueta: 'Razón social', tipo: 'text' }, null],
  [{ etiqueta: 'Nombre del contacto de emergencia', tipo: 'text' }, null],
  [{ etiqueta: 'Teléfono del contacto de emergencia', tipo: 'tel' }, null],
  [{ etiqueta: 'Título de la vacante', tipo: 'text' }, null],
  [{ etiqueta: 'Ciudad de la vacante', tipo: 'text' }, null],
  [{ etiqueta: 'Salario ofrecido', tipo: 'text' }, null]
];

CASOS.forEach(([descriptor, esperado]) => {
  const resultado = detectar(descriptor);
  const obtenido = resultado ? resultado.campo : null;
  const pista = descriptor.etiqueta || descriptor.placeholder || descriptor.nombre || descriptor.autocomplete;
  c.igual(obtenido, esperado, `«${pista}» (${descriptor.tipo})`);
});

// El umbral existe para que la duda se resuelva no tocando el campo.
c.exigir(detectar({ etiqueta: 'Otro dato cualquiera', tipo: 'text' }) === null,
  'un rótulo sin relación no debe reconocerse');
c.exigir(detectar({}) === null, 'un campo sin ninguna pista no debe reconocerse');
c.exigir(detectar(null) === null, 'un descriptor nulo no debe reventar');

c.cerrar();
