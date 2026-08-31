import { useEffect } from 'react'

let audioContext: AudioContext | null = null

function getAudioContext() {
  if (audioContext && audioContext.state !== 'closed') return audioContext

  const AudioContextConstructor = window.AudioContext
  if (!AudioContextConstructor) return null

  audioContext = new AudioContextConstructor()
  return audioContext
}

function playButtonClick() {
  const context = getAudioContext()
  if (!context) return

  if (context.state === 'suspended') {
    void context.resume().catch(() => {})
  }

  scheduleButtonClick(context)
}

function scheduleButtonClick(context: AudioContext) {

  const now = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(560, now)
  oscillator.frequency.exponentialRampToValueAtTime(360, now + 0.07)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.11, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.095)
}

function handleDocumentClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return

  const interactive = event.target.closest('button, [role="button"], a')
  if (!(interactive instanceof HTMLElement)) return
  if (interactive.matches(':disabled') || interactive.getAttribute('aria-disabled') === 'true') return
  if (interactive.dataset.sound === 'none') return

  playButtonClick()
}

export function useUiSoundEffects() {
  useEffect(() => {
    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [])
}
