import type { MapPosition } from './course'

export type CompassDirection8 = 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'N' | 'NE'

export type CompanionState =
  | 'idle'        // En reposo junto a la misión activa
  | 'attention'   // Requiere decisión/clarificación o tiene sugerencia
  | 'thinking'    // Procesando inferencia AI en tiempo real
  | 'moving'      // Desplazándose a lo largo de una arista del mapa
  | 'verified'    // Modo TRAZO activado tras un PASS verificado

export interface CompanionVisualConfig {
  speedPxPerSec: number
  bobbingHeight: number
  shadowBaseWidth: number
  shadowBaseHeight: number
}

export interface CompanionPose {
  position: MapPosition
  direction: CompassDirection8
  state: CompanionState
  targetMissionId?: string
}
