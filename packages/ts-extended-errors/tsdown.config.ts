import { defineConfig } from 'tsdown'
import { baseBuildConfig } from '@repo/config/tsdown.base'

// The preset's Node 22 target matches `engines`. The dual format earns its
// keep here: a zero-dependency error utility gets pulled into old CJS services
// as readily as into new ESM ones.
export default defineConfig(baseBuildConfig())
