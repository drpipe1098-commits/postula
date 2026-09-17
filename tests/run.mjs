/**
 * POSTULA — Corredor de pruebas de contrato.
 *
 * Ejecuta cada candado en su propio proceso para que un fallo no tape a los
 * demás. Sin dependencias: `npm test` funciona sin `npm install`.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const pruebas = readdirSync(aqui)
  .filter((nombre) => nombre.endsWith('-contract.mjs'))
  .sort();

console.log(`POSTULA — ${pruebas.length} candados\n`);

let fallaron = 0;
pruebas.forEach((prueba) => {
  const resultado = spawnSync(process.execPath, [join(aqui, prueba)], { stdio: 'inherit' });
  if (resultado.status !== 0) fallaron += 1;
});

console.log('');
if (fallaron) {
  console.error(`✗ ${fallaron} de ${pruebas.length} candados fallaron.`);
  process.exit(1);
}
console.log(`✓ Los ${pruebas.length} candados pasaron.`);
