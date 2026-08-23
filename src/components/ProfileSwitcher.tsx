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
      <button type="button" className="profile-switcher__button" aria-label="Cambiar perfil" onClick={onOpen}>
        <span className="profile-switcher__button-label">Cambiar perfil</span>
        <span className="profile-switcher__button-label-mobile" aria-hidden="true">Perfil</span>
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
      <div className="entry-card entry-card--wide profile-selection-card">
        <header className="profile-selection-intro">
          <span className="setup-eyebrow">TRAZO · RUTAS GUARDADAS</span>
          <h1 id="profile-selection-title">¿Quién va a continuar?</h1>
          <p>Elige el recorrido que quieres retomar. Cada perfil conserva su propio punto en la ruta.</p>
        </header>
        {isLoading && <p className="entry-loading">Cargando perfiles…</p>}
        {error && <p className="setup-error" role="alert">{error}</p>}
        {!isLoading && !error && (
          <div className="profile-selection-list" role="list" aria-label="Perfiles guardados">
            {profiles.map((item, index) => (
              <button
                type="button"
                className="profile-selection-item"
                data-active={item.userId === activeProfileId}
                key={item.userId}
                onClick={() => onSelect(item.userId)}
              >
                <span className="profile-selection-item__waypoint" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="profile-selection-item__identity">
                  <strong>{item.displayName}</strong>
                  <small>{roleLabel(item.role)} · recorrido guardado</small>
                </span>
                {item.userId === activeProfileId && <span className="profile-selection-item__current">Ruta actual</span>}
                <span className="profile-selection-item__arrow" aria-hidden="true">→</span>
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
