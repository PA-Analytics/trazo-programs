# TRAZO AI RUNTIME CONTRACT

## Purpose

TRAZO tiene un único runtime server-side para Gemini. Las features no construyen clientes Google, no seleccionan credenciales y no cambian proyecto, ubicación o modelo.

La frontera canónica es [`src/server/ai/runtime.ts`](../src/server/ai/runtime.ts). `GeminiEvidenceInterpreter` y `GeminiNextActionProposer` reciben esa abstracción; no importan `@google/genai`.

## Production

La ruta conocida y verificada por el historial (`54b3273`, revisión `trazo-agentic-00011-55q`) es:

```text
Cloud Run: trazo-agentic
  → identidad de runtime del servicio / ADC
  → Vertex AI
  → ubicación global
  → modelo gemini-3.7-flash
```

El proyecto documentado es `trazo-agentic-2026`, en Cloud Run `us-central1`. La producción no depende de `GEMINI_API_KEY`; el commit de reliability baseline eliminó el binding de ese secreto y su permiso de Secret Manager.

El runtime usa `GOOGLE_CLOUD_PROJECT` o `GCLOUD_PROJECT` cuando están disponibles y conserva `trazo-agentic-2026` como valor documentado de V0. La ubicación y el modelo pueden configurarse mediante `GOOGLE_CLOUD_LOCATION` y `GEMINI_MODEL`, con defaults `global` y `gemini-3.7-flash`.

La configuración desplegada actual no pudo inspeccionarse en esta ejecución porque `gcloud` exigió reautenticación interactiva. El historial anterior es la fuente verificable de la revisión y del camino de identidad; no se afirma que el servicio vivo haya sido reconfigurado por este cambio.

### Verificación local de credenciales

El 2026-08-19 se ejecutaron estas comprobaciones, sin iniciar sesión automáticamente:

```text
gcloud auth list
  resultado: cuenta activa pablo@comandurisk.dev; exit 0

gcloud auth application-default print-access-token
  resultado: falló con "Reauthentication failed" durante la ejecución no interactiva; exit 1
  no se imprimió ni almacenó el token

gcloud config get-value project
  resultado: trazo-agentic-2026; exit 0
```

La cuenta autenticada por `gcloud auth list` y las credenciales ADC son estados distintos. En esta verificación la cuenta existe, pero ADC no pudo emitir un token y por ello no se considera disponible para una llamada Vertex local.

Regla para futuros agentes: ejecutar primero `gcloud auth list`, `gcloud auth application-default print-access-token` y `gcloud config get-value project`. Si ADC emite un token, la autenticación ya está validada y se debe investigar el fallo downstream de Vertex; no pedir login. Sólo solicitar `gcloud auth application-default login` cuando `print-access-token` demuestre que ADC está expirado, revocado o indisponible, como ocurrió en esta verificación.

## Local Development

El camino soportado es el mismo camino Vertex/ADC:

1. Comprobar primero ADC con `gcloud auth application-default print-access-token`.
2. Tener acceso a Vertex AI en `trazo-agentic-2026`.
3. Ejecutar con `GOOGLE_CLOUD_PROJECT=trazo-agentic-2026`, opcionalmente `GOOGLE_CLOUD_LOCATION=global` y `GEMINI_MODEL=gemini-3.7-flash`.

Reiniciar la PC no requiere volver a iniciar sesión en ADC: las credenciales existentes deben comprobarse primero. Si `print-access-token` devuelve `Reauthentication failed`, solicitar `gcloud auth application-default login`. No modificar el runtime ni el proveedor para corregir credenciales locales expiradas.

### Smoke test local Vertex

Después de la reautenticación manual se ejecutó:

```text
gcloud auth application-default print-access-token
  resultado: ADC_ACCESS_TOKEN_ISSUED=true; exit 0

node --env-file=.env --experimental-strip-types scripts/test-live-companion-conversation.ts
  resultado: exit 0; smoke test completado mediante createCanonicalGeminiRuntime()
```

La llamada local real a Vertex/Gemini respondió correctamente en conversación multi-turno, clasificación de evidencia, PASS con mutación válida y AMBIGUOUS sin mutación. Por tanto, el `VERTEX_AUTHENTICATION_FAILED` observado anteriormente se clasifica como un problema de **LOCAL ADC REAUTHENTICATION**, no como una regresión del código del runtime.

La identidad de servicio de Cloud Run y las credenciales ADC locales son independientes. Que ADC local requiera reautenticación no implica que la identidad de servicio de producción necesite cambios.

El repositorio contiene variables históricas `GEMINI_API_KEY` y scripts de diagnóstico antiguos. No son el camino de producción ni un fallback. Si un diagnóstico local necesita explícitamente esa ruta heredada, debe declarar `TRAZO_LOCAL_AI_AUTH=api-key`; el runtime rechaza esa modalidad cuando `NODE_ENV=production`.

La llamada local fue verificada con ADC reautenticado y el runtime canónico. La clave existente no se utiliza implícitamente; por tanto, el resultado es `CODE CORRECT` + `LIVE LOCAL VERTEX AUTH VERIFIED`.

## Feature Rule

Toda feature AI consume `CanonicalGeminiRuntime` y deja que el runtime resuelva autenticación, proyecto, ubicación y modelo. La autoridad de progreso permanece en el motor determinista.

## Forbidden

No se permite:

- inicializar otro cliente Google GenAI o Vertex en código de feature;
- cambiar a Gemini Developer API como solución de producción;
- añadir fallback por API key;
- cambiar proyecto, ubicación o modelo desde una feature;
- implementar autenticación específica del proveedor en evaluator, Companion o Calibration;
- caer silenciosamente a otro modelo o proveedor.

## Change Policy

Si una feature no puede funcionar mediante el runtime canónico, se detiene y reporta el motivo. No crea otro runtime.

## Local ADC Verification

Antes de indicar al desarrollador que inicie sesión, ejecutar:

```text
gcloud auth application-default print-access-token
```

Si el comando tiene éxito, ADC es válido: no solicitar login y diagnosticar cualquier fallo posterior en Vertex. Sólo si falla específicamente con un error de reautenticación se debe solicitar:

```text
gcloud auth application-default login
```

Después del login, volver a ejecutar `print-access-token` y luego el smoke test canónico que usa `createCanonicalGeminiRuntime()`. No crear otro cliente Gemini/Vertex ni un fallback de proveedor.

`gcloud auth list` y Application Default Credentials son contextos de credenciales separados. Una cuenta activa en `gcloud auth list` no demuestra que ADC sea utilizable.

Reiniciar la PC no es motivo suficiente para solicitar login: siempre se debe probar ADC primero. Si la reautenticación local se repite, puede ser consistente con una política de sesión de Google Cloud o Google Workspace, pero la política exacta no debe afirmarse sin verificación.

La expiración de ADC local no es evidencia de un problema en la identidad de servicio de Cloud Run ni en producción.

### Local ADC diagnosis closure — 2026-08-21

Antes del login manual, `print-access-token` falló con `Reauthentication failed` y exit 1. Después del login, emitió token y terminó con exit 0. El smoke test local `scripts/test-live-companion-conversation.ts` terminó con exit 0 mediante `createCanonicalGeminiRuntime()`, con respuesta real del modelo, PASS válido y AMBIGUOUS sin mutación de estado.

La clasificación es `LOCAL_ADC_REAUTHENTICATION`, no una regresión del runtime. No hay evidencia local que verifique la política exacta de sesión u organización.

## Error Semantics

Un fallo de proveedor, autenticación, red o respuesta inválida:

- no equivale a `REWORK`;
- no muta progreso ni desbloquea misiones;
- conserva la evidencia del learner;
- muestra una copia entendible en producto: “No pude revisarlo ahora. Tu entrega sigue aquí y tu progreso no cambió. Inténtalo otra vez en un momento.”

Los códigos técnicos pueden permanecer en logs y pruebas, pero no son el copy principal del learner.
