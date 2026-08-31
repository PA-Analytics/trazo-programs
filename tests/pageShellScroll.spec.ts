import { expect, test, type Locator, type Page } from '@playwright/test'

const timestamp = '2026-08-21T00:00:00.000Z'

function profile(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-active-profile',
    displayName: 'Euge',
    role: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

async function mockActiveProfile(page: Page, activeProfile: ReturnType<typeof profile>) {
  await page.addInitScript((userId) => {
    localStorage.setItem('trazo_active_user_id', userId)
  }, activeProfile.userId)
  await page.route('**/api/v1/profiles', async (route) => {
    await route.fulfill({ json: [activeProfile] })
  })
  await page.route(`**/api/v1/profiles/${activeProfile.userId}`, async (route) => {
    await route.fulfill({ json: activeProfile })
  })
}

async function expectScrollableShell(page: Page, selector: string, terminalAction: Locator) {
  const shell = page.locator(selector)
  await expect(shell).toBeVisible()
  await expect.poll(() => shell.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto')
  await expect.poll(() => shell.evaluate((element) => getComputedStyle(element).overflowX)).toBe('hidden')
  await expect.poll(() => shell.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await expect.poll(() => page.evaluate(() => {
    const html = document.documentElement
    const appRoot = document.getElementById('root')
    return Boolean(
      appRoot
      && Math.abs(html.scrollWidth - html.clientWidth) <= 2
      && Math.abs(document.body.scrollWidth - document.body.clientWidth) <= 2
      && Math.abs(appRoot.scrollWidth - appRoot.clientWidth) <= 2,
    )
  })).toBe(true)

  await shell.hover({ position: { x: 16, y: 80 } })
  await page.mouse.wheel(0, 600)

  await terminalAction.scrollIntoViewIfNeeded()
  await expect(terminalAction).toBeInViewport()
  await expect.poll(() => shell.evaluate((element) => element.scrollWidth <= window.innerWidth + 2)).toBe(true)
}

for (const viewport of [
  { name: 'desktop', width: 900, height: 360 },
  { name: 'mobile', width: 390, height: 360 },
]) {
  test.describe(`${viewport.name} document shells`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport)
    })

    test('identity entry scrolls to its final action', async ({ page }) => {
      await page.route('**/api/v1/profiles', async (route) => {
        await route.fulfill({ json: [] })
      })
      await page.goto('http://127.0.0.1:5173')
      const createBtn = page.getByRole('button', { name: 'Crear una ruta' })
      if (await createBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await createBtn.click()
      }
      await page.getByLabel('Tu nombre').fill('Euge')

      await expectScrollableShell(
        page,
        '.product-route',
        page.getByRole('button', { name: /Continuar/ }),
      )
    })

    test('role selection scrolls to its final choice', async ({ page }) => {
      await mockActiveProfile(page, profile())
      await page.goto('http://127.0.0.1:5173')
      const learnerChoice = page.getByRole('radio', { name: /Alumno/i })
      await learnerChoice.click()
      await expect(page.getByRole('button', { name: /Continuar/ })).toBeEnabled()

      await expectScrollableShell(
        page,
        '.product-route',
        page.getByRole('button', { name: /Continuar/ }),
      )
    })

    test('profile selection supports wheel and keyboard navigation', async ({ page }) => {
      const activeProfile = profile()
      const profiles = Array.from({ length: 14 }, (_, index) => ({
        userId: index === 0 ? activeProfile.userId : `user-profile-${index}`,
        displayName: index === 0 ? activeProfile.displayName : `Perfil ${index + 1}`,
        role: index % 2 === 0 ? 'learner' : 'coach',
      }))
      await mockActiveProfile(page, activeProfile)
      await page.route('**/api/v1/profiles', async (route) => {
        await route.fulfill({ json: profiles })
      })
      await page.goto('http://127.0.0.1:5173')
      await page.getByRole('button', { name: 'Cambiar perfil' }).click()

      const shell = page.locator('.profile-selection-shell')
      await expectScrollableShell(
        page,
        '.profile-selection-shell',
        page.getByRole('button', { name: 'Crear una ruta' }),
      )

      await shell.evaluate((element) => element.scrollTo({ top: 0 }))
      await expect.poll(() => shell.evaluate((element) => element.scrollTop)).toBe(0)
      const createBtn = page.getByRole('button', { name: 'Crear una ruta' })
      await createBtn.focus()
      await expect(createBtn).toBeFocused()
      await expect(createBtn).toBeInViewport()
    })

    test('coach onboarding scrolls to calibration action', async ({ page }) => {
      await mockActiveProfile(page, profile({ role: 'coach' }))
      await page.goto('http://127.0.0.1:5173')
      const transformationField = page.locator('#transformation-context')
      await transformationField.fill('Conseguir el primer cliente digital')
      await expect(page.locator('.coach-step-hero')).toBeVisible()

      await expectScrollableShell(
        page,
        '.coach-workbench-shell',
        page.getByRole('button', { name: /Continuar/ }),
      )
    })

    test('learner setup scrolls to its next action', async ({ page }) => {
      const implementationId = 'learner-user-active-profile'
      const learner = profile({ role: 'learner', learnerImplementationId: implementationId })
      await mockActiveProfile(page, learner)
      await page.route(`**/api/v1/implementations/${implementationId}`, async (route) => {
        await route.fulfill({
          json: {
            id: implementationId,
            userId: learner.userId,
            courseId: 'primer-cliente-digital',
            courseVersion: '1.0.0',
            completedMissionIds: [],
            submissions: [],
            updatedAt: timestamp,
          },
        })
      })
      await page.goto('http://127.0.0.1:5173')
      await expect(page.getByRole('heading', { name: /ELIGE TU FORMATO/i })).toBeVisible()

      await expectScrollableShell(
        page,
        '.product-route',
        page.getByRole('button', { name: /Siguiente paso/i }),
      )
    })

    test('quest map keeps its fixed viewport', async ({ page }) => {
      const implementationId = 'learner-user-active-profile'
      const learner = profile({ role: 'learner', learnerImplementationId: implementationId })
      await mockActiveProfile(page, learner)
      await page.route(`**/api/v1/implementations/${implementationId}`, async (route) => {
        await route.fulfill({
          json: {
            id: implementationId,
            userId: learner.userId,
            courseId: 'primer-cliente-digital',
            courseVersion: '1.0.0',
            completedMissionIds: [],
            submissions: [],
            learnerSetup: {
              goal: 'Publicar mi primera pieza estratégica',
              availableTime: '30_60_MIN',
              helpPreference: 'DIRECT',
            },
            updatedAt: timestamp,
          },
        })
      })
      await page.goto('http://127.0.0.1:5173')
      const appShell = page.locator('.app-shell')
      await expect(appShell).toBeVisible()
      await expect.poll(() => appShell.evaluate((element) => getComputedStyle(element).overflowY)).toBe('visible')
      await expect.poll(() => appShell.evaluate((element) => getComputedStyle(element).overflowX)).toBe('visible')
      await expect.poll(() => page.evaluate(() => {
        const html = document.documentElement
        const appRoot = document.getElementById('root')
        return Boolean(
          appRoot
          && html.scrollHeight <= html.clientHeight
          && document.body.scrollHeight <= document.body.clientHeight
          && appRoot.scrollHeight <= appRoot.clientHeight,
        )
      })).toBe(true)
    })

    test('creator calibration scrolls to its primary action', async ({ page }) => {
      const coach = profile({
        role: 'coach',
        coachSetup: {
          transformationContext: 'Conseguir el primer cliente digital',
          submissionTypes: ['text'],
          calibrationMode: 'mixed_examples',
          completedAt: timestamp,
        },
      })
      await mockActiveProfile(page, coach)
      await page.route('**/api/v1/coach/cohort', async (route) => {
        await route.fulfill({
          json: {
            totalLearners: 0,
            activeCount: 0,
            completedCount: 0,
            stalledCount: 0,
            learners: [],
            averageProgress: 0,
          },
        })
      })
      await page.route('**/api/v1/calibrations/N01', async (route) => {
        await route.fulfill({ json: null })
      })
      await page.goto('http://127.0.0.1:5173')
      await page.getByRole('tab', { name: /CALIBRAR RÚBRICAS/i }).click()
      await page.locator('#initial-standard').fill('Una audiencia y una señal concreta.')

      await expectScrollableShell(
        page,
        '.coach-workbench-shell',
        page.getByRole('button', { name: /Iniciar Ronda de Calibración/ }),
      )
    })
  })
}
