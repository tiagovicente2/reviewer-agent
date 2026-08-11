import { Tabs } from '@ark-ui/react/tabs'
import type { ReactNode } from 'react'
import { css } from 'styled-system/css'
import { Box } from 'styled-system/jsx'

export function StatusCard({
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

export function TabButton({ children, value }: { children: ReactNode; value: string }) {
	return (
		<Tabs.Trigger
			value={value}
			className={css({
				paddingX: '3',
				paddingY: '1.5',
				borderRadius: 's',
				fontSize: 'sm',
				fontWeight: 'medium',
				transition: 'all 150ms ease',
				cursor: 'pointer',
				backgroundColor: 'transparent',
				color: 'fg.muted',
				border: 'none',
				'&[data-selected]': {
					backgroundColor: 'gray.1',
					color: 'fg.default',
				},
				_hover: {
					backgroundColor: 'gray.3',
					color: 'fg.default',
				},
			})}
		>
			{children}
		</Tabs.Trigger>
	)
}

export function Code({ children }: { children: string }) {
	return (
		<Box as="code" bg="gray.3" borderRadius="l1" color="fg.default" px="1.5" py="0.5">
			{children}
		</Box>
	)
}
