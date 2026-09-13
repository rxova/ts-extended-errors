import { defineConfig } from 'tsdown'
import { baseBuildConfig } from '@repo/config/tsdown.base'

// Node 20 rather than the preset's 22: this package is published, and its
// `engines` promises 20.19. The dual format earns its keep here too — a
// zero-dependency error utility gets pulled into old CJS services as readily as
// into new ESM ones.
export default defineConfig(baseBuildConfig({ target: 'node20' }))
