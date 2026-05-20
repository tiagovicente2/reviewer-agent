import type { ReactNode } from 'react'
import { Box, Grid, HStack, Stack } from 'styled-system/jsx'
import type { AsyncState } from '@/app/types'
import { Code } from '@/components/common'
import { Badge, Button, Card } from '@/components/ui'
import type { GitHubAuthStatus } from '@/shared/github'
import type { AgentAvailability } from '@/shared/settings'

export function OnboardingPage({
	agentAvailability,
	agentsState,
	authState,
	connectState,
	loginOutput,
	onComplete,
	onConnect,
	onOpenSettings,
	onRefresh,
	status,
}: {
	agentAvailability: AgentAvailability[]
	agentsState: AsyncState
	authState: AsyncState
	connectState: AsyncState
	loginOutput: string
	onComplete: () => void
	onConnect: () => void
	onOpenSettings: () => void
	onRefresh: () => void
	status: GitHubAuthStatus
}) {
	const ghReady = status.ghInstalled
	const primaryAction = status.authenticated ? onComplete : ghReady ? onConnect : onRefresh
	const primaryLabel = status.authenticated
		? 'Next: Open review inbox'
		: ghReady
			? 'Next: Connect GitHub'
			: 'Recheck GitHub CLI'

	return (
		<Grid h="100%" minH="0" overflowY="auto" placeItems="center" p="6">
			<Card.Root maxW="760px" w="full">
				<Card.Header>
					<Badge colorPalette="cyan" size="lg" width="fit-content">
						Onboarding
					</Badge>
					<Card.Title>Set up Reviewer Agent</Card.Title>
					<Card.Description>
						Finish these quick checks, then click next when you are ready to open your requested
						GitHub pull requests.
					</Card.Description>
				</Card.Header>

				<Card.Body>
					<Stack gap="4">
						<GitHubCliStep authState={authState} status={status} />
						<AgentStep agents={agentAvailability} agentsState={agentsState} />
						<ReviewerInstructionsStep onOpenSettings={onOpenSettings} />
						<PreferencesStep onOpenSettings={onOpenSettings} />
						<ConnectStep status={status} />
						<LoginOutput output={loginOutput} />
					</Stack>
				</Card.Body>

				<Card.Footer>
					<Button variant="outline" onClick={onRefresh} loading={authState === 'loading'}>
						Recheck
					</Button>
					<Button
						loading={connectState === 'loading' || authState === 'loading'}
						onClick={primaryAction}
					>
						{primaryLabel}
					</Button>
				</Card.Footer>
			</Card.Root>
		</Grid>
	)
}

function GitHubCliStep({ authState, status }: { authState: AsyncState; status: GitHubAuthStatus }) {
	const message = getGitHubCliMessage({ authState, status })

	return (
		<OnboardingStep
			badge={status.ghInstalled ? 'Installed' : 'Missing'}
			badgeTone={status.ghInstalled ? 'green' : 'red'}
			index="1"
			title="Check GitHub CLI"
		>
			<Box color="fg.muted" textStyle="sm">
				{message}
			</Box>
		</OnboardingStep>
	)
}

function AgentStep({
	agents,
	agentsState,
}: {
	agents: AgentAvailability[]
	agentsState: AsyncState
}) {
	const readyCount = agents.filter((agent) => agent.ready).length
	return (
		<OnboardingStep
			badge={agentsState === 'loading' ? 'Checking' : readyCount > 0 ? `${readyCount} ready` : 'Needs setup'}
			badgeTone={readyCount > 0 ? 'green' : agentsState === 'loading' ? 'cyan' : 'red'}
			index="2"
			title="Check review agents"
		>
			<Stack gap="2">
				<Box color="fg.muted" textStyle="sm">
					At least one local review agent must be installed and authenticated before generating drafts.
				</Box>
				{agents.map((agent) => (
					<HStack key={agent.agent} justify="space-between" gap="3" textStyle="sm">
						<Box fontWeight="medium">{agent.label}</Box>
						<Badge colorPalette={agent.ready ? 'green' : agent.installed ? 'cyan' : 'red'}>
							{agent.ready ? 'Ready' : agent.installed ? 'Needs login' : 'Missing'}
						</Badge>
					</HStack>
				))}
				{agents.find((agent) => !agent.ready)?.message ? (
					<Box color="fg.muted" textStyle="xs">
						{agents.find((agent) => !agent.ready)?.message}
					</Box>
				) : null}
			</Stack>
		</OnboardingStep>
	)
}

function ReviewerInstructionsStep({ onOpenSettings }: { onOpenSettings: () => void }) {
	return (
		<OnboardingStep badge="Recommended" badgeTone="cyan" index="3" title="Add reviewer instructions">
			<Stack gap="3">
				<Box color="fg.muted" textStyle="sm">
					Tell the reviewer how to review your PRs: preferred language, severity style, project
					standards, comment format, and anything it should always check or avoid. You can paste an
					existing review prompt in settings.
				</Box>
				<Button alignSelf="flex-start" size="sm" variant="outline" onClick={onOpenSettings}>
					Add reviewer instructions
				</Button>
			</Stack>
		</OnboardingStep>
	)
}

function PreferencesStep({ onOpenSettings }: { onOpenSettings: () => void }) {
	return (
		<OnboardingStep badge="Optional" badgeTone="gray" index="4" title="Review preferences">
			<Stack gap="3">
				<Box color="fg.muted" textStyle="sm">
					Choose the theme, review language, and default review agent/model used for generated drafts.
				</Box>
				<Button alignSelf="flex-start" size="sm" variant="outline" onClick={onOpenSettings}>
					Open settings
				</Button>
			</Stack>
		</OnboardingStep>
	)
}

function ConnectStep({ status }: { status: GitHubAuthStatus }) {
	return (
		<OnboardingStep
			badge={status.authenticated ? 'Authenticated' : 'Not connected'}
			badgeTone={status.authenticated ? 'green' : 'cyan'}
			index="5"
			title="Authenticate GitHub"
		>
			<Box color="fg.muted" textStyle="sm">
				{status.authenticated ? (
					`Authenticated${status.username ? ` as @${status.username}` : ''}. Click next when you are ready to open the review inbox.`
				) : (
					<>
						When ready, the next step runs <Code>gh auth login --web</Code>. GitHub opens in your
						browser, then the app waits here until you choose to continue.
					</>
				)}
			</Box>
		</OnboardingStep>
	)
}

function LoginOutput({ output }: { output: string }) {
	if (!output) {
		return null
	}

	return (
		<Box as="pre" bg="gray.2" borderRadius="l2" overflowX="auto" p="4" textStyle="xs">
			<code>{output}</code>
		</Box>
	)
}

function OnboardingStep({
	badge,
	badgeTone,
	children,
	index,
	title,
}: {
	badge: string
	badgeTone: 'cyan' | 'gray' | 'green' | 'red'
	children: ReactNode
	index: string
	title: string
}) {
	return (
		<Box bg="gray.2" borderRadius="l2" p="4">
			<HStack alignItems="flex-start" gap="3">
				<Box
					bg="gray.3"
					borderRadius="full"
					color="fg.muted"
					flexShrink="0"
					fontWeight="bold"
					h="7"
					pt="1"
					textAlign="center"
					textStyle="sm"
					w="7"
				>
					{index}
				</Box>
				<Stack gap="2" flex="1" minW="0">
					<HStack justify="space-between" gap="3">
						<Box fontWeight="semibold">{title}</Box>
						<Badge colorPalette={badgeTone}>{badge}</Badge>
					</HStack>
					{children}
				</Stack>
			</HStack>
		</Box>
	)
}

function getGitHubCliMessage({
	authState,
	status,
}: {
	authState: AsyncState
	status: GitHubAuthStatus
}) {
	if (authState === 'loading') {
		return 'Checking GitHub CLI...'
	}

	if (status.error || status.message) {
		return status.error || status.message
	}

	return status.ghInstalled
		? 'GitHub CLI is installed and available on your PATH.'
		: 'Install GitHub CLI first, then come back and recheck.'
}
