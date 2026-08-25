export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agenda_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          is_published: boolean
          location: string | null
          max_seats: number | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string
          id?: string
          is_published?: boolean
          location?: string | null
          max_seats?: number | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_published?: boolean
          location?: string | null
          max_seats?: number | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      agenda_registrations: {
        Row: {
          created_at: string
          event_id: string
          guests: number
          id: string
          member_id: number
          note: string | null
          registered_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guests?: number
          id?: string
          member_id: number
          note?: string | null
          registered_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guests?: number
          id?: string
          member_id?: number
          note?: string | null
          registered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "agenda_events"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_uploads: {
        Row: {
          closing_balance: number | null
          created_at: string
          file_name: string
          id: string
          imported_by: string
          opening_balance: number | null
          year: number
        }
        Insert: {
          closing_balance?: number | null
          created_at?: string
          file_name: string
          id?: string
          imported_by: string
          opening_balance?: number | null
          year: number
        }
        Update: {
          closing_balance?: number | null
          created_at?: string
          file_name?: string
          id?: string
          imported_by?: string
          opening_balance?: number | null
          year?: number
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          amount: number
          counterparty: string | null
          created_at: string
          description: string | null
          direction: string
          dossier: string | null
          id: string
          invoice_reference: string | null
          line_item_id: string | null
          row_hash: string
          row_index: number
          transaction_date: string | null
          upload_id: string
          year: number
        }
        Insert: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          description?: string | null
          direction: string
          dossier?: string | null
          id?: string
          invoice_reference?: string | null
          line_item_id?: string | null
          row_hash: string
          row_index?: number
          transaction_date?: string | null
          upload_id: string
          year: number
        }
        Update: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          description?: string | null
          direction?: string
          dossier?: string | null
          id?: string
          invoice_reference?: string | null
          line_item_id?: string | null
          row_hash?: string
          row_index?: number
          transaction_date?: string | null
          upload_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_images: {
        Row: {
          benefit_id: string
          caption: string | null
          created_at: string
          id: string
          image_path: string
          sort_order: number
        }
        Insert: {
          benefit_id: string
          caption?: string | null
          created_at?: string
          id?: string
          image_path: string
          sort_order?: number
        }
        Update: {
          benefit_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          image_path?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "benefit_images_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "member_benefits"
            referencedColumns: ["id"]
          },
        ]
      }
      board_members: {
        Row: {
          bond_email: string | null
          coffeeshop: string | null
          coffeeshop_plaats: string | null
          created_at: string
          email: string | null
          functie: string
          geboortedatum: string | null
          id: string
          lid_id: number | null
          lid_ids: number[] | null
          naam: string
          prive_adres: string | null
          prive_plaats: string | null
          prive_postcode: string | null
          sort_order: number
          telefoon: string | null
          type: string
          updated_at: string
        }
        Insert: {
          bond_email?: string | null
          coffeeshop?: string | null
          coffeeshop_plaats?: string | null
          created_at?: string
          email?: string | null
          functie: string
          geboortedatum?: string | null
          id?: string
          lid_id?: number | null
          lid_ids?: number[] | null
          naam: string
          prive_adres?: string | null
          prive_plaats?: string | null
          prive_postcode?: string | null
          sort_order?: number
          telefoon?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          bond_email?: string | null
          coffeeshop?: string | null
          coffeeshop_plaats?: string | null
          created_at?: string
          email?: string | null
          functie?: string
          geboortedatum?: string | null
          id?: string
          lid_id?: number | null
          lid_ids?: number[] | null
          naam?: string
          prive_adres?: string | null
          prive_plaats?: string | null
          prive_postcode?: string | null
          sort_order?: number
          telefoon?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_balance_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          name: string
          section: string
          side: string
          sort_order: number
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          name: string
          section?: string
          side?: string
          sort_order?: number
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          name?: string
          section?: string
          side?: string
          sort_order?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      budget_expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          creditor_name: string | null
          description: string | null
          direction: string
          dossier: string | null
          expense_date: string | null
          external_id: string | null
          id: string
          invoice_reference: string | null
          line_item_id: string
          paid: boolean
          paid_date: string | null
          pdf_file_path: string | null
          source: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          creditor_name?: string | null
          description?: string | null
          direction?: string
          dossier?: string | null
          expense_date?: string | null
          external_id?: string | null
          id?: string
          invoice_reference?: string | null
          line_item_id: string
          paid?: boolean
          paid_date?: string | null
          pdf_file_path?: string | null
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          creditor_name?: string | null
          description?: string | null
          direction?: string
          dossier?: string | null
          expense_date?: string | null
          external_id?: string | null
          id?: string
          invoice_reference?: string | null
          line_item_id?: string
          paid?: boolean
          paid_date?: string | null
          pdf_file_path?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_expenses_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "budget_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_line_items: {
        Row: {
          budgeted_amount: number
          category_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          budgeted_amount?: number
          category_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          budgeted_amount?: number
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_line_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          year?: number
        }
        Relationships: []
      }
      budget_year_settings: {
        Row: {
          budgeted_member_count: number
          contribution_amount: number
          created_at: string
          expense_source_preference: string
          id: string
          updated_at: string
          year: number
        }
        Insert: {
          budgeted_member_count?: number
          contribution_amount?: number
          created_at?: string
          expense_source_preference?: string
          id?: string
          updated_at?: string
          year: number
        }
        Update: {
          budgeted_member_count?: number
          contribution_amount?: number
          created_at?: string
          expense_source_preference?: string
          id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      contribution_invoices: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          invoice_date: string | null
          invoice_file_path: string | null
          invoice_number: string | null
          member_id: number
          year: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_file_path?: string | null
          invoice_number?: string | null
          member_id: number
          year: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_file_path?: string | null
          invoice_number?: string | null
          member_id?: number
          year?: number
        }
        Relationships: []
      }
      contribution_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          installment_count: number
          installment_number: number
          member_id: number
          paid_at: string | null
          payment_method: string
          status: string
          stripe_environment: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          installment_count?: number
          installment_number?: number
          member_id: number
          paid_at?: string | null
          payment_method?: string
          status?: string
          stripe_environment?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          installment_count?: number
          installment_number?: number
          member_id?: number
          paid_at?: string | null
          payment_method?: string
          status?: string
          stripe_environment?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          key: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          key: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          key?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      expense_documents: {
        Row: {
          created_at: string
          dossier: string | null
          entry_key: string
          file_name: string
          file_path: string
          id: string
          invoice_reference: string | null
          mime_type: string | null
          source: string
          uploaded_by: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          dossier?: string | null
          entry_key: string
          file_name: string
          file_path: string
          id?: string
          invoice_reference?: string | null
          mime_type?: string | null
          source?: string
          uploaded_by?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          dossier?: string | null
          entry_key?: string
          file_name?: string
          file_path?: string
          id?: string
          invoice_reference?: string | null
          mime_type?: string | null
          source?: string
          uploaded_by?: string | null
          year?: number | null
        }
        Relationships: []
      }
      expense_dossier_splits: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          dossier: string
          entry_key: string
          id: string
          year: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          dossier: string
          entry_key: string
          id?: string
          year?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          dossier?: string
          entry_key?: string
          id?: string
          year?: number | null
        }
        Relationships: []
      }
      external_org_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          org_id: string
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          org_id: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_org_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "external_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_org_users: {
        Row: {
          created_at: string
          id: string
          org_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_org_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "external_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_organizations: {
        Row: {
          address: string | null
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          description: string | null
          id: string
          kvk: string | null
          logo_path: string | null
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          type: string
          website: string | null
        }
        Insert: {
          address?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kvk?: string | null
          logo_path?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          type?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kvk?: string | null
          logo_path?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          type?: string
          website?: string | null
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer: string
          audience: Database["public"]["Enums"]["faq_audience"]
          created_at: string
          id: string
          is_published: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          audience?: Database["public"]["Enums"]["faq_audience"]
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          audience?: Database["public"]["Enums"]["faq_audience"]
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_todos: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          file_path: string | null
          id: string
          member_id: number | null
          notes: string | null
          notes_by: string | null
          reference_id: string | null
          status: string
          title: string
          todo_type: string
          updated_at: string
          year: number
        }
        Insert: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_path?: string | null
          id?: string
          member_id?: number | null
          notes?: string | null
          notes_by?: string | null
          reference_id?: string | null
          status?: string
          title: string
          todo_type?: string
          updated_at?: string
          year?: number
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_path?: string | null
          id?: string
          member_id?: number | null
          notes?: string | null
          notes_by?: string | null
          reference_id?: string | null
          status?: string
          title?: string
          todo_type?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      informer_bank_balances: {
        Row: {
          account_id: string
          as_of_date: string | null
          balance: number
          currency: string | null
          iban: string | null
          id: string
          name: string | null
          raw: Json | null
          updated_at: string
        }
        Insert: {
          account_id: string
          as_of_date?: string | null
          balance?: number
          currency?: string | null
          iban?: string | null
          id?: string
          name?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          as_of_date?: string | null
          balance?: number
          currency?: string | null
          iban?: string | null
          id?: string
          name?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      informer_debtor_map: {
        Row: {
          created_at: string
          informer_debtor_id: string
          matched_by: string
          member_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          informer_debtor_id: string
          matched_by?: string
          member_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          informer_debtor_id?: string
          matched_by?: string
          member_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "informer_debtor_map_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members_data"
            referencedColumns: ["id"]
          },
        ]
      }
      informer_field_diffs: {
        Row: {
          created_at: string
          field: string
          id: string
          informer_value: string | null
          local_value: string | null
          member_id: number
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          informer_value?: string | null
          local_value?: string | null
          member_id: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          informer_value?: string | null
          local_value?: string | null
          member_id?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      informer_sync_log: {
        Row: {
          action: string
          api_calls: Json | null
          details: Json | null
          error_message: string | null
          id: string
          items_processed: number
          run_at: string
          success: boolean
        }
        Insert: {
          action: string
          api_calls?: Json | null
          details?: Json | null
          error_message?: string | null
          id?: string
          items_processed?: number
          run_at?: string
          success: boolean
        }
        Update: {
          action?: string
          api_calls?: Json | null
          details?: Json | null
          error_message?: string | null
          id?: string
          items_processed?: number
          run_at?: string
          success?: boolean
        }
        Relationships: []
      }
      informer_sync_state: {
        Row: {
          id: number
          last_bank_sync_at: string | null
          last_creditor_sync_at: string | null
          last_debtor_sync_at: string | null
          last_payment_sync_at: string | null
          last_ponto_sync_at: string | null
          last_ponto_tx_sync_at: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          last_bank_sync_at?: string | null
          last_creditor_sync_at?: string | null
          last_debtor_sync_at?: string | null
          last_payment_sync_at?: string | null
          last_ponto_sync_at?: string | null
          last_ponto_tx_sync_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          last_bank_sync_at?: string | null
          last_creditor_sync_at?: string | null
          last_debtor_sync_at?: string | null
          last_payment_sync_at?: string | null
          last_ponto_sync_at?: string | null
          last_ponto_tx_sync_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      internal_declarations: {
        Row: {
          account_holder: string | null
          amount: number
          appointment: string | null
          bank_account: string | null
          bank_transaction_id: string | null
          board_member_name: string
          created_at: string
          declaration_type: string
          expense_date: string | null
          id: string
          km_rate: number
          km_return: number | null
          km_single: number | null
          max_allowance_note: string | null
          paid_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          trajectory: string | null
          updated_at: string
          year: number
        }
        Insert: {
          account_holder?: string | null
          amount?: number
          appointment?: string | null
          bank_account?: string | null
          bank_transaction_id?: string | null
          board_member_name: string
          created_at?: string
          declaration_type?: string
          expense_date?: string | null
          id?: string
          km_rate?: number
          km_return?: number | null
          km_single?: number | null
          max_allowance_note?: string | null
          paid_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          trajectory?: string | null
          updated_at?: string
          year?: number
        }
        Update: {
          account_holder?: string | null
          amount?: number
          appointment?: string | null
          bank_account?: string | null
          bank_transaction_id?: string | null
          board_member_name?: string
          created_at?: string
          declaration_type?: string
          expense_date?: string | null
          id?: string
          km_rate?: number
          km_return?: number | null
          km_single?: number | null
          max_allowance_note?: string | null
          paid_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          trajectory?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "internal_declarations_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "ponto_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_conversions: {
        Row: {
          created_at: string
          created_by: string
          factuur_adres: string | null
          factuur_bedrijfsnaam: string | null
          factuur_email: string | null
          factuur_kvk: string | null
          factuur_plaats: string | null
          factuur_postcode: string | null
          id: string
          lead_id: number
          lid_sinds: number | null
          lidnummer: number
        }
        Insert: {
          created_at?: string
          created_by: string
          factuur_adres?: string | null
          factuur_bedrijfsnaam?: string | null
          factuur_email?: string | null
          factuur_kvk?: string | null
          factuur_plaats?: string | null
          factuur_postcode?: string | null
          id?: string
          lead_id: number
          lid_sinds?: number | null
          lidnummer: number
        }
        Update: {
          created_at?: string
          created_by?: string
          factuur_adres?: string | null
          factuur_bedrijfsnaam?: string | null
          factuur_email?: string | null
          factuur_kvk?: string | null
          factuur_plaats?: string | null
          factuur_postcode?: string | null
          id?: string
          lead_id?: number
          lid_sinds?: number | null
          lidnummer?: number
        }
        Relationships: []
      }
      member_allowed_emails: {
        Row: {
          email: string
          id: string
          member_id: number
        }
        Insert: {
          email: string
          id?: string
          member_id: number
        }
        Update: {
          email?: string
          id?: string
          member_id?: number
        }
        Relationships: []
      }
      member_benefits: {
        Row: {
          active: boolean
          category: string
          contact_email: string | null
          created_at: string
          created_by: string
          description: string | null
          detail_content: string | null
          discount_info: string | null
          featured: boolean
          id: string
          image_path: string | null
          original_price: number | null
          price: number | null
          provider_name: string | null
          provider_url: string | null
          sort_order: number
          supplier_org_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          contact_email?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          detail_content?: string | null
          discount_info?: string | null
          featured?: boolean
          id?: string
          image_path?: string | null
          original_price?: number | null
          price?: number | null
          provider_name?: string | null
          provider_url?: string | null
          sort_order?: number
          supplier_org_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          contact_email?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          detail_content?: string | null
          discount_info?: string | null
          featured?: boolean
          id?: string
          image_path?: string | null
          original_price?: number | null
          price?: number | null
          provider_name?: string | null
          provider_url?: string | null
          sort_order?: number
          supplier_org_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_benefits_supplier_org_id_fkey"
            columns: ["supplier_org_id"]
            isOneToOne: false
            referencedRelation: "external_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contributions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          external_invoice_id: string | null
          id: string
          invoice_date: string | null
          invoice_file_path: string | null
          invoice_number: string | null
          member_id: number
          notes: string | null
          paid: boolean
          paid_date: string | null
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          external_invoice_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_file_path?: string | null
          invoice_number?: string | null
          member_id: number
          notes?: string | null
          paid?: boolean
          paid_date?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          external_invoice_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_file_path?: string | null
          invoice_number?: string | null
          member_id?: number
          notes?: string | null
          paid?: boolean
          paid_date?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      member_data_consents: {
        Row: {
          granted_at: string
          granted_by: string
          id: string
          member_id: number
          org_id: string
          revoked_at: string | null
        }
        Insert: {
          granted_at?: string
          granted_by: string
          id?: string
          member_id: number
          org_id: string
          revoked_at?: string | null
        }
        Update: {
          granted_at?: string
          granted_by?: string
          id?: string
          member_id?: number
          org_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_data_consents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "external_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_edit_requests: {
        Row: {
          created_at: string
          data: Json
          id: string
          member_id: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["edit_request_status"]
          submitted_by: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          member_id: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["edit_request_status"]
          submitted_by: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          member_id?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["edit_request_status"]
          submitted_by?: string
        }
        Relationships: []
      }
      member_edits: {
        Row: {
          data: Json
          id: string
          member_id: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          data?: Json
          id?: string
          member_id: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          data?: Json
          id?: string
          member_id?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      member_mailing_preferences: {
        Row: {
          created_at: string
          email: string
          id: string
          member_id: number
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          member_id: number
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          member_id?: number
        }
        Relationships: []
      }
      member_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          member_id: number
          note: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          member_id: number
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          member_id?: number
          note?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          created_at: string
          id: string
          member_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: number
          user_id?: string
        }
        Relationships: []
      }
      member_whatsapp_status: {
        Row: {
          created_at: string
          in_community: boolean
          last_checked_at: string
          matched_name: string | null
          matched_phone: string | null
          member_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          in_community?: boolean
          last_checked_at?: string
          matched_name?: string | null
          matched_phone?: string | null
          member_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          in_community?: boolean
          last_checked_at?: string
          matched_name?: string | null
          matched_phone?: string | null
          member_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      members_data: {
        Row: {
          data: Json
          id: number
          member_type: string
        }
        Insert: {
          data?: Json
          id: number
          member_type?: string
        }
        Update: {
          data?: Json
          id?: number
          member_type?: string
        }
        Relationships: []
      }
      membership_requests: {
        Row: {
          city: string
          coffeeshop_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          request_type: string
          status: string
        }
        Insert: {
          city: string
          coffeeshop_name: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          request_type?: string
          status?: string
        }
        Update: {
          city?: string
          coffeeshop_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          request_type?: string
          status?: string
        }
        Relationships: []
      }
      mfa_email_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          cover_image_url: string | null
          created_at: string
          excerpt: string
          id: string
          is_published: boolean
          members_only_content: string | null
          public_content: string
          published_at: string
          slug: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          is_published?: boolean
          members_only_content?: string | null
          public_content?: string
          published_at?: string
          slug: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          is_published?: boolean
          members_only_content?: string | null
          public_content?: string
          published_at?: string
          slug?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      outlook_sync_log: {
        Row: {
          details: Json | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          trigger: string | null
        }
        Insert: {
          details?: Json | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status: string
          trigger?: string | null
        }
        Update: {
          details?: Json | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          trigger?: string | null
        }
        Relationships: []
      }
      pages: {
        Row: {
          content_markdown: string
          created_at: string
          hero_image_url: string | null
          id: string
          is_published: boolean
          meta_description: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content_markdown?: string
          created_at?: string
          hero_image_url?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content_markdown?: string
          created_at?: string
          hero_image_url?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      passkey_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          public_key?: string
          transports?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      ponto_bank_balances: {
        Row: {
          account_id: string
          as_of_date: string | null
          available_balance: number
          currency: string | null
          current_balance: number
          iban: string | null
          id: string
          name: string | null
          raw: Json | null
          updated_at: string
        }
        Insert: {
          account_id: string
          as_of_date?: string | null
          available_balance?: number
          currency?: string | null
          current_balance?: number
          iban?: string | null
          id?: string
          name?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          as_of_date?: string | null
          available_balance?: number
          currency?: string | null
          current_balance?: number
          iban?: string | null
          id?: string
          name?: string | null
          raw?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      ponto_matching_rules: {
        Row: {
          budget_line_item_id: string | null
          created_at: string
          created_by: string | null
          dossier: string | null
          id: string
          match_field: string
          pattern: string
          priority: number
          updated_at: string
        }
        Insert: {
          budget_line_item_id?: string | null
          created_at?: string
          created_by?: string | null
          dossier?: string | null
          id?: string
          match_field?: string
          pattern: string
          priority?: number
          updated_at?: string
        }
        Update: {
          budget_line_item_id?: string | null
          created_at?: string
          created_by?: string | null
          dossier?: string | null
          id?: string
          match_field?: string
          pattern?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_matching_rules_budget_line_item_id_fkey"
            columns: ["budget_line_item_id"]
            isOneToOne: false
            referencedRelation: "budget_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_transactions: {
        Row: {
          account_id: string
          amount: number
          budget_line_item_id: string | null
          category: string | null
          counterparty_iban: string | null
          counterparty_name: string | null
          created_at: string
          currency: string | null
          description: string | null
          dossier: string | null
          executed_at: string | null
          id: string
          match_strategy: string | null
          matched_manually: boolean
          matched_rule_id: string | null
          raw: Json | null
          remittance_info: string | null
          transaction_id: string
          updated_at: string
          value_date: string | null
        }
        Insert: {
          account_id: string
          amount: number
          budget_line_item_id?: string | null
          category?: string | null
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          dossier?: string | null
          executed_at?: string | null
          id?: string
          match_strategy?: string | null
          matched_manually?: boolean
          matched_rule_id?: string | null
          raw?: Json | null
          remittance_info?: string | null
          transaction_id: string
          updated_at?: string
          value_date?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          budget_line_item_id?: string | null
          category?: string | null
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          dossier?: string | null
          executed_at?: string | null
          id?: string
          match_strategy?: string | null
          matched_manually?: boolean
          matched_rule_id?: string | null
          raw?: Json | null
          remittance_info?: string | null
          transaction_id?: string
          updated_at?: string
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_transactions_budget_line_item_id_fkey"
            columns: ["budget_line_item_id"]
            isOneToOne: false
            referencedRelation: "budget_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          attachment_url: string | null
          cover_image_url: string | null
          created_at: string
          id: string
          is_published: boolean
          members_only_content: string | null
          public_content: string
          published_at: string
          slug: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          members_only_content?: string | null
          public_content?: string
          published_at?: string
          slug: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          members_only_content?: string | null
          public_content?: string
          published_at?: string
          slug?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_device_tokens: {
        Row: {
          created_at: string
          device_token: string
          id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_token: string
          id?: string
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_token?: string
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      secure_document_views: {
        Row: {
          document_id: string
          id: string
          user_agent: string | null
          user_email: string | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          document_id: string
          id?: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          document_id?: string
          id?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "secure_document_views_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "secure_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_documents: {
        Row: {
          audience: string
          file_size_bytes: number | null
          id: string
          slug: string
          storage_path: string
          title: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          audience?: string
          file_size_bytes?: number | null
          id?: string
          slug: string
          storage_path: string
          title: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          audience?: string
          file_size_bytes?: number | null
          id?: string
          slug?: string
          storage_path?: string
          title?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      survey_completions: {
        Row: {
          completed_at: string
          id: string
          location_name: string | null
          survey_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          location_name?: string | null
          survey_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          location_name?: string | null
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_completions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          id: string
          options: Json | null
          question_text: string
          question_type: string
          required: boolean
          sort_order: number
          survey_id: string
        }
        Insert: {
          id?: string
          options?: Json | null
          question_text: string
          question_type?: string
          required?: boolean
          sort_order?: number
          survey_id: string
        }
        Update: {
          id?: string
          options?: Json | null
          question_text?: string
          question_type?: string
          required?: boolean
          sort_order?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answer: Json
          id: string
          question_id: string
          respondent_email: string | null
          status: string
          submitted_at: string
          survey_id: string
        }
        Insert: {
          answer?: Json
          id?: string
          question_id: string
          respondent_email?: string | null
          status?: string
          submitted_at?: string
          survey_id: string
        }
        Update: {
          answer?: Json
          id?: string
          question_id?: string
          respondent_email?: string | null
          status?: string
          submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          archived: boolean
          created_at: string
          display_name: string | null
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_outbound_at: string | null
          member_id: number | null
          phone: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          member_id?: number | null
          phone: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_outbound_at?: string | null
          member_id?: number | null
          phone?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_data"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          created_at: string
          direction: string
          error: string | null
          id: string
          media_type: string | null
          media_url: string | null
          member_id: number | null
          phone: string
          read_by_us_at: string | null
          sent_by: string | null
          status: string
          template_name: string | null
          template_variables: Json | null
          timestamp: string
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          member_id?: number | null
          phone: string
          read_by_us_at?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string | null
          template_variables?: Json | null
          timestamp?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          member_id?: number | null
          phone?: string
          read_by_us_at?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string | null
          template_variables?: Json | null
          timestamp?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_data"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_participants: {
        Row: {
          created_at: string
          display_name: string
          id: string
          member_id: number | null
          note: string | null
          phone: string | null
          sort_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          member_id?: number | null
          note?: string | null
          phone?: string | null
          sort_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          member_id?: number | null
          note?: string | null
          phone?: string | null
          sort_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_data"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_preferences: {
        Row: {
          blocked: boolean
          created_at: string
          member_id: number
          opted_in: boolean
          opted_in_at: string | null
          opted_out_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          member_id: number
          opted_in?: boolean
          opted_in_at?: string | null
          opted_out_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blocked?: boolean
          created_at?: string
          member_id?: number
          opted_in?: boolean
          opted_in_at?: string | null
          opted_out_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members_data"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_text: string | null
          category: string
          created_at: string
          display_name: string | null
          id: string
          language: string
          last_synced_at: string | null
          meta_template_id: string | null
          name: string
          status: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          body_text?: string | null
          category?: string
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          last_synced_at?: string | null
          meta_template_id?: string | null
          name: string
          status?: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          body_text?: string | null
          category?: string
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          last_synced_at?: string | null
          meta_template_id?: string | null
          name?: string
          status?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _list_vault_secret_names: { Args: never; Returns: string[] }
      cleanup_expired_mfa_codes: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_board_members_public: {
        Args: never
        Returns: {
          bond_email: string
          coffeeshop: string
          coffeeshop_plaats: string
          created_at: string
          email: string
          functie: string
          id: string
          lid_id: number
          lid_ids: number[]
          naam: string
          sort_order: number
          telefoon: string
          type: string
          updated_at: string
        }[]
      }
      get_member_id_for_email: { Args: { _email: string }; Returns: number }
      get_members_for_extern: { Args: { _org_id: string }; Returns: Json }
      get_membership_request_status: {
        Args: { _email: string }
        Returns: {
          created_at: string
          has_login: boolean
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_board_member: { Args: { _user_id: string }; Returns: boolean }
      is_pcn_reviewer: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      send_welcome_email_admin: {
        Args: {
          _body: string
          _idempotency_key: string
          _recipient: string
          _subject: string
        }
        Returns: number
      }
      set_vault_secret: {
        Args: { _name: string; _value: string }
        Returns: undefined
      }
      trigger_informer_sync: { Args: { _action?: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user" | "extern" | "inhuur"
      edit_request_status: "pending" | "approved" | "rejected"
      faq_audience: "public" | "members"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "extern", "inhuur"],
      edit_request_status: ["pending", "approved", "rejected"],
      faq_audience: ["public", "members"],
    },
  },
} as const
