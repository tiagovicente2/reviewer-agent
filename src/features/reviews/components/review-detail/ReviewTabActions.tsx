import { HStack } from 'styled-system/jsx'
import { Button } from '@/components/ui'
import { getPrimaryReviewAction } from '../editableFindingUtils'

export function ReviewTabActions({
	approveDisabled,
	approveReason,
	approving,
	canExportReview,
	exporting,
	hasPublishableFindings,
	onApprove,
	onCopy,
	onExport,
	onRequestChanges,
	requestChangesDisabled,
	requestChangesReason,
	requestingChanges,
}: {
	approveDisabled: boolean
	approveReason: string
	approving: boolean
	canExportReview: boolean
	exporting: boolean
	hasPublishableFindings: boolean
	onApprove: () => void
	onCopy: () => void
	onExport: () => void
	onRequestChanges: () => void
	requestChangesDisabled: boolean
	requestChangesReason: string
	requestingChanges: boolean
}) {
	const primaryAction = getPrimaryReviewAction(hasPublishableFindings)

	return (
		<HStack gap="2">
			<Button disabled={!canExportReview || exporting} onClick={onCopy} size="sm" variant="plain">
				Copy
			</Button>
			<Button
				disabled={!canExportReview}
				loading={exporting}
				onClick={onExport}
				size="sm"
				variant="outline"
			>
				Export
			</Button>
			<Button
				disabled={approveDisabled}
				loading={approving}
				onClick={onApprove}
				size="sm"
				title={approveReason || undefined}
				variant={primaryAction === 'approve' ? undefined : 'outline'}
			>
				Approve
			</Button>
			<Button
				disabled={requestChangesDisabled}
				loading={requestingChanges}
				onClick={onRequestChanges}
				size="sm"
				title={requestChangesReason || undefined}
				variant={primaryAction === 'request_changes' ? undefined : 'outline'}
			>
				Request changes
			</Button>
		</HStack>
	)
}
