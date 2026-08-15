import * as http from 'node:http'
import { createRequestListener } from './app.ts'
import { createImplementationRepository } from './repository.ts'
import { ImplementationService } from './service.ts'

const port = Number(process.env.PORT || 3001)
const host = '0.0.0.0'
const repository = createImplementationRepository()
const service = new ImplementationService(repository)
const requestListener = createRequestListener(service)

const server = http.createServer(requestListener)

server.listen(port, host, () => {
  console.log(`[TRAZO Backend] Server listening on http://${host}:${port}`)
  console.log(`[TRAZO Backend] Authoritative Persistence: ${repository.constructor.name}`)
})

export { server, service, repository }
