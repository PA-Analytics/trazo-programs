import type { NodeType, ProgressState } from '../domain/course'

export const progressLabels: Record<ProgressState, string> = {
  locked: 'Bloqueada',
  available: 'Disponible',
  active: 'En curso',
  submitted: 'En revisión',
  completed: 'Completada',
}

export const nodeTypeLabels: Record<NodeType, string> = {
  normal: 'Misión',
  optional: 'Revisión opcional',
  milestone: 'Hito',
}
