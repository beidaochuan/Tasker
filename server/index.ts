import { createApp } from './app.js'
import { loadServerConfig } from './config.js'

const config = loadServerConfig()
const app = createApp({ config })

app.listen(config.port, config.host, () => {
  console.log(`Tasker server: http://${config.host}:${config.port}`)
})
