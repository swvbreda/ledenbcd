import * as React from 'npm:react@18.3.1'
import { Html, Head, Preview, Body, Container, Text, Button } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { reconfirmationParagraphs, RECONFIRMATION_BUTTON, RECONFIRMATION_SUBJECT } from '../memberReconfirmationPolicy.ts'

interface Props { contactName: string; invoiceNumber: string; shop: string; confirmationUrl: string }
const MembershipReconfirmation = ({ contactName, invoiceNumber, shop, confirmationUrl }: Props) => {
  const paragraphs = reconfirmationParagraphs(contactName, invoiceNumber, shop)
  return <Html lang="nl"><Head /><Preview>{RECONFIRMATION_SUBJECT}</Preview><Body style={{ backgroundColor: '#ffffff', fontFamily: 'Barlow, Helvetica, Arial, sans-serif' }}><Container style={{ maxWidth: '600px', padding: '28px' }}>
    {paragraphs.map((p, index) => <React.Fragment key={index}><Text style={{ color: '#333333', fontSize: '15px', lineHeight: '1.65', whiteSpace: 'pre-line' }}>{p}</Text>{index === 2 && <Button href={confirmationUrl} style={{ backgroundColor: '#e01b1b', color: '#ffffff', padding: '14px 24px', borderRadius: '6px', fontWeight: 'bold' }}>{RECONFIRMATION_BUTTON}</Button>}</React.Fragment>)}
  </Container></Body></Html>
}
export const template = { component: MembershipReconfirmation, subject: RECONFIRMATION_SUBJECT, displayName: 'Lidmaatschapsbevestiging contributie 2026' } satisfies TemplateEntry