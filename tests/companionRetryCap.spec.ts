import { expect, test, type Page } from '@playwright/test'

const timestamp = '2026-08-23T00:00:00.000Z'
const implementationId = 'learner-user-active-profile'
const courseId = 'primer-sistema-de-contenido'

// F5 regression: the companion must NOT auto-refire /next-action in an unbounded loop
// while the endpoint is failing (outage/quota). One automatic attempt max; recovery
// is user-driven via the explicit Reintentar control.
test.describe('companion next-action retry cap', () => {
  test('auto next-action requests stay bounded when the endpoint persistently fails', async ({ page }) => {
    let nextActionRequests = 0

    // Registered first: Playwright resolves overlapping routes most-recent-first,
    // so this catch-all must precede every specific mock.
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ json: null })
    })
    await mockLearnerQuestMap(page)
    await page.route(`**/api/v1/implementations/${implementationId}/next-action`, async (route) => {
      nextActionRequests += 1
      await route.abort('failed')
    })

    await page.goto('http://127.0.0.1:5173')
    await expect(page.locator('.app-shell')).toBeVisible()

    // Fixed observation window: under the old behavior this floods with thousands of
    // requests at ~4-15ms intervals; bounded behavior must hold at exactly one
    // automatic attempt for the whole window.
    await page.waitForTimeout(3000)

    expect(nextActionRequests).toBeLessThanOrEqual(1)
  })

  test('explicit learner retry after failure issues a new request', async ({ page }) => {
    let nextActionRequests = 0

    await page.route('**/api/**', async (route) => {
      await route.fulfill({ json: null })
    })
    await mockLearnerQuestMap(page)
    await page.route(`**/api/v1/implementations/${implementationId}/next-action`, async (route) => {
      nextActionRequests += 1
      if (nextActionRequests === 1) {
        await route.abort('failed')
        return
      }
      await route.fulfill({
        json: { type: 'RECOMMEND_MISSION', missionId: 'N02', rationale: 'Sigue por aquí.' },
      })
    })

    await page.goto('http://127.0.0.1:5173')
    await expect(page.locator('.app-shell')).toBeVisible()
    await page.waitForTimeout(800)
    expect(nextActionRequests).toBe(1)

    await page.locator('.trazo-companion-body-btn').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Reintentar' }).click()

    await expect(page.getByText(/Vamos por aquí|Ir a esta ruta/).first()).toBeVisible()
    expect(nextActionRequests).toBe(2)
  })
})

async function mockLearnerQuestMap(page: Page) {
  const learner = {
    userId: 'user-active-profile',
    displayName: 'Euge',
    role: 'learner',
    createdAt: timestamp,
    updatedAt: timestamp,
    learnerImplementationId: implementationId,
  }

  await page.addInitScript((userId) => {
    localStorage.setItem('trazo_active_user_id', userId)
  }, learner.userId)

  await page.route('**/api/v1/profiles', async (route) => {
    await route.fulfill({ json: [learner] })
  })
  await page.route(`**/api/v1/profiles/${learner.userId}`, async (route) => {
    await route.fulfill({ json: learner })
  })
  // N01 completed => N02 + N03 available => availableMissions.length > 1 =>
  // companion auto-fetch condition armed.
  await page.route(`**/api/v1/implementations/${implementationId}`, async (route) => {
    await route.fulfill({
      json: {
        id: implementationId,
        userId: learner.userId,
        courseId,
        courseVersion: '1.0.0',
        completedMissionIds: ['N01'],
        artifacts: {
          premise: {
            key: 'premise',
            sourceMissionId: 'N01',
            value: { statement: 'premise de prueba' },
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        },
        learnerSetup: {
          goal: 'Publicar mi primera pieza estratégica',
          availableTime: '30_60_MIN',
          helpPreference: 'DIRECT',
        },
        updatedAt: timestamp,
      },
    })
  })
}
