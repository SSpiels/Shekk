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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance_agorot: number
          created_at: string
          currency: string
          held_agorot: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_agorot?: number
          created_at?: string
          currency?: string
          held_agorot?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_agorot?: number
          created_at?: string
          currency?: string
          held_agorot?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_outbound_clicks: {
        Row: {
          affiliate_campaign_id: string | null
          created_at: string
          destination_url: string
          event_id: string | null
          external_provider_id: string | null
          id: string
          provider: string
          user_id: string | null
        }
        Insert: {
          affiliate_campaign_id?: string | null
          created_at?: string
          destination_url: string
          event_id?: string | null
          external_provider_id?: string | null
          id?: string
          provider: string
          user_id?: string | null
        }
        Update: {
          affiliate_campaign_id?: string | null
          created_at?: string
          destination_url?: string
          event_id?: string | null
          external_provider_id?: string | null
          id?: string
          provider?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_outbound_clicks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          id: string
          name: string
          path: string | null
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          path?: string | null
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          path?: string | null
          props?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      cohort_members: {
        Row: {
          cohort_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          is_public: boolean
          join_code: string
          name: string
          program_id: string
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_public?: boolean
          join_code: string
          name: string
          program_id: string
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_public?: boolean
          join_code?: string
          name?: string
          program_id?: string
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          cohort_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_message_at: string
          title: string | null
          updated_at: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tickets: {
        Row: {
          amount_agorot: number
          code: string
          created_at: string
          entry_id: string | null
          event_id: string
          id: string
          idempotency_key: string
          quantity: number
          status: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          amount_agorot: number
          code: string
          created_at?: string
          entry_id?: string | null
          event_id: string
          id?: string
          idempotency_key: string
          quantity: number
          status?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          amount_agorot?: number
          code?: string
          created_at?: string
          entry_id?: string | null
          event_id?: string
          id?: string
          idempotency_key?: string
          quantity?: number
          status?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          affiliate_campaign_id: string | null
          age_min: number | null
          availability_confidence: string | null
          capacity: number
          city: string | null
          commission_rate: number | null
          commission_type: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          emoji: string
          ends_at: string | null
          external_booking_url: string | null
          external_provider_id: string | null
          host: string
          id: string
          includes: string | null
          integration_type: string
          kind: string
          last_verified_at: string | null
          per_person_limit: number
          price_agorot: number
          programme_status: string
          provider: string
          provider_ref: string | null
          refund_summary: string | null
          source_category: string | null
          starts_at: string
          status: string
          terms_url: string | null
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          affiliate_campaign_id?: string | null
          age_min?: number | null
          availability_confidence?: string | null
          capacity?: number
          city?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          ends_at?: string | null
          external_booking_url?: string | null
          external_provider_id?: string | null
          host: string
          id?: string
          includes?: string | null
          integration_type?: string
          kind?: string
          last_verified_at?: string | null
          per_person_limit?: number
          price_agorot?: number
          programme_status?: string
          provider?: string
          provider_ref?: string | null
          refund_summary?: string | null
          source_category?: string | null
          starts_at: string
          status?: string
          terms_url?: string | null
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          affiliate_campaign_id?: string | null
          age_min?: number | null
          availability_confidence?: string | null
          capacity?: number
          city?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          ends_at?: string | null
          external_booking_url?: string | null
          external_provider_id?: string | null
          host?: string
          id?: string
          includes?: string | null
          integration_type?: string
          kind?: string
          last_verified_at?: string | null
          per_person_limit?: number
          price_agorot?: number
          programme_status?: string
          provider?: string
          provider_ref?: string | null
          refund_summary?: string | null
          source_category?: string | null
          starts_at?: string
          status?: string
          terms_url?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          blocked_by: string | null
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      funding_events: {
        Row: {
          created_at: string
          entry_id: string | null
          fee_minor: number
          id: string
          idempotency_key: string
          interbank_rate: number
          method: string
          pay_amount_minor: number
          pay_currency: string
          provider: string
          provider_ref: string | null
          quoted_rate: number
          settled_at: string | null
          shekels_agorot: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id?: string | null
          fee_minor?: number
          id?: string
          idempotency_key: string
          interbank_rate: number
          method?: string
          pay_amount_minor: number
          pay_currency: string
          provider?: string
          provider_ref?: string | null
          quoted_rate: number
          settled_at?: string | null
          shekels_agorot: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string | null
          fee_minor?: number
          id?: string
          idempotency_key?: string
          interbank_rate?: number
          method?: string
          pay_amount_minor?: number
          pay_currency?: string
          provider?: string
          provider_ref?: string | null
          quoted_rate?: number
          settled_at?: string | null
          shekels_agorot?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      holds: {
        Row: {
          amount_agorot: number
          category: string
          created_at: string
          external_ref: string | null
          icon: string
          id: string
          idempotency_key: string
          merchant: string
          resolved_at: string | null
          settled_amount_agorot: number | null
          settled_entry_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_agorot: number
          category?: string
          created_at?: string
          external_ref?: string | null
          icon?: string
          id?: string
          idempotency_key: string
          merchant: string
          resolved_at?: string | null
          settled_amount_agorot?: number | null
          settled_entry_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_agorot?: number
          category?: string
          created_at?: string
          external_ref?: string | null
          icon?: string
          id?: string
          idempotency_key?: string
          merchant?: string
          resolved_at?: string | null
          settled_amount_agorot?: number | null
          settled_entry_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holds_settled_entry_id_fkey"
            columns: ["settled_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_cards: {
        Row: {
          back_path: string | null
          covers: string | null
          created_at: string
          front_path: string | null
          group_number: string | null
          hotline: string | null
          id: string
          is_primary: boolean
          member_number: string | null
          plan: string | null
          policy_holder: string | null
          provider_id: string
          provider_name: string
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          back_path?: string | null
          covers?: string | null
          created_at?: string
          front_path?: string | null
          group_number?: string | null
          hotline?: string | null
          id?: string
          is_primary?: boolean
          member_number?: string | null
          plan?: string | null
          policy_holder?: string | null
          provider_id: string
          provider_name: string
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          back_path?: string | null
          covers?: string | null
          created_at?: string
          front_path?: string | null
          group_number?: string | null
          hotline?: string | null
          id?: string
          is_primary?: boolean
          member_number?: string | null
          plan?: string | null
          policy_holder?: string | null
          provider_id?: string
          provider_name?: string
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          byte_size: number | null
          created_at: string
          id: string
          kind: string
          mime_type: string | null
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          id?: string
          kind: string
          mime_type?: string | null
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount_agorot: number
          balance_after_agorot: number
          category: string
          counterparty: string | null
          created_at: string
          direction: string
          external_ref: string | null
          hold_id: string | null
          icon: string
          id: string
          idempotency_key: string
          merchant: string
          user_id: string
        }
        Insert: {
          amount_agorot: number
          balance_after_agorot: number
          category?: string
          counterparty?: string | null
          created_at?: string
          direction: string
          external_ref?: string | null
          hold_id?: string | null
          icon?: string
          id?: string
          idempotency_key: string
          merchant: string
          user_id: string
        }
        Update: {
          amount_agorot?: number
          balance_after_agorot?: number
          category?: string
          counterparty?: string | null
          created_at?: string
          direction?: string
          external_ref?: string | null
          hold_id?: string | null
          icon?: string
          id?: string
          idempotency_key?: string
          merchant?: string
          user_id?: string
        }
        Relationships: []
      }
      member_handles: {
        Row: {
          avatar_url: string | null
          created_at: string
          discoverable: boolean
          display_name: string
          handle: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discoverable?: boolean
          display_name?: string
          handle: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discoverable?: boolean
          display_name?: string
          handle?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_line2: string | null
          address_postcode: string | null
          address_state: string | null
          airwallex_account_id: string | null
          airwallex_account_status: string
          airwallex_cardholder_id: string | null
          airwallex_rejection_reason: string | null
          arrival_date: string | null
          city: string | null
          cohort: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          esign_accepted_at: string | null
          expected_monthly_ils: number | null
          id_document_number: string | null
          id_document_type: string | null
          id_expiry: string | null
          id_issuing_country: string | null
          il_address_city: string | null
          il_address_line1: string | null
          il_address_postcode: string | null
          ils_account_approved_at: string | null
          is_pep: boolean
          is_us_person: boolean
          kyc_rejection_reason: string | null
          kyc_reviewed_at: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          legal_first_name: string | null
          legal_last_name: string | null
          legal_middle_name: string | null
          nationality: string | null
          occupation: string | null
          phone_country_code: string | null
          phone_number: string | null
          preferred_currency: string
          privacy_accepted_at: string | null
          program: string | null
          reverify_due_at: string | null
          source_of_funds: string | null
          tax_country: string | null
          tax_id: string | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          address_state?: string | null
          airwallex_account_id?: string | null
          airwallex_account_status?: string
          airwallex_cardholder_id?: string | null
          airwallex_rejection_reason?: string | null
          arrival_date?: string | null
          city?: string | null
          cohort?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          esign_accepted_at?: string | null
          expected_monthly_ils?: number | null
          id_document_number?: string | null
          id_document_type?: string | null
          id_expiry?: string | null
          id_issuing_country?: string | null
          il_address_city?: string | null
          il_address_line1?: string | null
          il_address_postcode?: string | null
          ils_account_approved_at?: string | null
          is_pep?: boolean
          is_us_person?: boolean
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          legal_first_name?: string | null
          legal_last_name?: string | null
          legal_middle_name?: string | null
          nationality?: string | null
          occupation?: string | null
          phone_country_code?: string | null
          phone_number?: string | null
          preferred_currency?: string
          privacy_accepted_at?: string | null
          program?: string | null
          reverify_due_at?: string | null
          source_of_funds?: string | null
          tax_country?: string | null
          tax_id?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          address_state?: string | null
          airwallex_account_id?: string | null
          airwallex_account_status?: string
          airwallex_cardholder_id?: string | null
          airwallex_rejection_reason?: string | null
          arrival_date?: string | null
          city?: string | null
          cohort?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          esign_accepted_at?: string | null
          expected_monthly_ils?: number | null
          id_document_number?: string | null
          id_document_type?: string | null
          id_expiry?: string | null
          id_issuing_country?: string | null
          il_address_city?: string | null
          il_address_line1?: string | null
          il_address_postcode?: string | null
          ils_account_approved_at?: string | null
          is_pep?: boolean
          is_us_person?: boolean
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          legal_first_name?: string | null
          legal_last_name?: string | null
          legal_middle_name?: string | null
          nationality?: string | null
          occupation?: string | null
          phone_country_code?: string | null
          phone_number?: string | null
          preferred_currency?: string
          privacy_accepted_at?: string | null
          program?: string | null
          reverify_due_at?: string | null
          source_of_funds?: string | null
          tax_country?: string | null
          tax_id?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          message_id: string | null
          reason: string
          reporter_id: string
          status: string
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          message_id?: string | null
          reason: string
          reporter_id: string
          status?: string
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          message_id?: string | null
          reason?: string
          reporter_id?: string
          status?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      member_travel: {
        Row: {
          accommodation_area: string | null
          arrival_date: string | null
          created_at: string
          departure_date: string | null
          display_name: string | null
          funding_currency: string | null
          home_country: string | null
          interests: string[]
          israel_city: string | null
          onboarding_completed_at: string | null
          onboarding_step: string | null
          travel_style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accommodation_area?: string | null
          arrival_date?: string | null
          created_at?: string
          departure_date?: string | null
          display_name?: string | null
          funding_currency?: string | null
          home_country?: string | null
          interests?: string[]
          israel_city?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          travel_style?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accommodation_area?: string | null
          arrival_date?: string | null
          created_at?: string
          departure_date?: string | null
          display_name?: string | null
          funding_currency?: string | null
          home_country?: string | null
          interests?: string[]
          israel_city?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          travel_style?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          kind: string
          meta: Json
          sender_id: string | null
        }
        Insert: {
          body?: string
          conversation_id: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          sender_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      money_waitlist: {
        Row: {
          created_at: string
          email: string | null
          id: string
          interests: string[]
          note: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          interests?: string[]
          note?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          interests?: string[]
          note?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      official_documents: {
        Row: {
          byte_size: number | null
          category: string
          created_at: string
          expires_on: string | null
          id: string
          label: string
          mime_type: string | null
          note: string | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          byte_size?: number | null
          category: string
          created_at?: string
          expires_on?: string | null
          id?: string
          label: string
          mime_type?: string | null
          note?: string | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          byte_size?: number | null
          category?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          label?: string
          mime_type?: string | null
          note?: string | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      official_tasks: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          due_on: string | null
          id: string
          note: string | null
          step_key: string
          title: string
          track: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_on?: string | null
          id?: string
          note?: string | null
          step_key: string
          title: string
          track: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_on?: string | null
          id?: string
          note?: string | null
          step_key?: string
          title?: string
          track?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programme_acknowledgements: {
        Row: {
          acknowledged_at: string
          cohort_id: string
          id: string
          subject_id: string
          subject_type: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          cohort_id: string
          id?: string
          subject_id: string
          subject_type: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          cohort_id?: string
          id?: string
          subject_id?: string
          subject_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_acknowledgements_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_announcements: {
        Row: {
          audience_kind: string
          body: string
          cohort_id: string
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          link_url: string | null
          pinned: boolean
          priority: string
          published_at: string
          requires_ack: boolean
          title: string
          updated_at: string
        }
        Insert: {
          audience_kind?: string
          body: string
          cohort_id: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          link_url?: string | null
          pinned?: boolean
          priority?: string
          published_at?: string
          requires_ack?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          audience_kind?: string
          body?: string
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          link_url?: string | null
          pinned?: boolean
          priority?: string
          published_at?: string
          requires_ack?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_announcements_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "programme_events"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_audiences: {
        Row: {
          cohort_id: string
          created_at: string
          group_id: string | null
          id: string
          subject_id: string
          subject_type: string
          user_id: string | null
        }
        Insert: {
          cohort_id: string
          created_at?: string
          group_id?: string | null
          id?: string
          subject_id: string
          subject_type: string
          user_id?: string | null
        }
        Update: {
          cohort_id?: string
          created_at?: string
          group_id?: string | null
          id?: string
          subject_id?: string
          subject_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_audiences_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_audiences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "programme_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_checklist_items: {
        Row: {
          action_url: string | null
          audience_kind: string
          cohort_id: string
          created_at: string
          details: string | null
          due_on: string | null
          feature_key: string | null
          id: string
          item_key: string
          required: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          audience_kind?: string
          cohort_id: string
          created_at?: string
          details?: string | null
          due_on?: string | null
          feature_key?: string | null
          id?: string
          item_key: string
          required?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          audience_kind?: string
          cohort_id?: string
          created_at?: string
          details?: string | null
          due_on?: string | null
          feature_key?: string | null
          id?: string
          item_key?: string
          required?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_checklist_items_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_checklist_progress: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          id: string
          item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: string
          item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: string
          item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_checklist_progress_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "programme_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_cohorts: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          is_demo: boolean
          join_code: string
          name: string
          programme_id: string
          starts_on: string | null
          status: string
          timezone: string
          updated_at: string
          welcome_message: string | null
          year: string | null
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_demo?: boolean
          join_code: string
          name: string
          programme_id: string
          starts_on?: string | null
          status?: string
          timezone?: string
          updated_at?: string
          welcome_message?: string | null
          year?: string | null
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_demo?: boolean
          join_code?: string
          name?: string
          programme_id?: string
          starts_on?: string | null
          status?: string
          timezone?: string
          updated_at?: string
          welcome_message?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_cohorts_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_contacts: {
        Row: {
          audience_kind: string
          availability: string | null
          category: string
          cohort_id: string
          created_at: string
          email: string | null
          id: string
          is_emergency: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          sort_order: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          audience_kind?: string
          availability?: string | null
          category?: string
          cohort_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_emergency?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          audience_kind?: string
          availability?: string | null
          category?: string
          cohort_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_emergency?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          sort_order?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_contacts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_documents: {
        Row: {
          audience_kind: string
          byte_size: number | null
          category: string
          cohort_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          label: string
          link_url: string | null
          mime_type: string | null
          sort_order: number
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          audience_kind?: string
          byte_size?: number | null
          category?: string
          cohort_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          link_url?: string | null
          mime_type?: string | null
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          audience_kind?: string
          byte_size?: number | null
          category?: string
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          link_url?: string | null
          mime_type?: string | null
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_documents_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_event_changes: {
        Row: {
          after_value: string | null
          before_value: string | null
          changed_at: string
          changed_by: string | null
          cohort_id: string
          event_id: string
          field: string
          id: string
          note: string | null
          notify_level: string
        }
        Insert: {
          after_value?: string | null
          before_value?: string | null
          changed_at?: string
          changed_by?: string | null
          cohort_id: string
          event_id: string
          field: string
          id?: string
          note?: string | null
          notify_level?: string
        }
        Update: {
          after_value?: string | null
          before_value?: string | null
          changed_at?: string
          changed_by?: string | null
          cohort_id?: string
          event_id?: string
          field?: string
          id?: string
          note?: string | null
          notify_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_event_changes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_event_changes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "programme_events"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          response: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          response: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          response?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "programme_events"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_events: {
        Row: {
          audience_kind: string
          capacity: number | null
          cohort_id: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_type: string
          google_place_id: string | null
          id: string
          last_changed_at: string | null
          latitude: number | null
          location_label: string | null
          longitude: number | null
          mandatory: boolean
          meeting_point: string | null
          online_url: string | null
          original_starts_at: string | null
          requires_ack: boolean
          rsvp_enabled: boolean
          starts_at: string
          status: string
          status_note: string | null
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          urgent: boolean
        }
        Insert: {
          audience_kind?: string
          capacity?: number | null
          cohort_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string
          google_place_id?: string | null
          id?: string
          last_changed_at?: string | null
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          mandatory?: boolean
          meeting_point?: string | null
          online_url?: string | null
          original_starts_at?: string | null
          requires_ack?: boolean
          rsvp_enabled?: boolean
          starts_at: string
          status?: string
          status_note?: string | null
          timezone?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          urgent?: boolean
        }
        Update: {
          audience_kind?: string
          capacity?: number | null
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string
          google_place_id?: string | null
          id?: string
          last_changed_at?: string | null
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          mandatory?: boolean
          meeting_point?: string | null
          online_url?: string | null
          original_starts_at?: string | null
          requires_ack?: boolean
          rsvp_enabled?: boolean
          starts_at?: string
          status?: string
          status_note?: string | null
          timezone?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          urgent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "programme_events_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "programme_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_groups: {
        Row: {
          cohort_id: string
          colour: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cohort_id: string
          colour?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cohort_id?: string
          colour?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_groups_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code: string
          cohort_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string | null
          id: string
          kind: string
          note: string | null
          programme_id: string
          role: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          note?: string | null
          programme_id: string
          role?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          note?: string | null
          programme_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_invites_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_invites_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_memberships: {
        Row: {
          cohort_id: string
          created_at: string
          id: string
          joined_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          id?: string
          joined_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          id?: string
          joined_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_memberships_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_notifications: {
        Row: {
          body: string | null
          cohort_id: string
          created_at: string
          id: string
          level: string
          read_at: string | null
          subject_id: string | null
          subject_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          cohort_id: string
          created_at?: string
          id?: string
          level?: string
          read_at?: string | null
          subject_id?: string | null
          subject_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          cohort_id?: string
          created_at?: string
          id?: string
          level?: string
          read_at?: string | null
          subject_id?: string | null
          subject_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_notifications_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_places: {
        Row: {
          address: string | null
          audience_kind: string
          category: string
          cohort_id: string
          created_at: string
          created_by: string | null
          google_place_id: string | null
          id: string
          label: string
          latitude: number | null
          longitude: number | null
          meeting_instructions: string | null
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          audience_kind?: string
          category?: string
          cohort_id: string
          created_at?: string
          created_by?: string | null
          google_place_id?: string | null
          id?: string
          label: string
          latitude?: number | null
          longitude?: number | null
          meeting_instructions?: string | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          audience_kind?: string
          category?: string
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          google_place_id?: string | null
          id?: string
          label?: string
          latitude?: number | null
          longitude?: number | null
          meeting_instructions?: string | null
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_places_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_schedule_items: {
        Row: {
          cohort_id: string
          created_at: string
          details: string | null
          ends_at: string | null
          id: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          details?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          details?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_schedule_items_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_staff: {
        Row: {
          created_at: string
          id: string
          permissions: string[]
          programme_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permissions?: string[]
          programme_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permissions?: string[]
          programme_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_staff_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_student_details: {
        Row: {
          cohort_id: string
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          flight_arrival_at: string | null
          flight_number: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          flight_arrival_at?: string | null
          flight_number?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          flight_arrival_at?: string | null
          flight_number?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_student_details_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_vote_options: {
        Row: {
          capacity: number | null
          created_at: string
          detail: string | null
          id: string
          label: string
          sort_order: number
          vote_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          detail?: string | null
          id?: string
          label: string
          sort_order?: number
          vote_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          detail?: string | null
          id?: string
          label?: string
          sort_order?: number
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_vote_options_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "programme_votes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_vote_responses: {
        Row: {
          created_at: string
          id: string
          option_id: string
          updated_at: string
          user_id: string
          vote_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          updated_at?: string
          user_id: string
          vote_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          updated_at?: string
          user_id?: string
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_vote_responses_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "programme_vote_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_vote_responses_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "programme_votes"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_votes: {
        Row: {
          allow_change: boolean
          anonymous: boolean
          audience_kind: string
          closed_at: string | null
          closes_at: string | null
          cohort_id: string
          created_at: string
          created_by: string | null
          description: string | null
          event_id: string | null
          id: string
          question: string
          results_visible: boolean
          status: string
          updated_at: string
          vote_kind: string
          winning_option_id: string | null
        }
        Insert: {
          allow_change?: boolean
          anonymous?: boolean
          audience_kind?: string
          closed_at?: string | null
          closes_at?: string | null
          cohort_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          question: string
          results_visible?: boolean
          status?: string
          updated_at?: string
          vote_kind?: string
          winning_option_id?: string | null
        }
        Update: {
          allow_change?: boolean
          anonymous?: boolean
          audience_kind?: string
          closed_at?: string | null
          closes_at?: string | null
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          question?: string
          results_visible?: boolean
          status?: string
          updated_at?: string
          vote_kind?: string
          winning_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_votes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "programme_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_votes_winner_fk"
            columns: ["winning_option_id"]
            isOneToOne: false
            referencedRelation: "programme_vote_options"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_demo: boolean
          logo_url: string | null
          name: string
          organisation: string | null
          programme_type: string
          slug: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name: string
          organisation?: string | null
          programme_type?: string
          slug?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          organisation?: string | null
          programme_type?: string
          slug?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_public: boolean
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_places: {
        Row: {
          app: string
          category: string | null
          created_at: string
          google_place_id: string
          id: string
          label: string | null
          name_snapshot: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app?: string
          category?: string | null
          created_at?: string
          google_place_id: string
          id?: string
          label?: string | null
          name_snapshot?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app?: string
          category?: string | null
          created_at?: string
          google_place_id?: string
          id?: string
          label?: string | null
          name_snapshot?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      setup_tasks: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          id: string
          task_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: string
          task_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: string
          task_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sim_clicks: {
        Row: {
          affiliate: boolean
          converted_at: string | null
          created_at: string
          id: string
          plan_id: string | null
          provider_id: string | null
          recommendation_id: string | null
          reported_amount_minor: number | null
          reported_currency: string | null
          target_url: string
          user_id: string | null
        }
        Insert: {
          affiliate?: boolean
          converted_at?: string | null
          created_at?: string
          id?: string
          plan_id?: string | null
          provider_id?: string | null
          recommendation_id?: string | null
          reported_amount_minor?: number | null
          reported_currency?: string | null
          target_url: string
          user_id?: string | null
        }
        Update: {
          affiliate?: boolean
          converted_at?: string | null
          created_at?: string
          id?: string
          plan_id?: string | null
          provider_id?: string | null
          recommendation_id?: string | null
          reported_amount_minor?: number | null
          reported_currency?: string | null
          target_url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sim_clicks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "sim_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_clicks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "sim_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_clicks_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "sim_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_esims: {
        Row: {
          activation_code: string | null
          created_at: string
          expires_at: string | null
          iccid: string | null
          id: string
          installed_at: string | null
          lpa_string: string | null
          matching_id: string | null
          order_id: string | null
          plan_id: string | null
          provider_id: string
          qr_url: string | null
          raw: Json
          smdp_address: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_code?: string | null
          created_at?: string
          expires_at?: string | null
          iccid?: string | null
          id?: string
          installed_at?: string | null
          lpa_string?: string | null
          matching_id?: string | null
          order_id?: string | null
          plan_id?: string | null
          provider_id: string
          qr_url?: string | null
          raw?: Json
          smdp_address?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_code?: string | null
          created_at?: string
          expires_at?: string | null
          iccid?: string | null
          id?: string
          installed_at?: string | null
          lpa_string?: string | null
          matching_id?: string | null
          order_id?: string | null
          plan_id?: string | null
          provider_id?: string
          qr_url?: string | null
          raw?: Json
          smdp_address?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_esims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sim_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_esims_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "sim_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_esims_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "sim_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_orders: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          mode: string
          plan_id: string | null
          provider_id: string
          provider_order_ref: string | null
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          mode: string
          plan_id?: string | null
          provider_id: string
          provider_order_ref?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          mode?: string
          plan_id?: string | null
          provider_id?: string
          provider_order_ref?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "sim_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_orders_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "sim_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_plans: {
        Row: {
          activation_policy: string | null
          active: boolean
          calls_included: boolean
          country_code: string
          created_at: string
          currency: string
          data_mb: number | null
          display_period_label: string | null
          display_price_label: string | null
          display_price_minor: number
          external_id: string | null
          fair_use_note: string | null
          featured: boolean
          headline: string | null
          id: string
          in_stock: boolean
          name: string
          net_cost_minor: number | null
          networks: string[] | null
          operator: string | null
          phone_number_included: boolean
          plan_type: string
          points: string[]
          provider_id: string
          rank_boost: number
          raw: Json
          rechargeable: boolean
          source: string
          synced_at: string | null
          texts_included: boolean
          unlimited: boolean
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          activation_policy?: string | null
          active?: boolean
          calls_included?: boolean
          country_code?: string
          created_at?: string
          currency?: string
          data_mb?: number | null
          display_period_label?: string | null
          display_price_label?: string | null
          display_price_minor?: number
          external_id?: string | null
          fair_use_note?: string | null
          featured?: boolean
          headline?: string | null
          id?: string
          in_stock?: boolean
          name: string
          net_cost_minor?: number | null
          networks?: string[] | null
          operator?: string | null
          phone_number_included?: boolean
          plan_type?: string
          points?: string[]
          provider_id: string
          rank_boost?: number
          raw?: Json
          rechargeable?: boolean
          source?: string
          synced_at?: string | null
          texts_included?: boolean
          unlimited?: boolean
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          activation_policy?: string | null
          active?: boolean
          calls_included?: boolean
          country_code?: string
          created_at?: string
          currency?: string
          data_mb?: number | null
          display_period_label?: string | null
          display_price_label?: string | null
          display_price_minor?: number
          external_id?: string | null
          fair_use_note?: string | null
          featured?: boolean
          headline?: string | null
          id?: string
          in_stock?: boolean
          name?: string
          net_cost_minor?: number | null
          networks?: string[] | null
          operator?: string | null
          phone_number_included?: boolean
          plan_type?: string
          points?: string[]
          provider_id?: string
          rank_boost?: number
          raw?: Json
          rechargeable?: boolean
          source?: string
          synced_at?: string | null
          texts_included?: boolean
          unlimited?: boolean
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sim_plans_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "sim_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_providers: {
        Row: {
          active: boolean
          affiliate_network: string | null
          affiliate_tracking_id: string | null
          affiliate_url_template: string | null
          blurb: string | null
          created_at: string
          id: string
          metadata: Json
          mode: string
          name: string
          site_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          affiliate_network?: string | null
          affiliate_tracking_id?: string | null
          affiliate_url_template?: string | null
          blurb?: string | null
          created_at?: string
          id: string
          metadata?: Json
          mode?: string
          name: string
          site_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          affiliate_network?: string | null
          affiliate_tracking_id?: string | null
          affiliate_url_template?: string | null
          blurb?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          mode?: string
          name?: string
          site_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sim_recommendations: {
        Row: {
          answers: Json
          created_at: string
          id: string
          ranked: Json
          top_plan_id: string | null
          user_id: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          ranked?: Json
          top_plan_id?: string | null
          user_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          ranked?: Json
          top_plan_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sim_recommendations_top_plan_id_fkey"
            columns: ["top_plan_id"]
            isOneToOne: false
            referencedRelation: "sim_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      split_bills: {
        Row: {
          conversation_id: string | null
          created_at: string
          creator_id: string
          id: string
          mode: string
          note: string
          status: string
          total_agorot: number
          updated_at: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          creator_id: string
          id?: string
          mode?: string
          note?: string
          status?: string
          total_agorot: number
          updated_at?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          mode?: string
          note?: string
          status?: string
          total_agorot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_bills_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      split_shares: {
        Row: {
          amount_agorot: number
          bill_id: string
          created_at: string
          entry_id: string | null
          id: string
          paid_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_agorot: number
          bill_id: string
          created_at?: string
          entry_id?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_agorot?: number
          bill_id?: string
          created_at?: string
          entry_id?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_shares_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "split_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_meta: {
        Row: {
          active: boolean
          chain: string | null
          city: string | null
          created_at: string
          day_pass_ils: number | null
          english_friendly: boolean
          facilities: string[]
          google_place_id: string
          id: string
          internal_notes: string | null
          label: string | null
          min_contract_months: number | null
          monthly_ils: number | null
          name_snapshot: string | null
          notes: string | null
          partner: boolean
          partner_offer: string | null
          short_stay: boolean
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          active?: boolean
          chain?: string | null
          city?: string | null
          created_at?: string
          day_pass_ils?: number | null
          english_friendly?: boolean
          facilities?: string[]
          google_place_id: string
          id?: string
          internal_notes?: string | null
          label?: string | null
          min_contract_months?: number | null
          monthly_ils?: number | null
          name_snapshot?: string | null
          notes?: string | null
          partner?: boolean
          partner_offer?: string | null
          short_stay?: boolean
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          active?: boolean
          chain?: string | null
          city?: string | null
          created_at?: string
          day_pass_ils?: number | null
          english_friendly?: boolean
          facilities?: string[]
          google_place_id?: string
          id?: string
          internal_notes?: string | null
          label?: string | null
          min_contract_months?: number | null
          monthly_ils?: number | null
          name_snapshot?: string | null
          notes?: string | null
          partner?: boolean
          partner_offer?: string | null
          short_stay?: boolean
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      audience_allows: {
        Args: {
          _kind: string
          _subject_id: string
          _subject_type: string
          _user_id: string
        }
        Returns: boolean
      }
      claim_first_admin: { Args: { _user_id: string }; Returns: boolean }
      cohort_programme_id: { Args: { _cohort_id: string }; Returns: string }
      cohort_staff_can: {
        Args: { _cohort_id: string; _perm: string; _user_id: string }
        Returns: boolean
      }
      ensure_account: {
        Args: { _user_id: string }
        Returns: {
          balance_agorot: number
          created_at: string
          currency: string
          held_agorot: number
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      event_cohort_id: { Args: { _event_id: string }; Returns: string }
      funding_settle: {
        Args: {
          _fee_minor: number
          _idempotency_key?: string
          _interbank_rate: number
          _method?: string
          _pay_amount_minor: number
          _pay_currency: string
          _provider?: string
          _provider_ref?: string
          _quoted_rate: number
          _shekels_agorot: number
          _user_id: string
        }
        Returns: {
          created_at: string
          entry_id: string | null
          fee_minor: number
          id: string
          idempotency_key: string
          interbank_rate: number
          method: string
          pay_amount_minor: number
          pay_currency: string
          provider: string
          provider_ref: string | null
          quoted_rate: number
          settled_at: string | null
          shekels_agorot: number
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "funding_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      group_cohort_id: { Args: { _group_id: string }; Returns: string }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hold_create: {
        Args: {
          _amount_agorot: number
          _category?: string
          _external_ref?: string
          _icon?: string
          _idempotency_key?: string
          _merchant: string
          _user_id: string
        }
        Returns: {
          amount_agorot: number
          category: string
          created_at: string
          external_ref: string | null
          icon: string
          id: string
          idempotency_key: string
          merchant: string
          resolved_at: string | null
          settled_amount_agorot: number | null
          settled_entry_id: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "holds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hold_release: {
        Args: { _hold_id: string; _user_id: string }
        Returns: {
          amount_agorot: number
          category: string
          created_at: string
          external_ref: string | null
          icon: string
          id: string
          idempotency_key: string
          merchant: string
          resolved_at: string | null
          settled_amount_agorot: number | null
          settled_entry_id: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "holds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hold_settle: {
        Args: {
          _final_amount_agorot?: number
          _hold_id: string
          _user_id: string
        }
        Returns: {
          amount_agorot: number
          balance_after_agorot: number
          category: string
          counterparty: string | null
          created_at: string
          direction: string
          external_ref: string | null
          hold_id: string | null
          icon: string
          id: string
          idempotency_key: string
          merchant: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ledger_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      in_cohort: {
        Args: { _cohort_id: string; _user_id: string }
        Returns: boolean
      }
      in_conversation: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_blocked_pair: { Args: { _a: string; _b: string }; Returns: boolean }
      is_cohort_staff: {
        Args: { _cohort_id: string; _user_id: string }
        Returns: boolean
      }
      is_programme_owner: {
        Args: { _programme_id: string; _user_id: string }
        Returns: boolean
      }
      is_programme_staff: {
        Args: { _programme_id: string; _user_id: string }
        Returns: boolean
      }
      ledger_post: {
        Args: {
          _amount_agorot: number
          _category?: string
          _counterparty?: string
          _direction: string
          _external_ref?: string
          _hold_id?: string
          _icon?: string
          _idempotency_key?: string
          _merchant: string
          _user_id: string
        }
        Returns: {
          amount_agorot: number
          balance_after_agorot: number
          category: string
          counterparty: string | null
          created_at: string
          direction: string
          external_ref: string | null
          hold_id: string | null
          icon: string
          id: string
          idempotency_key: string
          merchant: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ledger_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_cohort_id: { Args: { _user_id: string }; Returns: string }
      owes_on_bill: {
        Args: { _bill_id: string; _user_id: string }
        Returns: boolean
      }
      programme_code_preview: {
        Args: { _code: string }
        Returns: {
          city: string
          cohort_id: string
          cohort_name: string
          ends_on: string
          is_demo: boolean
          organisation: string
          programme_name: string
          starts_on: string
        }[]
      }
      programme_join: {
        Args: { _code: string; _user_id: string }
        Returns: {
          cohort_id: string
          created_at: string
          id: string
          joined_at: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "programme_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shares_cohort: { Args: { _a: string; _b: string }; Returns: boolean }
      staff_can: {
        Args: { _perm: string; _programme_id: string; _user_id: string }
        Returns: boolean
      }
      ticket_purchase: {
        Args: {
          _event_id: string
          _idempotency_key?: string
          _quantity: number
          _user_id: string
        }
        Returns: {
          amount_agorot: number
          code: string
          created_at: string
          entry_id: string | null
          event_id: string
          id: string
          idempotency_key: string
          quantity: number
          status: string
          used_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_post: {
        Args: {
          _amount_agorot: number
          _daily_cap_agorot?: number
          _idempotency_key?: string
          _note?: string
          _recipient: string
          _sender: string
        }
        Returns: {
          amount_agorot: number
          balance_after_agorot: number
          category: string
          counterparty: string | null
          created_at: string
          direction: string
          external_ref: string | null
          hold_id: string | null
          icon: string
          id: string
          idempotency_key: string
          merchant: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ledger_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      vote_cohort_id: { Args: { _vote_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "reviewer" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "reviewer", "member"],
    },
  },
} as const
