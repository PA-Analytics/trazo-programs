import { useState } from 'react'
import type { UserProfile, UserRole } from '../domain/identity'
import { ProductRouteFrame } from './ProductRouteFrame'
import trazzVueloDeterminado from '../assets/mascota-estados/vuelo-determinado/vuelo-determinado.png'
import trazzCoachEvaluador from '../assets/mascota-estados/coach-evaluador/coach-evaluador.png'

interface RoleGatewayProps {
  profile: UserProfile
  onComplete: (profile: UserProfile) => void
}

export function RoleGateway({ profile, onComplete }: RoleGatewayProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [isSaving, setIsSaving] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function continueWithRole(roleToSave = selectedRole) {
    if (!roleToSave) return
    setIsSaving(roleToSave)
    setError(null)
    try {
      const response = await fetch(`/api/v1/profiles/${encodeURIComponent(profile.userId)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Trazo-User-Id': profile.userId },
        body: JSON.stringify({ role: roleToSave }),
      })
      if (!response.ok) throw new Error('No se pudo guardar tu camino.')
      onComplete((await response.json()) as UserProfile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar tu camino.')
    } finally {
      setIsSaving(null)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && selectedRole && !isSaving) {
      event.preventDefault()
      void continueWithRole()
    }
  }

  return (
    <ProductRouteFrame variant="branch" hideRail>
      <section
        className="role-branch"
        aria-labelledby="role-title"
        onKeyDown={handleKeyDown}
      >
        <header className="role-branch__header">
          <span className="setup-eyebrow">TRAZO · {profile.displayName.toUpperCase()}</span>
          <h1 id="role-title" className="role-branch__title">
            ¿CÓMO PARTICIPAS EN ESTA RUTA?
          </h1>
          <p className="role-branch__subtitle">
            Elige el rol con el que vas a interactuar con el mapa.
          </p>
        </header>

        <div className="role-monoliths" role="radiogroup" aria-label="Rutas disponibles">
          {/* S1: Alumno */}
          <button
            type="button"
            className="role-monolith role-monolith--learner"
            data-route="learner"
            data-selected={selectedRole === 'learner'}
            aria-checked={selectedRole === 'learner'}
            role="radio"
            disabled={Boolean(isSaving)}
            onClick={() => setSelectedRole('learner')}
            onDoubleClick={() => void continueWithRole('learner')}
          >
            <div className="role-monolith__top">
              <span className="role-monolith__tag">02A · ALUMNO</span>
              <span className="role-monolith__radio" aria-hidden="true">
                {selectedRole === 'learner' ? '●' : '○'}
              </span>
            </div>

            <div className="role-monolith__visual">
              <img
                src={trazzVueloDeterminado}
                alt=""
                className="role-monolith__avatar"
              />
            </div>

            <div className="role-monolith__content">
              <h2 className="role-monolith__title">RECORRER LA RUTA</h2>
              <p className="role-monolith__desc">
                Ejecuta misiones, entrega trabajo real y avanza en el grafo al verificarlo.
              </p>
              <span className="role-monolith__badge">
                ✦ TRABAJO REAL Y EVIDENCIAS
              </span>
            </div>
          </button>

          {/* S2: Coach */}
          <button
            type="button"
            className="role-monolith role-monolith--coach"
            data-route="coach"
            data-selected={selectedRole === 'coach'}
            aria-checked={selectedRole === 'coach'}
            role="radio"
            disabled={Boolean(isSaving)}
            onClick={() => setSelectedRole('coach')}
            onDoubleClick={() => void continueWithRole('coach')}
          >
            <div className="role-monolith__top">
              <span className="role-monolith__tag">02B · COACH</span>
              <span className="role-monolith__radio" aria-hidden="true">
                {selectedRole === 'coach' ? '●' : '○'}
              </span>
            </div>

            <div className="role-monolith__visual">
              <img
                src={trazzCoachEvaluador}
                alt=""
                className="role-monolith__avatar"
              />
            </div>

            <div className="role-monolith__content">
              <h2 className="role-monolith__title">TRAZAR EL CAMINO</h2>
              <p className="role-monolith__desc">
                Define qué cuenta como buen trabajo y calibra los criterios de evaluación.
              </p>
              <span className="role-monolith__badge">
                ✦ CALIBRACIÓN DE RÚBRICAS
              </span>
            </div>
          </button>
        </div>

        {error && (
          <p className="setup-error role-branch__error" role="alert">
            {error}
          </p>
        )}

        <footer className="role-branch__footer">
          <button
            type="button"
            className="setup-primary role-branch__submit"
            disabled={!selectedRole || Boolean(isSaving)}
            onClick={() => void continueWithRole()}
          >
            {isSaving
              ? 'Guardando…'
              : selectedRole === 'learner'
                ? 'Continuar como Alumno →'
                : selectedRole === 'coach'
                  ? 'Continuar como Coach →'
                  : 'Selecciona una ruta →'}
          </button>
          {selectedRole && (
            <span className="role-branch__hint" aria-hidden="true">
              o presiona <strong>Enter ↵</strong>
            </span>
          )}
        </footer>
      </section>
    </ProductRouteFrame>
  )
}
