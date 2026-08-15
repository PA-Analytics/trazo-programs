import { CenterIcon, ZoomInIcon, ZoomOutIcon } from './icons'

interface MapControlsProps {
  zoom: number
  disabled: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

export function MapControls({
  zoom,
  disabled,
  onZoomIn,
  onZoomOut,
  onFit,
}: MapControlsProps) {
  return (
    <div className="map-controls" role="group" aria-label="Controles de cámara del mapa">
      <button
        type="button"
        className="map-control"
        aria-label="Acercar mapa"
        title="Acercar"
        disabled={disabled}
        onClick={onZoomIn}
      >
        <ZoomInIcon />
      </button>
      <output
        className="map-controls__zoom"
        aria-label={`Nivel de zoom: ${Math.round(zoom * 100)} por ciento`}
      >
        {Math.round(zoom * 100)}%
      </output>
      <button
        type="button"
        className="map-control"
        aria-label="Alejar mapa"
        title="Alejar"
        disabled={disabled}
        onClick={onZoomOut}
      >
        <ZoomOutIcon />
      </button>
      <button
        type="button"
        className="map-control map-control--fit"
        aria-label="Encuadrar toda la ruta"
        title="Encuadrar ruta"
        disabled={disabled}
        onClick={onFit}
      >
        <CenterIcon />
      </button>
    </div>
  )
}
