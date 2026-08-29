import { useState } from 'react'
import type { UserProfile, UserRole } from '../domain/identity'
import { ProductRouteFrame } from './ProductRouteFrame'
import { TrazzSlot } from './TrazzSlot'

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
    <ProductRouteFrame
      variant="branch"
      stages={[
        { label: 'Identidad', state: 'complete' },
        { label: 'Elige tu ruta', state: 'current' },
        { label: 'Implementación', state: 'future' },
      ]}
    >
      <section className="role-branch" aria-labelledby="role-title">
        <header className="role-branch__header">
          <span className="setup-eyebrow">TRAZO · {profile.displayName}</span>
          <h1 id="role-title">Elige tu ruta.</h1>
          <p>Las dos parten de la misma metodología, pero cambian lo que haces dentro del sistema.</p>
        </header>
        <div className="role-branch__wayfinder">
          <TrazzSlot />
        </div>
        <div className="role-branch__origin">
          <span aria-hidden="true">01</span>
          <div><strong>Identidad</strong><small>{profile.displayName}</small></div>
        </div>
        <div className="role-choice-list" role="group" aria-label="Rutas disponibles">
          <button type="button" className="role-choice" data-route="learner" disabled={Boolean(isSaving)} onClick={() => void choose('learner')}>
            <span className="role-choice__index">02A</span>
            <span><strong>Alumno</strong><small>Ejecuta misiones, entrega trabajo real y avanza al verificarlo.</small></span>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="role-choice" data-route="coach" disabled={Boolean(isSaving)} onClick={() => void choose('coach')}>
            <span className="role-choice__index">02B</span>
            <span><strong>Coach</strong><small>Define qué cuenta como buen trabajo y calibra su evaluación.</small></span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {error && <p className="setup-error" role="alert">{error}</p>}
      </section>
    </ProductRouteFrame>
  )
}
