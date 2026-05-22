import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { StatusCard } from '@/components/common'
import { Badge } from '@/components/ui'
import type { ReviewInlineComment } from '@/shared/review'
import { type DiffDisplaySettings, DiffFileView, parsePatch } from './DiffDisplay'
import { getFileDiffKey, getScrollableParent } from './diffViewerUtils'

type DiffViewerProps = {
	inlineComments?: ReviewInlineComment[]
	onSelectFile?: (path: string) => void
	patch: string
	selectedFilePath?: string | null
	settings: DiffDisplaySettings
}

export const DiffViewer = memo(function DiffViewer({
	inlineComments = [],
	onSelectFile,
	patch,
	selectedFilePath,
	settings,
}: DiffViewerProps) {
	const parsedPatch = useMemo(() => parsePatch(patch), [patch])
	const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => new Set())
	const fileRefs = useRef(new Map<string, HTMLDivElement>())

	useEffect(() => {
		if (!selectedFilePath) return

		for (const file of parsedPatch.files) {
			if (file.name === selectedFilePath || file.prevName === selectedFilePath) {
				const fileKey = getFileDiffKey(file)
				setExpandedFiles((current) => new Set(current).add(fileKey))
				requestAnimationFrame(() => {
					const node = fileRefs.current.get(fileKey)
					const scrollParent = node ? getScrollableParent(node) : null
					if (node && scrollParent) {
						scrollParent.scrollTo({
							behavior: 'smooth',
							top: node.offsetTop - scrollParent.offsetTop,
						})
					}
				})
				return
			}
		}
	}, [parsedPatch.files, selectedFilePath])

	if (!patch.trim()) {
		return <StatusCard title="No diff loaded" body="Select a PR to load its GitHub diff." />
	}

	if (parsedPatch.error) {
		return <StatusCard title="Could not render diff" body={parsedPatch.error} tone="red" />
	}

	if (parsedPatch.files.length === 0) {
		return <StatusCard title="Empty diff" body="GitHub returned no changed files for this PR." />
	}

	return (
		<Stack gap="4" pr="1">
			{parsedPatch.files.map((fileDiff) => {
				const fileKey = getFileDiffKey(fileDiff)
				const expanded = expandedFiles.has(fileKey)

				return (
					<Box
						bg="gray.1"
						borderRadius="l2"
						borderWidth="1px"
						key={fileKey}
						overflow="hidden"
						ref={(node) => {
							if (node) {
								fileRefs.current.set(fileKey, node)
							} else {
								fileRefs.current.delete(fileKey)
							}
						}}
					>
						<DiffFileHeader
							expanded={expanded}
							fileDiff={fileDiff}
							onToggle={() => {
								onSelectFile?.(fileDiff.name)
								setExpandedFiles((current) => {
									const next = new Set(current)
									if (next.has(fileKey)) next.delete(fileKey)
									else next.add(fileKey)
									return next
								})
							}}
						/>
						{expanded ? (
							<DiffFileView
								disableFileHeader
								fileDiff={fileDiff}
								inlineComments={inlineComments}
								settings={settings}
							/>
						) : null}
					</Box>
				)
			})}
		</Stack>
	)
})

function DiffFileHeader({
	expanded,
	fileDiff,
	onToggle,
}: {
	expanded: boolean
	fileDiff: ReturnType<typeof parsePatch>['files'][number]
	onToggle: () => void
}) {
	const additions = fileDiff.hunks.reduce((total, hunk) => total + hunk.additionLines, 0)
	const deletions = fileDiff.hunks.reduce((total, hunk) => total + hunk.deletionLines, 0)

	return (
		<Box
			as="button"
			bg="gray.2"
			borderBottomWidth={expanded ? '1px' : '0'}
			cursor="pointer"
			onClick={onToggle}
			px="3"
			py="2"
			textAlign="left"
			w="100%"
			_hover={{ bg: 'gray.3' }}
		>
			<HStack gap="3" justify="space-between" w="100%">
				<HStack gap="2" minW="0">
					<Box color="fg.muted" fontSize="sm" w="5">
						{expanded ? '▾' : '▸'}
					</Box>
					<Box fontFamily="mono" fontSize="sm" fontWeight="medium" truncate>
						{fileDiff.name}
					</Box>
				</HStack>
				<HStack flexShrink="0" gap="2" fontFamily="mono" fontSize="xs">
					<Badge colorPalette="gray" variant="surface">
						{fileDiff.type}
					</Badge>
					<Box color="green.11">+{additions}</Box>
					<Box color="red.11">-{deletions}</Box>
				</HStack>
			</HStack>
		</Box>
	)
}
