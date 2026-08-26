/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  subject?: string
  body?: string
  portalUrl?: string
}

const STEPS: string[] = [
  'Ga naar leden.coffeeshopbond.nl',
  'Heb je nog geen account? Klik onderaan op "Nog geen account? Registreren"',
  'Gebruik exact het e-mailadres waarop je deze mail hebt ontvangen',
  'Kies zelf een wachtwoord van minimaal 8 tekens',
  'Bevestig de beveiligingscode die je per e-mail ontvangt (tweestapsverificatie is verplicht)',
  'Controleer daarna je gegevens: contactpersoon, adres, locaties en factuurgegevens. Wijzigingen dien je in ter goedkeuring bij het bestuur',
]

const LoginReminderEmail = ({ subject, body, portalUrl }: Props) => {
  const url = portalUrl || 'https://leden.coffeeshopbond.nl'
  const paragraphs = (body || '').split(/\n{2,}/).filter((p) => p.trim().length > 0)
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Preview>{subject || 'Log in op het ledenportaal en controleer je gegevens'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={bar}>
            <Text style={brand}>BOND VAN CANNABIS DETAILLISTEN</Text>
          </Section>

          <Heading style={h1}>{subject || 'Controleer je gegevens in het ledenportaal'}</Heading>

          {paragraphs.map((p, i) => (
            <Text key={i} style={text}>
              {p.split('\n').map((line, j) => (
                <React.Fragment key={j}>
                  {line}
                  {j < p.split('\n').length - 1 ? <br /> : null}
                </React.Fragment>
              ))}
            </Text>
          ))}

          <Section style={{ margin: '24px 0' }}>
            <Button href={url} style={button}>
              Inloggen op het ledenportaal
            </Button>
          </Section>

          <Section style={card}>
            <Text style={cardTitle}>Zo log je in</Text>
            {STEPS.map((s, i) => (
              <Text key={i} style={step}>
                <span style={stepNum}>{i + 1}.</span> {s}
              </Text>
            ))}
          </Section>

          <Hr style={hr} />

          <Text style={help}>
            <strong>Lukt het niet?</strong> Mail naar{' '}
            <Link href="mailto:info@coffeeshopbond.nl" style={link}>
              info@coffeeshopbond.nl
            </Link>{' '}
            met je naam en coffeeshop, dan helpen wij je verder met het aanmaken van je account.
          </Text>

          <Text style={footer}>
            Bond van Cannabis Detaillisten &middot; lokaal verenigd, landelijk vertegenwoordigd
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: LoginReminderEmail,
  subject: (data: Record<string, any>) =>
    data.subject || 'Log in op het ledenportaal en controleer je gegevens',
  displayName: 'Herinnering: inloggen en gegevens controleren',
  previewData: {
    subject: 'Controleer je gegevens in het ledenportaal',
    body:
      'Beste contactpersoon,\n\nEerder ontving je van ons een uitnodiging voor het ledenportaal van de BCD. Wij zien dat er voor Coffeeshop Voorbeeld in Amsterdam nog geen account is aangemaakt.\n\nWil je inloggen en je gegevens controleren? Zo weten wij zeker dat wij jouw shop juist vertegenwoordigen.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Barlow, Helvetica, Arial, sans-serif' }
const container = { padding: '0 0 28px', maxWidth: '600px' }
const bar = { backgroundColor: '#e01b1b', padding: '16px 28px', borderRadius: '6px 6px 0 0' }
const brand = {
  margin: '0',
  color: '#ffffff',
  fontSize: '13px',
  letterSpacing: '1px',
  fontWeight: 'bold' as const,
  fontFamily: 'Archivo Black, Helvetica, Arial, sans-serif',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1a1a1a',
  margin: '28px 28px 16px',
  lineHeight: '1.3',
  fontFamily: 'Archivo Black, Helvetica, Arial, sans-serif',
}
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.65', margin: '0 28px 16px' }
const button = {
  backgroundColor: '#e01b1b',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  padding: '14px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '0 28px',
}
const card = {
  margin: '0 28px',
  border: '2px solid rgba(224, 27, 27, 0.5)',
  borderRadius: '8px',
  padding: '16px 18px',
  backgroundColor: '#fdf6f6',
}
const cardTitle = {
  margin: '0 0 12px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  color: '#a31621',
}
const step = { margin: '0 0 10px', fontSize: '14px', color: '#333333', lineHeight: '1.55' }
const stepNum = { fontWeight: 'bold' as const, color: '#e01b1b' }
const hr = { borderColor: '#eeeeee', margin: '24px 28px' }
const help = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 28px 20px' }
const link = { color: '#a31621' }
const footer = { fontSize: '12px', color: '#888888', margin: '0 28px' }
