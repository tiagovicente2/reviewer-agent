import { useCallback, useEffect, useState } from 'react'
import { Box } from 'styled-system/jsx'
import { useAgentAvailability } from '@/app/hooks/useAgentAvailability'
import { useColorMode } from '@/app/hooks/useColorMode'
import { useErrorLog } from '@/app/hooks/useErrorLog'
import { usePullRequestDetails } from '@/app/hooks/usePullRequestDetails'
import { isPullRequestQuery, useReviewRequests } from '@/app/hooks/useReviewRequests'
import { useReviewSearchFilter } from '@/app/hooks/useReviewSearchFilter'
import { useUpdateStatus } from '@/app/hooks/useUpdateStatus'
import { OnboardingPage } from '@/features/auth/components/OnboardingPage'
import { OpeningScreen } from '@/features/auth/components/OpeningScreen'
import { ErrorLogPage } from '@/features/errors/components/ErrorLogPage'
import { SettingsPage } from '@/features/settings/components/SettingsPage'
import type { GitHubAuthStatus } from '@/shared/github'
import type { AppSettings } from '@/shared/settings'
import { MainReviewScreen } from './MainReviewScreen'
import { appRpc } from './rpc'
import type { AsyncState } from './types'

const emptyAuthStatus: GitHubAuthStatus = {
	ghInstalled: false,
	authenticated: false,
	message: 'Checking GitHub CLI status...',
}

function App() {
	const [showSettings, setShowSettings] = useState(false)
	const [showErrorLog, setShowErrorLog] = useState(false)
	const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null)
	const [settingsState, setSettingsState] = useState<AsyncState>('loading')
	const [startupError, setStartupError] = useState('')
	const [authStatus, setAuthStatus] = useState<GitHubAuthStatus | null>(null)
	const [authState, setAuthState] = useState<AsyncState>('loading')
	const [connectState, setConnectState] = useState<AsyncState>('idle')
	const [loginOutput, setLoginOutput] = useState('')
	const [query, setQuery] = useState('')
	const [, setSummary] = useState('')

	const { colorMode, setPreference: setColorModePreference } = useColorMode()
	const openErrorLog = useCallback(() => {
		setShowSettings(false)
		setShowErrorLog(true)
	}, [])
	const { clearErrors, dismissError, errors: errorLogs, logError } = useErrorLog(openErrorLog)

	const { agentAvailability, agentsState, refreshAgents } = useAgentAvailability()
	const { updateStatus } = useUpdateStatus()
	const {
		activeSearchQuery,
		loadReviewRequests,
		reviewPullRequest,
		reviewPrState,
		reviews,
		reviewsState,
		searchActive,
		searchMode,
		searchPullRequests,
		selectedReview,
		selectedReviewId,
		setSearchMode,
		setSelectedReviewId,
	} = useReviewRequests({ logError })

	const loadSettings = useCallback(async () => {
		setSettingsState('loading')
		setStartupError('')
		try {
			const settings = await appRpc.request.getAppSettings()
			setColorModePreference(settings.colorMode)
			setOnboardingComplete(settings.onboardingComplete)
			setSettingsState('idle')
		} catch (error) {
			setStartupError(logError('Could not load app settings', error, 'Startup'))
			setSettingsState('error')
		}
	}, [logError, setColorModePreference])

	useEffect(() => {
		void loadSettings()
	}, [loadSettings])

	const handleSettingsSaved = (settings: AppSettings) => {
		setColorModePreference(settings.colorMode)
		setOnboardingComplete(settings.onboardingComplete)
		setSettingsState('idle')
		setStartupError('')
	}

	const completeOnboarding = async () => {
		const settings = await appRpc.request.completeOnboarding()
		setOnboardingComplete(settings.onboardingComplete)
	}

	const refreshAuth = useCallback(async () => {
		setAuthState('loading')
		setStartupError('')
		try {
			const status = await appRpc.request.getGitHubAuthStatus()
			setAuthStatus(status)
			setAuthState('idle')

			if (status.authenticated) {
				const loaded = await loadReviewRequests()
				if (!loaded) {
					setStartupError('Could not load review requests. Try again or check GitHub access.')
				}
			}
		} catch (error) {
			const message = logError('Could not check GitHub auth', error, 'Startup')
			setAuthStatus({
				ghInstalled: false,
				authenticated: false,
				error: message,
			})
			setStartupError(message)
			setAuthState('error')
		}
	}, [loadReviewRequests, logError])

	useEffect(() => {
		void refreshAuth()
		void refreshAgents()
	}, [refreshAuth, refreshAgents])

	const displayedReviews = useReviewSearchFilter(query, reviews)

	const resetSummary = useCallback(() => setSummary(''), [])
	const { detail, detailError, detailState } = usePullRequestDetails({
		logError,
		onResetSummary: resetSummary,
		review: selectedReview,
	})

	const canReviewPrQuery = isPullRequestQuery(query)

	const handleSearch = () => {
		void searchPullRequests(query)
	}

	const handleClearSearch = () => {
		setQuery('')
		void loadReviewRequests()
	}

	const handleReviewPr = async () => {
		const reviewed = await reviewPullRequest(query)
		if (reviewed) setQuery('')
	}

	const handleConnect = async () => {
		void refreshAgents()
		setConnectState('loading')
		setLoginOutput('')

		try {
			const result = await appRpc.request.startGitHubLogin()
			setAuthStatus(result.status)
			setLoginOutput(result.output)
			setConnectState(result.ok ? 'idle' : 'error')

			if (result.status.authenticated) {
				const loaded = await loadReviewRequests()
				if (!loaded) {
					setStartupError('Could not load review requests. Try again or check GitHub access.')
				}
			}
		} catch (error) {
			setLoginOutput(logError('Could not connect GitHub', error, 'GitHub login'))
			setConnectState('error')
		}
	}

	const handleRefreshSetup = () => {
		void loadSettings()
		void refreshAuth()
		void refreshAgents()
	}

	const currentAuthStatus = authStatus ?? emptyAuthStatus
	const setupLoading = settingsState === 'loading' || authState === 'loading'
	const setupError =
		startupError || (settingsState === 'error' ? 'Could not load app settings.' : '')
	const shouldShowOpeningScreen =
		!showErrorLog &&
		!showSettings &&
		(setupLoading || Boolean(setupError)) &&
		(onboardingComplete === null || onboardingComplete)

	return (
		<Box
			className={colorMode}
			h="100vh"
			minH="0"
			overflow="hidden"
			bg="gray.1"
			color="fg.default"
			colorPalette="cyan"
		>
			{shouldShowOpeningScreen ? (
				<OpeningScreen
					error={setupError}
					onOpenSettings={() => setShowSettings(true)}
					onRetry={handleRefreshSetup}
				/>
			) : showErrorLog ? (
				<ErrorLogPage
					errors={errorLogs}
					onBack={() => setShowErrorLog(false)}
					onClear={clearErrors}
					onDismiss={dismissError}
				/>
			) : showSettings ? (
				<SettingsPage
					onBack={() => setShowSettings(false)}
					onOpenErrorLog={() => {
						setShowSettings(false)
						setShowErrorLog(true)
					}}
					onSaved={handleSettingsSaved}
				/>
			) : !currentAuthStatus.authenticated || !onboardingComplete ? (
				<OnboardingPage
					agentAvailability={agentAvailability}
					agentsState={agentsState}
					authState={authState}
					connectState={connectState}
					loginOutput={loginOutput}
					onConnect={handleConnect}
					onComplete={completeOnboarding}
					onOpenSettings={() => setShowSettings(true)}
					onRefresh={handleRefreshSetup}
					status={currentAuthStatus}
				/>
			) : (
				<MainReviewScreen
					activeSearchQuery={activeSearchQuery}
					canReviewPrQuery={canReviewPrQuery}
					colorMode={colorMode}
					currentAuthStatus={currentAuthStatus}
					detail={detail}
					detailError={detailError}
					detailState={detailState}
					displayedReviews={displayedReviews}
					loadReviewRequests={loadReviewRequests}
					onClearSearch={handleClearSearch}
					onOpenSettings={() => setShowSettings(true)}
					onReviewPr={handleReviewPr}
					onSearch={handleSearch}
					query={query}
					reviewPrState={reviewPrState}
					reviewsState={reviewsState}
					searchActive={searchActive}
					searchMode={searchMode}
					selectedReview={selectedReview}
					selectedReviewId={selectedReviewId}
					setQuery={setQuery}
					setSearchMode={setSearchMode}
					setSelectedReviewId={setSelectedReviewId}
					setSummary={setSummary}
					updateStatus={updateStatus}
				/>
			)}
		</Box>
	)
}

export default App
