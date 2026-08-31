/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  organisatie?: string
  contactpersoon?: string
  email?: string
  wachtwoord?: string
  loginUrl?: string
}

const ExternInviteEmail = ({ organisatie, contactpersoon, email, wachtwoord, loginUrl }: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Uw toegang tot het ledenportaal van de BCD</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Uitnodiging voor het BCD-portaal</Heading>
        <Text style={text}>Beste {contactpersoon || 'relatie'},</Text>
        <Text style={text}>
          De Bond van Cannabis Detaillisten nodigt {organisatie || 'uw organisatie'} uit om een account te
          gebruiken in het ledenportaal. Daarmee kunt u uw aanbod voor leden beheren en uw
          organisatiegegevens bijhouden.
        </Text>

        <Section style={box}>
          <Text style={label}>Inloggegevens</Text>
          <Text style={mono}>E-mailadres: {email}</Text>
          <Text style={mono}>Tijdelijk wachtwoord: {wachtwoord}</Text>
        </Section>

        <Text style={text}>
          Log in via onderstaande knop en wijzig daarna direct uw wachtwoord via uw profiel.
        </Text>

        <Button style={button} href={loginUrl}>
          Inloggen
        </Button>

        <Hr style={hr} />
        <Text style={footer}>
          Vragen? Beantwoord deze e-mail, dan helpt het bestuur u verder.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ExternInviteEmail,
  subject: (data: Record<string, any>) =>
    `Uitnodiging: account voor ${data.organisatie || 'uw organisatie'} in het BCD-portaal`,
  displayName: 'Uitnodiging externe partij',
  previewData: {
    organisatie: 'Voorbeeld Leverancier B.V.',
    contactpersoon: 'Jan Jansen',
    email: 'contact@voorbeeld.nl',
    wachtwoord: 'Tijdelijk-Wachtwoord-1234',
    loginUrl: 'https://leden.coffeeshopbond.nl/extern-login',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#A31621', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const box = { border: '1px solid #e5e5e5', borderRadius: '8px', padding: '12px 16px', margin: '0 0 16px' }
const label = { fontSize: '12px', color: '#666666', margin: '0 0 8px', textTransform: 'uppercase' as const }
const mono = { fontSize: '14px', color: '#111111', margin: '0 0 4px', fontFamily: 'monospace' }
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
const hr = { borderColor: '#e5e5e5', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#888888', lineHeight: '1.5', margin: '0' }
