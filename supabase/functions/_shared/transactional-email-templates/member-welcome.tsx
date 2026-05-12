/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  subject?: string
  body?: string
}

const MemberWelcomeEmail = ({ subject, body }: Props) => {
  const paragraphs = (body || '').split(/\n{2,}/)
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Preview>{subject || 'Welkom'}</Preview>
      <Body style={main}>
        <Container style={container}>
          {subject ? <Heading style={h1}>{subject}</Heading> : null}
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
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: MemberWelcomeEmail,
  subject: (data: Record<string, any>) => data.subject || 'Welkom',
  displayName: 'Welkomstmail lid/lead',
  previewData: {
    subject: 'Welkom bij de Bond van Cannabis Detaillisten',
    body: 'Beste contactpersoon,\n\nWelkom bij de BCD!\n\nMet vriendelijke groet,\nBestuur BCD',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#A31621', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }