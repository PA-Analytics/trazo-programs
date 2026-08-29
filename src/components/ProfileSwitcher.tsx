import { useEffect, useState } from 'react'
import type { UserProfile, UserProfileSummary } from '../domain/identity'
import { TrazzSlot } from './TrazzSlot'
import trazoLogoFull from '../../trazo-logo-full.png'

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
          <div className="profile-selection-brand">
            <img className="profile-selection-brand__logo" src={trazoLogoFull} alt="TRAZO" />
          </div>
          <span className="setup-eyebrow">RUTAS GUARDADAS</span>
          <h1 id="profile-selection-title">
            <span>¿QUIÉN</span>
            <span>SIGUE</span>
            <span>LA RUTA?</span>
          </h1>
          <p>Vuelve al punto donde lo dejaste.</p>
          <TrazzSlot />
        </header>
        <section className="profile-selection-routes" aria-labelledby="profile-selection-routes-title">
          <header className="profile-selection-routes__header">
            <span className="profile-selection-routes__index">01 / IDENTIDAD</span>
            <h2 id="profile-selection-routes-title">Elige tu punto de partida</h2>
          </header>
          {isLoading && <p className="entry-loading">Cargando perfiles…</p>}
          {error && <p className="setup-error" role="alert">{error}</p>}
          {!isLoading && !error && profiles.length === 0 && (
            <p className="profile-selection-empty">Todavía no hay perfiles guardados.</p>
          )}
          {!isLoading && !error && profiles.length > 0 && (
            <ul className="profile-selection-list" aria-label="Perfiles guardados">
              {profiles.map((item, index) => {
                const isActive = item.userId === activeProfileId
                return (
                  <li key={item.userId}>
                    <button
                      type="button"
                      className="profile-selection-item"
                      data-active={isActive}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => onSelect(item.userId)}
                    >
                      <span className="profile-selection-item__waypoint" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="profile-selection-item__identity">
                        <strong>{item.displayName}</strong>
                        <small>{roleLabel(item.role)}</small>
                      </span>
                      {isActive && <span className="profile-selection-item__current">Perfil activo</span>}
                      <span className="profile-selection-item__arrow">
                        <span>{isActive ? 'Continuar' : 'Retomar'}</span>
                        <span aria-hidden="true">→</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="profile-selection-actions">
            <button type="button" className="setup-primary" onClick={onCreate}>
              Crear otro perfil
            </button>
            <button type="button" className="setup-secondary" onClick={onClose}>
              Volver al recorrido
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
