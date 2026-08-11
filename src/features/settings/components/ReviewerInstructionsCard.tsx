import { Tabs } from '@ark-ui/react/tabs'
import { useState } from 'react'
import { Box, HStack } from 'styled-system/jsx'
import { visuallyHidden } from 'styled-system/patterns'
import { TabButton } from '@/components/common'
import { MarkdownContent } from '@/components/markdown/MarkdownContent'
import { Button, Card, Input, Select, Textarea } from '@/components/ui'
import type { ReviewerInstruction } from '@/shared/settings'

type InstructionsMode = 'raw' | 'preview'

export function ReviewerInstructionsCard({
	instructions,
	mode,
	onChangeInstructions,
	onChangeMode,
	path,
}: {
	instructions: ReviewerInstruction[]
	mode: InstructionsMode
	onChangeInstructions: (instructions: ReviewerInstruction[]) => void
	onChangeMode: (mode: InstructionsMode) => void
	path: string
}) {
	const [selectedId, setSelectedId] = useState(instructions[0]?.id ?? '')
	const selected =
		instructions.find((instruction) => instruction.id === selectedId) ?? instructions[0]

	const updateSelected = (changes: Partial<ReviewerInstruction>) => {
		if (!selected) return
		onChangeInstructions(
			instructions.map((instruction) =>
				instruction.id === selected.id ? { ...instruction, ...changes } : instruction,
			),
		)
	}

	const addInstruction = () => {
		const instruction: ReviewerInstruction = {
			id: crypto.randomUUID(),
			name: `Instructions ${instructions.length + 1}`,
			content: '',
		}
		onChangeInstructions([...instructions, instruction])
		setSelectedId(instruction.id)
		onChangeMode('raw')
	}

	const deleteSelected = () => {
		if (!selected || instructions.length <= 1) return
		const remaining = instructions.filter((instruction) => instruction.id !== selected.id)
		onChangeInstructions(remaining)
		setSelectedId(remaining[0]?.id ?? '')
	}

	return (
		<Tabs.Root
			lazyMount={false}
			onValueChange={({ value }) => onChangeMode(value as InstructionsMode)}
			unmountOnExit={false}
			value={mode}
		>
			<Card.Root minH="0" minW="0" overflow="visible">
				<Card.Header>
					<HStack justify="space-between" gap="4">
						<Box minW="0">
							<Card.Title>Reviewer agent instructions</Card.Title>
							<Card.Description>{path}</Card.Description>
						</Box>
						<Tabs.List aria-label="Instruction editor view" asChild>
							<HStack gap="1" p="0.5" bg="gray.2" borderRadius="l1" flexShrink="0">
								<TabButton value="raw">Raw</TabButton>
								<TabButton value="preview">Preview</TabButton>
							</HStack>
						</Tabs.List>
					</HStack>
					<HStack gap="2" mt="3">
						<Select
							label="Instruction set"
							onChange={setSelectedId}
							options={instructions.map((instruction) => ({
								label: instruction.name || 'Untitled',
								value: instruction.id,
							}))}
							placeholder="Select instructions"
							value={selected?.id ?? ''}
						/>
						<label className={visuallyHidden()} htmlFor="instruction-name">
							Instruction name
						</label>
						<Input
							id="instruction-name"
							flex="1"
							minW="0"
							placeholder="Instruction name"
							value={selected?.name ?? ''}
							onChange={(event) => updateSelected({ name: event.target.value })}
						/>
						<Button onClick={addInstruction} size="sm" variant="outline">
							New
						</Button>
						<Button
							disabled={instructions.length <= 1}
							onClick={deleteSelected}
							size="sm"
							variant="outline"
						>
							Delete
						</Button>
					</HStack>
				</Card.Header>
				<Card.Body minH="0" overflow="visible">
					<Tabs.Content asChild value="raw">
						<Box minH="0">
							<label className={visuallyHidden()} htmlFor="instruction-content">
								Reviewer instructions markdown
							</label>
							<Textarea
								id="instruction-content"
								boxSizing="border-box"
								display="block"
								minH="24rem"
								resize="vertical"
								placeholder="Custom markdown instructions for the reviewer agent."
								value={selected?.content ?? ''}
								onChange={(event) => updateSelected({ content: event.target.value })}
								variant="surface"
							/>
						</Box>
					</Tabs.Content>
					<Tabs.Content asChild value="preview">
						<Box bg="gray.2" borderRadius="l2" minH="24rem" p="4">
							<MarkdownContent>{selected?.content || '_No instructions yet._'}</MarkdownContent>
						</Box>
					</Tabs.Content>
				</Card.Body>
			</Card.Root>
		</Tabs.Root>
	)
}
