import { HStack } from 'styled-system/jsx'
import { Button } from '@/components/ui'

export function ReviewTabActions({
	approving,
	canExportReview,
	exporting,
	hasPublishableFindings,
	onApprove,
	onCopy,
	onExport,
	onRequestChanges,
	requestingChanges,
	submissionDisabled,
}: {
	approving: boolean
	canExportReview: boolean
	exporting: boolean
	hasPublishableFindings: boolean
	onApprove: () => void
	onCopy: () => void
	onExport: () => void
	onRequestChanges: () => void
	requestingChanges: boolean
	submissionDisabled: boolean
}) {
	return (
		<HStack gap="2">
			<Button disabled={!canExportReview || exporting} onClick={onCopy} size="sm" variant="outline">
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
				disabled={submissionDisabled}
				loading={approving}
				onClick={onApprove}
				size="sm"
				variant="outline"
			>
				Approve
			</Button>
			{hasPublishableFindings ? (
				<Button
					disabled={submissionDisabled}
					loading={requestingChanges}
					onClick={onRequestChanges}
					size="sm"
				>
					Request changes
				</Button>
			) : null}
		</HStack>
	)
}
