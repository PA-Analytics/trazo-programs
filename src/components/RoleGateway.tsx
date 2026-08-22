import { useState } from 'react'
import type { UserProfile, UserRole } from '../domain/identity'

interface RoleGatewayProps {
  profile: UserProfile
  onComplete: (profile: UserProfile) => void
}

export function RoleGateway({ profile, onComplete }: RoleGatewayProps) {
  const [isSaving, setIsSaving] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(role: UserRole) {
    setIsSaving(role)
    setError(null)
    try {
      const response = await fetch(`/api/v1/profiles/${encodeURIComponent(profile.userId)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': profile.userId },
        body: JSON.stringify({ role }),
      })
      if (!response.ok) throw new Error('No se pudo guardar tu camino.')
      onComplete((await response.json()) as UserProfile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar tu camino.')
    } finally {
      setIsSaving(null)
    }
  }

  return (
    <main className="entry-shell" aria-labelledby="role-title">
      <div className="entry-card entry-card--wide">
        <span className="setup-eyebrow">TRAZO · {profile.displayName}</span>
        <h1 id="role-title">¿Cómo vas a usar TRAZO?</h1>
        <p>Elige el recorrido que corresponde a lo que vienes a hacer.</p>
        <div className="role-choice-list">
          <button type="button" className="role-choice" disabled={Boolean(isSaving)} onClick={() => void choose('learner')}>
            <span className="role-choice__index">01</span>
            <span><strong>Estoy tomando el programa</strong><small>Quiero avanzar por misiones y entregar trabajo real.</small></span>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="role-choice" disabled={Boolean(isSaving)} onClick={() => void choose('coach')}>
            <span className="role-choice__index">02</span>
            <span><strong>Estoy guiando el programa</strong><small>Quiero enseñarle a TRAZO qué cuenta como buen trabajo.</small></span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {error && <p className="setup-error" role="alert">{error}</p>}
      </div>
    </main>
  )
}
