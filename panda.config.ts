import { defineConfig } from '@pandacss/dev'
import { animationStyles } from '@/theme/animation-styles'
import { cyan } from '@/theme/colors/cyan'
import { green } from '@/theme/colors/green'
import { red } from '@/theme/colors/red'
import { slate } from '@/theme/colors/slate'
import { conditions } from '@/theme/conditions'
import { globalCss } from '@/theme/global-css'
import { keyframes } from '@/theme/keyframes'
import { layerStyles } from '@/theme/layer-styles'
import { recipes, slotRecipes } from '@/theme/recipes'
import { textStyles } from '@/theme/text-styles'
import { colors } from '@/theme/tokens/colors'
import { durations } from '@/theme/tokens/durations'
import { shadows } from '@/theme/tokens/shadows'
import { zIndex } from '@/theme/tokens/z-index'

export default defineConfig({
	preflight: true,
	jsxFramework: 'react',
	include: ['./src/**/*.{ts,tsx}'],
	exclude: [],
	outdir: 'styled-system',
	importMap: 'styled-system',
	globalCss: globalCss,
	conditions: conditions,

	theme: {
		extend: {
			animationStyles: animationStyles,
			recipes: recipes,
			slotRecipes: slotRecipes,
			keyframes: keyframes,
			layerStyles: layerStyles,
			textStyles: textStyles,

			tokens: {
				colors: colors,
				durations: durations,
				zIndex: zIndex,
			},

			semanticTokens: {
				colors: {
					fg: {
						default: {
							value: {
								_light: '{colors.gray.12}',
								_dark: '{colors.gray.12}',
							},
						},

						muted: {
							value: {
								_light: '{colors.gray.11}',
								_dark: '{colors.gray.11}',
							},
						},

						subtle: {
							value: {
								_light: '{colors.gray.10}',
								_dark: '{colors.gray.10}',
							},
						},
					},

					border: {
						value: {
							_light: '{colors.gray.4}',
							_dark: '{colors.gray.4}',
						},
					},

					error: {
						value: {
							_light: '{colors.red.9}',
							_dark: '{colors.red.9}',
						},
					},

					cyan: cyan,
					gray: slate,
					red: red,
					green: green,

					review: {
						blue: { value: { _light: '#0969da', _dark: '#0969da' } },
						commentBg: { value: { _light: '#fff8c5', _dark: '#fff8c5' } },
						commentBorder: { value: { _light: '#d4a72c', _dark: '#d4a72c' } },
						commentTagBg: { value: { _light: '#00a2c7', _dark: '#00a2c7' } },
						diffAdditionBg: {
							value: { _light: 'rgba(0, 127, 255, 0.18)', _dark: 'rgba(0, 127, 255, 0.18)' },
						},
						diffDeletionBg: {
							value: { _light: 'rgba(220, 38, 38, 0.2)', _dark: 'rgba(220, 38, 38, 0.2)' },
						},
						treeSelectedBg: { value: { _light: '{colors.cyan.a3}', _dark: '{colors.cyan.a3}' } },
					},
				},

				shadows: shadows,
			},
		},
	},
})
