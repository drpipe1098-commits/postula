/**
 * CANDADO — De la hoja de vida al Perfil Único, sin inventar nada.
 *
 * La regla que este archivo protege: **un campo que la hoja de vida no dice
 * se queda vacío.** El perfil se copia tal cual en los formularios de los
 * portales y nadie lo revisa campo por campo; un dato adivinado se convierte
 * en una afirmación falsa sobre la persona ante un empleador.
 *
 * Los casos reproducen lo que de verdad traen los PDF de hoja de vida, que
 * es donde falló el parser la primera vez: títulos partidos en dos renglones,
 * un paréntesis suelto que pertenece al renglón anterior, pies de página del
 * generador, estudios en curso mezclados con títulos terminados, y el nivel
 * de idioma escrito varios renglones más abajo que el nombre del idioma.
 *
 * Todos los datos son ficticios.
 */
import { contrato } from './ayuda.mjs';
import { aPerfil, extraerExperiencia, anosDeExperiencia, extraerEducacion }
  from '../herramientas/lib/hoja-de-vida.mjs';

const c = contrato('hoja-de-vida-contract');

const HOJA = `ANDREA GÓMEZ RUIZ
ANALISTA DE SOPORTE TI Y AUTOMATIZACIÓN
Ubicación: Armenia, Quindío, Colombia
Teléfono: (+57) 300-1234567
Correo: andrea@ejemplo.com
Modalidad: Disponible para Teletrabajo

PERFIL PROFESIONAL
Tecnóloga en sistemas con experiencia en soporte de segundo nivel y
automatización de procesos con Python.

EXPERIENCIA LABORAL
Analista de Soporte Nivel 2 y Gestión de
Incidentes
(Contrato a término indefinido)
Servicios Ejemplo SAS
Marzo 2021 – Presente
Atención de incidentes y escalamiento a proveedores.
Documentación técnica en la base de conocimiento.
Página 1 de 2
Auxiliar de Mesa de Ayuda
Compañía Ficticia Ltda
Enero 2019 – Febrero 2021
Registro de tickets y soporte a usuarios finales.

EDUCACIÓN
Especialización en Seguridad Informática
Universidad de Ejemplo
En curso (Estudios activos)
Tecnóloga en Análisis y Desarrollo de
Sistemas
Servicio Nacional de Aprendizaje (SENA) | 2018

HABILIDADES Y TECNOLOGÍAS
Python, PowerShell, Microsoft 365, AnyDesk, sistemas de tickets.

CERTIFICACIONES
Google IT Support | 2022
Scrum Fundamentals | 2020

IDIOMAS
Inglés Técnico:
Nivel Medio en comprensión de lectura
y escucha. Nivel Básico en habla.`;

const { perfil, encontrados, vacios } = aPerfil(HOJA, new Date('2026-09-15'));

// --- 1. Identidad y contacto ---
c.igual(perfil.nombres, 'ANDREA', 'el nombre se separa de los apellidos');
c.igual(perfil.apellidos, 'GÓMEZ RUIZ', 'dos apellidos, como es habitual en Colombia');
c.igual(perfil.titularProfesional, 'ANALISTA DE SOPORTE TI Y AUTOMATIZACIÓN',
  'el renglón siguiente al nombre es el titular profesional');
c.igual(perfil.email, 'andrea@ejemplo.com', 'el correo se reconoce con o sin etiqueta');
c.igual(perfil.celular, '3001234567', 'el celular queda en dígitos, sin el indicativo');
c.igual(perfil.ciudad, 'Armenia', 'la ciudad sale de la línea de ubicación');
c.igual(perfil.departamento, 'Quindío', 'el departamento también');
c.igual(perfil.modalidad, 'Remoto', '«Teletrabajo» es modalidad remota');

// --- 2. NUNCA inventar: lo que la hoja de vida no dice, queda vacío ---
[
  ['numeroDocumento', 'la cédula'],
  ['tipoDocumento', 'el tipo de documento'],
  ['fechaNacimiento', 'la fecha de nacimiento'],
  ['genero', 'el género'],
  ['linkedin', 'el perfil de LinkedIn'],
  ['github', 'GitHub'],
  ['direccion', 'la dirección'],
  ['pretensionSalarial', 'la aspiración salarial'],
  ['tieneVehiculo', 'si tiene vehículo'],
  ['licenciaConduccion', 'la licencia de conducción']
].forEach(([campo, que]) => {
  c.igual(perfil[campo], '', `${que} no está en la hoja de vida: no se puede inventar`);
  c.exigir(vacios.includes(campo), `${campo} debe reportarse como pendiente de llenar`);
});

// --- 3. Experiencia: el título partido y el paréntesis suelto son un cargo ---
c.igual(perfil.experiencia.length, 2, 'se reconocen los dos cargos');

const reciente = perfil.experiencia[0];
c.igual(reciente.cargo, 'Analista de Soporte Nivel 2 y Gestión de Incidentes (Contrato a término indefinido)',
  'el cargo partido en tres renglones se vuelve a unir');
c.igual(reciente.empresa, 'Servicios Ejemplo SAS', 'la empresa es el renglón anterior a las fechas');
c.igual(reciente.desde, 'Marzo 2021', 'la fecha de inicio');
c.igual(reciente.hasta, 'Presente', 'el cargo actual se marca como Presente');

// El desbordamiento que falló la primera vez: las funciones de un cargo no
// pueden arrastrar la cabecera del cargo siguiente.
c.exigir(!reciente.funciones.includes('Auxiliar de Mesa de Ayuda'),
  'las funciones de un cargo no pueden incluir el cargo siguiente');
c.exigir(!reciente.funciones.includes('Compañía Ficticia'),
  'las funciones de un cargo no pueden incluir la empresa siguiente');
c.exigir(reciente.funciones.includes('Atención de incidentes'),
  'las funciones propias sí deben estar');

c.igual(perfil.experiencia[1].cargo, 'Auxiliar de Mesa de Ayuda', 'el segundo cargo');
c.igual(perfil.experiencia[1].empresa, 'Compañía Ficticia Ltda', 'la segunda empresa');

// --- 4. El pie de página del generador no es contenido ---
const todoElPerfil = JSON.stringify(perfil);
c.exigir(!/Página \d+ de \d+/.test(todoElPerfil),
  'el pie de página del PDF no puede acabar dentro del perfil');

// --- 5. Educación: gana el título terminado, no el que está en curso ---
c.igual(perfil.nivelEducativo, 'Tecnólogo',
  'una especialización en curso no es un título obtenido');
c.igual(perfil.titulo, 'Tecnóloga en Análisis y Desarrollo de Sistemas',
  'el título terminado, con su nombre completo aunque venga partido');
c.igual(perfil.institucion, 'Servicio Nacional de Aprendizaje (SENA)', 'la institución');
c.igual(perfil.anoGrado, '2018', 'el año de grado');

// --- 6. Idiomas: el nivel real, sin reducirlo a una etiqueta ---
c.igual(perfil.idiomas.length, 1, 'un idioma declarado');
c.igual(perfil.idiomas[0].idioma, 'Inglés', 'el idioma');
c.exigir(perfil.idiomas[0].nivel.includes('Medio') && perfil.idiomas[0].nivel.includes('Básico'),
  'el nivel conserva el matiz: medio en lectura, básico en habla');

// --- 7. Habilidades y certificaciones llegan al perfil ---
c.exigir(perfil.habilidades.includes('Python') && perfil.habilidades.includes('AnyDesk'),
  'las habilidades se guardan para los campos de «conocimientos» de los portales');
c.exigir(perfil.certificaciones.includes('Google IT Support'),
  'las certificaciones también');

// --- 8. Los años de experiencia se calculan, no se copian ---
c.igual(anosDeExperiencia([
  { desde: 'Enero 2020', hasta: 'Enero 2022' },
  { desde: 'Enero 2021', hasta: 'Enero 2023' }
], new Date('2026-09-15')), '3', 'dos cargos solapados no suman el doble');
c.igual(anosDeExperiencia([{ desde: 'Septiembre 2024', hasta: 'Presente' }],
  new Date('2026-09-15')), '2', '«Presente» se cuenta hasta hoy');
c.igual(anosDeExperiencia([], new Date('2026-09-15')), '',
  'sin experiencia no se inventa un número');

// --- 9. Una hoja de vida vacía no produce un perfil lleno de basura ---
const nada = aPerfil('', new Date('2026-09-15'));
c.igual(nada.perfil.nombres, '', 'sin texto no hay nombre');
c.igual(nada.perfil.experiencia, [], 'sin texto no hay experiencia');
c.exigir(nada.encontrados.length === 0, 'sin texto no se reporta ningún campo encontrado');

// --- 10. El informe de campos cuadra con el perfil ---
c.exigir(encontrados.includes('nombres') && encontrados.includes('habilidades'),
  'el informe debe listar lo que sí se llenó');
encontrados.forEach((campo) => {
  c.exigir(String(perfil[campo]).trim() !== '',
    `el informe dice que ${campo} se llenó, pero está vacío`);
});

// --- 11. Sin sección de experiencia no se fabrican entradas ---
c.igual(extraerExperiencia([]), [], 'sin renglones no hay cargos');
c.igual(extraerEducacion(['Nada que se parezca a un título']), {},
  'sin título reconocible no se inventa un nivel educativo');

c.cerrar();
