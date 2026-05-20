import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { Box, HStack, Stack } from 'styled-system/jsx'
import { appRpc } from '@/app/rpc'
import { useToast } from '@/app/toast'
import type { AsyncState } from '@/app/types'
import { getErrorMessage } from '@/app/utils'
import { StatusCard } from '@/components/common'
import { Button } from '@/components/ui'
import type { AgentAvailability, AppSettings, AvailablePiModel } from '@/shared/settings'
import { AgentStatusCard } from './AgentStatusCard'
import { PreferencesCard } from './PreferencesCard'
import { ReviewerInstructionsCard } from './ReviewerInstructionsCard'
import { CacheModal } from './CacheModal'
import { UpdateModal } from './UpdateModal'
import type { UpdateStatus } from '@/shared/update'

export function SettingsPage({
	onBack,
	onOpenErrorLog,
	onSaved,
}: {
	onBack: () => void
	onOpenErrorLog: () => void
	onSaved: (settings: AppSettings) => void
}) {
	const [settings, setSettings] = useState<AppSettings | null>(null)
	const [state, setState] = useState<AsyncState>('loading')
	const [error, setError] = useState('')
	const [availableModels, setAvailableModels] = useState<AvailablePiModel[]>([])
	const [agentAvailability, setAgentAvailability] = useState<AgentAvailability[]>([])
	const [agentsState, setAgentsState] = useState<AsyncState>('idle')
	const [instructionsMode, setInstructionsMode] = useState<'raw' | 'preview'>('raw')
	const instructionsModeInitializedRef = useRef(false)
	const { showToast } = useToast()

	useEffect(() => {
		let cancelled = false

		appRpc.request
			.getAppSettings()
			.then((value) => {
				if (cancelled) return
				setSettings(value)
				if (!instructionsModeInitializedRef.current) {
					setInstructionsMode(value.reviewerInstructions.trim() ? 'preview' : 'raw')
					instructionsModeInitializedRef.current = true
				}
				setState('idle')
			})
			.catch((unknownError: unknown) => {
				if (cancelled) return
				setError(getErrorMessage(unknownError))
				setState('error')
			})

		return () => {
			cancelled = true
		}
	}, [])

	const refreshAgentAvailability = useCallback(async () => {
		setAgentsState('loading')
		try {
			setAgentAvailability(await appRpc.request.listAgentAvailability())
			setAgentsState('idle')
		} catch {
			setAgentsState('error')
		}
	}, [])

	useEffect(() => {
		void refreshAgentAvailability()
	}, [refreshAgentAvailability])

	const codeAgent = settings?.codeAgent

	useEffect(() => {
		if (!codeAgent) return
		let cancelled = false
		setAvailableModels([])
		appRpc.request
			.listAvailablePiModels({ agent: codeAgent })
			.then((models) => {
				if (cancelled) return
				setAvailableModels(models)
				setSettings((current) => {
					if (!current || current.codeAgent !== codeAgent || models.length === 0) return current
					return models.some((availableModel) => availableModel.id === current.model)
						? current
						: { ...current, model: models[0]?.id ?? current.model }
				})
			})
			.catch(() => {
				if (!cancelled) setAvailableModels([])
			})

		return () => {
			cancelled = true
		}
	}, [codeAgent])

	const selectedAgentAvailability = settings
		? agentAvailability.find((agent) => agent.agent === settings.codeAgent)
		: undefined

	const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
	const [isCacheModalOpen, setIsCacheModalOpen] = useState(false)
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

	useEffect(() => {
		appRpc.request.getUpdateStatus().then(setUpdateStatus).catch(Object)
	}, [])

	const save = async () => {
		if (!settings) return
		setState('loading')
		setError('')
		try {
			const saved = await appRpc.request.saveAppSettings(settings)
			setSettings(saved)
			onSaved(saved)
			setState('idle')
			showToast({ title: 'Settings saved', tone: 'success' })
		} catch (unknownError) {
			setError(getErrorMessage(unknownError))
			setState('error')
		}
	}

	return (
		<Box boxSizing="border-box" h="100%" overflow="hidden" px="8" py="6">
			<Stack gap="4" h="100%" minH="0" mx="auto" w="100%">
				<HStack alignItems="flex-start" justify="space-between">
					<Box>
						<Box as="h1" fontWeight="bold" textStyle="3xl">
							Settings
						</Box>
						<Box color="fg.muted" textStyle="sm">
							Configure local review generation.
						</Box>
					</Box>
					<HStack gap="2" flexShrink="0">
						<IconButton ariaLabel="Local cache" onClick={() => setIsCacheModalOpen(true)}>
							<CacheIcon />
						</IconButton>
						<Box position="relative">
							<IconButton
								ariaLabel="Check for updates"
								onClick={() => setIsUpdateModalOpen(true)}
							>
								<UpdateIcon />
							</IconButton>
							{updateStatus?.available && (
								<Box
									bg="cyan.9"
									borderRadius="full"
									h="2.5"
									position="absolute"
									right="1"
									top="1"
									w="2.5"
								/>
							)}
						</Box>
						<Button variant="outline" onClick={onOpenErrorLog}>
							Error log
						</Button>
						<Button variant="outline" onClick={onBack}>
							Back
						</Button>
						<Button loading={state === 'loading'} onClick={save} disabled={!settings}>
							Save
						</Button>
					</HStack>
				</HStack>

				{error ? <StatusCard tone="red" title="Could not save settings" body={error} /> : null}
				{settings ? (
					<Box
						display="grid"
						gap="4"
						gridTemplateColumns={{
							base: 'minmax(0, 1fr)',
							xl: '32rem minmax(0, 1fr)',
						}}
						h="100%"
						minH="0"
						overflow="hidden"
					>
						<Stack gap="4" h="100%" minH="0" overflowY="auto">
							<PreferencesCard
								availableModels={availableModels}
								onChange={setSettings}
								selectedAgentAvailability={selectedAgentAvailability}
								settings={settings}
							/>
							<AgentStatusCard
								agents={agentAvailability}
								agentsState={agentsState}
								onRefresh={() => void refreshAgentAvailability()}
							/>
						</Stack>

						<ReviewerInstructionsCard
							instructions={settings.reviewerInstructions}
							mode={instructionsMode}
							onChangeInstructions={(reviewerInstructions) =>
								setSettings({ ...settings, reviewerInstructions })
							}
							onChangeMode={setInstructionsMode}
							path={settings.reviewerInstructionsPath}
						/>
					</Box>
				) : null}
			</Stack>

			{isUpdateModalOpen && <UpdateModal onClose={() => setIsUpdateModalOpen(false)} />}
			{isCacheModalOpen && <CacheModal onClose={() => setIsCacheModalOpen(false)} />}
		</Box>
	)
}

function IconButton({
	ariaLabel,
	children,
	onClick,
}: {
	ariaLabel: string
	children: React.ReactNode
	onClick: () => void
}) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			onClick={onClick}
			className={css({
				alignItems: 'center',
				bg: 'transparent',
				border: '1px solid',
				borderColor: 'gray.7',
				borderRadius: 'l2',
				color: 'fg.muted',
				cursor: 'pointer',
				display: 'inline-flex',
				h: '10',
				justifyContent: 'center',
				p: '0',
				transition: 'all 120ms ease',
				w: '10',
				_hover: { bg: 'gray.3', color: 'fg.default' },
			})}
		>
			{children}
		</button>
	)
}

function UpdateIcon() {
	return (
		<svg
			aria-hidden="true"
			fill="none"
			height="20"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			viewBox="0 0 24 24"
			width="20"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="m16 12-4-4-4 4" />
			<path d="M12 16V8" />
		</svg>
	)
}

function CacheIcon() {
	return (
		<svg
			aria-hidden="true"
			fill="none"
			height="20"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			viewBox="0 0 24 24"
			width="20"
		>
			<ellipse cx="12" cy="5" rx="8" ry="3" />
			<path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
			<path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
			<circle cx="17" cy="11" r="1" fill="currentColor" stroke="none" />
			<circle cx="17" cy="17" r="1" fill="currentColor" stroke="none" />
		</svg>
	)
}
