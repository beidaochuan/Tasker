import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { completionsRouter } from './routes/completions.js'
import { importRouter } from './routes/importExport.js'
import { projectsRouter } from './routes/projects.js'
import { subtasksRouter } from './routes/subtasks.js'
import { tagsRouter } from './routes/tags.js'
import { tasksRouter } from './routes/tasks.js'
import { topicsRouter } from './routes/topics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp() {
  const app = express()
  const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : null

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!allowedOrigins || !origin || allowedOrigins.includes(origin)) {
          callback(null, true)
        } else {
          callback(new Error('Not allowed by CORS'))
        }
      },
    })
  )
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
