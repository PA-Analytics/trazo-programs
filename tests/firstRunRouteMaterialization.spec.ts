import { expect, test, type Page } from '@playwright/test'

const timestamp = '2026-08-28T00:00:00.000Z'
const implementationId = 'learner-first-run-e2e'
const courseId = 'primer-sistema-de-contenido'

test.describe('First-Run Route Materialization E2E Browser Flow', () => {
  test('learner sees route framing, selects narrative branch, and QuestMap materializes corridor', async ({ page }) => {
    let savedSetupPayload: Record<string, unknown> | null = null

    const learner = {
      userId: 'user-first-run-e2e',
      displayName: 'Valeria',
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

    let implementationState: Record<string, unknown> = {
      id: implementationId,
      userId: learner.userId,
      courseId,
      courseVersion: '1.0.0',
      completedMissionIds: [],
      submissions: [],
      updatedAt: timestamp,
    }

    await page.route(`**/api/v1/implementations/${implementationId}`, async (route) => {
      await route.fulfill({ json: implementationState })
    })

    await page.route(`**/api/v1/implementations/${implementationId}/methodology`, async (route) => {
      await route.fulfill({
        json: {
          progress: {
            N01: 'available',
            N02: 'locked',
            N03: 'locked',
            N04: 'locked',
            N05: 'locked',
            N06: 'locked',
            N07: 'locked',
            N08: 'locked',
            N09: 'locked',
          },
        },
      })
    })

    await page.route(`**/api/v1/implementations/${implementationId}/learner-setup`, async (route) => {
      savedSetupPayload = route.request().postDataJSON()
      implementationState = {
        ...implementationState,
        learnerSetup: {
          ...savedSetupPayload,
          updatedAt: timestamp,
        },
      }
      await route.fulfill({ json: implementationState })
    })

    // 1. Visit app - Route Framing screen is rendered
    await page.goto('http://127.0.0.1:5173')
    await expect(page.getByRole('heading', { name: 'Elige el enfoque de tu recorrido.' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Estructura Directa/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Estructura Narrativa/ })).toBeVisible()

    // 2. Select Estructura Narrativa (03B)
    const narrativeChoice = page.locator('button.learner-route-choice[data-route="N03"]')
    await narrativeChoice.click()
    await expect(narrativeChoice).toHaveAttribute('data-selected', 'true')
    await expect(page.locator('.learner-route-corridor-preview')).toContainText('Estructura Narrativa')

    // 3. Confirm route
    const submitBtn = page.getByRole('button', { name: 'Comenzar mi recorrido →' })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // 4. Verify exact backend payload sent
    expect(savedSetupPayload).toEqual({
      preferredRouteId: 'N03',
    })

    // 5. Verify transition to QuestMap with materialized corridor
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.locator('.quest-map-stage, .react-flow')).toBeVisible()

    // 6. Verify node corridor attributes: N03 is corridor, N02 is dimmed
    const nodeN03 = page.locator('.quest-node-shell').filter({ hasText: 'Estructura Narrativa' })
    const nodeN02 = page.locator('.quest-node-shell').filter({ hasText: 'Estructura Directa' })

    await expect(nodeN03).toHaveAttribute('data-corridor', 'true')
    await expect(nodeN03).toHaveAttribute('data-dimmed', 'false')
    await expect(nodeN02).toHaveAttribute('data-dimmed', 'true')
  })
})
