import { useState } from 'react'
import type { UserProfile } from '../domain/identity'
import { ProductRouteFrame } from './ProductRouteFrame'

interface IdentityEntryProps {
  onComplete: (profile: UserProfile) => void
  onCancel?: () => void
}

export function IdentityEntry({ onComplete, onCancel }: IdentityEntryProps) {
  const [displayName, setDisplayName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const value = displayName.trim()
    if (!value) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: value }),
      })
      if (!response.ok) throw new Error('No se pudo guardar tu identidad.')
      onComplete((await response.json()) as UserProfile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar tu identidad.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ProductRouteFrame
      stages={[
        { label: 'Identidad', state: 'current' },
        { label: 'Ruta', state: 'future' },
        { label: 'Trabajo real', state: 'future' },
      ]}
    >
      <form className="entry-card identity-route" aria-labelledby="identity-title" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <span className="setup-eyebrow">TRAZO · PRIMER PASO</span>
        <h1 id="identity-title">¿Cómo quieres que te llamemos?</h1>
        <p>Tu nombre ancla el recorrido que vas a demostrar.</p>
        <div className="identity-route__start">
          <span className="identity-route__node" aria-hidden="true">01</span>
          <div className="identity-route__action">
            <span className="identity-route__label">Inicio de ruta · Identidad</span>
            <label className="entry-label" htmlFor="display-name">Tu nombre</label>
            <input
              id="display-name"
              className="entry-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Pablo"
              autoComplete="name"
              autoFocus
            />
            {error && <p className="setup-error" role="alert">{error}</p>}
            <button type="submit" className="setup-primary entry-submit" disabled={!displayName.trim() || isSaving}>
              {isSaving ? 'Guardando…' : 'Continuar →'}
            </button>
          </div>
        </div>
        <div className="identity-route__next" aria-hidden="true">
          <span>02</span>
          <small>Elige la ruta que vas a recorrer</small>
        </div>
        {onCancel && (
          <button type="button" className="setup-secondary entry-cancel" onClick={onCancel} disabled={isSaving}>
            Volver a perfiles
          </button>
        )}
      </form>
    </ProductRouteFrame>
  )
}
