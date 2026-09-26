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
import { template as memberWelcomeSteps } from './member-welcome-steps.tsx'
import { template as membershipRequest } from './membership-request.tsx'
import { template as agendaRegistrationConfirmation } from './agenda-registration-confirmation.tsx'
import { template as agendaEventAnnouncement } from './agenda-event-announcement.tsx'
import { template as agendaEventCancelled } from './agenda-event-cancelled.tsx'
import { template as agendaNewRegistrationAdmin } from './agenda-new-registration-admin.tsx'
import { template as agendaGuestDeclined } from './agenda-guest-declined.tsx'
import { template as loginReminder } from './login-reminder.tsx'
import { template as externInvite } from './extern-invite.tsx'
import { template as contactDetailsChanged } from './contact-details-changed.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'member-welcome': memberWelcome,
  'member-welcome-steps': memberWelcomeSteps,
  'membership-request': membershipRequest,
  'agenda-registration-confirmation': agendaRegistrationConfirmation,
  'agenda-event-announcement': agendaEventAnnouncement,
  'agenda-event-cancelled': agendaEventCancelled,
  'agenda-new-registration-admin': agendaNewRegistrationAdmin,
  'agenda-guest-declined': agendaGuestDeclined,
  'login-reminder': loginReminder,
  'extern-invite': externInvite,
  'contact-details-changed': contactDetailsChanged,
}