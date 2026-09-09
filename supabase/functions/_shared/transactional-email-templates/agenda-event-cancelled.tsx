/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  siteName?: string
  eventTitle?: string
  eventDate?: string
  eventTime?: string
  location?: string
  reason?: string
  eventUrl?: string
  recipientName?: string
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowStyle}>
    <span style={labelStyle}>{label}</span>
    <span>{value}</span>
  </Text>
)

const AgendaEventCancelled = ({
  siteName = 'Bond van Cannabisdetaillisten (BCD)',
  eventTitle = 'Evenement',
  eventDate,
  eventTime,
  location,
  reason,
  eventUrl,
  recipientName,
}: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>{`Geannuleerd: ${eventTitle}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{`Geannuleerd: ${eventTitle}`}</Heading>
        <Text style={text}>{recipientName ? `Beste ${recipientName},` : 'Beste leden,'}</Text>
        <Text style={text}>
          Het onderstaande agenda-item gaat helaas niet door. Je aanmelding komt hiermee te
          vervallen.
        </Text>

        <Section style={card}>
          {eventDate ? <Row label="Datum" value={eventDate} /> : null}
          {eventTime ? <Row label="Tijd" value={eventTime} /> : null}
          {location ? <Row label="Locatie" value={location} /> : null}
          {reason ? <Row label="Reden" value={reason} /> : null}
        </Section>

        {eventUrl ? (
          <Button href={eventUrl} style={button}>
            Bekijk de agenda
          </Button>
        ) : null}

        <Hr style={hr} />
        <Text style={footer}>
          Onze excuses voor het ongemak.
          <br />
          {siteName}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AgendaEventCancelled,
  subject: (data: Record<string, any>) => `Geannuleerd: ${data.eventTitle || 'evenement'}`,
  displayName: 'Annulering evenement',
  previewData: {
    eventTitle: 'Ledenbijeenkomst najaar',
    eventDate: 'donderdag 8 oktober 2026',
    eventTime: '19:00 – 22:00',
    location: 'Utrecht',
    reason: 'Te weinig aanmeldingen',
    eventUrl: 'https://leden.coffeeshopbond.nl/agenda',
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
const hr = { borderColor: '#e5e5e5', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#6b7280', lineHeight: '1.6' }
