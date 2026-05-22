import { useEffect, useRef, useState } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'

const reviewFrames = ['[ === ]', '[ ==  ]', '[ =   ]', '[  == ]', '[   = ]', '[  == ]', '[ === ]']

export function ReviewProgress({ message, outputText }: { message?: string; outputText?: string }) {
	const [frameIndex, setFrameIndex] = useState(0)
	const transcriptRef = useRef<HTMLDivElement | null>(null)
	const transcriptLines = getTranscriptLines(outputText)
	const hasTranscript = transcriptLines.length > 0

	useEffect(() => {
		const interval = window.setInterval(() => {
			setFrameIndex((current) => (current + 1) % reviewFrames.length)
		}, 500)

		return () => window.clearInterval(interval)
	}, [])

	useEffect(() => {
		const transcript = transcriptRef.current
		if (!transcript || !hasTranscript) return

		transcript.scrollTop = transcript.scrollHeight
	})

	return (
		<Stack bg="gray.2" borderRadius="l2" gap="4" minH="18rem" p="6" textAlign="left">
			<HStack alignItems="center" justify="space-between" gap="3">
				<Box fontWeight="semibold">Reviewing this PR</Box>
				{hasTranscript ? (
					<HStack color="fg.muted" flexShrink="0" gap="2" textStyle="xs">
						<Box color="cyan.11" fontFamily="mono" fontWeight="bold">
							{reviewFrames[frameIndex]}
						</Box>
						<Box>{message || 'Generating draft review...'}</Box>
					</HStack>
				) : null}
			</HStack>
			<Stack flex="1" minH="0">
				{hasTranscript ? (
					<Stack
						bg="gray.1"
						borderColor="border.default"
						borderRadius="l2"
						borderWidth="1px"
						gap="0"
						h="100%"
						minH="18rem"
						overflow="auto"
						py="3"
						ref={transcriptRef}
						w="100%"
					>
						{transcriptLines.map((line) => (
							<TranscriptLine key={line.id} line={line} />
						))}
					</Stack>
				) : (
					<Stack
						alignItems="center"
						flex="1"
						gap="4"
						justify="center"
						minH="18rem"
						textAlign="center"
					>
						<Box color="cyan.11" fontFamily="mono" fontSize="5xl" fontWeight="bold" lineHeight="1">
							{reviewFrames[frameIndex]}
						</Box>
						<Box color="fg.muted" maxW="32rem" textStyle="sm">
							{message || 'Waiting for the first streamed response tokens...'}
						</Box>
					</Stack>
				)}
			</Stack>
		</Stack>
	)
}

type TranscriptLineKind =
	| 'check'
	| 'finding'
	| 'output'
	| 'prompt'
	| 'status'
	| 'summary'
	| 'thought'

type TranscriptLineModel = {
	detail?: string
	id: string
	kind: TranscriptLineKind
	label?: string
	raw: string
	text: string
}

function getTranscriptLines(outputText?: string): TranscriptLineModel[] {
	return (outputText ?? '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line, index) => ({ ...parseTranscriptLine(line), id: `${index}:${line}` }))
}

function parseTranscriptLine(raw: string): Omit<TranscriptLineModel, 'id'> {
	if (raw.startsWith('::')) {
		return { kind: 'status', raw, text: raw.replace(/^::\s*/, '') }
	}

	if (raw.startsWith('Thought:')) {
		return { kind: 'thought', label: 'Thought', raw, text: raw.replace(/^Thought:\s*/, '') }
	}

	if (raw.startsWith('Finding')) {
		const match = raw.match(/^Finding(?:\s+\(([^)]+)\))?:\s*(.*)$/)
		return {
			detail: match?.[1],
			kind: 'finding',
			label: 'Finding',
			raw,
			text: match?.[2] || raw,
		}
	}

	if (raw.startsWith('Summary:')) {
		return { kind: 'summary', label: 'Summary', raw, text: raw.replace(/^Summary:\s*/, '') }
	}

	if (raw.startsWith('->')) {
		const text = raw.replace(/^->\s*/, '')
		const separatorIndex = text.indexOf(': ')
		return {
			detail: separatorIndex > 0 ? text.slice(0, separatorIndex) : undefined,
			kind: 'check',
			label: 'Check',
			raw,
			text: separatorIndex > 0 ? text.slice(separatorIndex + 2) : text,
		}
	}

	if (/^Generate\b/.test(raw)) {
		return { kind: 'prompt', raw, text: raw }
	}

	return { kind: 'output', raw, text: raw }
}

function TranscriptLine({ line }: { line: TranscriptLineModel }) {
	const tone = transcriptLineTone[line.kind]

	return (
		<HStack
			alignItems="baseline"
			borderBottomColor="border.muted"
			borderBottomWidth="1px"
			gap="3"
			px="4"
			py="2.5"
			_last={{ borderBottomWidth: '0' }}
		>
			<Box
				color={tone.labelColor}
				flexShrink="0"
				fontFamily="mono"
				fontSize="xs"
				fontWeight="semibold"
				lineHeight="1.6"
				minW="4.5rem"
				textTransform="uppercase"
			>
				{line.label ?? tone.label}
			</Box>
			<Stack gap="1" minW="0">
				{line.detail ? (
					<Box color={tone.detailColor} fontFamily="mono" textStyle="xs" wordBreak="break-all">
						{line.detail}
					</Box>
				) : null}
				<Box color={tone.textColor} lineHeight="1.6" textStyle="sm" whiteSpace="pre-wrap">
					{line.text}
				</Box>
			</Stack>
		</HStack>
	)
}

const transcriptLineTone: Record<
	TranscriptLineKind,
	{ detailColor: string; label: string; labelColor: string; textColor: string }
> = {
	check: {
		detailColor: 'cyan.11',
		label: 'Check',
		labelColor: 'cyan.11',
		textColor: 'fg.default',
	},
	finding: {
		detailColor: 'red.11',
		label: 'Finding',
		labelColor: 'red.11',
		textColor: 'fg.default',
	},
	output: {
		detailColor: 'fg.muted',
		label: 'Output',
		labelColor: 'fg.muted',
		textColor: 'fg.default',
	},
	prompt: {
		detailColor: 'fg.muted',
		label: 'Prompt',
		labelColor: 'fg.muted',
		textColor: 'fg.default',
	},
	status: {
		detailColor: 'fg.muted',
		label: 'Status',
		labelColor: 'fg.muted',
		textColor: 'fg.muted',
	},
	summary: {
		detailColor: 'fg.muted',
		label: 'Summary',
		labelColor: 'cyan.11',
		textColor: 'fg.default',
	},
	thought: {
		detailColor: 'fg.muted',
		label: 'Thought',
		labelColor: 'green.11',
		textColor: 'fg.default',
	},
}
