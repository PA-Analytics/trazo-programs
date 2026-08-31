import { expect, test } from '@playwright/test'

const timestamp = '2026-08-28T00:00:00.000Z'
const implementationId = 'learner-friction-e2e'
const courseId = 'primer-sistema-de-contenido'

test.describe('Repeated-Friction Proactive Recovery E2E Flow', () => {
  test('surfaces proactive recovery card on 2nd consecutive REWORK without learner help request', async ({ page }) => {
    let submissionCount = 0

    const learner = {
      userId: 'user-friction-e2e',
      displayName: 'Carlos',
      role: 'learner',
      createdAt: timestamp,
      updatedAt: timestamp,
      learnerImplementationId: implementationId,
    }

    await page.addInitScript((userId) => {
      localStorage.setItem('trazo_active_user_id', userId)
    }, learner.userId)

    await page.route('**/api/**', async (route) => {
      await route.fulfill({ json: null })
    })

    await page.route('**/api/v1/profiles', async (route) => {
      await route.fulfill({ json: [learner] })
    })

    await page.route(`**/api/v1/profiles/${learner.userId}`, async (route) => {
      await route.fulfill({ json: learner })
    })

    let implementationState: any = {
      id: implementationId,
      userId: learner.userId,
      courseId,
      courseVersion: '1.0.0',
      completedMissionIds: [],
      submissions: [],
      learnerSetup: {
        preferredRouteId: 'N02',
        updatedAt: timestamp,
      },
      evaluationProvenance: [],
      updatedAt: timestamp,
    }

    await page.route(`**/api/v1/implementations/${implementationId}`, async (route) => {
      await route.fulfill({ json: implementationState })
    })

    await page.route(`**/api/v1/implementations/${implementationId}/methodology`, async (route) => {
      await route.fulfill({ status: 404, json: null })
    })

    // Mock submissions
    await page.route(`**/api/v1/implementations/${implementationId}/submissions`, async (route) => {
      submissionCount++
      const now = new Date(Date.now() + submissionCount * 1000).toISOString()

      if (submissionCount === 1) {
        // Attempt 1: First REWORK
        const provRecord = {
          id: 'prov-1',
          evaluationId: 'eval-1',
          implementationId,
          courseId,
          missionId: 'N01',
          criteriaSetId: 'rubric-n01',
          criteriaVersion: '1.0.0',
          policyVerdict: 'REWORK',
          evidenceHash: 'hash-1',
          timestamp: now,
          criterionResults: [
            { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Buena idea.' },
            { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Falta especificar audiencia.' },
            { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Sin relleno.' },
          ],
          evaluation: {
            criteria: [
              { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Buena idea.' },
              { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Falta especificar audiencia.' },
              { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Sin relleno.' },
            ],
            coachingFeedback: 'Identifica a quién le hablas para que la premisa sea concreta.',
          },
        }

        implementationState = {
          ...implementationState,
          evaluationProvenance: [provRecord],
          updatedAt: now,
        }

        await route.fulfill({
          json: {
            interactionType: 'EVIDENCE_SUBMISSION',
            message: 'Identifica a quién le hablas para que la premisa sea concreta.',
            evaluation: provRecord.evaluation,
            policyVerdict: 'REWORK',
            state: implementationState,
            completed: false,
          },
        })
      } else if (submissionCount === 2) {
        // Attempt 2: Second REWORK (same mission, persistent failure on c2_target_audience)
        const provRecord = {
          id: 'prov-2',
          evaluationId: 'eval-2',
          implementationId,
          courseId,
          missionId: 'N01',
          criteriaSetId: 'rubric-n01',
          criteriaVersion: '1.0.0',
          policyVerdict: 'REWORK',
          evidenceHash: 'hash-2',
          timestamp: now,
          criterionResults: [
            { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea clara.' },
            { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Aún no se distingue el público objetivo.' },
            { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Directo.' },
          ],
          evaluation: {
            criteria: [
              { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'Idea clara.' },
              { criterionId: 'c2_target_audience', status: 'NOT_MET', rationale: 'Aún no se distingue el público objetivo.' },
              { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'Directo.' },
            ],
            coachingFeedback: 'El público objetivo sigue difuso. Enfócate en el cliente.',
          },
        }

        implementationState = {
          ...implementationState,
          evaluationProvenance: [...implementationState.evaluationProvenance, provRecord],
          updatedAt: now,
        }

        await route.fulfill({
          json: {
            interactionType: 'EVIDENCE_SUBMISSION',
            message: 'El público objetivo sigue difuso. Enfócate en el cliente.',
            evaluation: provRecord.evaluation,
            policyVerdict: 'REWORK',
            state: implementationState,
            completed: false,
          },
        })
      } else {
        // Attempt 3: PASS
        const provRecord = {
          id: 'prov-3',
          evaluationId: 'eval-3',
          implementationId,
          courseId,
          missionId: 'N01',
          criteriaSetId: 'rubric-n01',
          criteriaVersion: '1.0.0',
          policyVerdict: 'PASS',
          evidenceHash: 'hash-3',
          timestamp: now,
          criterionResults: [
            { criterionId: 'c1_concrete_idea', status: 'PASS', rationale: 'OK' },
            { criterionId: 'c2_target_audience', status: 'PASS', rationale: 'Audiencia verificada.' },
            { criterionId: 'c3_no_filler', status: 'PASS', rationale: 'OK' },
          ],
        }

        implementationState = {
          ...implementationState,
          completedMissionIds: ['N01'],
          evaluationProvenance: [...implementationState.evaluationProvenance, provRecord],
          updatedAt: now,
        }

        await route.fulfill({
          json: {
            interactionType: 'EVIDENCE_SUBMISSION',
            message: 'Premisa verificada.',
            policyVerdict: 'PASS',
            state: implementationState,
            completed: true,
          },
        })
      }
    })

    // 1. Navigate to App (already configured with route preference)
    await page.goto('http://127.0.0.1:5173')
    await expect(page.locator('.app-shell')).toBeVisible()

    // 2. Open Mission N01
    const nodeN01 = page.getByRole('button', { name: /Misión: Premisa/ })
    await nodeN01.click()
    await expect(page.locator('.mission-panel')).toBeVisible()

    // 3. First Submission -> REWORK (1st attempt)
    const textarea = page.locator('#mission-evidence-N01')
    await textarea.fill('Quiero hacer publicaciones para conseguir clientes.')
    await page.locator('.submit-evidence-button').click()

    // Feedback appears, but NO proactive recovery card yet
    await expect(page.locator('.companion-feedback-summary')).toBeVisible()
    await expect(page.locator('.mission-friction-recovery')).toHaveCount(0)

    // 4. Second Submission -> 2nd consecutive REWORK -> Proactive recovery card surfaces!
    await textarea.fill('Consejos de ventas para profesionales independientes.')
    await page.locator('.submit-evidence-button').click()

    const recoveryCard = page.locator('.mission-friction-recovery')
    await expect(recoveryCard).toBeVisible()
    await expect(recoveryCard).toContainText('Sugerencia para avanzar')
    await expect(recoveryCard).toContainText('Audiencia Reconocible')

    // 5. Click "Entendido" -> Dismisses card
    await recoveryCard.getByRole('button', { name: 'Entendido' }).click()
    await expect(page.locator('.mission-friction-recovery')).toHaveCount(0)

    // 6. Third Submission -> PASS
    await textarea.fill('Estrategia de prospección en LinkedIn para consultores B2B de software.')
    await page.locator('.submit-evidence-button').click()

    // Mission verified!
    await expect(page.locator('.mission-complete-note')).toBeVisible()
    await expect(page.locator('.mission-complete-note')).toContainText('completado y validado')
  })
})
