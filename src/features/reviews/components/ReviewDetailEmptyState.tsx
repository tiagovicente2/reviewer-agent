import { Grid } from 'styled-system/jsx'
import { StatusCard } from '@/components/common'

export function ReviewDetailEmptyState() {
	return (
		<Grid h="100%" minH="0" overflowY="auto" placeItems="center" p="8">
			<StatusCard
				title="Select a pull request"
				body="Your GitHub review requests will appear in the inbox."
			/>
		</Grid>
	)
}
