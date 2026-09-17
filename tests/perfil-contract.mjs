/**
 * CANDADO — El esquema del Perfil Único es estable y su copia es reversible.
 *
 * Si alguien cambia el esquema de forma que rompa las copias que la gente ya
 * descargó, esta prueba lo detiene.
 */
import { cargar, contrato } from './ayuda.mjs';

const ambito = cargar(['extension/lib/normalizar.js', 'extension/lib/perfil.js']);
const P = ambito.POSTULA_Perfil;
const c = contrato('perfil-contract');

// Campos que ningún cambio futuro puede eliminar: son los que piden todos
// los portales y los que el matcher sabe reconocer.
const IMPRESCINDIBLES = [
  'nombres', 'apellidos', 'tipoDocumento', 'numeroDocumento', 'fechaNacimiento',
  'email', 'celular', 'telefono', 'direccion', 'ciudad', 'departamento', 'pais',
  'linkedin', 'titularProfesional', 'resumenProfesional', 'anosExperiencia',
  'pretensionSalarial', 'disponibilidad', 'nivelEducativo', 'titulo', 'institucion'
];

const ids = P.idsDeCampos();
IMPRESCINDIBLES.forEach((id) => {
  c.exigir(ids.includes(id), `falta el campo imprescindible «${id}» en el esquema`);
});

c.exigir(new Set(ids).size === ids.length, 'hay identificadores de campo repetidos');

// Todo campo del esquema debe tener etiqueta en español para la persona.
P.GRUPOS.forEach((grupo) => {
  c.exigir(!!grupo.titulo && !!grupo.ayuda, `el grupo «${grupo.id}» necesita título y ayuda`);
  grupo.campos.forEach((campo) => {
    c.exigir(!!campo.etiqueta, `el campo «${campo.id}» necesita una etiqueta visible`);
    if (campo.tipo === 'opcion') {
      c.exigir(Array.isArray(campo.opciones) && campo.opciones.length > 1,
        `el campo «${campo.id}» es de opciones y necesita al menos dos`);
    }
  });
});

// Validación: un perfil vacío no sirve para postularse.
const vacio = P.perfilVacio();
c.exigir(P.validar(vacio).length >= 4, 'un perfil vacío debe reportar los datos que faltan');

const bueno = Object.assign(P.perfilVacio(), {
  nombres: 'Ana María', apellidos: 'Gómez Ruiz',
  email: 'ana@ejemplo.com', celular: '3001234567'
});
c.igual(P.validar(bueno), [], 'un perfil con los datos mínimos debe validar sin errores');
c.igual(P.nombreCompleto(bueno), 'Ana María Gómez Ruiz', 'nombre completo derivado');

c.igual(P.validar(Object.assign({}, bueno, { email: 'esto-no-es-correo' })).length, 1,
  'un correo mal escrito debe reportarse');
c.igual(P.validar(Object.assign({}, bueno, { celular: '300' })).length, 1,
  'un celular incompleto debe reportarse');

// Saneado: descartar basura y conservar lo válido.
const sucio = Object.assign({}, bueno, {
  campoInventado: 'basura',
  experiencia: [
    { cargo: 'Analista de Soporte', empresa: 'Empresa Ejemplo', desde: '2022-10', hasta: '2024-02', funciones: 'Soporte N2' },
    { cargo: '', empresa: '', desde: '', hasta: '', funciones: '' },
    'esto no es una fila'
  ],
  idiomas: [{ idioma: 'Español', nivel: 'Nativo' }]
});
const limpio = P.sanear(sucio);
c.exigir(!('campoInventado' in limpio), 'sanear debe descartar claves desconocidas');
c.igual(limpio.experiencia.length, 1, 'sanear debe descartar filas vacías y basura');
c.igual(limpio.experiencia[0].cargo, 'Analista de Soporte', 'sanear conserva los datos válidos');
c.igual(limpio.idiomas.length, 1, 'sanear conserva los idiomas');

// La copia que descarga la persona debe poder volver a cargarse igual.
const ida = P.sanear(sucio);
const vuelta = P.sanear(JSON.parse(JSON.stringify(ida)));
c.igual(vuelta, ida, 'exportar e importar el perfil debe devolver exactamente lo mismo');

c.exigir(P.sanear(null) && P.sanear(undefined) && P.sanear('texto'),
  'sanear no debe reventar con entradas inválidas');

c.cerrar();
