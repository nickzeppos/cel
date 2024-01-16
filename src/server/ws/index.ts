import { cleanup } from '../queue'
import { appRouter } from '../router'
import { createContext } from '../router/context'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import ws from 'ws'

const wss = new ws.Server({ port: 3030 })
const handler = applyWSSHandler({ wss, router: appRouter, createContext })

wss.on('connection', (ws) => {
  console.log(`🔌➕ Connection (${wss.clients.size})`)
  ws.once('close', () => {
    console.log(`🔌➖ Connection (${wss.clients.size})`)
  })
})
console.log('🔼 WebSocket Server listening on ws://localhost:3030')

process.on('SIGTERM', async () => {
  console.log('🔽 SIGTERM')
  handler.broadcastReconnectNotification()
  wss.close()
  await cleanup()
})
