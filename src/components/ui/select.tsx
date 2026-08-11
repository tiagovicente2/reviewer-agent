import { Portal } from '@ark-ui/react/portal'
import { Select as ArkSelect, createListCollection } from '@ark-ui/react/select'
import { css } from 'styled-system/css'
import { Box } from 'styled-system/jsx'
import { visuallyHidden } from 'styled-system/patterns'

export type SelectOption = string | { label: string; value: string }

type NormalizedOption = { label: string; value: string }

export function Select({
	disabled = false,
	label,
	loading = false,
	onChange,
	options,
	placeholder,
	value,
	width = '15rem',
}: {
	disabled?: boolean
	label: string
	loading?: boolean
	onChange: (value: string) => void
	options: SelectOption[]
	placeholder?: string
	value: string
	width?: string
}) {
	const collection = createListCollection<NormalizedOption>({
		items: options.map((option) =>
			typeof option === 'string' ? { label: option, value: option } : option,
		),
	})

	return (
		<ArkSelect.Root
			collection={collection}
			disabled={disabled}
			onValueChange={({ value: nextValue }) => {
				const selectedValue = nextValue[0]
				if (selectedValue !== undefined) onChange(selectedValue)
			}}
			positioning={{ placement: 'bottom-end', sameWidth: false }}
			value={value ? [value] : []}
		>
			<Box flexShrink="0" position="relative" w={width}>
				<ArkSelect.Label className={visuallyHidden()}>{label}</ArkSelect.Label>
				<ArkSelect.Control>
					<ArkSelect.Trigger
						aria-busy={loading}
						className={css({
							alignItems: 'center',
							bg: 'gray.2',
							borderColor: 'border.default',
							borderRadius: 'l2',
							borderWidth: '1px',
							color: 'fg.default',
							cursor: disabled ? 'not-allowed' : 'pointer',
							display: 'flex',
							fontSize: 'sm',
							h: '10',
							justifyContent: 'space-between',
							minW: '0',
							px: '3',
							textAlign: 'left',
							w: '100%',
						})}
					>
						<ArkSelect.ValueText
							className={css({
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							})}
							placeholder={loading ? 'Loading…' : placeholder}
						/>
						<ArkSelect.Indicator aria-hidden="true">▾</ArkSelect.Indicator>
					</ArkSelect.Trigger>
				</ArkSelect.Control>
				<Portal>
					<ArkSelect.Positioner>
						<ArkSelect.Content
							className={css({
								bg: 'gray.2',
								borderColor: 'border.default',
								borderRadius: 'l2',
								borderWidth: '1px',
								boxShadow: 'lg',
								maxH: '18rem',
								minW: '100%',
								mt: '1',
								overflowY: 'auto',
								w: 'max-content',
								zIndex: 'dropdown',
							})}
						>
							<ArkSelect.ItemGroup>
								{collection.items.map((option) => (
									<ArkSelect.Item
										className={css({
											alignItems: 'center',
											bg: 'transparent',
											color: 'fg.default',
											cursor: 'pointer',
											display: 'flex',
											fontSize: 'sm',
											gap: '3',
											justifyContent: 'space-between',
											minH: '9',
											minW: '100%',
											px: '3',
											py: '2',
											textAlign: 'left',
											whiteSpace: 'nowrap',
											'&[data-state=checked]': { bg: 'gray.4' },
											'&[data-highlighted]': { bg: 'gray.4' },
											_hover: { bg: 'gray.4' },
										})}
										item={option}
										key={option.value}
									>
										<ArkSelect.ItemText>{option.label}</ArkSelect.ItemText>
										<ArkSelect.ItemIndicator aria-hidden="true">✓</ArkSelect.ItemIndicator>
									</ArkSelect.Item>
								))}
							</ArkSelect.ItemGroup>
						</ArkSelect.Content>
					</ArkSelect.Positioner>
				</Portal>
				<ArkSelect.HiddenSelect />
			</Box>
		</ArkSelect.Root>
	)
}
