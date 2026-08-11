import { css } from 'styled-system/css'
import { Box, HStack } from 'styled-system/jsx'
import { visuallyHidden } from 'styled-system/patterns'
import type { AsyncState } from '@/app/types'
import { Input, Select } from '@/components/ui'
import { ArrowRightIcon, CloseIcon } from './InboxIcons'
import { type SearchMode, searchModeLabels, searchPlaceholders } from './types'

export function ReviewSearchBar({
	canReviewPrQuery,
	onClearSearch,
	onReviewPr,
	onSearch,
	query,
	reviewPrState,
	reviewsState,
	searchMode,
	setQuery,
	setSearchMode,
	showResetAction,
}: {
	canReviewPrQuery: boolean
	onClearSearch: () => void
	onReviewPr: () => void
	onSearch: () => void
	query: string
	reviewPrState: AsyncState
	reviewsState: AsyncState
	searchMode: SearchMode
	setQuery: (query: string) => void
	setSearchMode: (mode: SearchMode) => void
	showResetAction: boolean
}) {
	const trimmedQuery = query.trim()
	const primaryAction = canReviewPrQuery ? onReviewPr : onSearch
	const primaryActionLabel = canReviewPrQuery ? 'Review PR' : 'Search'

	return (
		<Box
			display="grid"
			gap="2"
			gridTemplateColumns={{ base: 'minmax(0, 1fr)', sm: '5.75rem minmax(0, 1fr)' }}
		>
			<Select
				label="Search mode"
				value={searchMode}
				width="5.75rem"
				onChange={(mode) => setSearchMode(mode as SearchMode)}
				options={Object.entries(searchModeLabels).map(([value, label]) => ({ value, label }))}
			/>
			<Box position="relative" minW="0">
				<label className={visuallyHidden()} htmlFor="review-search">
					Search pull requests
				</label>
				<Input
					id="review-search"
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') primaryAction()
					}}
					placeholder={searchPlaceholders[searchMode]}
					pr="9"
					value={query}
					variant="surface"
				/>
				<HStack gap="1" position="absolute" right="1" top="50%" transform="translateY(-50%)">
					{showResetAction ? (
						<SearchIconButton
							ariaLabel="Reset search"
							disabled={reviewsState === 'loading'}
							onClick={onClearSearch}
						>
							<CloseIcon />
						</SearchIconButton>
					) : (
						<SearchIconButton
							ariaLabel={primaryActionLabel}
							disabled={!trimmedQuery || reviewPrState === 'loading' || reviewsState === 'loading'}
							onClick={primaryAction}
						>
							<ArrowRightIcon />
						</SearchIconButton>
					)}
				</HStack>
			</Box>
		</Box>
	)
}

function SearchIconButton({
	ariaLabel,
	children,
	disabled,
	onClick,
}: {
	ariaLabel: string
	children: React.ReactNode
	disabled?: boolean
	onClick: () => void
}) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={onClick}
			className={css({
				alignItems: 'center',
				bg: 'transparent',
				borderRadius: 'l1',
				color: 'fg.muted',
				cursor: disabled ? 'not-allowed' : 'pointer',
				display: 'inline-flex',
				fontSize: 'lg',
				fontWeight: 'bold',
				h: '7',
				justifyContent: 'center',
				lineHeight: '1',
				opacity: disabled ? 0.45 : 1,
				transition: 'all 120ms ease',
				w: '7',
				_hover: { bg: disabled ? 'transparent' : 'gray.4', color: 'fg.default' },
			})}
		>
			{children}
		</button>
	)
}
