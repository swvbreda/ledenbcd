/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  eventTitle?: string
  eventDate?: string
  shop?: string
  contactName?: string
  contactEmail?: string
  guests?: number | string
  isMember?: boolean
  note?: string
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowStyle}>
    <span style={labelStyle}>{label}</span>
    <span>{value}</span>
  </Text>
)

const Email = ({ eventTitle = 'Bijeenkomst', eventDate, shop, contactName, contactEmail, guests, isMember, note }: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>{`Nieuwe aanmelding: ${shop || contactName || 'onbekend'} voor ${eventTitle}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nieuwe aanmelding</Heading>
        <Text style={text}>{`Er is een nieuwe aanmelding binnengekomen voor ${eventTitle}.`}</Text>
        <Section style={card}>
          {eventDate ? <Row label="Datum" value={eventDate} /> : null}
          {shop ? <Row label="Shop" value={shop} /> : null}
          {contactName ? <Row label="Naam" value={contactName} /> : null}
          {contactEmail ? <Row label="E-mail" value={contactEmail} /> : null}
          {guests ? <Row label="Personen" value={String(guests)} /> : null}
          <Row label="Lid" value={isMember ? 'Ja' : 'Nee (gast)'} />
          {note ? <Row label="Opmerking" value={note} /> : null}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>Ledenportaal BCD</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Nieuwe aanmelding: ${d.shop || d.contactName || 'onbekend'} — ${d.eventTitle || 'bijeenkomst'}`,
  displayName: 'Nieuwe aanmelding (bestuur)',
  to: 'info@coffeeshopbond.nl',
  previewData: {
    eventTitle: 'Experiment bijeenkomst',
    eventDate: '2026-09-30',
    shop: 'Coffeeshop Mississippi',
    contactName: 'Jan Jansen',
    contactEmail: 'jan@voorbeeld.nl',
    guests: 2,
    isMember: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#A31621', textTransform: 'uppercase' as const, margin: '0 0 18px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const card = { border: '1px solid #e5e5e5', borderLeft: '4px solid #A31621', borderRadius: '6px', padding: '14px 16px', margin: '0 0 20px' }
const rowStyle = { fontSize: '14px', color: '#333333', margin: '0 0 6px', lineHeight: '1.5' }
const labelStyle = { display: 'inline-block', width: '140px', color: '#6b7280' }
const hr = { borderColor: '#e5e5e5', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#6b7280', lineHeight: '1.6' }
