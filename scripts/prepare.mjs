const omittedDependencies = new Set(
  (process.env.npm_config_omit ?? '').split(/\s+/).filter(Boolean)
)

if (process.env.NODE_ENV === 'production' || omittedDependencies.has('dev')) {
  process.exit(0)
}

const husky = (await import('husky')).default
console.log(husky())
