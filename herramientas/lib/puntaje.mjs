/**
 * POSTULA — Compatibilidad entre una vacante y el perfil.
 *
 * El puntaje se calcula aquí, en el equipo, sin llamar a ningún servicio.
 * Eso mantiene el costo de operación en cero (AGENTS.md §1) y hace que el
 * resultado sea **explicable**: cada punto viene de una palabra concreta que
 * está a la vez en la vacante y en la hoja de vida, y la herramienta puede
 * mostrarla. Un puntaje que la persona no puede auditar no sirve para
 * decidir a qué se postula.
 */
import { Normalizar } from './esquema.mjs';
import { textoDeVacante, leerSalario, leerModalidad } from './criterios.mjs';

const { normalizar } = Normalizar;

/** Palabras que aparecen en todos los avisos y no distinguen nada. */
const VACIAS = new Set(`a al algo alguna algunas alguno algunos ante antes aqui asi aun bajo bien
cada como con contra cual cuales cuando de del desde donde dos el ella ellas ello ellos en entre
era eran es esa esas ese eso esos esta estan estar estas este esto estos fue fueron ha hace hacer
hacia han hasta hay la las le les lo los mas me mi mientras mucho muy nada ni no nos o otra otras
otro otros para pero poco por porque que quien se sea segun ser si sin sobre solo son su sus tan
tanto te tiene tienen todo todos tu un una uno unos ya y e o u
empresa vacante oferta puesto cargo trabajo empleo persona candidato candidata buscamos requiere
requisitos ofrecemos funciones responsabilidades experiencia anos años nivel area equipo cliente
clientes servicio servicios gestion manejo conocimiento conocimientos capacidad contrato salario
horario tiempo completo indefinido termino fijo disponibilidad inmediata`.split(/\s+/).filter(Boolean));

/** Términos significativos de un texto, sin repetir. */
export function terminos(texto) {
  return new Set(
    normalizar(texto)
      .split(' ')
      .filter((palabra) => palabra.length >= 3 && !VACIAS.has(palabra) && !/^\d+$/.test(palabra))
  );
}

/** Todo lo que la persona sabe hacer, según su perfil. */
export function corpusDelPerfil(perfil) {
  const partes = [
    perfil.titularProfesional, perfil.resumenProfesional,
    perfil.habilidades, perfil.certificaciones,
    perfil.titulo, perfil.nivelEducativo
  ];
  (perfil.experiencia || []).forEach((entrada) => {
    partes.push(entrada.cargo, entrada.empresa, entrada.funciones);
  });
  return partes.filter(Boolean).join(' \n ');
}

/** Cuánto se parecen dos títulos de cargo, de 0 a 1. */
function parecidoDeCargo(tituloVacante, cargosPropios) {
  const dela = terminos(tituloVacante);
  if (!dela.size) return 0;
  let mejor = 0;
  cargosPropios.filter(Boolean).forEach((cargo) => {
    const mios = terminos(cargo);
    if (!mios.size) return;
    let comunes = 0;
    dela.forEach((palabra) => { if (mios.has(palabra)) comunes += 1; });
    mejor = Math.max(mejor, comunes / dela.size);
  });
  return mejor;
}

/**
 * Puntaje de compatibilidad, de 0 a 100.
 *
 * Reparto: el cargo pesa 35, los conocimientos 40, la modalidad 15 y el
 * salario 10. El cargo y los conocimientos deciden; la modalidad y el
 * salario solo confirman, porque ya pasaron por el filtro de descarte.
 */
export function calcular(vacante, perfil, criterios) {
  const textoVacante = textoDeVacante(vacante);
  const corpus = corpusDelPerfil(perfil);
  const mios = terminos(corpus);
  const razones = [];

  // --- Cargo (35) ---
  const cargosPropios = [perfil.titularProfesional]
    .concat((perfil.experiencia || []).map((e) => e.cargo))
    .concat(criterios ? criterios.cargos : []);
  const parecido = parecidoDeCargo(vacante.titulo || '', cargosPropios);
  const puntosCargo = Math.round(parecido * 35);
  if (parecido >= 0.6) razones.push('El cargo es casi el mismo que ya has ejercido');
  else if (parecido >= 0.3) razones.push('El cargo se parece a tu experiencia');

  // --- Conocimientos (40) ---
  const suyos = terminos(textoVacante);
  const comunes = [...suyos].filter((palabra) => mios.has(palabra));
  const cobertura = suyos.size ? comunes.length / suyos.size : 0;
  // Una vacante nunca comparte todo su vocabulario con una hoja de vida:
  // cubrir la mitad de sus términos propios ya es una coincidencia muy alta.
  const puntosConocimiento = Math.round(Math.min(cobertura / 0.5, 1) * 40);

  // Las palabras compartidas más largas son las que de verdad dicen algo.
  const destacadas = comunes
    .filter((palabra) => palabra.length >= 5)
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
  if (destacadas.length) razones.push(`Coincide en: ${destacadas.join(', ')}`);

  // --- Modalidad (15) ---
  const modalidad = leerModalidad(vacante.modalidad || '') || leerModalidad(textoVacante);
  let puntosModalidad = 7;
  if (modalidad === 'remoto') { puntosModalidad = 15; razones.push('Es 100% teletrabajo'); }
  else if (modalidad === 'hibrido') { puntosModalidad = 11; razones.push('Es híbrida'); }
  else if (modalidad === 'presencial') puntosModalidad = 3;

  // --- Salario (10) ---
  const salario = leerSalario(vacante.salario || textoVacante);
  const minimo = criterios ? criterios.salarioMinimo : 0;
  let puntosSalario = 5;
  if (salario.publicado && minimo) {
    const holgura = salario.maximo / minimo;
    puntosSalario = Math.round(Math.max(0, Math.min(holgura - 1, 1)) * 10);
    if (holgura >= 1.4) razones.push('Paga bastante por encima de tu mínimo');
  }

  const total = puntosCargo + puntosConocimiento + puntosModalidad + puntosSalario;
  return {
    puntaje: Math.max(0, Math.min(100, total)),
    razones,
    detalle: {
      cargo: puntosCargo,
      conocimientos: puntosConocimiento,
      modalidad: puntosModalidad,
      salario: puntosSalario,
      terminosComunes: destacadas
    }
  };
}

export default { calcular, terminos, corpusDelPerfil };
