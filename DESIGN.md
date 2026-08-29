# Design system en construcción

Este documento es una primera versión del sistema visual de `acompanante-ia`. Está deliberadamente incompleto: las decisiones futuras deben conservar la gramática de progresión y documentar cualquier cambio. No fijamos todavía una paleta ni tipografías definitivas.

## Product feeling

Una interfaz de progresión inspirada en quest systems y skill trees de videojuegos, reinterpretada para educación profesional.

Debe sentirse exploratoria, clara, satisfactoria, seria, distintiva y adaptable a la marca del creador.

No debe sentirse como un SaaS dashboard, admin panel, crypto dashboard, AI chatbot ni videojuego infantil.

## Composition principle

El quest map es el protagonista:

- navegación secundaria pequeña;
- canvas/mapa dominante;
- detalle de misión bajo demanda.

El panel de misión no debe ocupar permanentemente una gran parte del mapa. La información contextual aparece cuando ayuda a decidir o actuar.

## Product composition baseline

La pagina de seleccion de perfiles fija la referencia operativa para las siguientes pestanas de producto: marco tinta/papel, senal cobalto, tipografia display + UI, composicion editorial/decisional, filas accionables, botones y comportamiento responsive. La ficha detallada esta en [`docs/brand/PRODUCT_PROFILE_COMPOSITION.md`](docs/brand/PRODUCT_PROFILE_COMPOSITION.md). Debe reutilizarse la gramatica, no copiarse cada elemento contextual como el personaje o el copy.

## Core visual grammar

La interfaz debe distinguir al menos:

- **Mission node**: unidad accionable de aprendizaje.
- **Milestone**: hito que sintetiza o desbloquea progreso.
- **Locked**: requisito pendiente, con razón visible.
- **Available**: puede iniciarse.
- **Active**: trabajo en curso.
- **Completed**: condición satisfecha.

Los estados deben reconocerse mediante una combinación de forma, etiqueta, iconografía, estructura y color; nunca depender únicamente del color.

## Motion principle

Animar solo cambios con significado: completar una misión, desbloquear un nodo, revelar una nueva rama y abrir o cerrar detalle. No animar cada elemento simplemente porque es posible. Respetar reduced motion.

## Branding principle

La arquitectura UX permanece estable. En el futuro, los tokens visuales podrán variar por creador en color, typography, iconography y elementos decorativos seleccionados. La marca no debe desplazar la claridad del mapa ni convertirse en branding de “AI”.

## Decisions pending

- Paleta definitiva.
- Tipografías definitivas.
- Escala final de spacing, radios y bordes.
- Sistema de iconografía y tokens por creador.

## Anti-patterns

Evitar específicamente:

- generic SaaS dashboard aesthetic;
- purple SaaS gradients;
- glassmorphism sin propósito;
- cards para todo;
- `rounded-xl` indiscriminado;
- emojis como iconos;
- glow excesivo;
- KPI dashboards dominantes;
- sidebars SaaS genéricas;
- chat como interfaz principal;
- branding de “AI” como protagonista;
- decoración sin función.
