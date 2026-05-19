import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
	plugins: [react()],
	root: 'src/mainview',
	base: './',
	build: {
		outDir: '../../dist',
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			'@': resolve(projectRoot, 'src'),
			'styled-system': resolve(projectRoot, 'styled-system'),
		},
	},
	server: {
		port: 5173,
		strictPort: true,
	},
})
