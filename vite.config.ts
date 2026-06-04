import { defineConfig, type Connect, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Dev/preview-only persistence: serves a single portable JSON file
 * (mutube.data.json at the project root) over a tiny endpoint so the running
 * app can read and write it like a backend.
 *
 *   GET  /__data  -> file contents, or 204 when the file doesn't exist yet
 *   PUT  /__data  -> overwrite the file with the request body
 *
 * This is intentionally test-only — a static production build has no server, so
 * FileStorageAdapter degrades to in-memory there. The file format is documented
 * in schema/mutube.schema.json.
 */
function localDataFile(fileName = 'mutube.data.json'): PluginOption {
  const filePath = path.resolve(process.cwd(), fileName)

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url || !req.url.startsWith('/__data')) return next()

    if (req.method === 'GET') {
      readFile(filePath, 'utf8')
        .then((text) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(text)
        })
        .catch(() => {
          res.statusCode = 204 // no file yet — empty library
          res.end()
        })
      return
    }

    if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        writeFile(filePath, Buffer.concat(chunks).toString('utf8'), 'utf8')
          .then(() => {
            res.statusCode = 204
            res.end()
          })
          .catch((err) => {
            res.statusCode = 500
            res.end(String(err))
          })
      })
      return
    }

    next()
  }

  return {
    name: 'mutube-local-data-file',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

// Use a relative base so the built app also works on GitHub Pages / static hosts.
export default defineConfig({
  base: './',
  plugins: [react(), localDataFile()],
})
