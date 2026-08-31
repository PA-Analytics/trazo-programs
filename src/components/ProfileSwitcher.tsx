import { useEffect, useState } from 'react'
import type { UserProfile, UserProfileSummary } from '../domain/identity'
import { ProfileReturnRoute } from './ProfileReturnRoute'
import trazoLogoFullWhite from '../../trazo-logo-full-white.png'
import { trazzSorprendido } from '../assets/mascota-estados'

interface ProfileSwitcherProps {
  profile: UserProfile
  onOpen: () => void
}

interface ProfileSelectionProps {
  activeProfileId: string
  onSelect: (userId: string) => void
  onCreate: () => void
  onClose?: () => void
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

export function ProfileSelection({ activeProfileId, onSelect, onCreate }: ProfileSelectionProps) {
  const [profiles, setProfiles] = useState<UserProfileSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileToDelete, setProfileToDelete] = useState<UserProfileSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete(userId: string) {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/v1/profiles/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Error ${res.status}: No se pudo eliminar el perfil.`)
      }
      setProfiles((prev) => prev.filter((p) => p.userId !== userId))
      setProfileToDelete(null)
      setDeleteError(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar el perfil.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="entry-shell profile-selection-shell" aria-labelledby="profile-selection-title">
      <div className="entry-card entry-card--wide profile-selection-card">
        <header className="profile-selection-intro">
          <div className="profile-selection-brand">
            <img className="profile-selection-brand__logo" src={trazoLogoFullWhite} alt="TRAZO" />
          </div>
          <span className="setup-eyebrow">RUTAS GUARDADAS</span>
          <h1 id="profile-selection-title">
            <span>¿QUIÉN</span>
            <span>SIGUE</span>
            <span>LA RUTA?</span>
          </h1>
          <p>Vuelve al punto donde lo dejaste.</p>
          <ProfileReturnRoute />
        </header>
        <section className="profile-selection-routes" aria-label="Rutas guardadas">
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
                  <li key={item.userId} className="profile-selection-list-item">
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
                    <button
                      type="button"
                      className="profile-selection-item__delete"
                      title={`Eliminar perfil de ${item.displayName}`}
                      aria-label={`Eliminar perfil de ${item.displayName}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setProfileToDelete(item)
                      }}
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="profile-selection-actions">
            <button type="button" className="setup-primary" onClick={onCreate}>
              Crear una ruta
            </button>
          </div>
        </section>
      </div>

      {/* MODAL EDITORIAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {profileToDelete && (
        <div className="profile-delete-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="profile-delete-modal">
            <header className="profile-delete-modal__header">
              <span className="setup-eyebrow">TRAZO // GESTIÓN DE PERFILES</span>
              <h2 id="delete-modal-title" className="profile-delete-modal__title">
                ¿ELIMINAR PERFIL DE LA BITÁCORA?
              </h2>
            </header>

            <div className="profile-delete-modal__body">
              <div className="profile-delete-modal__target">
                <strong className="profile-delete-modal__name">{profileToDelete.displayName}</strong>
                <span className="profile-delete-modal__role">{roleLabel(profileToDelete.role)}</span>
              </div>

              <p className="profile-delete-modal__warning">
                Esta acción es irreversible. Se borrarán de forma definitiva todas sus entregas, calibraciones, artefactos y el progreso registrado en el mapa de misiones.
              </p>

              <div className="profile-delete-modal__trazz">
                <img src={trazzSorprendido} alt="Trazz Alerta" className="profile-delete-modal__trazz-avatar" />
                <div className="profile-delete-modal__trazz-text">
                  <strong>TRAZZ // AVISO CRÍTICO</strong>
                  <p>Los datos eliminados no se pueden recuperar. ¿Seguro que deseas borrar este perfil?</p>
                </div>
              </div>

              {deleteError && (
                <div className="setup-error" role="alert" style={{ margin: '8px 0 0' }}>
                  {deleteError}
                </div>
              )}
            </div>

            <footer className="profile-delete-modal__actions">
              <button
                type="button"
                className="profile-delete-btn-cancel"
                disabled={isDeleting}
                onClick={() => setProfileToDelete(null)}
              >
                ← Cancelar
              </button>
              <button
                type="button"
                className="profile-delete-btn-confirm"
                disabled={isDeleting}
                onClick={() => void handleDelete(profileToDelete.userId)}
              >
                {isDeleting ? 'Eliminando…' : '✕ Sí, eliminar definitivamente'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  )
}
