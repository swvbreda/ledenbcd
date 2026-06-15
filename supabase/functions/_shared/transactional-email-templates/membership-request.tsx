/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  full_name?: string
  email?: string
  coffeeshop_name?: string
  city?: string
  phone?: string
  message?: string
}

const Row = ({ label, value }: { label: string; value?: string }) => (
  value ? (
    <Text style={text}>
      <strong>{label}: </strong>{value}
    </Text>
  ) : null
)

const MembershipRequestEmail = ({ full_name, email, coffeeshop_name, city, phone, message }: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Nieuwe aanmelding: {coffeeshop_name || full_name || 'lid'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nieuwe aanmelding via coffeeshopbond.nl</Heading>
        <Text style={text}>Er is zojuist een nieuwe aanmelding binnengekomen via de publieke website.</Text>
        <Section style={card}>
          <Row label="Naam" value={full_name} />
          <Row label="Coffeeshop" value={coffeeshop_name} />
          <Row label="Plaats" value={city} />
          <Row label="E-mail" value={email} />
          <Row label="Telefoon" value={phone} />
          {message ? (
            <Text style={text}>
              <strong>Bericht:</strong><br />{message}
            </Text>
          ) : null}
        </Section>
        <Text style={text}>Bekijk en verwerk de aanmelding via Goedkeuringen in het ledenportaal.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MembershipRequestEmail,
  subject: (data: Record<string, any>) =>
    `Nieuwe aanmelding: ${data.coffeeshop_name || data.full_name || 'onbekend'}`,
  displayName: 'Nieuwe aanmelding (intern)',
  previewData: {
    full_name: 'Jan Jansen',
    email: 'jan@voorbeeldshop.nl',
    coffeeshop_name: 'Voorbeeldshop',
    city: 'Amsterdam',
    phone: '0612345678',
    message: 'Graag info over lidmaatschap.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#A31621', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 12px' }
const card = { backgroundColor: '#f8f8f8', borderLeft: '3px solid #A31621', padding: '16px 20px', margin: '16px 0' }