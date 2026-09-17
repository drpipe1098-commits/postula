/**
 * POSTULA — Lectura de la lista de vacantes.
 *
 * Las vacantes **las trae la persona**: de las alertas de empleo que los
 * portales le mandan al correo, o copiadas del aviso. POSTULA no entra a los
 * portales a buscarlas (AGENTS.md §4.5), así que el formato de entrada tiene
 * que ser cómodo de escribir a mano o de pegar desde un correo.
 *
 * Se aceptan dos formas: un JSON con la lista, o bloques de texto separados
 * por una línea de guiones, con campos «Etiqueta: valor».
 */

const ETIQUETAS = {
  titulo: ['titulo', 'título', 'cargo', 'vacante', 'puesto'],
  empresa: ['empresa', 'compañia', 'compañía', 'compania', 'organizacion', 'organización'],
  salario: ['salario', 'sueldo', 'remuneracion', 'remuneración', 'pago'],
  modalidad: ['modalidad', 'jornada', 'tipo de trabajo'],
  ubicacion: ['ubicacion', 'ubicación', 'ciudad', 'lugar'],
  enlace: ['enlace', 'link', 'url', 'aviso'],
  descripcion: ['descripcion', 'descripción', 'detalle', 'requisitos', 'funciones']
};

function campoDeEtiqueta(texto) {
  const limpio = texto.trim().toLowerCase();
  for (const [campo, alias] of Object.entries(ETIQUETAS)) {
    if (alias.includes(limpio)) return campo;
  }
  return null;
}

/** Bloques «Etiqueta: valor» separados por una línea de guiones. */
export function leerTexto(texto) {
  return String(texto)
    .split(/^\s*-{3,}\s*$/m)
    .map((bloque) => {
      const vacante = { titulo: '', empresa: '', salario: '', modalidad: '',
        ubicacion: '', enlace: '', descripcion: '' };
      let ultimo = 'descripcion';
      let encontroAlgo = false;

      bloque.split(/\r?\n/).forEach((linea) => {
        if (!linea.trim()) return;
        const corte = linea.indexOf(':');
        const campo = corte > 0 ? campoDeEtiqueta(linea.slice(0, corte)) : null;
        if (campo) {
          vacante[campo] = linea.slice(corte + 1).trim();
          ultimo = campo;
          encontroAlgo = true;
          return;
        }
        // Renglón sin etiqueta: continúa el campo anterior.
        vacante[ultimo] = `${vacante[ultimo]} ${linea.trim()}`.trim();
        encontroAlgo = true;
      });

      return encontroAlgo ? vacante : null;
    })
    .filter((vacante) => vacante && (vacante.titulo || vacante.descripcion));
}

/** Normaliza una vacante venida de JSON, aceptando nombres alternos. */
function desdeObjeto(bruto) {
  const tomar = (...nombres) => {
    for (const nombre of nombres) {
      if (typeof bruto[nombre] === 'string' && bruto[nombre].trim()) return bruto[nombre].trim();
    }
    return '';
  };
  return {
    titulo: tomar('titulo', 'título', 'cargo', 'title'),
    empresa: tomar('empresa', 'company'),
    salario: tomar('salario', 'sueldo', 'salary'),
    modalidad: tomar('modalidad', 'jornada'),
    ubicacion: tomar('ubicacion', 'ubicación', 'ciudad', 'location'),
    enlace: tomar('enlace', 'link', 'url'),
    descripcion: tomar('descripcion', 'descripción', 'detalle', 'description')
  };
}

/** Lee la lista desde JSON o desde texto, según lo que parezca. */
export function leerVacantes(contenido) {
  const texto = String(contenido).trim();
  if (texto.startsWith('[') || texto.startsWith('{')) {
    const datos = JSON.parse(texto);
    const lista = Array.isArray(datos) ? datos : (datos.vacantes || []);
    return lista.filter((v) => v && typeof v === 'object').map(desdeObjeto)
      .filter((v) => v.titulo || v.descripcion);
  }
  return leerTexto(texto);
}

export default { leerVacantes, leerTexto };
