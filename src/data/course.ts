import type { Course } from '../domain/course'

export const course: Course = {
  id: 'primer-sistema-de-contenido',
  title: 'Primera pieza en mercado',
  chapters: [
    {
      id: 'chapter-1',
      title: 'Chapter 1 · De idea a señal real',
      shortTitle: '01',
      missions: [
        {
          id: 'N01',
          title: 'Premisa',
          nodeType: 'normal',
          progressState: 'available',
          position: { x: 100, y: 300 },
          description:
            'Define la idea central que hará que tu primera pieza tenga una dirección clara.',
        },
        {
          id: 'N02',
          title: 'Estructura Directa',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N01'],
          position: { x: 280, y: 220 },
          description:
            'Convierte la premisa en una estructura breve, explícita y fácil de seguir.',
        },
        {
          id: 'N03',
          title: 'Estructura Narrativa',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N01'],
          position: { x: 280, y: 380 },
          description:
            'Desarrolla la misma premisa como una secuencia con tensión, giro y resolución.',
        },
        {
          id: 'N04',
          title: 'Revisión Opcional',
          nodeType: 'optional',
          progressState: 'locked',
          prerequisites: ['N03'],
          position: { x: 440, y: 460 },
          description:
            'Haz una revisión adicional de ritmo y claridad sin detener la ruta principal.',
        },
        {
          id: 'N05',
          title: 'Ensamble',
          nodeType: 'normal',
          progressState: 'locked',
          requiresAny: ['N02', 'N03'],
          position: { x: 600, y: 300 },
          description:
            'Une premisa y estructura en un borrador completo listo para producir.',
        },
        {
          id: 'N06',
          title: 'Publicación',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N05'],
          position: { x: 780, y: 300 },
          description:
            'Publica la pieza terminada en el canal elegido y registra su enlace.',
        },
        {
          id: 'N07',
          title: 'Registro de Señales',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N06'],
          position: { x: 960, y: 300 },
          description:
            'Captura las primeras señales cualitativas y cuantitativas de la publicación.',
        },
        {
          id: 'N08',
          title: 'Análisis',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N07'],
          position: { x: 1140, y: 300 },
          description:
            'Interpreta las señales y decide qué conservar, ajustar o probar después.',
        },
        {
          id: 'N09',
          title: 'Primera Pieza en Mercado',
          nodeType: 'milestone',
          progressState: 'locked',
          prerequisites: ['N08'],
          position: { x: 1340, y: 284 },
          description:
            'Cierra el ciclo con una pieza publicada y un aprendizaje concreto del mercado.',
        },
      ],
      edges: [
        {
          id: 'E01',
          source: 'N01',
          target: 'N02',
          via: { x: 220, y: 300 },
        },
        {
          id: 'E02',
          source: 'N01',
          target: 'N03',
          via: { x: 220, y: 300 },
        },
        { id: 'E03', source: 'N02', target: 'N05' },
        { id: 'E04', source: 'N03', target: 'N05' },
        { id: 'E05', source: 'N03', target: 'N04', optional: true },
        { id: 'E06', source: 'N04', target: 'N05', optional: true },
        { id: 'E07', source: 'N05', target: 'N06' },
        { id: 'E08', source: 'N06', target: 'N07' },
        { id: 'E09', source: 'N07', target: 'N08' },
        { id: 'E10', source: 'N08', target: 'N09' },
      ],
      junctions: [{ id: 'branch-01', position: { x: 220, y: 300 } }],
    },
  ],
}
