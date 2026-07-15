import { createApp } from './app.js'

const PORT = Number(process.env.PORT ?? 3208)
const app = createApp()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Tasker server: http://localhost:${PORT}`)
})
