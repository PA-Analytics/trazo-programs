import { useEffect, useState } from 'react'
import type { UserProfile, UserProfileSummary } from '../domain/identity'

interface ProfileSwitcherProps {
  profile: UserProfile
  onOpen: () => void
}

interface ProfileSelectionProps {
  activeProfileId: string
  onSelect: (userId: string) => void
  onCreate: () => void
  onClose: () => void
}

function roleLabel(role: UserProfileSummary['role']) {
  return role === 'coach' ? 'Coach' : role === 'learner' ? 'Alumno' : 'Sin configurar'
}

export function ProfileSwitcher({ profile, onOpen }: ProfileSwitcherProps) {
  return (
    <div className="profile-switcher" data-testid="profile-switcher">
      <span className="profile-switcher__name">{profile.displayName}</span>
      <span className="profile-switcher__role">{roleLabel(profile.role)}</span>
      <button type="button" className="profile-switcher__button" onClick={onOpen}>
        Cambiar perfil
      </button>
    </div>
  )
}

export function ProfileSelection({ activeProfileId, onSelect, onCreate, onClose }: ProfileSelectionProps) {
  const [profiles, setProfiles] = useState<UserProfileSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/v1/profiles')
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron cargar los perfiles.')
        return (await response.json()) as UserProfileSummary[]
      })
      .then((data) => {
        if (!cancelled) setProfiles(data)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los perfiles. Intenta de nuevo.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="entry-shell profile-selection-shell" aria-labelledby="profile-selection-title">
      <div className="entry-card entry-card--wide">
        <span className="setup-eyebrow">TRAZO · PERFILES</span>
        <h1 id="profile-selection-title">¿Quién va a continuar?</h1>
        <p>Elige un perfil para volver a su recorrido guardado.</p>
        {isLoading && <p className="entry-loading">Cargando perfiles…</p>}
        {error && <p className="setup-error" role="alert">{error}</p>}
        {!isLoading && !error && (
          <div className="profile-selection-list" role="list" aria-label="Perfiles guardados">
            {profiles.map((item) => (
              <button
                type="button"
                className="profile-selection-item"
                data-active={item.userId === activeProfileId}
                key={item.userId}
                onClick={() => onSelect(item.userId)}
              >
                <span>
                  <strong>{item.displayName}</strong>
                  <small>{roleLabel(item.role)}</small>
                </span>
                {item.userId === activeProfileId && <span className="profile-selection-item__current">Actual</span>}
              </button>
            ))}
          </div>
        )}
        <div className="profile-selection-actions">
          <button type="button" className="setup-primary" onClick={onCreate}>
            Crear otro perfil
          </button>
          <button type="button" className="setup-secondary" onClick={onClose}>
            Volver al recorrido
          </button>
        </div>
      </div>
    </main>
  )
}
