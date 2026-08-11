import type { ReactNode } from 'react'
import { css } from 'styled-system/css'
import { Box, HStack } from 'styled-system/jsx'

export function InlineField({
	children,
	htmlFor,
	label,
	labelAccessory,
}: {
	children: ReactNode
	htmlFor?: string
	label: string
	labelAccessory?: ReactNode
}) {
	return (
		<HStack
			justify="space-between"
			gap="4"
			borderBottomWidth="1px"
			borderColor="border.subtle"
			py="2"
		>
			<HStack alignItems="center" gap="1.5">
				{htmlFor ? (
					<label className={css({ fontWeight: 'medium', textStyle: 'sm' })} htmlFor={htmlFor}>
						{label}
					</label>
				) : (
					<Box fontWeight="medium" textStyle="sm">
						{label}
					</Box>
				)}
				{labelAccessory}
			</HStack>
			{children}
		</HStack>
	)
}
