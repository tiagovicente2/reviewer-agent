import { useEffect, useRef, useState } from 'react'
import { Box, HStack, Stack, VisuallyHidden } from 'styled-system/jsx'
import { ReviewTranscript } from './review-progress/ReviewTranscript'
import { getTranscriptLines } from './review-progress/reviewTranscriptUtils'

const reviewFrames = ['[ === ]', '[ ==  ]', '[ =   ]', '[ ==  ]', '[ === ]', '[  == ]', '[   = ]']

export function ReviewProgress({ message, outputText }: { message?: string; outputText?: string }) {
	const [frameIndex, setFrameIndex] = useState(0)
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(
		() => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
	)
	const timestampByLineIdRef = useRef(new Map<string, string>())
	const transcriptLines = getTranscriptLines(outputText, timestampByLineIdRef.current)
	const hasTranscript = transcriptLines.length > 0

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
		const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)
		mediaQuery.addEventListener('change', updatePreference)
		return () => mediaQuery.removeEventListener('change', updatePreference)
	}, [])

	useEffect(() => {
		if (prefersReducedMotion) {
			setFrameIndex(0)
			return
		}

		const interval = window.setInterval(() => {
			setFrameIndex((current) => (current + 1) % reviewFrames.length)
		}, 500)
		return () => window.clearInterval(interval)
	}, [prefersReducedMotion])

	return (
		<Stack
			aria-busy="true"
			borderRadius="l2"
			gap="2"
			h="100%"
			minH="18rem"
			overflow="hidden"
			textAlign="left"
		>
			<HStack alignItems="center" justify="space-between" gap="3">
				<Box aria-atomic="true" aria-live="polite" fontWeight="semibold" role="status">
					Reviewing this PR
					<VisuallyHidden>
						{`. ${message || 'Waiting for the first streamed response tokens...'}`}
					</VisuallyHidden>
				</Box>
				{hasTranscript ? (
					<HStack aria-hidden="true" color="fg.muted" flexShrink="0" gap="2" textStyle="xs">
						<Box color="cyan.11" fontFamily="mono" fontWeight="bold">
							<ReviewFrame frame={reviewFrames[frameIndex]} />
						</Box>
					</HStack>
				) : null}
			</HStack>
			<Stack flex="1" minH="0">
				{hasTranscript ? (
					<ReviewTranscript lines={transcriptLines} />
				) : (
					<Stack
						alignItems="center"
						flex="1"
						gap="4"
						justify="center"
						minH="18rem"
						textAlign="center"
					>
						<Box
							aria-hidden="true"
							color="cyan.11"
							fontFamily="mono"
							fontSize="5xl"
							fontWeight="bold"
							lineHeight="1"
						>
							<ReviewFrame frame={reviewFrames[frameIndex]} />
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

function ReviewFrame({ frame }: { frame?: string }) {
	return (
		<Box as="span" display="inline-block" minW="7ch" textAlign="left" whiteSpace="pre">
			{frame ?? reviewFrames[0]}
		</Box>
	)
}
