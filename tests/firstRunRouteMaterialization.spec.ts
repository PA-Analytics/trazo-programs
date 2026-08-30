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

    // 5. Verify the explicit setup-to-map boundary
    await expect(page.getByRole('heading', { name: 'Tu ruta está lista.' })).toBeVisible()
    await page.getByRole('button', { name: /Entrar al mapa/ }).click()

    // 6. Verify transition to QuestMap with materialized corridor
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.locator('.quest-map-stage, .react-flow')).toBeVisible()
    const map = page.locator('.quest-map')
    await expect(map).toHaveAttribute('data-entry-phase', 'world')
    await expect(map).toHaveAttribute('data-entry-locked', 'true')
    await expect(page.getByRole('button', { name: /Omitir introducción/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeDisabled()
    await expect.poll(() => map.getAttribute('data-entry-phase'), { timeout: 1800, interval: 40 }).toBe('corridor')

    // 7. Verify node corridor attributes: N03 is corridor, N02 is dimmed
    const nodeN03 = page.locator('.quest-node-shell').filter({ hasText: 'Estructura Narrativa' })
    const nodeN02 = page.locator('.quest-node-shell').filter({ hasText: 'Estructura Directa' })

    await expect(nodeN03).toHaveAttribute('data-corridor', 'true')
    await expect(nodeN03).toHaveAttribute('data-dimmed', 'false')
    await expect(nodeN02).toHaveAttribute('data-dimmed', 'true')

    await page.getByRole('button', { name: /Omitir introducción/ }).focus()
    await expect(page.getByRole('button', { name: /Omitir introducción/ })).toBeFocused()
    await page.getByRole('button', { name: /Omitir introducción/ }).click()
    await expect(page.getByRole('button', { name: /Omitir introducción/ })).toHaveCount(0)
    await expect(map).toHaveAttribute('data-entry-locked', 'false')
    await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeEnabled()
  })
})
