/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  subject?: string
  message?: string
  eventTitle?: string
  recipientName?: string
}

// Alle tekst gaat als React-tekst (automatisch ge-escaped); geen HTML uit invoer.
const Email = ({ message, eventTitle, recipientName }: Props) => {
  const body = (message ?? '').trim()
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Preview>{eventTitle ? `Bericht over ${eventTitle}` : 'Bericht over de bijeenkomst'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{eventTitle || 'Bijeenkomst'}</Heading>
          {recipientName ? <Text style={text}>Beste {recipientName},</Text> : null}
          {body.split(/\n{2,}/).map((p, i) => (
            <Text key={i} style={text}>
              {p}
            </Text>
          ))}
          <Text style={muted}>
            Je ontvangt dit bericht omdat je bent aangemeld voor deze bijeenkomst van de Bond van Cannabis
            Detaillisten.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    String(d.subject || `Bericht over ${d.eventTitle || 'de bijeenkomst'}`)
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 200),
  displayName: 'Bericht aan evenementdeelnemers',
  previewData: {
    subject: 'Praktische informatie',
    message: 'De zaal is open vanaf 13.30 uur.\n\nTot dan!',
    eventTitle: 'Ledenvergadering',
    recipientName: 'Jan',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#A31621', textTransform: 'uppercase' as const, margin: '0 0 18px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px', whiteSpace: 'pre-line' as const }
const muted = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '24px 0 0' }
