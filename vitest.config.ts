import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
        exclude: [
          '**/*.test.{ts,tsx}',
          'src/test/**',
          'src/vite-env.d.ts',
          'src/types/**',
          'src/repositories/interface.ts',
        ],
      },
    },
  })
)
