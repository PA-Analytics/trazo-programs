import { useEffect, useRef, useState, memo } from 'react'
import '../styles/trazz-animations.css'

import idlePng from '../assets/trazz/trazz-idle.png'
import annotatingPng from '../assets/trazz/trazz-annotating.png'
import thinkingPng from '../assets/trazz/trazz-thinking.png'
import surprisedPng from '../assets/trazz/trazz-surprised.png'

export type TrazzEmotion =
  | 'idle'
  | 'walking'
  | 'thinking'
  | 'annotating'
  | 'surprised'
  | 'celebrate'

export type TrazzFacing = 'left' | 'right'

const emotionMap: Record<TrazzEmotion, string> = {
  idle: idlePng,
  walking: idlePng,
  surprised: surprisedPng,
  annotating: annotatingPng,
  thinking: thinkingPng,
  celebrate: idlePng,
}

const emotionLabel: Record<TrazzEmotion, string> = {
  idle: 'En espera',
  walking: 'Viajando',
  surprised: 'Sorprendido',
  annotating: 'Evaluando evidencia',
  thinking: 'Procesando ruta',
  celebrate: '¡Misión verificada!',
}

export interface TrazzCharacterProps {
  state: TrazzEmotion
  facing?: TrazzFacing
  className?: string
}

export const TrazzCharacter = memo(function TrazzCharacter({
  state,
  facing = 'right',
  className = '',
}: TrazzCharacterProps) {
  const [transitioning, setTransitioning] = useState(false)
  const prevState = useRef(state)

  useEffect(() => {
    if (prevState.current === state) return
    prevState.current = state

    setTransitioning(true)
    const id = setTimeout(() => setTransitioning(false), 140)
    return () => clearTimeout(id)
  }, [state])

  return (
    <div
      className={`trazz-character-wrapper ${className}`}
      data-state={state}
      data-facing={facing}
      data-transitioning={transitioning}
      aria-hidden="true"
    >
      <img
        src={emotionMap[state]}
        alt={`Acompañante TRAZO — ${emotionLabel[state]}`}
        draggable={false}
      />
    </div>
  )
})
