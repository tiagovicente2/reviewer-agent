import { HStack } from 'styled-system/jsx'
import { Button } from '@/components/ui'

export function ReviewTabActions({
	approveDisabled,
	approveReason,
	approving,
	canExportReview,
	exporting,
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
	onApprove: () => void
	onCopy: () => void
	onExport: () => void
	onRequestChanges: () => void
	requestChangesDisabled: boolean
	requestChangesReason: string
	requestingChanges: boolean
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
				disabled={approveDisabled}
				loading={approving}
				onClick={onApprove}
				size="sm"
				title={approveReason || undefined}
				variant="outline"
			>
				Approve
			</Button>
			<Button
				disabled={requestChangesDisabled}
				loading={requestingChanges}
				onClick={onRequestChanges}
				size="sm"
				title={requestChangesReason || undefined}
			>
				Request changes
			</Button>
		</HStack>
	)
}
