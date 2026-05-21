import { FileTree, useFileTree } from '@pierre/trees/react'
import { type CSSProperties, useEffect, useMemo } from 'react'
import type { GitHubPullRequestDetails } from '@/shared/github'

type ChangedFile = GitHubPullRequestDetails['files'][number]

export function ChangedFilesTree({
	colorMode,
	files,
	onSelectFile,
	selectedFilePath,
}: {
	colorMode: 'light' | 'dark'
	files: ChangedFile[]
	onSelectFile: (path: string | null) => void
	selectedFilePath: string | null
}) {
	const paths = useMemo(() => files.map((file) => file.path), [files])
	const gitStatus = useMemo(
		() => files.map((file) => ({ path: file.path, status: 'modified' as const })),
		[files],
	)
	const statsByPath = useMemo(
		() => new Map(files.map((file) => [file.path, `+${file.additions} / -${file.deletions}`])),
		[files],
	)
	const { model } = useFileTree({
		density: 'compact',
		flattenEmptyDirectories: false,
		gitStatus,
		icons: { colored: false, set: 'standard' },
		initialExpansion: 'open',
		initialSelectedPaths: selectedFilePath ? [selectedFilePath] : [],
		onSelectionChange: (selectedPaths) => {
			onSelectFile(selectedPaths.find((path) => statsByPath.has(path)) ?? null)
		},
		paths,
		renderRowDecoration: ({ item }) => {
			const text = statsByPath.get(item.path)
			return text ? { text, title: `${item.path}: ${text}` } : null
		},
		search: true,
		unsafeCSS: treeUnsafeCss,
	})

	useEffect(() => {
		model.resetPaths(paths, {
			initialExpandedPaths: getExpandableParentPaths(paths),
		})
		model.setGitStatus(gitStatus)
	}, [gitStatus, model, paths])

	useEffect(() => {
		for (const selectedPath of model.getSelectedPaths()) {
			if (selectedPath !== selectedFilePath) {
				model.getItem(selectedPath)?.deselect()
			}
		}

		if (selectedFilePath) {
			const item = model.getItem(selectedFilePath)
			item?.select()
			item?.focus()
			revealSelectedPath(model, selectedFilePath, paths)
		}
	}, [model, paths, selectedFilePath])

	return <FileTree key={colorMode} model={model} style={getTreeStyle(colorMode)} />
}

function revealSelectedPath(
	model: {
		getFileTreeContainer: () => HTMLElement | undefined
		getItemHeight: () => number
	},
	selectedPath: string,
	paths: string[],
) {
	const root = model.getFileTreeContainer()?.shadowRoot
	const scrollElement = root?.querySelector('[data-file-tree-virtualized-scroll="true"]')
	if (!(scrollElement instanceof HTMLElement) || !root) return

	const findSelectedRow = () =>
		Array.from(root.querySelectorAll('[data-item-path]')).find(
			(element): element is HTMLElement =>
				element instanceof HTMLElement && element.dataset.itemPath === selectedPath,
		)

	const selectedRow = findSelectedRow()
	if (selectedRow) {
		selectedRow.scrollIntoView({ block: 'nearest' })
		return
	}

	const selectedIndex = paths.indexOf(selectedPath)
	if (selectedIndex < 0) return

	scrollElement.scrollTop = Math.max(
		0,
		selectedIndex * model.getItemHeight() - scrollElement.clientHeight / 2,
	)
	requestAnimationFrame(() => findSelectedRow()?.scrollIntoView({ block: 'nearest' }))
}

const treeUnsafeCss = `
[data-item-selected='true'] {
	background-color: var(--trees-selected-bg) !important;
}

[data-item-selected='true'] [data-truncate-marker] {
	background-color: var(--trees-selected-bg) !important;
	background-image: none !important;
	color: transparent !important;
	opacity: 0 !important;
}
`

function getExpandableParentPaths(paths: string[]) {
	return Array.from(
		new Set(
			paths.flatMap((path) => {
				const parts = path.split('/')
				return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
			}),
		),
	)
}

function getTreeStyle(colorMode: 'light' | 'dark') {
	return {
		'--trees-bg-override': 'transparent',
		'--trees-bg-muted-override': 'var(--colors-gray.2)',
		'--trees-fg-override': 'var(--colors-fg-default)',
		'--trees-fg-muted-override': 'var(--colors-fg-muted)',
		'--trees-input-bg-override': 'var(--colors-gray.2)',
		'--trees-search-fg-override': 'var(--colors-fg-default)',
		'--trees-focus-ring-color-override': 'var(--colors-review-blue)',
		'--trees-selected-bg-override': 'var(--colors-review-tree-selected-bg)',
		'--trees-selected-focused-border-color-override': 'var(--colors-review-blue)',
		'--trees-selected-fg-override': 'var(--colors-fg-default)',
		backgroundColor: 'transparent',
		border: 'none',
		colorScheme: colorMode,
		height: '100%',
		minHeight: '0',
		overflow: 'hidden',
		width: '100%',
	} as CSSProperties
}
