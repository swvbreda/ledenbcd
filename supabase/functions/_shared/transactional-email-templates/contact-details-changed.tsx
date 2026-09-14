/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Change {
  label?: string
  oud?: string
  nieuw?: string
}

interface Props {
  siteName?: string
  memberName?: string
  changes?: Change[]
  changedAt?: string
  pending?: boolean
  loginUrl?: string
}

const Row = ({ change }: { change: Change }) => (
  <Text style={rowStyle}>
    <span style={labelStyle}>{change.label || 'Gegeven'}</span>
    <span>
      {change.oud?.trim() ? <span style={oldStyle}>{change.oud}</span> : <span style={oldStyle}>leeg</span>}
      {' → '}
      <strong>{change.nieuw?.trim() || 'leeg'}</strong>
    </span>
  </Text>
)

const ContactDetailsChanged = ({
  siteName = 'Bond van Cannabisdetaillisten (BCD)',
  memberName,
  changes = [],
  changedAt,
  pending,
  loginUrl = 'https://leden.coffeeshopbond.nl',
}: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Je contactgegevens zijn gewijzigd</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Contactgegevens gewijzigd</Heading>
        <Text style={text}>
          {(memberName || '').trim() ? `Beste ${String(memberName).trim()},` : 'Beste lid,'}
        </Text>
        <Text style={text}>
          De volgende gegevens zijn zojuist gewijzigd in het ledenportaal.
        </Text>

        <Section style={card}>
          {changes.map((c, i) => (
            <Row key={i} change={c} />
          ))}
          {changedAt ? (
            <Text style={rowStyle}>
              <span style={labelStyle}>Gewijzigd op</span>
              <span>{changedAt}</span>
            </Text>
          ) : null}
        </Section>

        {pending ? (
          <Text style={text}>
            De wijziging wordt nog gecontroleerd door het secretariaat en is pas daarna
            in je ledenprofiel zichtbaar.
          </Text>
        ) : null}

        <Button href={loginUrl} style={button}>
          Naar het ledenportaal
        </Button>

        <Hr style={hr} />
        <Text style={footer}>
          Niet zelf gedaan? Neem contact op met het secretariaat.
          <br />
          {siteName}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactDetailsChanged,
  subject: 'Je contactgegevens zijn gewijzigd',
  displayName: 'Contactgegevens gewijzigd',
  previewData: {
    memberName: 'Sander Roos',
    changes: [
      { label: 'E-mailadres', oud: 'oud@example.nl', nieuw: 'nieuw@example.nl' },
      { label: 'Telefoonnummer', oud: '020 123 4567', nieuw: '020 765 4321' },
    ],
    changedAt: 'maandag 14 september 2026 om 11:21',
    pending: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#A31621',
  textTransform: 'uppercase' as const,
  margin: '0 0 18px',
}
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const card = {
  border: '1px solid #e5e5e5',
  borderLeft: '4px solid #A31621',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '0 0 20px',
}
const rowStyle = { fontSize: '14px', color: '#333333', margin: '0 0 6px', lineHeight: '1.5' }
const labelStyle = { display: 'inline-block', width: '140px', color: '#6b7280' }
const oldStyle = { color: '#6b7280', textDecoration: 'line-through' }
const button = {
  backgroundColor: '#A31621',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold',
  padding: '12px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e5e5e5', margin: '24px 0 14px' }
const footer = { fontSize: '12px', color: '#6b7280', lineHeight: '1.6', margin: '0' }
