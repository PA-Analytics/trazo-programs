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
      && html.scrollWidth === html.clientWidth
      && document.body.scrollWidth === document.body.clientWidth
      && appRoot.scrollWidth === appRoot.clientWidth,
    )
  })).toBe(true)

  await shell.hover({ position: { x: 16, y: 80 } })
  await page.mouse.wheel(0, 600)
  await expect.poll(() => shell.evaluate((element) => element.scrollTop > 0)).toBe(true)

  await shell.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
  await expect(terminalAction).toBeInViewport()
  await expect.poll(() => shell.evaluate((element) => element.scrollWidth === element.clientWidth)).toBe(true)
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
      await page.getByRole('button', { name: 'Crear una ruta' }).click()
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
      const learnerChoice = page.getByRole('radio', { name: /Alumno/ })
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
      await page.locator('.profile-selection-item').first().focus()
      for (let index = 0; index < profiles.length + 1; index += 1) {
        await page.keyboard.press('Tab')
      }
      await expect(page.getByRole('button', { name: 'Crear una ruta' })).toBeFocused()
      await expect(page.getByRole('button', { name: 'Crear una ruta' })).toBeInViewport()
    })

    test('coach onboarding scrolls to calibration action', async ({ page }) => {
      await mockActiveProfile(page, profile({ role: 'coach' }))
      await page.goto('http://127.0.0.1:5173')
      const transformationField = page.getByRole('textbox', { name: /Resultado que guías/ })
      await transformationField.fill('Conseguir el primer cliente digital')
      await expect(page.locator('.route-rail__stages li').nth(0)).toHaveAttribute('data-state', 'current')
      const [fieldBox, switcherBox] = await Promise.all([
        transformationField.boundingBox(),
        page.locator('.profile-switcher').boundingBox(),
      ])
      expect(fieldBox).not.toBeNull()
      expect(switcherBox).not.toBeNull()
      expect(fieldBox!.y).toBeGreaterThanOrEqual(switcherBox!.y + switcherBox!.height)
      await page.getByRole('button', { name: /Continuar/ }).click()
      await page.getByText('Texto', { exact: true }).click()
      await page.getByRole('button', { name: /Atrás/ }).click()
      await expect(transformationField).toHaveValue('Conseguir el primer cliente digital')
      await page.getByRole('button', { name: /Continuar/ }).click()
      await expect(page.locator('input[type="checkbox"]').first()).toBeChecked()
      await page.getByRole('button', { name: /Continuar/ }).click()
      await page.getByText('Usar mis ejemplos', { exact: true }).click()
      await page.getByRole('button', { name: /Continuar/ }).click()
      await expect(page.getByRole('heading', { name: /Marca el límite/ })).toBeVisible()
      await expect(page.locator('.route-rail__stages li').nth(3)).toHaveAttribute('data-state', 'current')

      await expectScrollableShell(
        page,
        '.product-route',
        page.getByRole('button', { name: /Ir a calibración/ }),
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
      await expect(page.getByRole('heading', { name: /Elige el enfoque/ })).toBeVisible()

      await expectScrollableShell(
        page,
        '.product-route',
        page.getByRole('button', { name: /Comenzar mi recorrido/ }),
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

      await expect(page.locator('.app-shell')).toBeVisible()
      await expect(page.locator('.entry-shell, .coach-entry-shell, .setup-shell, .product-route, .calibration-shell')).toHaveCount(0)
      await expect.poll(() => page.evaluate(() => {
        const html = document.documentElement
        const appRoot = document.getElementById('root')
        return Boolean(
          appRoot
          && html.scrollWidth === html.clientWidth
          && document.body.scrollWidth === document.body.clientWidth
          && appRoot.scrollWidth === appRoot.clientWidth
          && appRoot.scrollHeight === appRoot.clientHeight,
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
      await page.route('**/api/v1/calibrations/N01', async (route) => {
        await route.fulfill({ json: null })
      })
      await page.goto('http://127.0.0.1:5173')
      await page.getByRole('textbox', { name: /Qué tendría que tener una respuesta/ }).fill('Una audiencia y una señal concreta.')

      await expectScrollableShell(
        page,
        '.calibration-shell',
        page.getByRole('button', { name: /Empezar calibración/ }),
      )
    })
  })
}
