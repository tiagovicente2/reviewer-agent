import { useEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { Box } from 'styled-system/jsx'

export type SelectOption = string | { label: string; value: string }

function optionValue(option: SelectOption) {
	return typeof option === 'string' ? option : option.value
}

function optionLabel(option: SelectOption) {
	return typeof option === 'string' ? option : option.label
}

export function Select({
	disabled = false,
	loading = false,
	onChange,
	options,
	placeholder,
	value,
	width = '15rem',
}: {
	disabled?: boolean
	loading?: boolean
	onChange: (value: string) => void
	options: SelectOption[]
	placeholder?: string
	value: string
	width?: string
}) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const selected = options.find((option) => optionValue(option) === value)

	useEffect(() => {
		if (!open) return
		const closeOnOutsideClick = (event: MouseEvent) => {
			if (!ref.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', closeOnOutsideClick)
		return () => document.removeEventListener('mousedown', closeOnOutsideClick)
	}, [open])

	return (
		<Box position="relative" ref={ref} flexShrink="0" w={width}>
			<button
				type="button"
				aria-busy={loading}
				aria-expanded={open}
				disabled={disabled}
				title={loading ? 'Loading…' : undefined}
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
				onClick={() => {
					if (!disabled) setOpen((current) => !current)
				}}
			>
				<span
					className={css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}
				>
					{loading ? 'Loading…' : selected ? optionLabel(selected) : placeholder || value}
				</span>
				<span aria-hidden="true">▾</span>
			</button>
			{open ? (
				<Box
					bg="gray.2"
					borderColor="border.default"
					borderRadius="l2"
					borderWidth="1px"
					boxShadow="lg"
					maxH="18rem"
					minW="100%"
					mt="1"
					overflowY="auto"
					position="absolute"
					right="0"
					w="max-content"
					zIndex="dropdown"
				>
					{options.map((option) => {
						const nextValue = optionValue(option)
						return (
							<button
								key={nextValue}
								type="button"
								title={optionLabel(option)}
								className={css({
									bg: nextValue === value ? 'gray.4' : 'transparent',
									color: 'fg.default',
									cursor: 'pointer',
									display: 'block',
									fontSize: 'sm',
									minH: '9',
									minW: '100%',
									px: '3',
									py: '2',
									textAlign: 'left',
									whiteSpace: 'nowrap',
									_hover: { bg: 'gray.4' },
								})}
								onClick={() => {
									onChange(nextValue)
									setOpen(false)
								}}
							>
								{optionLabel(option)}
							</button>
						)
					})}
				</Box>
			) : null}
		</Box>
	)
}
