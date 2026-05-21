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
	display: 'grid',
	gridTemplateColumns: '3rem minmax(0, 1fr)',
	whiteSpace: 'pre',
})

const diffLineNumberClassName = css({
	borderRightWidth: '1px',
	borderColor: 'border.default',
	color: 'fg.muted',
	px: '2',
	textAlign: 'right',
	userSelect: 'none',
})

const diffLineTextClassName = css({
	px: '3',
})

type DiffCodeLine = {
	id: string
	newLine?: number
	oldLine?: number
	value: string
}

export function DiffCodeBlock({ diff }: { diff: string }) {
	const normalizedDiff = stripMarkdownFence(diff)
	const lines = parseDiffCodeLines(normalizedDiff)

	return (
		<Box as="pre" maxW="100%" minW="0" className={diffCodeBlockClassName}>
			{lines.map((line) => (
				<Box
					as="code"
					className={diffLineClassName}
					color={diffLineColor(line.value)}
					key={line.id}
				>
					<Box as="span" className={diffLineNumberClassName}>
						{line.newLine ?? line.oldLine ?? ''}
					</Box>
					<Box as="span" className={diffLineTextClassName}>
						{line.value || ' '}
					</Box>
				</Box>
			))}
		</Box>
	)
}

function parseDiffCodeLines(diff: string) {
	let oldLine: number | null = null
	let newLine: number | null = null
	let inHunk = false
	const lineCounts = new Map<string, number>()

	return diff.split('\n').map((line): DiffCodeLine => {
		const count = lineCounts.get(line) ?? 0
		lineCounts.set(line, count + 1)
		const row: DiffCodeLine = { id: `${line}-${count}`, value: line }
		const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)

		if (hunk) {
			oldLine = Number(hunk[1])
			newLine = Number(hunk[2])
			inHunk = true
			return row
		}

		if (isFileMetadataLine(line)) {
			oldLine = null
			newLine = null
			inHunk = false
			return row
		}

		if (!inHunk || oldLine === null || newLine === null) {
			return row
		}

		if (line.startsWith('+')) {
			row.newLine = newLine
			newLine += 1
			return row
		}

		if (line.startsWith('-')) {
			row.oldLine = oldLine
			oldLine += 1
			return row
		}

		row.oldLine = oldLine
		row.newLine = newLine
		oldLine += 1
		newLine += 1
		return row
	})
}

function isFileHeaderLine(line: string) {
	return line.startsWith('diff --git') || line.startsWith('---') || line.startsWith('+++')
}

function isFileMetadataLine(line: string) {
	return (
		isFileHeaderLine(line) ||
		line.startsWith('index ') ||
		line.startsWith('new file mode ') ||
		line.startsWith('deleted file mode ') ||
		line.startsWith('old mode ') ||
		line.startsWith('new mode ') ||
		line.startsWith('similarity index ') ||
		line.startsWith('dissimilarity index ') ||
		line.startsWith('rename from ') ||
		line.startsWith('rename to ') ||
		line.startsWith('\\ No newline at end of file')
	)
}
