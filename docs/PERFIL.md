# Esquema del Perfil Único

Archivo: `extension/lib/perfil.js`. Es la única fuente de verdad de qué datos guarda POSTULA.

## Cómo está organizado

- **`GRUPOS`** — campos simples, agrupados por tema (Identidad, Contacto, Enlaces, Perfil profesional, Educación). La página de Perfil se dibuja sola a partir de esta lista.
- **`LISTAS`** — datos repetibles: experiencia laboral e idiomas. El usuario agrega las filas que necesite.

Cada campo declara:

| Clave | Para qué sirve |
|---|---|
| `id` | identificador interno; es el mismo que usa el matcher |
| `etiqueta` | lo que ve la persona |
| `tipo` | `text`, `email`, `tel`, `url`, `numero`, `fecha`, `parrafo`, `opcion` |
| `opciones` | obligatorio cuando `tipo` es `opcion` |
| `requerido` | marca el campo y lo exige `validar()` |
| `valorSugerido` | valor por defecto en un perfil nuevo |

## Funciones

- `perfilVacio()` — perfil nuevo con los valores sugeridos puestos.
- `sanear(entrada)` — descarta claves desconocidas y filas vacías. Toda entrada externa (una copia importada, lo leído del almacenamiento) pasa por aquí.
- `validar(perfil)` — lista en español de lo que impide postularse bien.
- `nombreCompleto(perfil)` — valor derivado; no se guarda.

## Agregar un campo nuevo

1. Agrégalo al grupo que corresponda en `GRUPOS`. Ya aparece en la página de Perfil.
2. Agrégale patrones en `extension/content/matcher.js` para que se rellene en los portales.
3. Agrega al menos un caso a `tests/matcher-contract.mjs`.
4. Si es un campo que piden casi todos los portales, agrégalo a `IMPRESCINDIBLES` en `tests/perfil-contract.mjs`.

`tests/proyecto-contract.mjs` impide que el matcher y el esquema se desincronicen: si el matcher reconoce un campo que no existe en el perfil, el CI falla.

## Dónde viven los datos

`chrome.storage.local`, bajo la clave `perfil`. En el equipo de la persona, nada más. Nunca en `chrome.storage.sync` ni en un servidor: eso está bloqueado por `tests/privacidad-contract.mjs`.

La copia que la persona descarga es el mismo objeto en JSON. `sanear()` debe ser reversible: exportar e importar tiene que devolver exactamente lo mismo, y hay un candado que lo verifica.
