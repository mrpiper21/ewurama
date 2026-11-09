import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In local dev, serve api/note.js the same way Vercel does in production.
const devApi = () => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api/note', async (req, res) => {
      let raw = ''
      for await (const chunk of req) raw += chunk
      const { default: handler } = await server.ssrLoadModule('/api/note.js')
      const shim = {
        statusCode: 200,
        status(c) {
          this.statusCode = c
          return this
        },
        setHeader: (k, v) => res.setHeader(k, v),
        json(obj) {
          res.statusCode = this.statusCode
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        },
      }
      await handler({ method: req.method, body: raw }, shim)
    })
  },
})

export default defineConfig({
  plugins: [react(), devApi()],
  server: { port: 5199, host: true },
})
