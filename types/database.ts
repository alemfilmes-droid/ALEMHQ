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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          archived_at: string | null
          audience_levels: Database["public"]["Enums"]["org_level"][]
          audience_squads: Database["public"]["Enums"]["squad"][]
          author_id: string | null
          body: string
          created_at: string
          expires_at: string | null
          id: string
          is_pinned: boolean
          notified_at: string | null
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          audience_levels?: Database["public"]["Enums"]["org_level"][]
          audience_squads?: Database["public"]["Enums"]["squad"][]
          author_id?: string | null
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          notified_at?: string | null
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          audience_levels?: Database["public"]["Enums"]["org_level"][]
          audience_squads?: Database["public"]["Enums"]["squad"][]
          author_id?: string | null
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          notified_at?: string | null
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          effective_from: string
          id: string
          kind: Database["public"]["Enums"]["commission_kind"]
          percent: number
          updated_by: string | null
        }
        Insert: {
          effective_from?: string
          id?: string
          kind: Database["public"]["Enums"]["commission_kind"]
          percent: number
          updated_by?: string | null
        }
        Update: {
          effective_from?: string
          id?: string
          kind?: Database["public"]["Enums"]["commission_kind"]
          percent?: number
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          all_day: boolean
          attendees: string[]
          company_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          ends_at: string
          external_attendees: Json
          google_calendar_id: string | null
          google_event_id: string | null
          google_sync_status: Database["public"]["Enums"]["google_sync_status"]
          id: string
          kind: Database["public"]["Enums"]["commitment_kind"]
          location_or_link: string | null
          notes: string | null
          owner_id: string
          pauta_id: string | null
          project_id: string | null
          recurrence_rule: string | null
          reminder_minutes: number[]
          starts_at: string
          status: Database["public"]["Enums"]["commitment_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["commitment_visibility"]
        }
        Insert: {
          all_day?: boolean
          attendees?: string[]
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          ends_at: string
          external_attendees?: Json
          google_calendar_id?: string | null
          google_event_id?: string | null
          google_sync_status?: Database["public"]["Enums"]["google_sync_status"]
          id?: string
          kind?: Database["public"]["Enums"]["commitment_kind"]
          location_or_link?: string | null
          notes?: string | null
          owner_id: string
          pauta_id?: string | null
          project_id?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number[]
          starts_at: string
          status?: Database["public"]["Enums"]["commitment_status"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["commitment_visibility"]
        }
        Update: {
          all_day?: boolean
          attendees?: string[]
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          ends_at?: string
          external_attendees?: Json
          google_calendar_id?: string | null
          google_event_id?: string | null
          google_sync_status?: Database["public"]["Enums"]["google_sync_status"]
          id?: string
          kind?: Database["public"]["Enums"]["commitment_kind"]
          location_or_link?: string | null
          notes?: string | null
          owner_id?: string
          pauta_id?: string | null
          project_id?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number[]
          starts_at?: string
          status?: Database["public"]["Enums"]["commitment_status"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["commitment_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "commitments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "commitments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "commitments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "commitments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          attention_margin_pct: number
          default_daily_hours: number
          default_workdays: number[]
          healthy_margin_pct: number
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attention_margin_pct?: number
          default_daily_hours?: number
          default_workdays?: number[]
          healthy_margin_pct?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attention_margin_pct?: number
          default_daily_hours?: number
          default_workdays?: number[]
          healthy_margin_pct?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          became_client_at: string | null
          city: string | null
          created_at: string
          created_by: string | null
          document: string | null
          health: Database["public"]["Enums"]["client_health"]
          health_note: string | null
          health_updated_at: string | null
          health_updated_by: string | null
          id: string
          instagram: string | null
          lifecycle: Database["public"]["Enums"]["company_lifecycle"]
          logo_url: string | null
          name: string
          segment: string | null
          source: Database["public"]["Enums"]["company_source"] | null
          source_detail: string | null
          tier: Database["public"]["Enums"]["client_tier"] | null
          updated_at: string
          website: string | null
        }
        Insert: {
          became_client_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          health?: Database["public"]["Enums"]["client_health"]
          health_note?: string | null
          health_updated_at?: string | null
          health_updated_by?: string | null
          id?: string
          instagram?: string | null
          lifecycle?: Database["public"]["Enums"]["company_lifecycle"]
          logo_url?: string | null
          name: string
          segment?: string | null
          source?: Database["public"]["Enums"]["company_source"] | null
          source_detail?: string | null
          tier?: Database["public"]["Enums"]["client_tier"] | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          became_client_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          health?: Database["public"]["Enums"]["client_health"]
          health_note?: string | null
          health_updated_at?: string | null
          health_updated_by?: string | null
          id?: string
          instagram?: string | null
          lifecycle?: Database["public"]["Enums"]["company_lifecycle"]
          logo_url?: string | null
          name?: string
          segment?: string | null
          source?: Database["public"]["Enums"]["company_source"] | null
          source_detail?: string | null
          tier?: Database["public"]["Enums"]["client_tier"] | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_health_updated_by_fkey"
            columns: ["health_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_decision_maker: boolean
          is_primary: boolean
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_decision_maker?: boolean
          is_primary?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_decision_maker?: boolean
          is_primary?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
        ]
      }
      crm_code_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          deal_id: string
          id: string
          kind: Database["public"]["Enums"]["activity_kind"]
          occurred_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          deal_id: string
          id?: string
          kind: Database["public"]["Enums"]["activity_kind"]
          occurred_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          deal_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind"]
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_interactions: {
        Row: {
          approach: string | null
          author_id: string | null
          body: string
          channel:
            | Database["public"]["Enums"]["deal_interaction_channel"]
            | null
          consumed_at: string | null
          created_at: string
          deal_id: string
          id: string
          kind: Database["public"]["Enums"]["deal_interaction_kind"]
          occurred_at: string
          responded: boolean | null
          responded_to_interaction_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          stage_to: Database["public"]["Enums"]["deal_stage"] | null
        }
        Insert: {
          approach?: string | null
          author_id?: string | null
          body: string
          channel?:
            | Database["public"]["Enums"]["deal_interaction_channel"]
            | null
          consumed_at?: string | null
          created_at?: string
          deal_id: string
          id?: string
          kind: Database["public"]["Enums"]["deal_interaction_kind"]
          occurred_at?: string
          responded?: boolean | null
          responded_to_interaction_id?: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          stage_to?: Database["public"]["Enums"]["deal_stage"] | null
        }
        Update: {
          approach?: string | null
          author_id?: string | null
          body?: string
          channel?:
            | Database["public"]["Enums"]["deal_interaction_channel"]
            | null
          consumed_at?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["deal_interaction_kind"]
          occurred_at?: string
          responded?: boolean | null
          responded_to_interaction_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_to?: Database["public"]["Enums"]["deal_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_interactions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_interactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_interactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_interactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_interactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_interactions_responded_to_interaction_id_fkey"
            columns: ["responded_to_interaction_id"]
            isOneToOne: false
            referencedRelation: "deal_interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_meetings: {
        Row: {
          attendee_id: string
          calendar_event_id: string | null
          commitment_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          duration_minutes: number
          id: string
          location_or_link: string | null
          result: Database["public"]["Enums"]["meeting_outcome"] | null
          result_note: string | null
          result_registered_at: string | null
          result_registered_by: string | null
          scheduled_at: string
        }
        Insert: {
          attendee_id: string
          calendar_event_id?: string | null
          commitment_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          duration_minutes?: number
          id?: string
          location_or_link?: string | null
          result?: Database["public"]["Enums"]["meeting_outcome"] | null
          result_note?: string | null
          result_registered_at?: string | null
          result_registered_by?: string | null
          scheduled_at: string
        }
        Update: {
          attendee_id?: string
          calendar_event_id?: string | null
          commitment_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          duration_minutes?: number
          id?: string
          location_or_link?: string | null
          result?: Database["public"]["Enums"]["meeting_outcome"] | null
          result_note?: string | null
          result_registered_at?: string | null
          result_registered_by?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_meetings_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_meetings_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_meetings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_meetings_result_registered_by_fkey"
            columns: ["result_registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_negotiations: {
        Row: {
          agreed_amount: number | null
          channel:
            | Database["public"]["Enums"]["deal_interaction_channel"]
            | null
          client_counter_amount: number | null
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          notes: string
          our_counter_amount: number | null
          proposal_id: string
        }
        Insert: {
          agreed_amount?: number | null
          channel?:
            | Database["public"]["Enums"]["deal_interaction_channel"]
            | null
          client_counter_amount?: number | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          notes: string
          our_counter_amount?: number | null
          proposal_id: string
        }
        Update: {
          agreed_amount?: number | null
          channel?:
            | Database["public"]["Enums"]["deal_interaction_channel"]
            | null
          client_counter_amount?: number | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          notes?: string
          our_counter_amount?: number | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_negotiations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_negotiations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_negotiations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_negotiations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_negotiations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_negotiations_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "deal_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_proposals: {
        Row: {
          amount: number
          created_at: string
          deal_id: string
          document_url: string | null
          id: string
          scope_notes: string | null
          sent_at: string
          sent_by: string | null
          sent_channel: Database["public"]["Enums"]["proposal_channel"]
          status: Database["public"]["Enums"]["proposal_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          deal_id: string
          document_url?: string | null
          id?: string
          scope_notes?: string | null
          sent_at?: string
          sent_by?: string | null
          sent_channel: Database["public"]["Enums"]["proposal_channel"]
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          deal_id?: string
          document_url?: string | null
          id?: string
          scope_notes?: string | null
          sent_at?: string
          sent_by?: string | null
          sent_channel?: Database["public"]["Enums"]["proposal_channel"]
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "deal_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_proposals_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_qualification: {
        Row: {
          budget_range: string | null
          deal_id: string
          decision_maker_contacted: boolean | null
          desired_timeline: string | null
          notes: string | null
          pain_point: string | null
          project_type: string | null
          qualified_at: string | null
          qualified_by: string | null
          updated_at: string
        }
        Insert: {
          budget_range?: string | null
          deal_id: string
          decision_maker_contacted?: boolean | null
          desired_timeline?: string | null
          notes?: string | null
          pain_point?: string | null
          project_type?: string | null
          qualified_at?: string | null
          qualified_by?: string | null
          updated_at?: string
        }
        Update: {
          budget_range?: string | null
          deal_id?: string
          decision_maker_contacted?: boolean | null
          desired_timeline?: string | null
          notes?: string | null
          pain_point?: string | null
          project_type?: string | null
          qualified_at?: string | null
          qualified_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_qualification_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_qualification_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_qualification_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_qualification_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_qualification_qualified_by_fkey"
            columns: ["qualified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_probabilities: {
        Row: {
          probability: number
          stage: Database["public"]["Enums"]["deal_stage"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          probability: number
          stage: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          probability?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_probabilities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          archived_at: string | null
          code: string | null
          company_id: string
          created_at: string
          created_by: string | null
          direction_note: string | null
          direction_task: Database["public"]["Enums"]["direction_task"] | null
          estimated_value: number | null
          expected_close_date: string | null
          fast_track: boolean
          id: string
          is_reheated: boolean
          lost_at: string | null
          lost_note: string | null
          lost_reason: Database["public"]["Enums"]["deal_loss_reason"] | null
          next_action: string | null
          next_action_at: string | null
          owner_id: string
          primary_contact_id: string | null
          prospection_goals: Database["public"]["Enums"]["prospection_goal"][]
          reheat_due_at: string | null
          reheat_status: Database["public"]["Enums"]["reheat_status"] | null
          responsible_id: string | null
          source: Database["public"]["Enums"]["company_source"] | null
          stage: Database["public"]["Enums"]["deal_stage"]
          stage_changed_at: string
          title: string
          updated_at: string
          won_at: string | null
        }
        Insert: {
          archived_at?: string | null
          code?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          direction_note?: string | null
          direction_task?: Database["public"]["Enums"]["direction_task"] | null
          estimated_value?: number | null
          expected_close_date?: string | null
          fast_track?: boolean
          id?: string
          is_reheated?: boolean
          lost_at?: string | null
          lost_note?: string | null
          lost_reason?: Database["public"]["Enums"]["deal_loss_reason"] | null
          next_action?: string | null
          next_action_at?: string | null
          owner_id: string
          primary_contact_id?: string | null
          prospection_goals?: Database["public"]["Enums"]["prospection_goal"][]
          reheat_due_at?: string | null
          reheat_status?: Database["public"]["Enums"]["reheat_status"] | null
          responsible_id?: string | null
          source?: Database["public"]["Enums"]["company_source"] | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_changed_at?: string
          title: string
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          archived_at?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          direction_note?: string | null
          direction_task?: Database["public"]["Enums"]["direction_task"] | null
          estimated_value?: number | null
          expected_close_date?: string | null
          fast_track?: boolean
          id?: string
          is_reheated?: boolean
          lost_at?: string | null
          lost_note?: string | null
          lost_reason?: Database["public"]["Enums"]["deal_loss_reason"] | null
          next_action?: string | null
          next_action_at?: string | null
          owner_id?: string
          primary_contact_id?: string | null
          prospection_goals?: Database["public"]["Enums"]["prospection_goal"][]
          reheat_due_at?: string | null
          reheat_status?: Database["public"]["Enums"]["reheat_status"] | null
          responsible_id?: string | null
          source?: Database["public"]["Enums"]["company_source"] | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_changed_at?: string
          title?: string
          updated_at?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          access_role: Database["public"]["Enums"]["access_role"]
          created_at: string
          email: string
          expires_at: string
          functions: Database["public"]["Enums"]["production_function"][]
          id: string
          invited_by: string | null
          squads: Database["public"]["Enums"]["squad"][]
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          access_role: Database["public"]["Enums"]["access_role"]
          created_at?: string
          email: string
          expires_at?: string
          functions?: Database["public"]["Enums"]["production_function"][]
          id?: string
          invited_by?: string | null
          squads?: Database["public"]["Enums"]["squad"][]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          access_role?: Database["public"]["Enums"]["access_role"]
          created_at?: string
          email?: string
          expires_at?: string
          functions?: Database["public"]["Enums"]["production_function"][]
          id?: string
          invited_by?: string | null
          squads?: Database["public"]["Enums"]["squad"][]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          read_at: string | null
          recipient_id: string
          title: string
          type: string
          url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
          url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pauta_code_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      pauta_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          edited_at: string | null
          id: string
          pauta_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          pauta_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          pauta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pauta_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_comments_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_comments_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      pauta_members: {
        Row: {
          added_at: string
          added_by: string | null
          pauta_id: string
          production_function: Database["public"]["Enums"]["production_function"]
          profile_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          pauta_id: string
          production_function: Database["public"]["Enums"]["production_function"]
          profile_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          pauta_id?: string
          production_function?: Database["public"]["Enums"]["production_function"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pauta_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_members_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_members_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pauta_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_assignee: string | null
          from_status: Database["public"]["Enums"]["pauta_status"] | null
          id: string
          note: string | null
          pauta_id: string
          to_assignee: string | null
          to_status: Database["public"]["Enums"]["pauta_status"] | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_assignee?: string | null
          from_status?: Database["public"]["Enums"]["pauta_status"] | null
          id?: string
          note?: string | null
          pauta_id: string
          to_assignee?: string | null
          to_status?: Database["public"]["Enums"]["pauta_status"] | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_assignee?: string | null
          from_status?: Database["public"]["Enums"]["pauta_status"] | null
          id?: string
          note?: string | null
          pauta_id?: string
          to_assignee?: string | null
          to_status?: Database["public"]["Enums"]["pauta_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "pauta_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_status_history_from_assignee_fkey"
            columns: ["from_assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_status_history_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_status_history_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_status_history_to_assignee_fkey"
            columns: ["to_assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pautas: {
        Row: {
          archived_at: string | null
          board_column: Database["public"]["Enums"]["pauta_column"]
          briefing: string | null
          capture_type: Database["public"]["Enums"]["pauta_capture_type"][]
          code: string | null
          contact_id: string | null
          contact_phone_override: string | null
          created_at: string
          created_by: string | null
          created_for: string | null
          current_assignee_id: string | null
          deal_id: string | null
          delivery_url: string | null
          drive_folder_url: string | null
          due_date: string | null
          duration_minutes: number | null
          equipment_notes: string | null
          format: string | null
          id: string
          is_critical: boolean
          is_standalone: boolean
          lead_id: string
          location_address: string | null
          previous_assignee_id: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          project_id: string | null
          returned_at: string | null
          scheduled_at: string | null
          script_url: string | null
          squad: Database["public"]["Enums"]["squad"]
          start_date: string | null
          status: Database["public"]["Enums"]["pauta_status"]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          board_column: Database["public"]["Enums"]["pauta_column"]
          briefing?: string | null
          capture_type?: Database["public"]["Enums"]["pauta_capture_type"][]
          code?: string | null
          contact_id?: string | null
          contact_phone_override?: string | null
          created_at?: string
          created_by?: string | null
          created_for?: string | null
          current_assignee_id?: string | null
          deal_id?: string | null
          delivery_url?: string | null
          drive_folder_url?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          equipment_notes?: string | null
          format?: string | null
          id?: string
          is_critical?: boolean
          is_standalone?: boolean
          lead_id: string
          location_address?: string | null
          previous_assignee_id?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          project_id?: string | null
          returned_at?: string | null
          scheduled_at?: string | null
          script_url?: string | null
          squad: Database["public"]["Enums"]["squad"]
          start_date?: string | null
          status: Database["public"]["Enums"]["pauta_status"]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          board_column?: Database["public"]["Enums"]["pauta_column"]
          briefing?: string | null
          capture_type?: Database["public"]["Enums"]["pauta_capture_type"][]
          code?: string | null
          contact_id?: string | null
          contact_phone_override?: string | null
          created_at?: string
          created_by?: string | null
          created_for?: string | null
          current_assignee_id?: string | null
          deal_id?: string | null
          delivery_url?: string | null
          drive_folder_url?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          equipment_notes?: string | null
          format?: string | null
          id?: string
          is_critical?: boolean
          is_standalone?: boolean
          lead_id?: string
          location_address?: string | null
          previous_assignee_id?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          project_id?: string | null
          returned_at?: string | null
          scheduled_at?: string | null
          script_url?: string | null
          squad?: Database["public"]["Enums"]["squad"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["pauta_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pautas_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_created_for_fkey"
            columns: ["created_for"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_current_assignee_id_fkey"
            columns: ["current_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "pautas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_previous_assignee_id_fkey"
            columns: ["previous_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pautas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          amount: number
          cancelled_at: string | null
          category: Database["public"]["Enums"]["payable_category"]
          company_id: string | null
          cost_scope: Database["public"]["Enums"]["cost_scope"]
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          is_fixed: boolean
          notes: string | null
          paid_at: string | null
          payee_name: string | null
          payee_profile_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          project_id: string | null
          recurrence: Database["public"]["Enums"]["payable_recurrence"]
          recurrence_parent_id: string | null
          recurrence_until: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          category: Database["public"]["Enums"]["payable_category"]
          company_id?: string | null
          cost_scope?: Database["public"]["Enums"]["cost_scope"]
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          is_fixed?: boolean
          notes?: string | null
          paid_at?: string | null
          payee_name?: string | null
          payee_profile_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["payable_recurrence"]
          recurrence_parent_id?: string | null
          recurrence_until?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["payable_category"]
          company_id?: string | null
          cost_scope?: Database["public"]["Enums"]["cost_scope"]
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          is_fixed?: boolean
          notes?: string | null
          paid_at?: string | null
          payee_name?: string | null
          payee_profile_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["payable_recurrence"]
          recurrence_parent_id?: string | null
          recurrence_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_payee_profile_id_fkey"
            columns: ["payee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "payables_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_squads: {
        Row: {
          created_at: string
          is_lead: boolean
          profile_id: string
          squad: Database["public"]["Enums"]["squad"]
        }
        Insert: {
          created_at?: string
          is_lead?: boolean
          profile_id: string
          squad: Database["public"]["Enums"]["squad"]
        }
        Update: {
          created_at?: string
          is_lead?: boolean
          profile_id?: string
          squad?: Database["public"]["Enums"]["squad"]
        }
        Relationships: [
          {
            foreignKeyName: "profile_squads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_role: Database["public"]["Enums"]["access_role"]
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          functions: Database["public"]["Enums"]["production_function"][]
          has_finance_access: boolean
          id: string
          is_active: boolean
          job_title: string | null
          org_level: Database["public"]["Enums"]["org_level"]
          phone: string | null
          updated_at: string
        }
        Insert: {
          access_role?: Database["public"]["Enums"]["access_role"]
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          functions?: Database["public"]["Enums"]["production_function"][]
          has_finance_access?: boolean
          id: string
          is_active?: boolean
          job_title?: string | null
          org_level?: Database["public"]["Enums"]["org_level"]
          phone?: string | null
          updated_at?: string
        }
        Update: {
          access_role?: Database["public"]["Enums"]["access_role"]
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          functions?: Database["public"]["Enums"]["production_function"][]
          has_finance_access?: boolean
          id?: string
          is_active?: boolean
          job_title?: string | null
          org_level?: Database["public"]["Enums"]["org_level"]
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_financials: {
        Row: {
          contract_value: number | null
          payment_terms: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          contract_value?: number | null
          payment_terms?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          contract_value?: number | null
          payment_terms?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_financials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_financials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_at: string
          added_by: string | null
          profile_id: string
          project_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          profile_id: string
          project_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          profile_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          briefing: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          delivered_at: string | null
          delivery_notes: string | null
          description: string | null
          drive_folder_url: string | null
          due_date: string | null
          end_date: string | null
          id: string
          included_revision_rounds: number | null
          is_internal: boolean
          location_address: string | null
          location_notes: string | null
          model: Database["public"]["Enums"]["project_model"]
          name: string
          owner_id: string
          priority: Database["public"]["Enums"]["project_priority"]
          production_notes: string | null
          service_types: Database["public"]["Enums"]["service_type"][]
          stage: Database["public"]["Enums"]["project_stage"]
          start_date: string | null
          updated_at: string
        }
        Insert: {
          briefing?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          description?: string | null
          drive_folder_url?: string | null
          due_date?: string | null
          end_date?: string | null
          id?: string
          included_revision_rounds?: number | null
          is_internal?: boolean
          location_address?: string | null
          location_notes?: string | null
          model?: Database["public"]["Enums"]["project_model"]
          name: string
          owner_id: string
          priority?: Database["public"]["Enums"]["project_priority"]
          production_notes?: string | null
          service_types?: Database["public"]["Enums"]["service_type"][]
          stage?: Database["public"]["Enums"]["project_stage"]
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          briefing?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          description?: string | null
          drive_folder_url?: string | null
          due_date?: string | null
          end_date?: string | null
          id?: string
          included_revision_rounds?: number | null
          is_internal?: boolean
          location_address?: string | null
          location_notes?: string | null
          model?: Database["public"]["Enums"]["project_model"]
          name?: string
          owner_id?: string
          priority?: Database["public"]["Enums"]["project_priority"]
          production_notes?: string | null
          service_types?: Database["public"]["Enums"]["service_type"][]
          stage?: Database["public"]["Enums"]["project_stage"]
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "projects_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          cancelled_at: string | null
          company_id: string
          competence_month: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string
          due_date: string
          id: string
          installment_number: number | null
          installment_total: number | null
          invoice_number: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          project_id: string | null
          received_amount: number | null
          received_at: string | null
          service_description: string | null
          task_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          company_id: string
          competence_month?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description: string
          due_date: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          invoice_number?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          project_id?: string | null
          received_amount?: number | null
          received_at?: string | null
          service_description?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          company_id?: string
          competence_month?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string
          due_date?: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          invoice_number?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          project_id?: string | null
          received_amount?: number | null
          received_at?: string | null
          service_description?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "receivables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "receivables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "receivables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_edited: boolean
          kind: Database["public"]["Enums"]["time_entry_kind"]
          note: string | null
          occurred_at: string
          original_occurred_at: string | null
          profile_id: string
          source: Database["public"]["Enums"]["time_entry_source"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          kind: Database["public"]["Enums"]["time_entry_kind"]
          note?: string | null
          occurred_at: string
          original_occurred_at?: string | null
          profile_id: string
          source?: Database["public"]["Enums"]["time_entry_source"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          kind?: Database["public"]["Enums"]["time_entry_kind"]
          note?: string | null
          occurred_at?: string
          original_occurred_at?: string | null
          profile_id?: string
          source?: Database["public"]["Enums"]["time_entry_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          notify_agenda: boolean
          notify_avisos: boolean
          notify_banco_horas: boolean
          notify_comercial: boolean
          notify_financeiro: boolean
          notify_pautas: boolean
          notify_projetos: boolean
          profile_id: string
          updated_at: string
        }
        Insert: {
          notify_agenda?: boolean
          notify_avisos?: boolean
          notify_banco_horas?: boolean
          notify_comercial?: boolean
          notify_financeiro?: boolean
          notify_pautas?: boolean
          notify_projetos?: boolean
          profile_id: string
          updated_at?: string
        }
        Update: {
          notify_agenda?: boolean
          notify_avisos?: boolean
          notify_banco_horas?: boolean
          notify_comercial?: boolean
          notify_financeiro?: boolean
          notify_pautas?: boolean
          notify_projetos?: boolean
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          daily_hours: number
          effective_from: string | null
          profile_id: string
          updated_at: string
          updated_by: string | null
          workdays: number[]
        }
        Insert: {
          daily_hours?: number
          effective_from?: string | null
          profile_id: string
          updated_at?: string
          updated_by?: string | null
          workdays?: number[]
        }
        Update: {
          daily_hours?: number
          effective_from?: string | null
          profile_id?: string
          updated_at?: string
          updated_by?: string | null
          workdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_schedules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cash_flow_projection: {
        Row: {
          day: string | null
          expected_inflow: number | null
          expected_outflow: number | null
          net_change: number | null
          running_balance: number | null
        }
        Relationships: []
      }
      deals_needing_attention: {
        Row: {
          archived_at: string | null
          can_reheat: boolean | null
          code: string | null
          commission_amount: number | null
          commission_percent: number | null
          company_id: string | null
          company_lifecycle:
            | Database["public"]["Enums"]["company_lifecycle"]
            | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          days_in_stage: number | null
          direction_note: string | null
          direction_task: Database["public"]["Enums"]["direction_task"] | null
          estimated_value: number | null
          expected_close_date: string | null
          fast_track: boolean | null
          has_pending_meeting: boolean | null
          hours_in_current_stage: number | null
          hours_since_last_interaction: number | null
          id: string | null
          interactions_count: number | null
          is_qualified: boolean | null
          is_reheated: boolean | null
          last_interaction_at: string | null
          latest_proposal_amount: number | null
          latest_proposal_sent_at: string | null
          latest_proposal_status:
            | Database["public"]["Enums"]["proposal_status"]
            | null
          lost_at: string | null
          lost_note: string | null
          lost_reason: Database["public"]["Enums"]["deal_loss_reason"] | null
          needs_update: boolean | null
          next_action: string | null
          next_action_at: string | null
          next_action_overdue: boolean | null
          next_action_today: boolean | null
          owner_avatar_url: string | null
          owner_id: string | null
          owner_name: string | null
          pending_meeting_id: string | null
          primary_contact_id: string | null
          primary_contact_name: string | null
          prospection_goals:
            | Database["public"]["Enums"]["prospection_goal"][]
            | null
          reheat_due_at: string | null
          reheat_ready: boolean | null
          reheat_status: Database["public"]["Enums"]["reheat_status"] | null
          responsible_avatar_url: string | null
          responsible_id: string | null
          responsible_name: string | null
          returned_from_meeting: boolean | null
          source: Database["public"]["Enums"]["company_source"] | null
          stage: Database["public"]["Enums"]["deal_stage"] | null
          stage_changed_at: string | null
          stale_prospection: boolean | null
          temperature: string | null
          temperature_reason: string | null
          title: string | null
          updated_at: string | null
          won_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals_sla: {
        Row: {
          can_reheat: boolean | null
          deal_id: string | null
          hours_in_current_stage: number | null
          hours_since_last_interaction: number | null
          last_interaction_at: string | null
          needs_update: boolean | null
          next_action_overdue: boolean | null
          next_action_today: boolean | null
          owner_id: string | null
          reheat_ready: boolean | null
          responsible_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"] | null
          stale_prospection: boolean | null
          temperature: string | null
          temperature_reason: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals_with_details: {
        Row: {
          archived_at: string | null
          can_reheat: boolean | null
          code: string | null
          commission_amount: number | null
          commission_percent: number | null
          company_id: string | null
          company_lifecycle:
            | Database["public"]["Enums"]["company_lifecycle"]
            | null
          company_logo_url: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          days_in_stage: number | null
          direction_note: string | null
          direction_task: Database["public"]["Enums"]["direction_task"] | null
          estimated_value: number | null
          expected_close_date: string | null
          fast_track: boolean | null
          has_pending_meeting: boolean | null
          hours_in_current_stage: number | null
          hours_since_last_interaction: number | null
          id: string | null
          interactions_count: number | null
          is_qualified: boolean | null
          is_reheated: boolean | null
          last_interaction_at: string | null
          latest_proposal_amount: number | null
          latest_proposal_sent_at: string | null
          latest_proposal_status:
            | Database["public"]["Enums"]["proposal_status"]
            | null
          lost_at: string | null
          lost_note: string | null
          lost_reason: Database["public"]["Enums"]["deal_loss_reason"] | null
          needs_update: boolean | null
          next_action: string | null
          next_action_at: string | null
          next_action_overdue: boolean | null
          next_action_today: boolean | null
          owner_avatar_url: string | null
          owner_id: string | null
          owner_name: string | null
          pending_meeting_id: string | null
          primary_contact_id: string | null
          primary_contact_name: string | null
          prospection_goals:
            | Database["public"]["Enums"]["prospection_goal"][]
            | null
          reheat_due_at: string | null
          reheat_ready: boolean | null
          reheat_status: Database["public"]["Enums"]["reheat_status"] | null
          responsible_avatar_url: string | null
          responsible_id: string | null
          responsible_name: string | null
          returned_from_meeting: boolean | null
          source: Database["public"]["Enums"]["company_source"] | null
          stage: Database["public"]["Enums"]["deal_stage"] | null
          stage_changed_at: string | null
          stale_prospection: boolean | null
          temperature: string | null
          temperature_reason: string | null
          title: string | null
          updated_at: string | null
          won_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_by_client: {
        Row: {
          company_id: string | null
          company_name: string | null
          margin_pct: number | null
          margin_status: string | null
          project_count: number | null
          total_billed: number | null
          total_costs: number | null
          total_pending: number | null
          total_received: number | null
        }
        Relationships: []
      }
      finance_monthly_summary: {
        Row: {
          fixed_costs: number | null
          month_end: string | null
          month_start: string | null
          net_result: number | null
          overdue_payables_count: number | null
          overdue_receivables_count: number | null
          total_paid: number | null
          total_received: number | null
          total_to_pay: number | null
          total_to_receive: number | null
          variable_costs: number | null
        }
        Relationships: []
      }
      pautas_with_details: {
        Row: {
          archived_at: string | null
          assignee_avatar_url: string | null
          assignee_name: string | null
          board_column: Database["public"]["Enums"]["pauta_column"] | null
          briefing: string | null
          capture_type:
            | Database["public"]["Enums"]["pauta_capture_type"][]
            | null
          code: string | null
          comments_count: number | null
          company_id: string | null
          company_logo_url: string | null
          company_name: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_phone_override: string | null
          created_at: string | null
          created_by: string | null
          created_for: string | null
          created_for_name: string | null
          current_assignee_id: string | null
          deal_id: string | null
          delivery_url: string | null
          drive_folder_url: string | null
          due_date: string | null
          duration_minutes: number | null
          equipment_notes: string | null
          format: string | null
          id: string | null
          is_critical: boolean | null
          is_standalone: boolean | null
          lead_avatar_url: string | null
          lead_id: string | null
          lead_name: string | null
          location_address: string | null
          previous_assignee_id: string | null
          priority: Database["public"]["Enums"]["project_priority"] | null
          project_id: string | null
          project_is_internal: boolean | null
          project_name: string | null
          returned_at: string | null
          scheduled_at: string | null
          script_url: string | null
          squad: Database["public"]["Enums"]["squad"] | null
          start_date: string | null
          status: Database["public"]["Enums"]["pauta_status"] | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pautas_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_created_for_fkey"
            columns: ["created_for"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_current_assignee_id_fkey"
            columns: ["current_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "pautas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_previous_assignee_id_fkey"
            columns: ["previous_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "pautas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
        ]
      }
      payables_with_status: {
        Row: {
          amount: number | null
          cancelled_at: string | null
          category: Database["public"]["Enums"]["payable_category"] | null
          company_id: string | null
          cost_scope: Database["public"]["Enums"]["cost_scope"] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string | null
          is_fixed: boolean | null
          notes: string | null
          paid_at: string | null
          payee_label: string | null
          payee_name: string | null
          payee_profile_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          project_id: string | null
          project_name: string | null
          recurrence: Database["public"]["Enums"]["payable_recurrence"] | null
          recurrence_parent_id: string | null
          recurrence_until: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_payee_profile_id_fkey"
            columns: ["payee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "payables_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      project_profitability: {
        Row: {
          company_id: string | null
          company_name: string | null
          contract_value: number | null
          due_date: string | null
          is_internal: boolean | null
          margin_pct: number | null
          margin_status: string | null
          payables_paid: number | null
          payables_total: number | null
          planned_margin: number | null
          project_id: string | null
          project_name: string | null
          receivable_pending: number | null
          stage: Database["public"]["Enums"]["project_stage"] | null
          total_received: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
        ]
      }
      receivables_with_status: {
        Row: {
          amount: number | null
          cancelled_at: string | null
          company_id: string | null
          company_name: string | null
          competence_month: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string | null
          installment_number: number | null
          installment_total: number | null
          invoice_number: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          project_id: string | null
          project_name: string | null
          received_amount: number | null
          received_at: string | null
          service_description: string | null
          status: string | null
          task_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "receivables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "receivables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "receivables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_balance_summary: {
        Row: {
          month_balance_minutes: number | null
          profile_id: string | null
          total_balance_minutes: number | null
          total_worked_minutes: number | null
          week_balance_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_daily_summary: {
        Row: {
          balance_minutes: number | null
          expected_minutes: number | null
          first_entry: string | null
          last_exit: string | null
          open_session: boolean | null
          profile_id: string | null
          work_date: string | null
          worked_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      announcements_unread_count: { Args: never; Returns: number }
      can_manage_company: { Args: never; Returns: boolean }
      company_contract_ranking: {
        Args: never
        Returns: {
          company_id: string
          rank: number
          total_value: number | null
        }[]
      }
      margin_status_for: { Args: { p_pct: number }; Returns: string }
      publish_due_announcements: { Args: never; Returns: number }
      accept_invitation: { Args: never; Returns: undefined }
      agenda_conflicts: {
        Args: {
          p_ends_at: string
          p_exclude_id?: string
          p_people: string[]
          p_starts_at: string
        }
        Returns: {
          ends_at: string
          profile_id: string
          profile_name: string
          source: string
          starts_at: string
          title: string
        }[]
      }
      agenda_feed: {
        Args: {
          p_from: string
          p_only_mine?: boolean
          p_people?: string[]
          p_to: string
        }
        Returns: {
          all_day: boolean
          attendees: string[]
          busy_only: boolean
          can_edit: boolean
          commitment_id: string
          company_id: string
          company_logo_url: string
          company_name: string
          deal_id: string
          ends_at: string
          event_key: string
          external_attendees: Json
          google_sync_status: Database["public"]["Enums"]["google_sync_status"]
          kind: Database["public"]["Enums"]["commitment_kind"]
          location_or_link: string
          notes: string
          owner_id: string
          owner_name: string
          pauta_id: string
          project_id: string
          project_name: string
          recurrence_rule: string
          reminder_minutes: number[]
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["commitment_status"]
          title: string
          visibility: Database["public"]["Enums"]["commitment_visibility"]
        }[]
      }
      can_access_all_deals: { Args: never; Returns: boolean }
      can_access_deal: { Args: { p_deal_id: string }; Returns: boolean }
      can_edit_pauta: { Args: { p_pauta_id: string }; Returns: boolean }
      can_fully_manage_pauta: { Args: never; Returns: boolean }
      can_manage_company_logos: { Args: never; Returns: boolean }
      can_manage_pautas: { Args: never; Returns: boolean }
      can_manage_profile: { Args: { p_target_id: string }; Returns: boolean }
      can_read_companies: { Args: never; Returns: boolean }
      can_see_busy_of: { Args: { p_owner_id: string }; Returns: boolean }
      can_see_crm: { Args: never; Returns: boolean }
      can_see_money: { Args: never; Returns: boolean }
      can_view_commitment: {
        Args: {
          p_attendees: string[]
          p_created_by: string
          p_deal_id: string
          p_owner_id: string
          p_visibility: Database["public"]["Enums"]["commitment_visibility"]
        }
        Returns: boolean
      }
      can_view_pauta: { Args: { p_pauta_id: string }; Returns: boolean }
      close_deal_won: {
        Args: {
          p_atendimento_id: string
          p_contract_value: number
          p_deal_id: string
          p_end_date: string
          p_project_model: Database["public"]["Enums"]["project_model"]
          p_project_name: string
          p_project_owner_id: string
          p_start_date: string
          p_tier: Database["public"]["Enums"]["client_tier"]
        }
        Returns: {
          briefing: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          delivered_at: string | null
          delivery_notes: string | null
          description: string | null
          drive_folder_url: string | null
          due_date: string | null
          end_date: string | null
          id: string
          included_revision_rounds: number | null
          is_internal: boolean
          location_address: string | null
          location_notes: string | null
          model: Database["public"]["Enums"]["project_model"]
          name: string
          owner_id: string
          priority: Database["public"]["Enums"]["project_priority"]
          production_notes: string | null
          service_types: Database["public"]["Enums"]["service_type"][]
          stage: Database["public"]["Enums"]["project_stage"]
          start_date: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_stale_time_sessions: { Args: never; Returns: undefined }
      company_overview: { Args: { p_company_id: string }; Returns: Json }
      company_timeline: {
        Args: { p_company_id: string; p_limit?: number }
        Returns: {
          event_at: string
          kind: string
          label: string
          meta: Json
          ref_id: string
        }[]
      }
      crm_client_responded: { Args: { p_deal_id: string }; Returns: boolean }
      crm_commission_percent: { Args: { p_reheated: boolean }; Returns: number }
      crm_create_deal: {
        Args: {
          p_city: string
          p_company_id: string
          p_company_name: string
          p_contact_email: string
          p_contact_job_title: string
          p_contact_name: string
          p_contact_phone: string
          p_document: string
          p_estimated_value: number
          p_expected_close_date: string
          p_goals: Database["public"]["Enums"]["prospection_goal"][]
          p_instagram: string
          p_next_action: string
          p_next_action_at: string
          p_owner_id: string
          p_primary_contact_id: string
          p_segment: string
          p_source: Database["public"]["Enums"]["company_source"]
          p_title: string
          p_website: string
        }
        Returns: string
      }
      crm_deal_qualified: { Args: { p_deal_id: string }; Returns: boolean }
      crm_direction_label: {
        Args: { p_task: Database["public"]["Enums"]["direction_task"] }
        Returns: string
      }
      crm_head_id: { Args: never; Returns: string }
      crm_stage_label: {
        Args: { p_stage: Database["public"]["Enums"]["deal_stage"] }
        Returns: string
      }
      crm_system_move: { Args: never; Returns: boolean }
      current_access_role: {
        Args: never
        Returns: Database["public"]["Enums"]["access_role"]
      }
      current_org_level: {
        Args: never
        Returns: Database["public"]["Enums"]["org_level"]
      }
      deal_change_stage: {
        Args: {
          p_approach: string
          p_body: string
          p_channel: Database["public"]["Enums"]["deal_interaction_channel"]
          p_deal_id: string
          p_kind: Database["public"]["Enums"]["deal_interaction_kind"]
          p_next_action: string
          p_next_action_at: string
          p_stage: Database["public"]["Enums"]["deal_stage"]
        }
        Returns: undefined
      }
      deal_define_reheat: {
        Args: {
          p_body: string
          p_deal_id: string
          p_document_url?: string
          p_next_action: string
          p_next_action_at: string
          p_path: string
          p_proposal_amount?: number
          p_proposal_channel?: Database["public"]["Enums"]["proposal_channel"]
          p_scope_notes?: string
        }
        Returns: undefined
      }
      deal_discard_reheat: { Args: { p_deal_id: string }; Returns: undefined }
      deal_log_interaction: {
        Args: {
          p_approach: string
          p_body: string
          p_channel: Database["public"]["Enums"]["deal_interaction_channel"]
          p_deal_id: string
          p_kind: Database["public"]["Enums"]["deal_interaction_kind"]
          p_next_action?: string
          p_next_action_at?: string
          p_responded_to?: string
        }
        Returns: string
      }
      deal_mark_lost: {
        Args: {
          p_deal_id: string
          p_note: string
          p_reason: Database["public"]["Enums"]["deal_loss_reason"]
        }
        Returns: undefined
      }
      deal_register_meeting_outcome: {
        Args: {
          p_meeting_id: string
          p_new_duration?: number
          p_new_location?: string
          p_new_starts_at?: string
          p_next_action?: string
          p_next_action_at?: string
          p_note: string
          p_result: Database["public"]["Enums"]["meeting_outcome"]
        }
        Returns: undefined
      }
      deal_register_negotiation: {
        Args: {
          p_agreed: number
          p_channel: Database["public"]["Enums"]["deal_interaction_channel"]
          p_client_counter: number
          p_deal_id: string
          p_next_action: string
          p_next_action_at: string
          p_notes: string
          p_our_counter: number
          p_proposal_id: string
        }
        Returns: string
      }
      deal_register_proposal: {
        Args: {
          p_amount: number
          p_channel: Database["public"]["Enums"]["proposal_channel"]
          p_deal_id: string
          p_document_url: string
          p_next_action: string
          p_next_action_at: string
          p_scope_notes: string
        }
        Returns: string
      }
      deal_set_direction: {
        Args: {
          p_deal_id: string
          p_due: string
          p_note: string
          p_task: Database["public"]["Enums"]["direction_task"]
        }
        Returns: undefined
      }
      deal_stage_rank: {
        Args: { p_stage: Database["public"]["Enums"]["deal_stage"] }
        Returns: number
      }
      expand_recurrence: {
        Args: { p_from: string; p_rule: string; p_start: string; p_to: string }
        Returns: string[]
      }
      expire_stale_invitations: { Args: never; Returns: undefined }
      finance_deals_in_negotiation: {
        Args: never
        Returns: {
          code: string
          company_id: string
          company_name: string
          deal_id: string
          expected_close_date: string
          owner_name: string
          probability: number
          proposal_amount: number
          proposal_sent_at: string
          proposal_status: Database["public"]["Enums"]["proposal_status"]
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          weighted_amount: number
        }[]
      }
      generate_installments: {
        Args: {
          p_company_id?: string
          p_description?: string
          p_first_due_date: string
          p_installments: number
          p_interval_days?: number
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_project_id: string
          p_total_amount: number
        }
        Returns: {
          amount: number
          cancelled_at: string | null
          company_id: string
          competence_month: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string
          due_date: string
          id: string
          installment_number: number | null
          installment_total: number | null
          invoice_number: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          project_id: string | null
          received_amount: number | null
          received_at: string | null
          service_description: string | null
          task_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "receivables"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_recurring_payables: {
        Args: { p_payable_id: string }
        Returns: {
          amount: number
          cancelled_at: string | null
          category: Database["public"]["Enums"]["payable_category"]
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          is_fixed: boolean
          notes: string | null
          paid_at: string | null
          payee_name: string | null
          payee_profile_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          project_id: string | null
          recurrence: Database["public"]["Enums"]["payable_recurrence"]
          recurrence_parent_id: string | null
          recurrence_until: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "payables"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_finance_access: { Args: never; Returns: boolean }
      in_squad: {
        Args: { p_squad: Database["public"]["Enums"]["squad"] }
        Returns: boolean
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_director: { Args: never; Returns: boolean }
      is_head: { Args: never; Returns: boolean }
      is_leadership: { Args: never; Returns: boolean }
      is_master: { Args: never; Returns: boolean }
      is_squad_lead: {
        Args: { p_squad: Database["public"]["Enums"]["squad"] }
        Returns: boolean
      }
      log_activity: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      managed_squads: {
        Args: never
        Returns: Database["public"]["Enums"]["squad"][]
      }
      notify: {
        Args: {
          p_body: string
          p_entity_id: string
          p_entity_type: string
          p_recipient: string
          p_title: string
          p_type: string
          p_url: string
        }
        Returns: undefined
      }
      notify_overdue_finance: { Args: never; Returns: undefined }
      pauta_default_squad: {
        Args: {
          p_deal_id: string
          p_is_standalone: boolean
          p_owner_id: string
        }
        Returns: Database["public"]["Enums"]["squad"]
      }
      pauta_handover: {
        Args: {
          p_assignee_id: string
          p_due_date?: string
          p_function: Database["public"]["Enums"]["production_function"]
          p_note?: string
          p_pauta_id: string
          p_status: Database["public"]["Enums"]["pauta_status"]
        }
        Returns: {
          archived_at: string | null
          board_column: Database["public"]["Enums"]["pauta_column"]
          briefing: string | null
          capture_type: Database["public"]["Enums"]["pauta_capture_type"][]
          code: string | null
          contact_id: string | null
          contact_phone_override: string | null
          created_at: string
          created_by: string | null
          created_for: string | null
          current_assignee_id: string | null
          deal_id: string | null
          delivery_url: string | null
          drive_folder_url: string | null
          due_date: string | null
          duration_minutes: number | null
          equipment_notes: string | null
          format: string | null
          id: string
          is_critical: boolean
          is_standalone: boolean
          lead_id: string
          location_address: string | null
          previous_assignee_id: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          project_id: string | null
          returned_at: string | null
          scheduled_at: string | null
          script_url: string | null
          squad: Database["public"]["Enums"]["squad"]
          start_date: string | null
          status: Database["public"]["Enums"]["pauta_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pautas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pauta_move_column: {
        Args: {
          p_column: Database["public"]["Enums"]["pauta_column"]
          p_pauta_id: string
        }
        Returns: {
          archived_at: string | null
          board_column: Database["public"]["Enums"]["pauta_column"]
          briefing: string | null
          capture_type: Database["public"]["Enums"]["pauta_capture_type"][]
          code: string | null
          contact_id: string | null
          contact_phone_override: string | null
          created_at: string
          created_by: string | null
          created_for: string | null
          current_assignee_id: string | null
          deal_id: string | null
          delivery_url: string | null
          drive_folder_url: string | null
          due_date: string | null
          duration_minutes: number | null
          equipment_notes: string | null
          format: string | null
          id: string
          is_critical: boolean
          is_standalone: boolean
          lead_id: string
          location_address: string | null
          previous_assignee_id: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          project_id: string | null
          returned_at: string | null
          scheduled_at: string | null
          script_url: string | null
          squad: Database["public"]["Enums"]["squad"]
          start_date: string | null
          status: Database["public"]["Enums"]["pauta_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pautas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pautas_summary: {
        Args: {
          p_assignee_id?: string
          p_company_id?: string
          p_lead_id?: string
          p_priority?: Database["public"]["Enums"]["project_priority"]
          p_project_id?: string
          p_search?: string
        }
        Returns: {
          concluidas: number
          criticas: number
          em_andamento: number
        }[]
      }
      set_company_logo: {
        Args: { p_company_id: string; p_logo_url: string }
        Returns: undefined
      }
      shares_squad_with: { Args: { p_profile_id: string }; Returns: boolean }
      sync_crm_alerts: { Args: never; Returns: number }
      transfer_master: { Args: { p_new_master_id: string }; Returns: undefined }
    }
    Enums: {
      access_role:
        | "admin"
        | "coordinator"
        | "member"
        | "freelancer"
        | "sdr"
        | "bdr"
      activity_kind:
        | "ligacao"
        | "whatsapp"
        | "email"
        | "reuniao"
        | "proposta"
        | "nota"
        | "outro"
      client_health: "ativo" | "atencao" | "tensao" | "churn"
      client_tier: "low_ticket" | "mid_ticket" | "high_ticket"
      commission_kind: "padrao" | "reaquecido"
      cost_scope: "empresa" | "projeto"
      commitment_kind: "reuniao_comercial" | "captacao" | "entrega" | "interno"
      commitment_status:
        | "agendado"
        | "realizado"
        | "nao_compareceu"
        | "remarcado"
        | "cancelado"
      commitment_visibility: "privado" | "equipe"
      company_lifecycle: "prospect" | "client"
      company_source:
        | "crm"
        | "indicacao"
        | "cliente_antigo"
        | "instagram"
        | "site"
        | "evento"
        | "prospeccao_ativa"
        | "outro"
      deal_interaction_channel:
        | "email"
        | "whatsapp"
        | "ligacao"
        | "instagram"
        | "linkedin"
        | "presencial"
        | "meet"
        | "outro"
      deal_interaction_kind:
        | "tentativa_contato"
        | "resposta_cliente"
        | "reuniao"
        | "proposta"
        | "negociacao"
        | "direcionamento"
        | "nota"
      deal_loss_reason:
        | "preco"
        | "timing"
        | "sem_resposta"
        | "sem_fit"
        | "concorrente"
        | "orcamento_interno"
        | "outro"
      deal_stage:
        | "prospeccao"
        | "primeiro_contato"
        | "tentativas_contato"
        | "qualificado"
        | "reuniao_agendada"
        | "reuniao_realizada"
        | "proposta_enviada"
        | "negociacao"
        | "ganho"
        | "perdido"
      direction_task:
        | "marcar_reuniao_ceo"
        | "qualificar_melhor"
        | "call_kickoff"
        | "enviar_material"
        | "aguardar_retorno"
        | "descartar"
      google_sync_status:
        | "nao_sincronizado"
        | "pendente"
        | "sincronizado"
        | "erro"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      meeting_outcome:
        | "enviar_proposta"
        | "follow_up_sdr"
        | "sem_interesse"
        | "remarcar"
        | "nao_compareceu"
        | "fechado_na_call"
      org_level: "master" | "diretoria" | "head" | "executor"
      pauta_capture_type: "foto" | "video"
      pauta_column: "sprint_backlog" | "em_andamento" | "revisao" | "entregue"
      pauta_status:
        | "planejamento"
        | "captacao"
        | "edicao"
        | "revisao_interna"
        | "revisao_cliente"
        | "reajuste"
        | "aprovado"
      payable_category:
        | "freelancer"
        | "equipamento"
        | "locacao"
        | "deslocamento"
        | "hospedagem"
        | "alimentacao"
        | "trilha_licenca"
        | "software"
        | "imposto"
        | "marketing"
        | "outro"
        | "pessoal"
        | "estrutura"
      payable_recurrence: "none" | "mensal" | "trimestral" | "anual"
      payment_method:
        | "pix"
        | "boleto"
        | "transferencia"
        | "cartao"
        | "dinheiro"
        | "outro"
      production_function:
        | "captacao"
        | "edicao"
        | "direcao"
        | "roteiro"
        | "motion"
        | "producao"
        | "fotografia"
      project_model: "transacional" | "recorrente"
      project_priority: "baixa" | "media" | "alta" | "urgente"
      project_stage:
        | "pre_producao"
        | "captacao"
        | "edicao"
        | "revisao_interna"
        | "aprovacao_cliente"
        | "alteracao"
        | "entregue"
        | "planejamento"
        | "producao"
        | "pausado"
        | "cancelado"
      proposal_channel:
        | "whatsapp_pdf"
        | "email"
        | "ligacao"
        | "meet"
        | "presencial"
        | "outro"
      proposal_status: "enviada" | "em_negociacao" | "aceita" | "recusada"
      prospection_goal:
        | "recorrencia"
        | "campanha_institucional"
        | "cobertura_evento"
        | "ativacao_marca"
        | "producao_conteudo"
        | "video_institucional"
        | "outro"
      reheat_status:
        | "aguardando"
        | "notificado"
        | "em_reaquecimento"
        | "descartado"
      service_type: "captacao" | "edicao" | "direcao" | "producao_completa"
      squad: "diretoria" | "audiovisual" | "comercial" | "financeiro"
      time_entry_kind: "entrada" | "saida"
      time_entry_source: "timer" | "manual"
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
      access_role: [
        "admin",
        "coordinator",
        "member",
        "freelancer",
        "sdr",
        "bdr",
      ],
      activity_kind: [
        "ligacao",
        "whatsapp",
        "email",
        "reuniao",
        "proposta",
        "nota",
        "outro",
      ],
      client_health: ["ativo", "atencao", "tensao", "churn"],
      client_tier: ["low_ticket", "mid_ticket", "high_ticket"],
      commission_kind: ["padrao", "reaquecido"],
      cost_scope: ["empresa", "projeto"],
      commitment_kind: ["reuniao_comercial", "captacao", "entrega", "interno"],
      commitment_status: [
        "agendado",
        "realizado",
        "nao_compareceu",
        "remarcado",
        "cancelado",
      ],
      commitment_visibility: ["privado", "equipe"],
      company_lifecycle: ["prospect", "client"],
      company_source: [
        "crm",
        "indicacao",
        "cliente_antigo",
        "instagram",
        "site",
        "evento",
        "prospeccao_ativa",
        "outro",
      ],
      deal_interaction_channel: [
        "email",
        "whatsapp",
        "ligacao",
        "instagram",
        "linkedin",
        "presencial",
        "meet",
        "outro",
      ],
      deal_interaction_kind: [
        "tentativa_contato",
        "resposta_cliente",
        "reuniao",
        "proposta",
        "negociacao",
        "direcionamento",
        "nota",
      ],
      deal_loss_reason: [
        "preco",
        "timing",
        "sem_resposta",
        "sem_fit",
        "concorrente",
        "orcamento_interno",
        "outro",
      ],
      deal_stage: [
        "prospeccao",
        "primeiro_contato",
        "tentativas_contato",
        "qualificado",
        "reuniao_agendada",
        "reuniao_realizada",
        "proposta_enviada",
        "negociacao",
        "ganho",
        "perdido",
      ],
      direction_task: [
        "marcar_reuniao_ceo",
        "qualificar_melhor",
        "call_kickoff",
        "enviar_material",
        "aguardar_retorno",
        "descartar",
      ],
      google_sync_status: [
        "nao_sincronizado",
        "pendente",
        "sincronizado",
        "erro",
      ],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      meeting_outcome: [
        "enviar_proposta",
        "follow_up_sdr",
        "sem_interesse",
        "remarcar",
        "nao_compareceu",
        "fechado_na_call",
      ],
      org_level: ["master", "diretoria", "head", "executor"],
      pauta_capture_type: ["foto", "video"],
      pauta_column: ["sprint_backlog", "em_andamento", "revisao", "entregue"],
      pauta_status: [
        "planejamento",
        "captacao",
        "edicao",
        "revisao_interna",
        "revisao_cliente",
        "reajuste",
        "aprovado",
      ],
      payable_category: [
        "freelancer",
        "equipamento",
        "locacao",
        "deslocamento",
        "hospedagem",
        "alimentacao",
        "trilha_licenca",
        "software",
        "imposto",
        "marketing",
        "outro",
        "pessoal",
        "estrutura",
      ],
      payable_recurrence: ["none", "mensal", "trimestral", "anual"],
      payment_method: [
        "pix",
        "boleto",
        "transferencia",
        "cartao",
        "dinheiro",
        "outro",
      ],
      production_function: [
        "captacao",
        "edicao",
        "direcao",
        "roteiro",
        "motion",
        "producao",
        "fotografia",
      ],
      project_model: ["transacional", "recorrente"],
      project_priority: ["baixa", "media", "alta", "urgente"],
      project_stage: [
        "pre_producao",
        "captacao",
        "edicao",
        "revisao_interna",
        "aprovacao_cliente",
        "alteracao",
        "entregue",
        "planejamento",
        "producao",
        "pausado",
        "cancelado",
      ],
      proposal_channel: [
        "whatsapp_pdf",
        "email",
        "ligacao",
        "meet",
        "presencial",
        "outro",
      ],
      proposal_status: ["enviada", "em_negociacao", "aceita", "recusada"],
      prospection_goal: [
        "recorrencia",
        "campanha_institucional",
        "cobertura_evento",
        "ativacao_marca",
        "producao_conteudo",
        "video_institucional",
        "outro",
      ],
      reheat_status: [
        "aguardando",
        "notificado",
        "em_reaquecimento",
        "descartado",
      ],
      service_type: ["captacao", "edicao", "direcao", "producao_completa"],
      squad: ["diretoria", "audiovisual", "comercial", "financeiro"],
      time_entry_kind: ["entrada", "saida"],
      time_entry_source: ["timer", "manual"],
    },
  },
} as const
