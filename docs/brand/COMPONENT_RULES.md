# TRAZO — Component rules

Estas reglas describen lenguaje visual reusable, no una copia de cada componente React.

## Botones primarios

Fondo índigo, texto papel, Geist medium, mínimo táctil de 44px, padding horizontal generoso y `.edge` o `.edge-alt`. Hover cambia a tinta; el icono/flecha puede desplazarse `0.5px`. Usar para la acción principal del contexto. No usar azul en botones secundarios ni añadir glow.

## Botones secundarios y text links

Secundario: tinta/papel, borde visible o tratamiento textual; mantener el mismo radio asimétrico. Text link: Geist medium, tinta que pasa a índigo, flecha opcional. No convertir cada link en pill ni subrayar por decoración.

## Bordered surfaces, cards y panels

Un panel es una unidad de tarea o evidencia: borde de tinta de 2px, superficie papel/`surface`, radio alternado, padding `1.25rem`–`2rem`; divisor interno de 1px o 2px cuando separa estados. Sombras `shadow-sm` son auxiliares. No usar una cuadrícula de tarjetas equivalentes para una sola idea ni `rounded-xl` como default.

## Header

Navegación fija, h-16, wordmark + LogoMark, CTA único. En scroll: papel al 85%, blur pequeño y hairline. Touch target mínimo 44px. No llenar el header de links, badges o navegación densa.

## CTA sections

Superficie `surface` o ink con una proposición concreta. El formulario usa campos de superficie, borde 2px, Geist y `edge-alt`; el CTA es índigo. El estado de éxito debe explicar qué ocurrió. No usar urgencia, métricas inventadas o una promesa de seguimiento no conectada.

## Icon containers

Geometría simple, tinta o índigo, tamaño funcional y fondo papel/superficie. El icono acompaña un estado o acción. No usar emojis, ilustración AI, glow o iconografía ornamental abundante.

## Map frames

Marco de borde 2px (3px en hero), papel/superficie y `paper-grid` solo cuando comunica exploración. Puede llevar una línea índigo proyectada. Debe contener rutas o dependencias reales; no usar mapa como textura sin semántica.

## Mission-like surfaces

Cabecera con estado, título display, descripción, evidencia, feedback y unlock. La fila de desbloqueo puede usar tinta con etiqueta índigo. La misión tiene una acción verificable; no debe parecer un card de marketing o un badge.

## Dividers

Secciones: `rule-brand` de 1px con tinta al 16%. Estructura interna: 1px de línea o 2px de tinta. El divisor debe separar relaciones, no decorar cada párrafo.

## Estados

- **Focus:** outline índigo de 3px, offset 3px; nunca eliminarlo.
- **Hover:** cambio de color tinta↔índigo o contraste; sin elevación excesiva.
- **Disabled/locked:** piedra y patrón discontinuo, pero nunca depender solo del color: incluir texto, icono o dependencia explícita.
- **Active:** tinta como cuerpo estructural, punto/centro índigo y mayor presencia.

## Movimiento

Reveals de 500–800ms, rutas alrededor de 3.8s lineales y pulso de nodo activo de 2.4s. Animar solo recorrido, activación, desbloqueo o entrada de información. Respetar `prefers-reduced-motion`.
