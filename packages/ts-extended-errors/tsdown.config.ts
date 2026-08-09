import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  // Dual ESM + CJS. This is a zero-dependency error utility, the kind of thing
  // that gets pulled into old CJS services as readily as into new ESM ones.
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
})
