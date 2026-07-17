import cors from 'cors'
import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createAuthFeature } from './auth.js'
import { loadServerConfig, type ServerConfig } from './config.js'
import { completionsRouter } from './routes/completions.js'
import { importRouter } from './routes/importExport.js'
import { projectsRouter } from './routes/projects.js'
import { subtasksRouter } from './routes/subtasks.js'
import { tagsRouter } from './routes/tags.js'
import { tasksRouter } from './routes/tasks.js'
import { topicsRouter } from './routes/topics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

class CorsOriginDeniedError extends Error {}

export interface CreateAppOptions {
  config?: ServerConfig
  now?: () => number
}

function isSameHostOrigin(req: express.Request, origin: string): boolean {
  const host = req.get('host')
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function createCorsMiddleware(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins)
  const setCorsHeaders = cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  })

  return (req, res, next) => {
    const origin = req.get('Origin')
    if (origin) res.vary('Origin')
    if (origin && !isSameHostOrigin(req, origin) && !allowed.has(origin)) {
      next(new CorsOriginDeniedError('Not allowed by CORS'))
      return
    }
    setCorsHeaders(req, res, next)
  }
}

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? loadServerConfig()
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', false)

  app.use(createCorsMiddleware(config.corsOrigins))

  const auth = createAuthFeature(config.auth, options.now)
  app.use('/api/auth', auth.router)
  app.use('/api', auth.protectUnsafeRequests)
  app.use(express.json({ limit: '50mb' }))

  app.use('/api/projects', projectsRouter)
  app.use('/api/topics', topicsRouter)
  app.use('/api/tasks', tasksRouter)
  app.use('/api/subtasks', subtasksRouter)
  app.use('/api/tags', tagsRouter)
  app.use('/api/completions', completionsRouter)
  app.use('/api/import', importRouter)

  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof CorsOriginDeniedError) {
      res.status(403).json({ error: 'CORS_ORIGIN_DENIED' })
      return
    }
    if (error && typeof error === 'object' && 'status' in error && error.status === 413) {
      res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' })
      return
    }
    if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'JSON形式が不正です' })
      return
    }

    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'CONFLICT' })
      return
    }
    if (message.includes('constraint failed')) {
      res.status(400).json({ error: 'VALIDATION_ERROR' })
      return
    }

    console.error('[server]', error)
    res.status(500).json({ error: 'DB_ERROR' })
  }
  app.use(errorHandler)

  return app
}
