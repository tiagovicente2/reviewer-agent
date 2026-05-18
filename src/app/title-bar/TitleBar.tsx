import { css } from 'styled-system/css'
import { Box, HStack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'

type CssProps = Parameters<typeof css>[0]

const titleBarStyle = css({
	position: 'fixed',
	top: '0',
	left: '0',
	right: '0',
	height: '40px',
	backgroundColor: 'gray.1',
	borderBottom: '1px solid',
	borderColor: 'gray.3',
	display: 'flex',
	alignItems: 'center',
	paddingLeft: '16px',
	paddingRight: '8px',
	zIndex: '9999',
	userSelect: 'none',
	webkitAppRegion: 'drag',
} as CssProps)

const controlsStyle = css({
	webkitAppRegion: 'no-drag',
} as CssProps)

interface TitleBarProps {
	title: string
}

export function TitleBar({ title }: TitleBarProps) {
	return (
		<Box className={titleBarStyle}>
			<Box
				className={css({
					fontSize: '13px',
					fontWeight: '600',
					color: 'fg.default',
				})}
			>
				{title}
			</Box>
			<Box flex="1" />
			<HStack gap="1" className={controlsStyle}>
				<TitleBarButton onClick={() => appRpc.request.minimizeWindow()} label="─" />
				<TitleBarButton onClick={() => appRpc.request.toggleMaximizeWindow()} label="□" />
				<TitleBarButton onClick={() => appRpc.request.closeWindow()} label="✕" close />
			</HStack>
		</Box>
	)
}

function TitleBarButton({
	onClick,
	label,
	close,
}: {
	onClick: () => void
	label: string
	close?: boolean
}) {
	return (
		<Box
			as="button"
			onClick={onClick}
			className={css({
				width: '32px',
				height: '24px',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'transparent',
				border: 'none',
				borderRadius: '4px',
				cursor: 'pointer',
				fontSize: '12px',
				color: 'fg.muted',
				_hover: {
					backgroundColor: close ? 'red.5' : 'gray.3',
					color: close ? 'white' : 'fg.default',
				},
			})}
		>
			{label}
		</Box>
	)
}
