import { useState } from 'react'
import type { UserProfile } from '../domain/identity'

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
    <main className="entry-shell" aria-labelledby="identity-title">
      <div className="entry-card">
        <span className="setup-eyebrow">TRAZO · PRIMER PASO</span>
        <h1 id="identity-title">¿Cómo quieres que te llamemos?</h1>
        <p>Así guardamos tu recorrido y no tienes que empezar de nuevo cada vez que vuelves.</p>
        <label className="entry-label" htmlFor="display-name">Tu nombre</label>
        <input
          id="display-name"
          className="entry-input"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit()
          }}
          placeholder="Pablo"
          autoComplete="name"
          autoFocus
        />
        {error && <p className="setup-error" role="alert">{error}</p>}
        <button type="button" className="setup-primary entry-submit" disabled={!displayName.trim() || isSaving} onClick={() => void submit()}>
          {isSaving ? 'Guardando…' : 'Continuar →'}
        </button>
        {onCancel && (
          <button type="button" className="setup-secondary entry-cancel" onClick={onCancel} disabled={isSaving}>
            Volver a perfiles
          </button>
        )}
      </div>
    </main>
  )
}
