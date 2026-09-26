import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    // Invoice and term logic is date-sensitive: pin the zone the app is used in.
    env: { TZ: 'Europe/London' },
  },
})
