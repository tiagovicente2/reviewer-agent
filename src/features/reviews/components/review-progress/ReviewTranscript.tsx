import { useCallback, useLayoutEffect, useRef } from 'react'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { type TranscriptLineModel, transcriptLineTone } from './reviewTranscriptUtils'

export function ReviewTranscript({ lines }: { lines: TranscriptLineModel[] }) {
	const transcriptRef = useRef<HTMLDivElement | null>(null)
	const shouldFollowTranscriptRef = useRef(true)

	const updateTranscriptFollowState = useCallback(() => {
		const transcript = transcriptRef.current
		if (!transcript) return

		shouldFollowTranscriptRef.current =
			transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight <= 8
	}, [])

	useLayoutEffect(() => {
		if (!shouldFollowTranscriptRef.current) return

		const transcript = transcriptRef.current
		if (!transcript) return

		transcript.scrollTop = transcript.scrollHeight
	})

	return (
		<Stack
			aria-label="Review generation transcript"
			aria-live="polite"
			aria-relevant="additions text"
			bg="gray.1"
			borderColor="border.default"
			borderRadius="l2"
			borderWidth="1px"
			flex="1"
			gap="0"
			minH="0"
			onScroll={updateTranscriptFollowState}
			overflowY="auto"
			ref={transcriptRef}
			role="log"
			scrollbarGutter="stable"
			w="100%"
		>
			{lines.map((line) => (
				<TranscriptLine key={line.id} line={line} />
			))}
		</Stack>
	)
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
			<HStack
				alignItems="baseline"
				color={tone.labelColor}
				flexShrink="0"
				fontFamily="mono"
				fontSize="xs"
				fontWeight="semibold"
				gap="2"
				lineHeight="1.6"
				minW="7.25rem"
			>
				<Box textTransform="uppercase">{line.label ?? tone.label}</Box>
				{line.timestamp ? (
					<Box color="fg.subtle" fontSize="2xs" fontWeight="medium">
						{line.timestamp}
					</Box>
				) : null}
			</HStack>
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
