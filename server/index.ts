import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { projectsRouter } from './routes/projects.js'
import { topicsRouter } from './routes/topics.js'
import { tasksRouter } from './routes/tasks.js'
import { subtasksRouter } from './routes/subtasks.js'
import { tagsRouter } from './routes/tags.js'
import { completionsRouter } from './routes/completions.js'
import { importRouter } from './routes/importExport.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = Number(process.env.PORT ?? 3208)

const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3208', 'http://localhost:4173', 'http://localhost:5173']

app.use(
  cors({
    origin: (origin, callback) => {
      // 同一オリジン (本番) の場合 origin は undefined
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
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

// 本番ビルド時は dist/ の静的ファイルも serve する
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Tasker server: http://localhost:${PORT}`)
})
