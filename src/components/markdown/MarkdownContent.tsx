import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { css, cx } from 'styled-system/css'
import { Box } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'

const githubImageHosts = new Set([
	'github.com',
	'user-images.githubusercontent.com',
	'private-user-images.githubusercontent.com',
])

const markdownContentClassName = css({
	color: 'fg.muted',
	lineHeight: '1.7',
	textStyle: 'sm',
	'& h1, & h2, & h3, & h4': {
		color: 'fg.default',
		fontWeight: 'semibold',
		marginBottom: '2',
		marginTop: '4',
	},
	'& p': { marginY: '2' },
	'& ul, & ol': { marginY: '2', paddingLeft: '5' },
	'& li': { marginY: '1' },
	'& a': { color: 'cyan.11', textDecoration: 'underline' },
	'& code': {
		backgroundColor: 'gray.3',
		borderRadius: 'l1',
		color: 'fg.default',
		fontFamily: 'mono',
		paddingX: '1',
	},
	'& pre': {
		backgroundColor: 'gray.2',
		borderRadius: 'l2',
		overflowX: 'auto',
		padding: '3',
	},
	'& pre code': { backgroundColor: 'transparent', padding: '0' },
	'& blockquote': {
		borderLeftColor: 'cyan.8',
		borderLeftWidth: '3px',
		color: 'fg.muted',
		paddingLeft: '3',
	},
	'& table': {
		borderCollapse: 'collapse',
		display: 'block',
		overflowX: 'auto',
		width: '100%',
	},
	'& th, & td': { borderColor: 'border.default', borderWidth: '1px', padding: '2' },
	'& img': { borderRadius: 'l2', maxWidth: '100%', marginY: '3' },
	'& details': {
		backgroundColor: 'gray.2',
		borderColor: 'border.default',
		borderRadius: 'l2',
		borderWidth: '1px',
		marginY: '3',
		padding: '3',
	},
	'& summary': { color: 'fg.default', cursor: 'pointer', fontWeight: 'semibold' },
})

const commentMarkdownContentClassName = css({
	color: 'black',
	'& h1, & h2, & h3, & h4': {
		color: 'black',
	},
	'& a': { color: '#005cc5' },
	'& code': {
		backgroundColor: 'rgba(27, 31, 35, 0.12)',
		color: 'black',
	},
	'& pre': {
		backgroundColor: 'rgba(27, 31, 35, 0.08)',
	},
	'& blockquote': {
		borderLeftColor: 'rgba(27, 31, 35, 0.35)',
		color: 'rgba(0, 0, 0, 0.78)',
	},
	'& th, & td': { borderColor: 'rgba(27, 31, 35, 0.22)' },
	'& details': {
		backgroundColor: 'rgba(27, 31, 35, 0.06)',
		borderColor: 'rgba(27, 31, 35, 0.22)',
	},
	'& summary': { color: 'black' },
})

function isGitHubImageSrc(src?: string) {
	if (!src) return false
	try {
		return githubImageHosts.has(new URL(src).hostname)
	} catch {
		return false
	}
}

function GitHubImage({ alt, src }: { alt?: string; src?: string }) {
	const [dataUrl, setDataUrl] = useState<string | null>(null)
	const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(
		src && isGitHubImageSrc(src) ? 'loading' : 'loaded',
	)
	const shouldProxy = src ? isGitHubImageSrc(src) : false

	useEffect(() => {
		setDataUrl(null)
		setState(src && isGitHubImageSrc(src) ? 'loading' : 'loaded')

		if (!src || !isGitHubImageSrc(src)) return
		let cancelled = false
		appRpc.request
			.getGitHubAsset({ url: src })
			.then((result) => {
				if (!cancelled) setDataUrl(result.dataUrl)
			})
			.catch(() => {
				if (!cancelled) setState('failed')
			})
		return () => {
			cancelled = true
		}
	}, [src])

	if (!src) return null

	return (
		<Box position="relative" minH={state === 'loading' ? '10' : undefined}>
			{state === 'loading' ? (
				<Box
					aria-hidden="true"
					bg="gray.2"
					borderColor="border.default"
					borderRadius="l2"
					borderWidth="1px"
					color="fg.muted"
					my="3"
					px="3"
					py="2"
					textStyle="xs"
				>
					Loading image…
				</Box>
			) : null}
			{state === 'failed' ? (
				<Box color="fg.muted" my="3" textStyle="xs">
					Image could not be loaded.
				</Box>
			) : null}
			<img
				alt={alt ?? ''}
				decoding="async"
				loading="lazy"
				onError={() => setState('failed')}
				onLoad={() => setState('loaded')}
				src={shouldProxy ? dataUrl || undefined : src}
				style={{ display: state === 'loaded' ? undefined : 'none' }}
			/>
		</Box>
	)
}

export function MarkdownContent({
	children,
	tone = 'default',
}: {
	children: string
	tone?: 'comment' | 'default'
}) {
	return (
		<Box
			className={cx(
				markdownContentClassName,
				tone === 'comment' ? commentMarkdownContentClassName : undefined,
			)}
		>
			<ReactMarkdown
				components={{ img: ({ alt, src }) => <GitHubImage alt={alt} src={src} /> }}
				remarkPlugins={[remarkGfm]}
			>
				{children}
			</ReactMarkdown>
		</Box>
	)
}
