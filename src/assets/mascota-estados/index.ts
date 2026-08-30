import trazzVueloDeterminado from './vuelo-determinado/vuelo-determinado.png'
import trazzCoachEvaluador from './coach-evaluador/coach-evaluador.png'
import trazzPensandoDerecha from './pensando-derecha/pensando-derecha.png'
import trazzPensandoIzquierda from './pensando-izquierda/pensando-izquierda.png'
import trazzSorprendido from './sorprendido/sorprendido.png'

export {
  trazzVueloDeterminado,
  trazzCoachEvaluador,
  trazzPensandoDerecha,
  trazzPensandoIzquierda,
  trazzSorprendido,
}

export const TRAZZ_CANONICAL_ASSETS = {
  vueloDeterminado: trazzVueloDeterminado,
  coachEvaluador: trazzCoachEvaluador,
  pensandoDerecha: trazzPensandoDerecha,
  pensandoIzquierda: trazzPensandoIzquierda,
  sorprendido: trazzSorprendido,
} as const

export type TrazzCanonicalState = keyof typeof TRAZZ_CANONICAL_ASSETS
