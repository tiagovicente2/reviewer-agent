import type { DiffLineAnnotation, FileDiffMetadata } from '@pierre/diffs/direct/types.js'
import { parsePatchFiles } from '@pierre/diffs/direct/utils/parsePatchFiles.js'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { Badge } from '@/components/ui'
import type { PiInlineComment } from '@/shared/review'
import {
	type DiffAnnotation,
	getFileDiffKey,
	getLineAnnotations,
	getScrollableParent,
	groupInlineCommentsByPath,
} from './diffViewerUtils'
import { ReviewCommentAnnotation } from './ReviewCommentAnnotation'

type ParsedPatchState =
	| { files: FileDiffMetadata[]; error?: undefined }
	| { files: FileDiffMetadata[]; error: string }

type DiffViewerProps = {
	colorMode: 'light' | 'dark'
	inlineComments?: PiInlineComment[]
	onSelectFile?: (path: string) => void
	patch: string
	selectedFilePath?: string | null
}

export const DiffViewer = memo(function DiffViewer({
	inlineComments = [],
	onSelectFile,
	patch,
	selectedFilePath,
}: DiffViewerProps) {
	const parsedPatch = useMemo(() => parsePatch(patch), [patch])
	const inlineCommentsByPath = useMemo(
		() => groupInlineCommentsByPath(inlineComments),
		[inlineComments],
	)
	const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set())
	const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => new Set())
	const fileRefs = useRef(new Map<string, HTMLDivElement>())

	useEffect(() => {
		if (!selectedFilePath) return

		let selectedKey: string | null = null
		setCollapsedFiles((current) => {
			const next = new Set(current)
			for (const file of parsedPatch.files) {
				if (file.name === selectedFilePath || file.prevName === selectedFilePath) {
					selectedKey = getFileDiffKey(file)
					next.delete(selectedKey)
				}
			}
			return next
		})

		requestAnimationFrame(() => {
			if (!selectedKey) return

			const node = fileRefs.current.get(selectedKey)
			const scrollParent = node ? getScrollableParent(node) : null
			if (node && scrollParent) {
				scrollParent.scrollTo({
					behavior: 'smooth',
					top: node.offsetTop - scrollParent.offsetTop,
				})
			}
		})
	}, [parsedPatch.files, selectedFilePath])

	if (!patch.trim()) {
		return <DiffStatus title="No diff loaded" body="Select a PR to load its GitHub diff." />
	}

	if (parsedPatch.error) {
		return <DiffStatus title="Could not render diff" body={parsedPatch.error} tone="red" />
	}

	if (parsedPatch.files.length === 0) {
		return <DiffStatus title="Empty diff" body="GitHub returned no changed files for this PR." />
	}

	return (
		<Stack gap="4" pr="1">
			{parsedPatch.files.map((fileDiff) => {
				const fileKey = getFileDiffKey(fileDiff)
				const selected =
					fileDiff.name === selectedFilePath || fileDiff.prevName === selectedFilePath
				const collapsed = collapsedFiles.has(fileKey) || (!selected && !expandedFiles.has(fileKey))

				return (
					<Box
						className={diffClassName}
						key={fileKey}
						ref={(node) => {
							if (node) {
								fileRefs.current.set(fileKey, node)
							} else {
								fileRefs.current.delete(fileKey)
							}
						}}
					>
						<DiffFileHeader
							collapsed={collapsed}
							fileDiff={fileDiff}
							onToggle={() => {
								onSelectFile?.(fileDiff.name)
								if (collapsed) {
									setCollapsedFiles((current) => {
										const next = new Set(current)
										next.delete(fileKey)
										return next
									})
									setExpandedFiles((current) => new Set(current).add(fileKey))
								} else {
									setExpandedFiles((current) => {
										const next = new Set(current)
										next.delete(fileKey)
										return next
									})
									setCollapsedFiles((current) => new Set(current).add(fileKey))
								}
							}}
						/>
						{collapsed ? null : (
							<PlainFileDiff
								fileDiff={fileDiff}
								lineAnnotations={getLineAnnotations(fileDiff, inlineCommentsByPath)}
							/>
						)}
					</Box>
				)
			})}
		</Stack>
	)
})

function DiffFileHeader({
	collapsed,
	fileDiff,
	onToggle,
}: {
	collapsed: boolean
	fileDiff: FileDiffMetadata
	onToggle: () => void
}) {
	const additions = fileDiff.hunks.reduce((total, hunk) => total + hunk.additionLines, 0)
	const deletions = fileDiff.hunks.reduce((total, hunk) => total + hunk.deletionLines, 0)
	const displayPath = formatPathWithFilename(fileDiff.name)
	const previousDisplayPath = fileDiff.prevName ? formatPathWithFilename(fileDiff.prevName) : null

	return (
		<Box
			as="button"
			bg="gray.2"
			borderBottomWidth={collapsed ? '0' : '1px'}
			cursor="pointer"
			onClick={onToggle}
			px="3"
			py="2"
			textAlign="left"
			w="100%"
			_hover={{ bg: 'gray.3' }}
		>
			<HStack gap="3" justify="space-between" w="100%">
				<HStack minW="0" gap="2">
					<Box color="fg.muted" fontSize="sm" w="5">
						{collapsed ? '▸' : '▾'}
					</Box>
					<Stack gap="0" minW="0">
						<Box
							direction="rtl"
							fontFamily="mono"
							fontSize="sm"
							fontWeight="medium"
							title={fileDiff.name}
							truncate
						>
							<Box as="span" direction="ltr" unicodeBidi="plaintext">
								{displayPath}
							</Box>
						</Box>
						{fileDiff.prevName && fileDiff.prevName !== fileDiff.name ? (
							<Box
								color="fg.muted"
								direction="rtl"
								fontFamily="mono"
								fontSize="xs"
								title={fileDiff.prevName}
								truncate
							>
								<Box as="span" direction="ltr" unicodeBidi="plaintext">
									from {previousDisplayPath}
								</Box>
							</Box>
						) : null}
					</Stack>
				</HStack>
				<HStack flexShrink="0" gap="2" fontFamily="mono" fontSize="xs">
					<Badge colorPalette="gray" variant="surface">
						{fileDiff.type}
					</Badge>
					<Box color="review.blue">+{additions}</Box>
					<Box color="red.11">-{deletions}</Box>
				</HStack>
			</HStack>
		</Box>
	)
}

function formatPathWithFilename(path: string) {
	const segments = path.split('/')
	if (segments.length <= 1) return path

	const filename = segments.at(-1)
	const directory = segments.slice(0, -1).join('/')
	return `${filename} · ${directory}`
}

function PlainFileDiff({
	fileDiff,
	lineAnnotations,
}: {
	fileDiff: FileDiffMetadata
	lineAnnotations: DiffLineAnnotation<DiffAnnotation>[]
}) {
	const annotationKey = (annotation: DiffLineAnnotation<DiffAnnotation>) =>
		`${annotation.side}:${annotation.lineNumber}`
	const annotationsByLine = new Map(
		lineAnnotations.map((annotation) => [annotationKey(annotation), annotation]),
	)

	return (
		<Box className={plainDiffClassName} overflowX="auto">
			{fileDiff.hunks.map((hunk) => (
				<Box key={`${hunk.deletionStart}:${hunk.additionStart}:${hunk.hunkSpecs ?? ''}`}>
					<Box className="hunkHeader">{hunk.hunkSpecs ?? 'diff hunk'}</Box>
					{hunk.hunkContent.flatMap((content) => {
						if (content.type === 'context') {
							return Array.from({ length: content.lines }, (_, index) => {
								const oldLine = getDeletionLineNumber(hunk, content.deletionLineIndex, index)
								const newLine = getAdditionLineNumber(hunk, content.additionLineIndex, index)
								const annotation =
									annotationsByLine.get(`additions:${newLine}`) ??
									annotationsByLine.get(`deletions:${oldLine}`)
								return (
									<DiffLineGroup key={`context:${oldLine}:${newLine}`} annotation={annotation}>
										<DiffLine
											newLine={newLine}
											oldLine={oldLine}
											text={fileDiff.additionLines[content.additionLineIndex + index] ?? ''}
											type="context"
										/>
									</DiffLineGroup>
								)
							})
						}

						const deletionRows = Array.from({ length: content.deletions }, (_, index) => {
							const lineNumber = getDeletionLineNumber(hunk, content.deletionLineIndex, index)
							const annotation = annotationsByLine.get(`deletions:${lineNumber}`)
							return (
								<DiffLineGroup key={`deletion:${lineNumber}`} annotation={annotation}>
									<DiffLine
										oldLine={lineNumber}
										text={fileDiff.deletionLines[content.deletionLineIndex + index] ?? ''}
										type="deletion"
									/>
								</DiffLineGroup>
							)
						})
						const additionRows = Array.from({ length: content.additions }, (_, index) => {
							const lineNumber = getAdditionLineNumber(hunk, content.additionLineIndex, index)
							const annotation = annotationsByLine.get(`additions:${lineNumber}`)
							return (
								<DiffLineGroup key={`addition:${lineNumber}`} annotation={annotation}>
									<DiffLine
										newLine={lineNumber}
										text={fileDiff.additionLines[content.additionLineIndex + index] ?? ''}
										type="addition"
									/>
								</DiffLineGroup>
							)
						})
						return [...deletionRows, ...additionRows]
					})}
				</Box>
			))}
		</Box>
	)
}

function getDeletionLineNumber(
	hunk: FileDiffMetadata['hunks'][number],
	lineIndex: number,
	offset: number,
) {
	return hunk.deletionStart + (lineIndex - hunk.deletionLineIndex) + offset
}

function getAdditionLineNumber(
	hunk: FileDiffMetadata['hunks'][number],
	lineIndex: number,
	offset: number,
) {
	return hunk.additionStart + (lineIndex - hunk.additionLineIndex) + offset
}

function DiffLineGroup({
	annotation,
	children,
}: {
	annotation?: DiffLineAnnotation<DiffAnnotation>
	children: React.ReactNode
}) {
	return (
		<>
			{children}
			{annotation ? <ReviewCommentAnnotation {...annotation} /> : null}
		</>
	)
}

function DiffLine({
	newLine,
	oldLine,
	text,
	type,
}: {
	newLine?: number
	oldLine?: number
	text: string
	type: 'context' | 'addition' | 'deletion'
}) {
	return (
		<Box className={`diffLine ${type}`}>
			<Box className="lineNumber">{oldLine ?? ''}</Box>
			<Box className="lineNumber">{newLine ?? ''}</Box>
			<Box className="indicator">{type === 'addition' ? '+' : type === 'deletion' ? '-' : ' '}</Box>
			<Box as="pre" className="lineText">
				{text || ' '}
			</Box>
		</Box>
	)
}

function parsePatch(patch: string): ParsedPatchState {
	try {
		return {
			files: parsePatchFiles(patch, 'github-pr-diff', true).flatMap(
				(parsedPatch) => parsedPatch.files,
			),
		}
	} catch (error) {
		return {
			files: [],
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

function DiffStatus({
	body,
	title,
	tone = 'gray',
}: {
	body: string
	title: string
	tone?: 'gray' | 'red'
}) {
	return (
		<Box bg={tone === 'red' ? 'red.subtle.bg' : 'gray.2'} borderRadius="l2" p="4">
			<Box color={tone === 'red' ? 'red.11' : 'fg.default'} fontWeight="semibold">
				{title}
			</Box>
			<Box color={tone === 'red' ? 'red.11' : 'fg.muted'} mt="1" textStyle="sm">
				{body}
			</Box>
		</Box>
	)
}

const diffClassName = css({
	bg: 'gray.1',
	borderRadius: 'l2',
	borderWidth: '1px',
	overflow: 'hidden',
})

const plainDiffClassName = css({
	fontFamily: 'mono',
	fontSize: 'xs',
	lineHeight: '1.5',
	'& .hunkHeader': {
		bg: 'cyan.2',
		borderBottomWidth: '1px',
		borderColor: 'border.default',
		color: 'cyan.11',
		px: '3',
		py: '1.5',
		whiteSpace: 'pre',
	},
	'& .diffLine': {
		display: 'grid',
		gridTemplateColumns: '4rem 4rem 1.5rem minmax(0, 1fr)',
		minW: 'max-content',
	},
	'& .diffLine.context': { bg: 'gray.1' },
	'& .diffLine.addition': { bg: 'review.diffAdditionBg' },
	'& .diffLine.deletion': { bg: 'review.diffDeletionBg' },
	'& .lineNumber': {
		borderRightWidth: '1px',
		borderColor: 'border.default',
		color: 'fg.muted',
		px: '2',
		textAlign: 'right',
		userSelect: 'none',
	},
	'& .indicator': {
		color: 'fg.muted',
		px: '1',
		userSelect: 'none',
	},
	'& .lineText': {
		fontFamily: 'mono',
		m: '0',
		overflow: 'visible',
		px: '2',
		whiteSpace: 'pre-wrap',
	},
})
