/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as memberWelcome } from './member-welcome.tsx'
import { template as membershipRequest } from './membership-request.tsx'
import { template as agendaRegistrationConfirmation } from './agenda-registration-confirmation.tsx'
import { template as loginReminder } from './login-reminder.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'member-welcome': memberWelcome,
  'membership-request': membershipRequest,
  'agenda-registration-confirmation': agendaRegistrationConfirmation,
  'login-reminder': loginReminder,
}