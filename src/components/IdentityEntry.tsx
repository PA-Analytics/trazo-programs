import { useState, type FormEvent } from 'react'
import type { UserProfile } from '../domain/identity'
import { ProductRouteFrame } from './ProductRouteFrame'
import trazzPensandoIzquierda from '../assets/mascota-estados/pensando-izquierda/pensando-izquierda.png'

interface IdentityEntryProps {
  onComplete: (profile: UserProfile) => void
  onCancel?: () => void
}

export function IdentityEntry({ onComplete, onCancel }: IdentityEntryProps) {
  const [displayName, setDisplayName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event?: FormEvent) {
    if (event) event.preventDefault()
    const value = displayName.trim()
    if (!value || isSaving) return
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

  const trimmedName = displayName.trim()

  return (
    <ProductRouteFrame variant="identity" hideRail>
      <form
        className="identity-ledger"
        aria-labelledby="identity-title"
        onSubmit={submit}
      >
        <div className="identity-ledger__main">
          <header className="identity-ledger__header">
            <span className="setup-eyebrow">TRAZO · PRIMER PASO</span>
            <h1 id="identity-title" className="identity-ledger__title">
              ¿CÓMO TE INSCRIBES EN ESTA RUTA?
            </h1>
          </header>

          <div className="identity-ledger__body">
            <div className="identity-ledger__field">
              <label className="visually-hidden" htmlFor="display-name">
                Tu nombre o identificador
              </label>
              <input
                id="display-name"
                className="identity-ledger__input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="ESCRIBE TU NOMBRE…"
                autoComplete="name"
                autoFocus
                maxLength={40}
                disabled={isSaving}
              />
            </div>

            <div className="identity-ledger__echo" aria-live="polite">
              {trimmedName ? (
                <p>
                  ✦ Se anclarán las evidencias y entregables a nombre de <strong>{trimmedName}</strong>.
                </p>
              ) : (
                <p>
                  Tu nombre anclará el recorrido y las evidencias que vas a demostrar.
                </p>
              )}
            </div>

            {error && (
              <p className="setup-error identity-ledger__error" role="alert">
                {error}
              </p>
            )}

            <div className="identity-ledger__actions">
              <button
                type="submit"
                className="setup-primary identity-ledger__submit"
                disabled={!trimmedName || isSaving}
              >
                {isSaving ? 'Inscribiendo…' : 'Continuar →'}
              </button>
              <span className="identity-ledger__hint" aria-hidden="true">
                o presiona <strong>Enter ↵</strong>
              </span>

              {onCancel && (
                <button
                  type="button"
                  className="setup-secondary identity-ledger__cancel"
                  onClick={onCancel}
                  disabled={isSaving}
                >
                  Volver a perfiles
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="identity-ledger__waypoint-slot" aria-hidden="true">
          <div className="identity-ledger__waypoint-ground">
            <img
              src={trazzPensandoIzquierda}
              alt=""
              className="identity-ledger__trazz-avatar"
            />
            <div className="identity-ledger__waypoint-disc">
              <span className="identity-ledger__waypoint-tag">01 · PRIMER PASO</span>
            </div>
          </div>
        </aside>
      </form>
    </ProductRouteFrame>
  )
}
