# Quest grammar

Modelo conceptual interno:

`Course → Chapter → Quest Map → Mission → Evidence → Completion → Unlock`

- **Course**: experiencia completa y su objetivo.
- **Chapter**: agrupación narrativa o de competencia.
- **Quest Map**: representación espacial de la progresión del capítulo.
- **Mission**: unidad accionable de aprendizaje.
- **Evidence**: entrega, respuesta o señal verificable de trabajo.
- **Completion**: condición que confirma el logro.
- **Unlock**: consecuencia que habilita una misión, rama o milestone.

Las dependencias forman un DAG: una misión puede requerir varias anteriores y varias pueden converger en un hito. Toda dependencia visible debe poder explicarse al usuario.

TODO: enrich from verified upstream source
