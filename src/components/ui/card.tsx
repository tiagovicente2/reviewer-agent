'use client'
import { ark } from '@ark-ui/react/factory'
import { createStyleContext } from 'styled-system/jsx'
import { card } from 'styled-system/recipes'

const { withProvider, withContext } = createStyleContext(card)

export const Card = {
	Root: withProvider(ark.div, 'root'),
	Header: withContext(ark.div, 'header'),
	Body: withContext(ark.div, 'body'),
	Footer: withContext(ark.h3, 'footer'),
	Title: withContext(ark.h3, 'title'),
	Description: withContext(ark.div, 'description'),
}
