import { css } from 'styled-system/css'
import { Box } from 'styled-system/jsx'
import { diffLineColor, stripMarkdownFence } from './reviewUtils'

const diffCodeBlockClassName = css({
	backgroundColor: 'gray.1',
	borderColor: 'border.default',
	borderRadius: 'l2',
	borderWidth: '1px',
	fontFamily: 'mono',
	fontSize: 'xs',
	lineHeight: '1.7',
	maxWidth: '100%',
	overflowX: 'auto',
	py: '3',
})

const diffLineClassName = css({
	display: 'block',
	px: '3',
	whiteSpace: 'pre',
})

export function DiffCodeBlock({ diff }: { diff: string }) {
	const normalizedDiff = stripMarkdownFence(diff)
	const lineCounts = new Map<string, number>()
	const lines = normalizedDiff.split('\n').map((line) => {
		const count = lineCounts.get(line) ?? 0
		lineCounts.set(line, count + 1)
		return { id: `${line}-${count}`, value: line }
	})

	return (
		<Box as="pre" maxW="100%" minW="0" className={diffCodeBlockClassName}>
			{lines.map((line) => (
				<Box
					as="code"
					className={diffLineClassName}
					color={diffLineColor(line.value)}
					key={line.id}
				>
					{line.value || ' '}
				</Box>
			))}
		</Box>
	)
}
