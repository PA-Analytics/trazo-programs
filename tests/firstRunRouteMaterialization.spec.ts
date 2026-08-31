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
    await expect(page.getByRole('heading', { name: /ELIGE TU FORMATO INICIAL/i })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Estructura Directa/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Estructura Narrativa/ })).toBeVisible()

    // 2. Select Estructura Narrativa (N03)
    const narrativeChoice = page.getByRole('radio', { name: /Estructura Narrativa/ })
    await narrativeChoice.click()
    await expect(narrativeChoice).toHaveAttribute('aria-checked', 'true')

    // 3. Step 1 -> Step 2
    const step1NextBtn = page.getByRole('button', { name: /Siguiente paso →/ })
    await expect(step1NextBtn).toBeEnabled()
    await step1NextBtn.click()

    // 4. Step 2 -> Step 3
    await expect(page.getByRole('heading', { name: /FEEDBACK/i })).toBeVisible()
    const step2NextBtn = page.getByRole('button', { name: /Siguiente paso →/ })
    await expect(step2NextBtn).toBeEnabled()
    await step2NextBtn.click()

    // 5. Step 3 -> Finish
    await expect(page.getByRole('heading', { name: /CUÁNTO TIEMPO/i })).toBeVisible()
    const finishBtn = page.getByRole('button', { name: /Materializar mi mapa →/ })
    await expect(finishBtn).toBeEnabled()
    await finishBtn.click()

    // 6. Verify exact backend payload sent
    expect(savedSetupPayload).toEqual({
      preferredRouteId: 'N03',
      helpPreference: 'DIRECT',
      availableTime: '30_60_MIN',
    })

    // 7. Verify transition to QuestMap with materialized corridor
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.locator('.quest-map-stage, .react-flow')).toBeVisible()
    const map = page.locator('.quest-map')
    await expect(map).toHaveAttribute('data-entry-phase', 'commit')
    await expect(map).toHaveAttribute('data-entry-locked', 'true')
    await expect(page.getByText('Vía elegida: Estructura Narrativa')).toBeVisible()
    await expect(page.getByRole('button', { name: /Omitir introducción/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeDisabled()
    await expect.poll(() => map.getAttribute('data-entry-phase'), { timeout: 1200, interval: 40 }).toBe('tracing')

    // 7. Verify node corridor attributes: N03 is corridor, N02 is dimmed
    const nodeN03 = page.locator('.quest-node-shell').filter({ hasText: 'Estructura Narrativa' })
    const nodeN02 = page.locator('.quest-node-shell').filter({ hasText: 'Estructura Directa' })

    await expect(nodeN03).toHaveAttribute('data-corridor', 'true')
    await expect(nodeN03).toHaveAttribute('data-dimmed', 'false')
    await expect(nodeN03).toHaveAttribute('data-entry-route', 'true')
    await expect(nodeN03).toHaveAttribute('data-entry-current', 'true')
    await expect(nodeN02).toHaveAttribute('data-dimmed', 'true')
    await expect(nodeN02).toHaveAttribute('data-entry-route', 'false')

    await expect.poll(() => map.getAttribute('data-entry-phase'), { timeout: 6000, interval: 40 }).toBe('destination')
    await expect.poll(() => map.getAttribute('data-entry-phase'), { timeout: 1500, interval: 40 }).toBe('return')

    await page.getByRole('button', { name: /Omitir introducción/ }).focus()
    await expect(page.getByRole('button', { name: /Omitir introducción/ })).toBeFocused()
    await page.getByRole('button', { name: /Omitir introducción/ }).click()
    await expect(page.getByRole('button', { name: /Omitir introducción/ })).toHaveCount(0)
    await expect(map).toHaveAttribute('data-entry-locked', 'false')
    await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeEnabled()
  })
})
