import type { Course } from '../../domain/course'
import { course as primerSistemaDeContenido } from '../course.ts'
import { primerClienteDigital } from './primer-cliente.ts'

export type MethodologyPack = Course

export const packs: MethodologyPack[] = [primerSistemaDeContenido, primerClienteDigital]

export const DEFAULT_PACK_ID = primerSistemaDeContenido.id

export function resolvePack(courseId?: string): MethodologyPack {
  const id = courseId?.trim() || DEFAULT_PACK_ID
  const pack = packs.find((item) => item.id === id)
  if (!pack) {
    throw new Error(`Unknown methodology pack '${id}'. Registered packs: ${packs.map((p) => p.id).join(', ')}`)
  }
  return pack
}

export function resolveMission(packId: string, missionId: string) {
  const pack = resolvePack(packId)
  const mission = pack.chapters
    .flatMap((chapter) => chapter.missions)
    .find((item) => item.id === missionId)
  if (!mission) {
    throw new Error(`Mission '${missionId}' not found in methodology '${pack.id}'`)
  }
  return { pack, mission }
}

export function findMissionOwner(missionId: string): MethodologyPack | null {
  const owners = packs.filter((pack) =>
    pack.chapters.some((chapter) => chapter.missions.some((mission) => mission.id === missionId)),
  )
  if (owners.length === 0) return null
  if (owners.length > 1) {
    throw new Error(
      `Mission id '${missionId}' is ambiguous across methodologies (${owners.map((p) => p.id).join(', ')}). Use distinct mission ids per pack.`,
    )
  }
  return owners[0]
}
