# TRAZO Brand System

Version: 0.1  
Source: opus-landing-page  
Status: canonical for current TRAZO visual identity  
Last reviewed: 2026-08-06

## Alcance

Este sistema extrae la identidad visible de la landing actual. Es una referencia operativa para portar TRAZO a otro producto; no es un rediseño ni una especificación de la UI existente.

## Esencia visual

TRAZO presenta la metodología como un recorrido que se puede seguir, comprobar y desbloquear. La identidad se reconoce cuando una pieza combina:

- papel cálido como campo de lectura;
- tinta oscura como estructura, texto y borde;
- índigo como señal escasa de acción, ruta o progreso;
- composición editorial con una consecuencia funcional visible;
- geometría cartográfica: nodos, rutas, bifurcaciones, hitos y evidencia.

No es decoración cartográfica sobre una interfaz genérica. El mapa explica relaciones y estados.

## Principios observables

1. **La estructura se dibuja.** Los límites importantes se expresan con filetes de tinta, marcos y divisores; no con sombras o gradientes.
2. **El color comunica estado.** El índigo aparece en acción, progreso, selección, ruta completada y desbloqueo; no como relleno ambiental.
3. **La materialidad es papel + tinta.** Las superficies son cálidas, opacas y táctiles; la trama de puntos se reserva para mapas y zonas de exploración.
4. **La editorialidad sirve a una acción.** Un titular amplio abre una idea, pero debajo debe existir una ruta, una misión, una evidencia o una decisión.
5. **El espacio crea jerarquía.** Una sección tiene un foco principal y aire funcional alrededor; el vacío no sustituye el contenido.
6. **El progreso es espacial.** Una ruta continua, discontinua o futura hace visible la dependencia entre pasos.
7. **Las esquinas tienen gesto.** Las piezas TRAZO usan radios asimétricos, no redondeado uniforme como lenguaje por defecto.
8. **La interacción es sobria.** Hover, focus y motion refuerzan una acción o un cambio de estado.

## Editorialidad y producto

La landing puede permitirse titulares grandes, composiciones abiertas y storytelling secuencial. Un producto debe conservar la misma gramática en una densidad más compacta: la tipografía display identifica capítulos o hitos; la sans organiza tareas, metadatos y controles; el índigo guía la siguiente decisión.

## Estructural vs contextual

**Estructural:** papel/tinta/índigo, dos familias tipográficas, bordes visibles, radios asimétricos, mapa de estados, evidencia antes del desbloqueo, foco visible y respeto por reduced motion.

**Contextual:** trama puntual, marcos grandes, flechas proyectadas, diamantes, paneles oscuros amplios, titulares de 4–6rem y animaciones de recorrido. Pueden reducirse o desaparecer en una pantalla densa sin perder TRAZO.

## Asset y wordmark

No existe un asset canónico de logo/wordmark en `public/`. El logo actual es composición de código en `components/site-nav.tsx`: `LogoMark` es un SVG de 32×24 con dos segmentos, un círculo índigo central y un nodo final discontinuo; el wordmark es texto `Trazo` en `Anton`.

Reglas derivadas: usar el icono con al menos 28×21 CSS px cuando acompaña wordmark; mantener aproximadamente 8px de separación; usar tinta sobre papel y papel sobre tinta; reservar el índigo para el nodo central. Usar wordmark en navegación y footer; usar el icono solo cuando el contexto ya identifica la marca. No duplicar este SVG como asset hasta que exista una necesidad de distribución independiente.

## CURRENT INCONSISTENCIES

- `components/sections/difference-section.tsx` usa `font-mono` en dos labels con uppercase y tracking amplio. La regla dominante del resto de la landing es Geist sans legible; canon recomendado: sans para labels y mono solo si el dato es realmente técnico.
- `components/ui/button.tsx` y gran parte de `components/ui/*` pertenecen al kit genérico y usan `rounded-md`, sombras y tokens shadcn. La superficie TRAZO dominante usa `.edge`/`.edge-alt`, borde visible y sombras discretas; canon recomendado: los patrones TRAZO específicos tienen precedencia.
- `styles/globals.css` contiene la plantilla genérica en oklch y no está importada por `app/layout.tsx`; `app/globals.css` es la fuente efectiva. No se corrige en esta fase.
- El token histórico `--lime` nombra el índigo `#2625B7`. Es semánticamente confuso, pero es la fuente real actual; al portar, mapearlo a `--trazo-accent` sin replicar el nombre histórico.
- `glow-unlock` está definido en `app/globals.css`, pero no aparece usado en los componentes auditados. El patrón dominante real es `shadow-sm`; canon recomendado: no exportar glow como default.

## Criterio de canon

Cuando una pantalla nueva entre en conflicto, priorizar la semántica de estados, papel/tinta/índigo, bordes y tipografía de dos voces. Reducir textura o expresividad antes de llenar la superficie de azul o de convertir cada elemento en una tarjeta.
