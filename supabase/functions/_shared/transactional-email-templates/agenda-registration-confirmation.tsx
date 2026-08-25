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
  guests?: number | string
  attendeeNames?: string
  note?: string
  description?: string
  eventUrl?: string
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowStyle}>
    <span style={labelStyle}>{label}</span>
    <span>{value}</span>
  </Text>
)

const AgendaRegistrationConfirmation = ({
  siteName = 'Bond van Cannabisdetaillisten (BCD)',
  eventTitle = 'Agenda-item',
  eventDate,
  eventTime,
  location,
  guests,
  attendeeNames,
  note,
  description,
  eventUrl,
}: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>{`Aanmelding bevestigd: ${eventTitle}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Aanmelding bevestigd</Heading>
        <Text style={text}>
          Je aanmelding voor <strong>{eventTitle}</strong> is ontvangen. Hieronder vind je de
          gegevens.
        </Text>

        <Section style={card}>
          {eventDate ? <Row label="Datum" value={eventDate} /> : null}
          {eventTime ? <Row label="Tijd" value={eventTime} /> : null}
          {location ? <Row label="Locatie" value={location} /> : null}
          {guests ? <Row label="Aantal personen" value={String(guests)} /> : null}
          {note ? <Row label="Opmerking" value={note} /> : null}
        </Section>

        {description
          ? String(description)
              .split(/\n{2,}/)
              .map((p, i) => (
                <Text key={i} style={text}>
                  {p.split('\n').map((line, j, arr) => (
                    <React.Fragment key={j}>
                      {line}
                      {j < arr.length - 1 ? <br /> : null}
                    </React.Fragment>
                  ))}
                </Text>
              ))
          : null}

        {eventUrl ? (
          <Button href={eventUrl} style={button}>
            Bekijk in de agenda
          </Button>
        ) : null}

        <Hr style={hr} />
        <Text style={footer}>
          Kun je onverhoopt niet? Meld je dan af via de agenda in het ledenportaal.
          <br />
          {siteName}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AgendaRegistrationConfirmation,
  subject: (data: Record<string, any>) =>
    `Aanmelding bevestigd: ${data.eventTitle || 'agenda-item'}`,
  displayName: 'Bevestiging aanmelding agenda',
  previewData: {
    eventTitle: 'Open dag Tweede Kamer',
    eventDate: 'zaterdag 12 september 2026',
    eventTime: '11:00 – 16:00',
    location: 'Den Haag',
    guests: 2,
    note: 'Wij komen met twee personen',
    description: 'Op zaterdag 12 september opent de Tweede Kamer haar deuren voor publiek.',
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
const labelStyle = {
  display: 'inline-block',
  width: '140px',
  color: '#6b7280',
}
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
