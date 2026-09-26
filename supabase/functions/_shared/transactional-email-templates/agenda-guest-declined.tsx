/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  message?: string
  eventTitle?: string
}

const DEFAULT =
  'Beste,\n\nBedankt voor je aanmelding. Helaas is deze bijeenkomst alleen toegankelijk voor aangesloten coffeeshopondernemers van de Bond. Je aanmelding is daarom niet doorgegaan. Onze excuses voor het ongemak.\n\nMet vriendelijke groet,\nBond van Cannabis Detaillisten'

const Email = ({ message }: Props) => {
  const body = (message && message.trim()) || DEFAULT
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Preview>Over je aanmelding voor de bijeenkomst</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Je aanmelding</Heading>
          {body.split(/\n{2,}/).map((p, i) => (
            <Text key={i} style={text}>
              {p}
            </Text>
          ))}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Je aanmelding voor ${d.eventTitle || 'de bijeenkomst'}`,
  displayName: 'Aanmelding niet doorgegaan (gast)',
  previewData: { eventTitle: 'Experiment bijeenkomst' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#A31621', textTransform: 'uppercase' as const, margin: '0 0 18px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px', whiteSpace: 'pre-line' as const }
