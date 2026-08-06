# State model

Estados de una misión o nodo:

- `locked`: existe, pero una o más dependencias no se cumplen.
- `available`: puede iniciarse porque sus requisitos están satisfechos.
- `active`: el usuario está trabajando en ella.
- `submitted`: existe una evidencia enviada y espera revisión o confirmación.
- `completed`: la condición de finalización fue aceptada.
- `milestone`: hito de síntesis o logro; puede requerir varias misiones.

Transiciones válidas principales:

`locked → available → active → submitted → completed`

También puede ocurrir `active → available` al abandonar sin evidencia y `submitted → active` si la evidencia requiere cambios. `completed` no vuelve a un estado anterior salvo que una regla de producto explícita lo permita. Los estados deben comunicar razón del bloqueo y siguiente acción.

TODO: enrich from verified upstream source
