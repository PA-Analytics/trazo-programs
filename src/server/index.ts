import * as http from 'node:http'
import { createRequestListener } from './app.ts'
import { createCalibrationRepository, createImplementationRepository, createProfileRepository } from './repository.ts'
import { CalibrationService } from './calibrationService.ts'
import { IdentityService } from './identityService.ts'
import { ImplementationService } from './service.ts'

const port = Number(process.env.PORT || 3001)
const host = '0.0.0.0'
const repository = createImplementationRepository()
const calibrationRepository = createCalibrationRepository()
const service = new ImplementationService(repository, calibrationRepository)
const calibrationService = new CalibrationService(calibrationRepository)
const identityService = new IdentityService(createProfileRepository(), service)
const requestListener = createRequestListener(service, { calibrationService, identityService })

const server = http.createServer(requestListener)

server.listen(port, host, () => {
  console.log(`[TRAZO Backend] Server listening on http://${host}:${port}`)
  console.log(`[TRAZO Backend] Authoritative Persistence: ${repository.constructor.name}`)
})

export { server, service, repository }
