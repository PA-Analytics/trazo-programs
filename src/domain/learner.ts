import type {
  CalibrationVerdict,
  HelpPreference,
  Mission,
  PolicyVerdict,
} from './course'

export function adaptCompanionGuidance(
  message: string,
  preference: HelpPreference | undefined,
  mission: Mission,
  verdict: PolicyVerdict,
): string {
  if (!preference || preference === 'ADAPTIVE' || verdict === 'PASS') return message

  const focus = mission.title.toLocaleLowerCase('es-MX')
  if (preference === 'QUESTIONS') {
    return `${message} ¿Qué parte de ${focus} todavía no se puede comprobar con lo que escribiste?`
  }

  if (preference === 'EXAMPLE') {
    return `${message} Por ejemplo, vuelve a escribirlo con un caso concreto de ${focus}.`
  }

  return message
}

export function calibrationVerdictLabel(verdict: CalibrationVerdict): string {
  return verdict === 'PASS' ? 'PASS' : verdict === 'REWORK' ? 'REWORK' : 'CLARIFY'
}
