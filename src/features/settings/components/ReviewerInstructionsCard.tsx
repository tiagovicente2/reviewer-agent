import { Box, HStack } from 'styled-system/jsx'
import { TabButton } from '@/components/common'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Card, Textarea } from '@/components/ui'

type InstructionsMode = 'raw' | 'preview'

export function ReviewerInstructionsCard({
	instructions,
	mode,
	onChangeInstructions,
	onChangeMode,
	path,
}: {
	instructions: string
	mode: InstructionsMode
	onChangeInstructions: (instructions: string) => void
	onChangeMode: (mode: InstructionsMode) => void
	path: string
}) {
	return (
		<Card.Root
			h="100%"
			minH="0"
			overflow="hidden"
			display="grid"
			gridTemplateRows="auto minmax(0, 1fr)"
		>
			<Card.Header>
				<HStack justify="space-between" gap="4">
					<Box minW="0">
						<Card.Title>Reviewer agent instructions</Card.Title>
						<Card.Description>{path}</Card.Description>
					</Box>
					<HStack gap="1" p="0.5" bg="gray.2" borderRadius="l1" flexShrink="0">
						<TabButton active={mode === 'raw'} onClick={() => onChangeMode('raw')}>
							Raw
						</TabButton>
						<TabButton active={mode === 'preview'} onClick={() => onChangeMode('preview')}>
							Preview
						</TabButton>
					</HStack>
				</HStack>
			</Card.Header>
			<Card.Body minH="0" overflow="hidden">
				<Box display={mode === 'raw' ? 'block' : 'none'} h="100%" minH="0">
					<Textarea
						boxSizing="border-box"
						display="block"
						h="100%"
						minH="0"
						resize="none"
						placeholder="Custom markdown instructions for the reviewer agent."
						value={instructions}
						onChange={(event) => onChangeInstructions(event.target.value)}
						variant="surface"
					/>
				</Box>
				<Box
					bg="gray.2"
					borderRadius="l2"
					display={mode === 'preview' ? 'block' : 'none'}
					h="100%"
					minH="0"
					overflowY="auto"
					p="4"
				>
					<MarkdownContent>{instructions || '_No instructions yet._'}</MarkdownContent>
				</Box>
			</Card.Body>
		</Card.Root>
	)
}
