import { type CSSProperties, useState } from 'react'
import { Box, Grid, Stack } from 'styled-system/jsx'
import type { AsyncState, ColorMode } from '@/app/types'
import { StatusCard } from '@/components/common'
import { Button, Card } from '@/components/ui'
import type { GitHubPullRequestDetails } from '@/shared/github'
import type { ReviewInlineComment } from '@/shared/review'
import { ChangedFilesTree } from '../changed-files-tree/ChangedFilesTree'
import { DiffViewer } from '../diff-viewer/DiffViewer'
import type { DiffDisplaySettings } from '../diff-viewer/diffDisplayUtils'
import { ChevronLeftIcon, ChevronRightIcon } from '../inbox/InboxIcons'
import { PaneResizeHandle } from '../PaneResizeHandle'
import { filesPane } from '../workspaceLayoutUtils'

export function CodeTab({
	colorMode,
	detail,
	detailState,
	diff,
	diffError,
	diffDisplaySettings,
	diffState,
	inlineComments,
	onLoadDiff,
}: {
	colorMode: ColorMode
	detail: GitHubPullRequestDetails | null
	detailState: AsyncState
	diff: string
	diffError: string
	diffDisplaySettings: DiffDisplaySettings
	diffState: AsyncState
	inlineComments: ReviewInlineComment[]
	onLoadDiff: () => Promise<string>
}) {
	const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
	const [filesWidth, setFilesWidth] = useState<number>(filesPane.defaultWidth)
	const [filesCollapsed, setFilesCollapsed] = useState(false)

	if (detailState === 'loading' || !detail || (!diff && !diffError)) {
		return (
			<Stack h="100%" placeContent="center" alignItems="center" textAlign="center">
				<StatusCard
					title="Loading pull request"
					body="Loading PR metadata, changed files, and diff before showing the code view..."
				/>
			</Stack>
		)
	}

	return (
		<Grid
			style={{ '--files-width': `${filesWidth}px` } as CSSProperties}
			gridTemplateColumns={
				filesCollapsed ? '2.5rem minmax(0, 1fr)' : 'var(--files-width) 0.5rem minmax(0, 1fr)'
			}
			gap="0"
			h="100%"
			minH="0"
			minW="0"
			overflow="hidden"
		>
			<Card.Root
				borderRightWidth="0"
				display={filesCollapsed ? 'none' : 'flex'}
				h="100%"
				id="changed-files-pane"
				minH="0"
				overflow="hidden"
				variant="outline"
			>
				<Card.Header position="relative">
					<Card.Title pr="8" truncate>
						Changed files
					</Card.Title>
					<Card.Description truncate>{detail?.files.length ?? 0} edited files</Card.Description>
					<Button
						aria-controls="changed-files-tree"
						aria-expanded={true}
						aria-label="Collapse changed files"
						onClick={() => setFilesCollapsed(true)}
						position="absolute"
						right="4"
						size="2xs"
						top="4"
						variant="plain"
					>
						<ChevronLeftIcon />
					</Button>
				</Card.Header>
				<Card.Body id="changed-files-tree" minH="0" overflow="hidden" p="0">
					{detail ? (
						<ChangedFilesTree
							colorMode={colorMode}
							files={detail.files}
							onSelectFile={setSelectedFilePath}
							selectedFilePath={selectedFilePath}
						/>
					) : null}
				</Card.Body>
			</Card.Root>

			<Box
				alignItems="center"
				bg="gray.2"
				borderRightWidth="1px"
				display={filesCollapsed ? 'flex' : 'none'}
				h="100%"
				justifyContent="center"
				minH="0"
			>
				<Button
					aria-controls="changed-files-tree"
					aria-expanded={false}
					aria-label="Show changed files"
					h="full"
					onClick={() => setFilesCollapsed(false)}
					px="0"
					size="2xs"
					variant="plain"
					w="full"
				>
					<ChevronRightIcon />
				</Button>
			</Box>

			{filesCollapsed ? null : (
				<PaneResizeHandle
					ariaLabel="Resize changed files"
					controls="changed-files-pane"
					limits={filesPane}
					onChange={setFilesWidth}
					value={filesWidth}
				/>
			)}

			<Box h="100%" maxW="100%" minH="0" minW="0" overflow="auto">
				{diff ? (
					<DiffViewer
						colorMode={colorMode}
						inlineComments={inlineComments}
						onSelectFile={setSelectedFilePath}
						patch={diff}
						selectedFilePath={selectedFilePath}
						settings={diffDisplaySettings}
					/>
				) : (
					<Stack h="100%" placeContent="center" alignItems="center" gap="4" textAlign="center">
						<StatusCard
							tone={diffError ? 'red' : 'gray'}
							title={diffError ? 'Could not load diff' : 'Loading diff'}
							body={diffError || 'Loading the patch in the background...'}
						/>
						{diffError ? (
							<Button loading={diffState === 'loading'} onClick={() => void onLoadDiff()}>
								Retry loading diff
							</Button>
						) : null}
					</Stack>
				)}
			</Box>
		</Grid>
	)
}
