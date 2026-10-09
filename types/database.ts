// AJUSTE MANUAL após `npm run db:types`: em Functions.generate_installments.Args, marque
// p_project_id, p_company_id e p_payment_method como `| null`; em
// Functions.project_apply_contract_change.Args, p_budget_id como `| null`; em Functions.close_client.Args,
// p_project_id como `| null` (as funções aceitam NULL, mas o gerador não indica). Ver README → Migrações.
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
      budget_catalog_items: {
        Row: {
          active: boolean
          created_at: string
          default_cost: number
          id: string
          name: string
          notes: string | null
          position: number
          section: Database["public"]["Enums"]["budget_item_section"]
          unit: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_cost?: number
          id?: string
          name: string
          notes?: string | null
          position?: number
          section: Database["public"]["Enums"]["budget_item_section"]
          unit?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_cost?: number
          id?: string
          name?: string
          notes?: string | null
          position?: number
          section?: Database["public"]["Enums"]["budget_item_section"]
          unit?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          budget_id: string
          catalog_item_id: string | null
          created_at: string
          description: string
          id: string
          position: number
          quantity: number
          section: Database["public"]["Enums"]["budget_item_section"]
          unit: string
          unit_cost: number
          unit_price_override: number | null
        }
        Insert: {
          budget_id: string
          catalog_item_id?: string | null
          created_at?: string
          description: string
          id?: string
          position?: number
          quantity?: number
          section: Database["public"]["Enums"]["budget_item_section"]
          unit?: string
          unit_cost?: number
          unit_price_override?: number | null
        }
        Update: {
          budget_id?: string
          catalog_item_id?: string | null
          created_at?: string
          description?: string
          id?: string
          position?: number
          quantity?: number
          section?: Database["public"]["Enums"]["budget_item_section"]
          unit?: string
          unit_cost?: number
          unit_price_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "budget_catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          archived_at: string | null
          client_name: string
          company_id: string | null
          contract_synced_total: number | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          deal_proposal_id: string | null
          decided_at: string | null
          deliverable_items: Json
          delivery_terms: string | null
          fee_pct: number
          id: string
          issue_date: string
          notes: string | null
          number: number
          parent_id: string | null
          payment_terms: string | null
          presentation: Json
          project_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["budget_status"]
          status_note: string | null
          tax_pct: number
          title: string
          updated_at: string
          valid_until: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          client_name: string
          company_id?: string | null
          contract_synced_total?: number | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          deal_proposal_id?: string | null
          decided_at?: string | null
          deliverable_items?: Json
          delivery_terms?: string | null
          fee_pct?: number
          id?: string
          issue_date?: string
          notes?: string | null
          number?: number
          parent_id?: string | null
          payment_terms?: string | null
          presentation?: Json
          project_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          status_note?: string | null
          tax_pct?: number
          title: string
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          client_name?: string
          company_id?: string | null
          contract_synced_total?: number | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          deal_proposal_id?: string | null
          decided_at?: string | null
          deliverable_items?: Json
          delivery_terms?: string | null
          fee_pct?: number
          id?: string
          issue_date?: string
          notes?: string | null
          number?: number
          parent_id?: string | null
          payment_terms?: string | null
          presentation?: Json
          project_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          status_note?: string | null
          tax_pct?: number
          title?: string
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "budgets_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_deal_proposal_id_fkey"
            columns: ["deal_proposal_id"]
            isOneToOne: false
            referencedRelation: "deal_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_closures: {
        Row: {
          closed_at: string
          closed_by: string | null
          company_id: string
          created_at: string
          description: string
          future_prospect_potential: Database["public"]["Enums"]["prospect_potential"]
          has_pending_payables: boolean
          has_pending_receivables: boolean
          id: string
          notes: string | null
          pending_payables_note: string | null
          pending_receivables_note: string | null
          project_id: string | null
          reason: Database["public"]["Enums"]["closure_reason"]
          reopened_at: string | null
          reopened_by: string | null
          summary: Json
        }
        Insert: {
          closed_at: string
          closed_by?: string | null
          company_id: string
          created_at?: string
          description: string
          future_prospect_potential: Database["public"]["Enums"]["prospect_potential"]
          has_pending_payables?: boolean
          has_pending_receivables?: boolean
          id?: string
          notes?: string | null
          pending_payables_note?: string | null
          pending_receivables_note?: string | null
          project_id?: string | null
          reason: Database["public"]["Enums"]["closure_reason"]
          reopened_at?: string | null
          reopened_by?: string | null
          summary?: Json
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          company_id?: string
          created_at?: string
          description?: string
          future_prospect_potential?: Database["public"]["Enums"]["prospect_potential"]
          has_pending_payables?: boolean
          has_pending_receivables?: boolean
          id?: string
          notes?: string | null
          pending_payables_note?: string | null
          pending_receivables_note?: string | null
          project_id?: string | null
          reason?: Database["public"]["Enums"]["closure_reason"]
          reopened_at?: string | null
          reopened_by?: string | null
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "client_closures_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_closures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_closures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "client_closures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_closures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_closures_reopened_by_fkey"
            columns: ["reopened_by"]
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
      company_settings: {
        Row: {
          attention_margin_pct: number
          default_daily_hours: number
          default_workdays: number[]
          finance_auto_invoice: boolean
          finance_auto_monthly: boolean
          finance_auto_payments: boolean
          finance_auto_weekly: boolean
          finance_executor_id: string | null
          finance_invoice_days_before: number
          finance_weekly_dow: number
          healthy_margin_pct: number
          id: boolean
          proposal_profile: Json
          prospect_reviewer_id: string | null
          prospect_sdr_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attention_margin_pct?: number
          default_daily_hours?: number
          default_workdays?: number[]
          finance_auto_invoice?: boolean
          finance_auto_monthly?: boolean
          finance_auto_payments?: boolean
          finance_auto_weekly?: boolean
          finance_executor_id?: string | null
          finance_invoice_days_before?: number
          finance_weekly_dow?: number
          healthy_margin_pct?: number
          id?: boolean
          proposal_profile?: Json
          prospect_reviewer_id?: string | null
          prospect_sdr_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attention_margin_pct?: number
          default_daily_hours?: number
          default_workdays?: number[]
          finance_auto_invoice?: boolean
          finance_auto_monthly?: boolean
          finance_auto_payments?: boolean
          finance_auto_weekly?: boolean
          finance_executor_id?: string | null
          finance_invoice_days_before?: number
          finance_weekly_dow?: number
          healthy_margin_pct?: number
          id?: boolean
          proposal_profile?: Json
          prospect_reviewer_id?: string | null
          prospect_sdr_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_finance_executor_id_fkey"
            columns: ["finance_executor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_prospect_reviewer_id_fkey"
            columns: ["prospect_reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_prospect_sdr_id_fkey"
            columns: ["prospect_sdr_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_updated_by_fkey"
            columns: ["updated_by"]
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
          next_step: string | null
          occurred_at: string
          responded: boolean | null
          responded_to_interaction_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          stage_to: Database["public"]["Enums"]["deal_stage"] | null
          summary: string | null
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
          next_step?: string | null
          occurred_at?: string
          responded?: boolean | null
          responded_to_interaction_id?: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          stage_to?: Database["public"]["Enums"]["deal_stage"] | null
          summary?: string | null
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
          next_step?: string | null
          occurred_at?: string
          responded?: boolean | null
          responded_to_interaction_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_to?: Database["public"]["Enums"]["deal_stage"] | null
          summary?: string | null
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
      deal_notes: {
        Row: {
          assigned_to: string | null
          author_id: string | null
          body: string
          created_at: string
          deal_id: string
          due_at: string | null
          id: string
          is_request: boolean
          reply_to_id: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          author_id?: string | null
          body: string
          created_at?: string
          deal_id: string
          due_at?: string | null
          id?: string
          is_request?: boolean
          reply_to_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          author_id?: string | null
          body?: string
          created_at?: string
          deal_id?: string
          due_at?: string | null
          id?: string
          is_request?: boolean
          reply_to_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_notes_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "deal_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_notes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      finance_auto_pauta_keys: {
        Row: {
          created_at: string
          key: string
          pauta_id: string | null
        }
        Insert: {
          created_at?: string
          key: string
          pauta_id?: string | null
        }
        Update: {
          created_at?: string
          key?: string
          pauta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_auto_pauta_keys_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_auto_pauta_keys_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancers: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          functions: Database["public"]["Enums"]["production_function"][]
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          functions?: Database["public"]["Enums"]["production_function"][]
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          functions?: Database["public"]["Enums"]["production_function"][]
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freelancers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contract_payouts: {
        Row: {
          amount: number
          contract_value: number
          created_at: string
          deal_id: string
          goal_id: string
          id: string
          payable_id: string | null
          rate: number
        }
        Insert: {
          amount: number
          contract_value: number
          created_at?: string
          deal_id: string
          goal_id: string
          id?: string
          payable_id?: string | null
          rate: number
        }
        Update: {
          amount?: number
          contract_value?: number
          created_at?: string
          deal_id?: string
          goal_id?: string
          id?: string
          payable_id?: string | null
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_contract_payouts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contract_payouts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contract_payouts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "goal_contract_payouts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contract_payouts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contract_payouts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals_with_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contract_payouts_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contract_payouts_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deal_id: string | null
          entry_date: string
          goal_id: string
          id: string
          link_url: string | null
          note: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: Database["public"]["Enums"]["goal_entry_source"]
          source_key: string | null
          status: Database["public"]["Enums"]["goal_entry_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          entry_date?: string
          goal_id: string
          id?: string
          link_url?: string | null
          note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["goal_entry_source"]
          source_key?: string | null
          status?: Database["public"]["Enums"]["goal_entry_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          entry_date?: string
          goal_id?: string
          id?: string
          link_url?: string | null
          note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["goal_entry_source"]
          source_key?: string | null
          status?: Database["public"]["Enums"]["goal_entry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_entries_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_entries_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_entries_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_sla"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "goal_entries_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_entries_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_entries_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals_with_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_entries_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_from_crm: boolean
          commission_mode: Database["public"]["Enums"]["goal_commission_mode"]
          commission_rate: number
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string
          fallback_rate: number
          final_achieved: number | null
          final_commission: number | null
          id: string
          is_money: boolean
          locked_rate: number | null
          metric: Database["public"]["Enums"]["goal_metric"]
          milestones_notified: number[]
          min_achievement_pct: number
          owner_id: string
          payable_id: string | null
          starts_on: string
          status: Database["public"]["Enums"]["goal_status"]
          target_value: number
          title: string
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_from_crm?: boolean
          commission_mode?: Database["public"]["Enums"]["goal_commission_mode"]
          commission_rate?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on: string
          fallback_rate?: number
          final_achieved?: number | null
          final_commission?: number | null
          id?: string
          is_money?: boolean
          locked_rate?: number | null
          metric: Database["public"]["Enums"]["goal_metric"]
          milestones_notified?: number[]
          min_achievement_pct?: number
          owner_id: string
          payable_id?: string | null
          starts_on: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_value: number
          title: string
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_from_crm?: boolean
          commission_mode?: Database["public"]["Enums"]["goal_commission_mode"]
          commission_rate?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string
          fallback_rate?: number
          final_achieved?: number | null
          final_commission?: number | null
          id?: string
          is_money?: boolean
          locked_rate?: number | null
          metric?: Database["public"]["Enums"]["goal_metric"]
          milestones_notified?: number[]
          min_achievement_pct?: number
          owner_id?: string
          payable_id?: string | null
          starts_on?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_value?: number
          title?: string
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      google_accounts: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          connected_at: string
          google_email: string | null
          last_error: string | null
          last_sync_at: string | null
          profile_id: string
          refresh_token: string
          scope: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_at?: string
          google_email?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          profile_id: string
          refresh_token: string
          scope?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_at?: string
          google_email?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          profile_id?: string
          refresh_token?: string
          scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_events: {
        Row: {
          all_day: boolean
          ends_at: string
          google_event_id: string
          html_link: string | null
          location: string | null
          profile_id: string
          starts_at: string
          synced_at: string
          title: string
        }
        Insert: {
          all_day?: boolean
          ends_at: string
          google_event_id: string
          html_link?: string | null
          location?: string | null
          profile_id: string
          starts_at: string
          synced_at?: string
          title: string
        }
        Update: {
          all_day?: boolean
          ends_at?: string
          google_event_id?: string
          html_link?: string | null
          location?: string | null
          profile_id?: string
          starts_at?: string
          synced_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_event_links: {
        Row: {
          content_hash: string
          google_event_id: string
          profile_id: string
          source_key: string
          updated_at: string
        }
        Insert: {
          content_hash: string
          google_event_id: string
          profile_id: string
          source_key: string
          updated_at?: string
        }
        Update: {
          content_hash?: string
          google_event_id?: string
          profile_id?: string
          source_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_event_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sync_jobs: {
        Row: {
          created_at: string
          detail: string | null
          finished_at: string | null
          id: string
          status: Database["public"]["Enums"]["sync_job_status"]
        }
        Insert: {
          created_at?: string
          detail?: string | null
          finished_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["sync_job_status"]
        }
        Update: {
          created_at?: string
          detail?: string | null
          finished_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["sync_job_status"]
        }
        Relationships: []
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
      invoice_issuances: {
        Row: {
          file_path: string | null
          id: string
          invoice_number: string | null
          issued_at: string
          issued_by: string | null
          period: string
          schedule_id: string
        }
        Insert: {
          file_path?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string
          issued_by?: string | null
          period: string
          schedule_id: string
        }
        Update: {
          file_path?: string | null
          id?: string
          invoice_number?: string | null
          issued_at?: string
          issued_by?: string | null
          period?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_issuances_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_issuances_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "project_invoice_schedules"
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
          pushed_at: string | null
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
          pushed_at?: string | null
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
          pushed_at?: string | null
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
      pauta_logs: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["pauta_log_kind"]
          link_url: string | null
          pauta_id: string
          status: Database["public"]["Enums"]["pauta_status"] | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["pauta_log_kind"]
          link_url?: string | null
          pauta_id: string
          status?: Database["public"]["Enums"]["pauta_status"] | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["pauta_log_kind"]
          link_url?: string | null
          pauta_id?: string
          status?: Database["public"]["Enums"]["pauta_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "pauta_logs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_logs_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauta_logs_pauta_id_fkey"
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
          client_waiting_since: string | null
          closure_label: string | null
          code: string | null
          contact_id: string | null
          contact_phone_override: string | null
          created_at: string
          created_by: string | null
          created_for: string | null
          current_assignee_id: string | null
          deal_id: string | null
          deal_stage: Database["public"]["Enums"]["deal_stage"] | null
          delivery_url: string | null
          direct_company_id: string | null
          drive_folder_url: string | null
          due_date: string | null
          due_time: string | null
          duration_minutes: number | null
          equipment_notes: string | null
          format: string | null
          freelancer_id: string | null
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
          self_complete: boolean
          source: string
          source_key: string | null
          source_period: string | null
          source_ref_id: string | null
          source_ref_type: string | null
          squad: Database["public"]["Enums"]["squad"]
          start_date: string | null
          status: Database["public"]["Enums"]["pauta_status"]
          title: string
          updated_at: string
          waiting_on_contact_id: string | null
        }
        Insert: {
          archived_at?: string | null
          board_column: Database["public"]["Enums"]["pauta_column"]
          briefing?: string | null
          capture_type?: Database["public"]["Enums"]["pauta_capture_type"][]
          client_waiting_since?: string | null
          closure_label?: string | null
          code?: string | null
          contact_id?: string | null
          contact_phone_override?: string | null
          created_at?: string
          created_by?: string | null
          created_for?: string | null
          current_assignee_id?: string | null
          deal_id?: string | null
          deal_stage?: Database["public"]["Enums"]["deal_stage"] | null
          delivery_url?: string | null
          direct_company_id?: string | null
          drive_folder_url?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_minutes?: number | null
          equipment_notes?: string | null
          format?: string | null
          freelancer_id?: string | null
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
          self_complete?: boolean
          source?: string
          source_key?: string | null
          source_period?: string | null
          source_ref_id?: string | null
          source_ref_type?: string | null
          squad: Database["public"]["Enums"]["squad"]
          start_date?: string | null
          status: Database["public"]["Enums"]["pauta_status"]
          title: string
          updated_at?: string
          waiting_on_contact_id?: string | null
        }
        Update: {
          archived_at?: string | null
          board_column?: Database["public"]["Enums"]["pauta_column"]
          briefing?: string | null
          capture_type?: Database["public"]["Enums"]["pauta_capture_type"][]
          client_waiting_since?: string | null
          closure_label?: string | null
          code?: string | null
          contact_id?: string | null
          contact_phone_override?: string | null
          created_at?: string
          created_by?: string | null
          created_for?: string | null
          current_assignee_id?: string | null
          deal_id?: string | null
          deal_stage?: Database["public"]["Enums"]["deal_stage"] | null
          delivery_url?: string | null
          direct_company_id?: string | null
          drive_folder_url?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_minutes?: number | null
          equipment_notes?: string | null
          format?: string | null
          freelancer_id?: string | null
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
          self_complete?: boolean
          source?: string
          source_key?: string | null
          source_period?: string | null
          source_ref_id?: string | null
          source_ref_type?: string | null
          squad?: Database["public"]["Enums"]["squad"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["pauta_status"]
          title?: string
          updated_at?: string
          waiting_on_contact_id?: string | null
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
            foreignKeyName: "pautas_direct_company_id_fkey"
            columns: ["direct_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_direct_company_id_fkey"
            columns: ["direct_company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "pautas_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancers"
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
            foreignKeyName: "pautas_waiting_on_contact_id_fkey"
            columns: ["waiting_on_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
          late_reason: string | null
          notes: string | null
          original_amount: number | null
          paid_at: string | null
          paid_late: boolean
          payee_account_type:
            | Database["public"]["Enums"]["bank_account_type"]
            | null
          payee_bank_account: string | null
          payee_bank_agency: string | null
          payee_bank_name: string | null
          payee_document: string | null
          payee_holder_name: string | null
          payee_name: string | null
          payee_pix_key: string | null
          payee_pix_key_type: Database["public"]["Enums"]["pix_key_type"] | null
          payee_profile_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_receipt_url: string | null
          penalty_amount: number | null
          penalty_reason: string | null
          project_id: string | null
          recurrence: Database["public"]["Enums"]["payable_recurrence"]
          recurrence_parent_id: string | null
          recurrence_until: string | null
          scheduled_at: string | null
          scheduled_by: string | null
          scheduled_for: string | null
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
          late_reason?: string | null
          notes?: string | null
          original_amount?: number | null
          paid_at?: string | null
          paid_late?: boolean
          payee_account_type?:
            | Database["public"]["Enums"]["bank_account_type"]
            | null
          payee_bank_account?: string | null
          payee_bank_agency?: string | null
          payee_bank_name?: string | null
          payee_document?: string | null
          payee_holder_name?: string | null
          payee_name?: string | null
          payee_pix_key?: string | null
          payee_pix_key_type?:
            | Database["public"]["Enums"]["pix_key_type"]
            | null
          payee_profile_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_receipt_url?: string | null
          penalty_amount?: number | null
          penalty_reason?: string | null
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["payable_recurrence"]
          recurrence_parent_id?: string | null
          recurrence_until?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scheduled_for?: string | null
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
          late_reason?: string | null
          notes?: string | null
          original_amount?: number | null
          paid_at?: string | null
          paid_late?: boolean
          payee_account_type?:
            | Database["public"]["Enums"]["bank_account_type"]
            | null
          payee_bank_account?: string | null
          payee_bank_agency?: string | null
          payee_bank_name?: string | null
          payee_document?: string | null
          payee_holder_name?: string | null
          payee_name?: string | null
          payee_pix_key?: string | null
          payee_pix_key_type?:
            | Database["public"]["Enums"]["pix_key_type"]
            | null
          payee_profile_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_receipt_url?: string | null
          penalty_amount?: number | null
          penalty_reason?: string | null
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["payable_recurrence"]
          recurrence_parent_id?: string | null
          recurrence_until?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scheduled_for?: string | null
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
          {
            foreignKeyName: "payables_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_details: {
        Row: {
          account_number: string | null
          account_type: Database["public"]["Enums"]["bank_account_type"] | null
          agency: string | null
          bank_code: string | null
          bank_name: string | null
          holder_document: string | null
          holder_name: string | null
          notes: string | null
          pix_key: string | null
          pix_key_type: Database["public"]["Enums"]["pix_key_type"] | null
          preferred_method: Database["public"]["Enums"]["payment_method"]
          profile_id: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["bank_account_type"] | null
          agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          holder_document?: string | null
          holder_name?: string | null
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"] | null
          preferred_method?: Database["public"]["Enums"]["payment_method"]
          profile_id: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["bank_account_type"] | null
          agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          holder_document?: string | null
          holder_name?: string | null
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"] | null
          preferred_method?: Database["public"]["Enums"]["payment_method"]
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      process_run_steps: {
        Row: {
          done_at: string
          done_by: string | null
          note: string | null
          run_id: string
          step_id: string
        }
        Insert: {
          done_at?: string
          done_by?: string | null
          note?: string | null
          run_id: string
          step_id: string
        }
        Update: {
          done_at?: string
          done_by?: string | null
          note?: string | null
          run_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_run_steps_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "process_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_run_steps_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      process_runs: {
        Row: {
          context_entity_id: string | null
          context_entity_type: string | null
          context_label: string | null
          finished_at: string | null
          id: string
          process_id: string
          started_at: string
          started_by: string
        }
        Insert: {
          context_entity_id?: string | null
          context_entity_type?: string | null
          context_label?: string | null
          finished_at?: string | null
          id?: string
          process_id: string
          started_at?: string
          started_by?: string
        }
        Update: {
          context_entity_id?: string | null
          context_entity_type?: string | null
          context_label?: string | null
          finished_at?: string | null
          id?: string
          process_id?: string
          started_at?: string
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_runs_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_runs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      process_steps: {
        Row: {
          action_kind: string
          archived_at: string | null
          branch_no_step_id: string | null
          branch_yes_step_id: string | null
          created_at: string
          description: string | null
          done_criteria: string | null
          estimated_minutes: number | null
          example_text: string | null
          id: string
          image_url: string | null
          is_blocking: boolean
          order_index: number
          process_id: string
          responsible_role: string | null
          step_type: string
          system_area: Database["public"]["Enums"]["process_system_area"]
          system_link: string | null
          title: string
          tool: string | null
        }
        Insert: {
          action_kind?: string
          archived_at?: string | null
          branch_no_step_id?: string | null
          branch_yes_step_id?: string | null
          created_at?: string
          description?: string | null
          done_criteria?: string | null
          estimated_minutes?: number | null
          example_text?: string | null
          id?: string
          image_url?: string | null
          is_blocking?: boolean
          order_index?: number
          process_id: string
          responsible_role?: string | null
          step_type?: string
          system_area?: Database["public"]["Enums"]["process_system_area"]
          system_link?: string | null
          title: string
          tool?: string | null
        }
        Update: {
          action_kind?: string
          archived_at?: string | null
          branch_no_step_id?: string | null
          branch_yes_step_id?: string | null
          created_at?: string
          description?: string | null
          done_criteria?: string | null
          estimated_minutes?: number | null
          example_text?: string | null
          id?: string
          image_url?: string | null
          is_blocking?: boolean
          order_index?: number
          process_id?: string
          responsible_role?: string | null
          step_type?: string
          system_area?: Database["public"]["Enums"]["process_system_area"]
          system_link?: string | null
          title?: string
          tool?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_branch_no_step_id_fkey"
            columns: ["branch_no_step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_steps_branch_yes_step_id_fkey"
            columns: ["branch_yes_step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_steps_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["process_frequency"]
          id: string
          is_published: boolean
          order_index: number
          owner_role: string | null
          slug: string
          squad: Database["public"]["Enums"]["squad"]
          summary: string | null
          title: string
          trigger_description: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["process_frequency"]
          id?: string
          is_published?: boolean
          order_index?: number
          owner_role?: string | null
          slug: string
          squad: Database["public"]["Enums"]["squad"]
          summary?: string | null
          title: string
          trigger_description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["process_frequency"]
          id?: string
          is_published?: boolean
          order_index?: number
          owner_role?: string | null
          slug?: string
          squad?: Database["public"]["Enums"]["squad"]
          summary?: string | null
          title?: string
          trigger_description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      project_contract_changes: {
        Row: {
          amount: number | null
          budget_id: string | null
          change_type: string
          changed_by: string | null
          created_at: string
          description: string | null
          id: string
          new_value: number | null
          note: string | null
          previous_value: number | null
          project_id: string
          receivables_summary: Json
        }
        Insert: {
          amount?: number | null
          budget_id?: string | null
          change_type: string
          changed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          new_value?: number | null
          note?: string | null
          previous_value?: number | null
          project_id: string
          receivables_summary?: Json
        }
        Update: {
          amount?: number | null
          budget_id?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          new_value?: number | null
          note?: string | null
          previous_value?: number | null
          project_id?: string
          receivables_summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "project_contract_changes_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contract_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contract_changes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_contract_changes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      project_invoice_schedules: {
        Row: {
          active: boolean
          contact_id: string | null
          created_at: string
          created_by: string | null
          day_of_month: number | null
          frequency: Database["public"]["Enums"]["invoice_frequency"]
          id: string
          issue_date: string | null
          notes: string | null
          project_id: string
          responsible_id: string
          send_to_email: string | null
        }
        Insert: {
          active?: boolean
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          frequency: Database["public"]["Enums"]["invoice_frequency"]
          id?: string
          issue_date?: string | null
          notes?: string | null
          project_id: string
          responsible_id: string
          send_to_email?: string | null
        }
        Update: {
          active?: boolean
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          frequency?: Database["public"]["Enums"]["invoice_frequency"]
          id?: string
          issue_date?: string | null
          notes?: string | null
          project_id?: string
          responsible_id?: string
          send_to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_invoice_schedules_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoice_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoice_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_profitability"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_invoice_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoice_schedules_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          closed_at: string | null
          closure_id: string | null
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
          finalized_at: string | null
          finalized_by: string | null
          id: string
          included_revision_rounds: number | null
          is_internal: boolean
          location_address: string | null
          location_notes: string | null
          margin_alert_at: string | null
          model: Database["public"]["Enums"]["project_model"]
          name: string
          owner_id: string
          payment_check_notified_at: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          production_notes: string | null
          reactivation_pauta_id: string | null
          ready_notified_at: string | null
          service_types: Database["public"]["Enums"]["service_type"][]
          stage: Database["public"]["Enums"]["project_stage"]
          start_date: string | null
          updated_at: string
        }
        Insert: {
          briefing?: string | null
          closed_at?: string | null
          closure_id?: string | null
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
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          included_revision_rounds?: number | null
          is_internal?: boolean
          location_address?: string | null
          location_notes?: string | null
          margin_alert_at?: string | null
          model?: Database["public"]["Enums"]["project_model"]
          name: string
          owner_id: string
          payment_check_notified_at?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          production_notes?: string | null
          reactivation_pauta_id?: string | null
          ready_notified_at?: string | null
          service_types?: Database["public"]["Enums"]["service_type"][]
          stage?: Database["public"]["Enums"]["project_stage"]
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          briefing?: string | null
          closed_at?: string | null
          closure_id?: string | null
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
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          included_revision_rounds?: number | null
          is_internal?: boolean
          location_address?: string | null
          location_notes?: string | null
          margin_alert_at?: string | null
          model?: Database["public"]["Enums"]["project_model"]
          name?: string
          owner_id?: string
          payment_check_notified_at?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          production_notes?: string | null
          reactivation_pauta_id?: string | null
          ready_notified_at?: string | null
          service_types?: Database["public"]["Enums"]["service_type"][]
          stage?: Database["public"]["Enums"]["project_stage"]
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "client_closures"
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
            foreignKeyName: "projects_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_reactivation_pauta_id_fkey"
            columns: ["reactivation_pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_reactivation_pauta_id_fkey"
            columns: ["reactivation_pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
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
          invoice_file_path: string | null
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
          invoice_file_path?: string | null
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
          invoice_file_path?: string | null
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
            isOneToOne: true
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
      goals_with_progress: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_value: number | null
          auto_from_crm: boolean | null
          closed_count: number | null
          closed_value: number | null
          closed_value_potential: number | null
          commission_confirmed: number | null
          commission_mode:
            | Database["public"]["Enums"]["goal_commission_mode"]
            | null
          commission_potential: number | null
          commission_rate: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          ends_on: string | null
          fallback_rate: number | null
          final_achieved: number | null
          final_commission: number | null
          id: string | null
          is_money: boolean | null
          locked_rate: number | null
          metric: Database["public"]["Enums"]["goal_metric"] | null
          milestones_notified: number[] | null
          min_achievement_pct: number | null
          owner_avatar_url: string | null
          owner_id: string | null
          owner_name: string | null
          payable_id: string | null
          pending_count: number | null
          pending_value: number | null
          starts_on: string | null
          status: Database["public"]["Enums"]["goal_status"] | null
          target_value: number | null
          title: string | null
          unit_label: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables_with_status"
            referencedColumns: ["id"]
          },
        ]
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
          client_waiting_since: string | null
          closure_label: string | null
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
          created_by_name: string | null
          created_for: string | null
          created_for_name: string | null
          current_assignee_id: string | null
          deal_id: string | null
          deal_stage: Database["public"]["Enums"]["deal_stage"] | null
          delivery_url: string | null
          direct_company_id: string | null
          drive_folder_url: string | null
          due_date: string | null
          due_time: string | null
          duration_minutes: number | null
          equipment_notes: string | null
          format: string | null
          freelancer_id: string | null
          freelancer_name: string | null
          freelancer_phone: string | null
          id: string | null
          is_critical: boolean | null
          is_standalone: boolean | null
          lead_avatar_url: string | null
          lead_id: string | null
          lead_name: string | null
          location_address: string | null
          logs_count: number | null
          open_requests_count: number | null
          previous_assignee_id: string | null
          priority: Database["public"]["Enums"]["project_priority"] | null
          project_id: string | null
          project_is_internal: boolean | null
          project_name: string | null
          returned_at: string | null
          scheduled_at: string | null
          script_url: string | null
          self_complete: boolean | null
          source: string | null
          source_period: string | null
          source_ref_id: string | null
          source_ref_type: string | null
          squad: Database["public"]["Enums"]["squad"] | null
          start_date: string | null
          status: Database["public"]["Enums"]["pauta_status"] | null
          title: string | null
          updated_at: string | null
          waiting_on_contact_id: string | null
          waiting_on_contact_name: string | null
          waiting_on_contact_role: string | null
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
            foreignKeyName: "pautas_direct_company_id_fkey"
            columns: ["direct_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_direct_company_id_fkey"
            columns: ["direct_company_id"]
            isOneToOne: false
            referencedRelation: "finance_by_client"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "pautas_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancers"
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
            foreignKeyName: "pautas_waiting_on_contact_id_fkey"
            columns: ["waiting_on_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
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
          late_reason: string | null
          notes: string | null
          original_amount: number | null
          paid_at: string | null
          paid_late: boolean | null
          payee_account_type:
            | Database["public"]["Enums"]["bank_account_type"]
            | null
          payee_bank_account: string | null
          payee_bank_agency: string | null
          payee_bank_name: string | null
          payee_document: string | null
          payee_holder_name: string | null
          payee_label: string | null
          payee_name: string | null
          payee_pix_key: string | null
          payee_pix_key_type: Database["public"]["Enums"]["pix_key_type"] | null
          payee_profile_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_receipt_url: string | null
          penalty_amount: number | null
          penalty_reason: string | null
          project_id: string | null
          project_name: string | null
          recurrence: Database["public"]["Enums"]["payable_recurrence"] | null
          recurrence_parent_id: string | null
          recurrence_until: string | null
          scheduled_at: string | null
          scheduled_by: string | null
          scheduled_for: string | null
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
          {
            foreignKeyName: "payables_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          invoice_file_path: string | null
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
      accept_invitation: { Args: never; Returns: undefined }
      add_business_days: {
        Args: { p_days: number; p_start: string }
        Returns: string
      }
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
      announcements_unread_count: { Args: never; Returns: number }
      budget_contract_status: {
        Args: { p_budget_id: string }
        Returns: {
          budget_total: number
          contract_value: number
          pending_count: number
          project_id: string
          project_name: string
          received_count: number
          synced_total: number
        }[]
      }
      budget_final_total: { Args: { p_budget_id: string }; Returns: number }
      budget_random_number: { Args: never; Returns: number }
      budget_set_proposal_status: {
        Args: {
          p_budget_id: string
          p_status: Database["public"]["Enums"]["proposal_status"]
        }
        Returns: undefined
      }
      can_access_all_deals: { Args: never; Returns: boolean }
      can_access_deal: { Args: { p_deal_id: string }; Returns: boolean }
      can_close_clients: { Args: never; Returns: boolean }
      can_delete_project: { Args: { p_project_id: string }; Returns: boolean }
      can_edit_pauta: { Args: { p_pauta_id: string }; Returns: boolean }
      can_edit_process_asset: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      can_edit_process_squad: {
        Args: { p_squad: Database["public"]["Enums"]["squad"] }
        Returns: boolean
      }
      can_finalize_project: { Args: { p_project_id: string }; Returns: boolean }
      can_fully_manage_pauta: { Args: never; Returns: boolean }
      can_manage_budgets: { Args: never; Returns: boolean }
      can_manage_company: { Args: never; Returns: boolean }
      can_manage_company_logos: { Args: never; Returns: boolean }
      can_manage_freelancers: { Args: never; Returns: boolean }
      can_manage_invoices: { Args: { p_project_id: string }; Returns: boolean }
      can_manage_pautas: { Args: never; Returns: boolean }
      can_manage_profile: { Args: { p_target_id: string }; Returns: boolean }
      can_read_companies: { Args: never; Returns: boolean }
      can_read_process_squad: {
        Args: { p_squad: Database["public"]["Enums"]["squad"] }
        Returns: boolean
      }
      can_see_busy_of: { Args: { p_owner_id: string }; Returns: boolean }
      can_see_crm: { Args: never; Returns: boolean }
      can_see_money: { Args: never; Returns: boolean }
      can_see_process_run: { Args: { p_run_id: string }; Returns: boolean }
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
      can_view_deal_notes: { Args: { p_deal_id: string }; Returns: boolean }
      can_view_goal: { Args: { p_goal_id: string }; Returns: boolean }
      can_view_pauta: { Args: { p_pauta_id: string }; Returns: boolean }
      check_project_payment: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      client_closure_preview: {
        Args: {
          p_closed_at?: string
          p_company_id: string
          p_project_id?: string
        }
        Returns: Json
      }
      close_client: {
        Args: {
          p_closed_at: string
          p_company_id: string
          p_description: string
          p_has_pending_payables: boolean
          p_has_pending_receivables: boolean
          p_keep_payable_ids: string[]
          p_keep_receivable_ids: string[]
          p_notes: string
          p_pending_payables_note: string
          p_pending_receivables_note: string
          p_potential: Database["public"]["Enums"]["prospect_potential"]
          p_project_id: string | null
          p_reason: Database["public"]["Enums"]["closure_reason"]
        }
        Returns: string
      }
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
          closed_at: string | null
          closure_id: string | null
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
          finalized_at: string | null
          finalized_by: string | null
          id: string
          included_revision_rounds: number | null
          is_internal: boolean
          location_address: string | null
          location_notes: string | null
          margin_alert_at: string | null
          model: Database["public"]["Enums"]["project_model"]
          name: string
          owner_id: string
          payment_check_notified_at: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          production_notes: string | null
          reactivation_pauta_id: string | null
          ready_notified_at: string | null
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
      closure_health: {
        Args: {
          p_current: Database["public"]["Enums"]["client_health"]
          p_reason: Database["public"]["Enums"]["closure_reason"]
        }
        Returns: Database["public"]["Enums"]["client_health"]
      }
      closure_reason_label: {
        Args: { p_reason: Database["public"]["Enums"]["closure_reason"] }
        Returns: string
      }
      closure_target_projects: {
        Args: { p_company_id: string; p_project_id: string }
        Returns: string[]
      }
      company_closed_since: { Args: { p_company_id: string }; Returns: string }
      company_contract_ranking: {
        Args: never
        Returns: {
          company_id: string
          rank: number
          total_value: number
        }[]
      }
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
      create_reactivation_pautas: { Args: never; Returns: undefined }
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
      crm_goal_label: {
        Args: { p_goal: Database["public"]["Enums"]["prospection_goal"] }
        Returns: string
      }
      crm_head_id: { Args: never; Returns: string }
      crm_pauta_column: {
        Args: { p_stage: Database["public"]["Enums"]["deal_stage"] }
        Returns: Database["public"]["Enums"]["pauta_column"]
      }
      crm_pauta_status: {
        Args: { p_stage: Database["public"]["Enums"]["deal_stage"] }
        Returns: Database["public"]["Enums"]["pauta_status"]
      }
      crm_pauta_title: {
        Args: {
          p_company: string
          p_goals: Database["public"]["Enums"]["prospection_goal"][]
          p_title: string
        }
        Returns: string
      }
      crm_stage_label: {
        Args: { p_stage: Database["public"]["Enums"]["deal_stage"] }
        Returns: string
      }
      crm_sync_deal_pauta: { Args: { p_deal_id: string }; Returns: string }
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
          p_next_step?: string
          p_previous_responded?: boolean
          p_responded_to?: string
          p_summary?: string
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
      deal_money: {
        Args: { p_deal_id: string }
        Returns: {
          commission_amount: number
          commission_percent: number
          estimated_value: number
          latest_proposal_amount: number
        }[]
      }
      deal_negotiations_list: {
        Args: { p_deal_id: string }
        Returns: {
          agreed_amount: number
          channel: Database["public"]["Enums"]["deal_interaction_channel"]
          client_counter_amount: number
          created_at: string
          created_by: string
          deal_id: string
          id: string
          notes: string
          our_counter_amount: number
          proposal_id: string
        }[]
      }
      deal_note_create: {
        Args: {
          p_assigned_to?: string
          p_body: string
          p_deal_id: string
          p_due_at?: string
          p_is_request?: boolean
          p_reply_to?: string
        }
        Returns: string
      }
      deal_note_set_resolved: {
        Args: { p_note_id: string; p_resolved: boolean }
        Returns: undefined
      }
      deal_pauta_url: { Args: { p_deal_id: string }; Returns: string }
      deal_proposals_list: {
        Args: { p_deal_id: string }
        Returns: {
          amount: number
          created_at: string
          deal_id: string
          document_url: string
          id: string
          scope_notes: string
          sent_at: string
          sent_by: string
          sent_channel: Database["public"]["Enums"]["proposal_channel"]
          status: Database["public"]["Enums"]["proposal_status"]
        }[]
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
      finalize_project: { Args: { p_project_id: string }; Returns: undefined }
      finance_auto_pauta: {
        Args: {
          p_briefing: string
          p_company: string
          p_due: string
          p_executor: string
          p_key: string
          p_lead: string
          p_period: string
          p_project: string
          p_ref_id: string
          p_ref_type: string
          p_self_complete: boolean
          p_title: string
        }
        Returns: string
      }
      finance_auto_pauta_append: {
        Args: { p_key: string; p_line: string; p_marker: string }
        Returns: undefined
      }
      finance_budgets_in_negotiation: {
        Args: never
        Returns: {
          budget_id: string
          client_name: string
          company_id: string
          number: number
          sent_at: string
          status: Database["public"]["Enums"]["budget_status"]
          title: string
          total: number
          valid_until: string
          version: number
        }[]
      }
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
      finance_executor_id: { Args: never; Returns: string }
      finance_generate_auto_pautas: { Args: never; Returns: number }
      finance_late_payments: {
        Args: { p_from: string; p_to: string }
        Returns: {
          amount: number
          days_late: number
          description: string
          due_date: string
          late_reason: string
          paid_at: string
          payable_id: string
          payee: string
          penalty_amount: number
          penalty_reason: string
          project_name: string
        }[]
      }
      finance_lead_id: { Args: never; Returns: string }
      finance_margin_below_target: {
        Args: never
        Returns: {
          company_name: string
          contract_value: number
          margin_pct: number
          payables_total: number
          project_id: string
          project_name: string
        }[]
      }
      finance_payee_key: {
        Args: { p_name: string; p_profile_id: string }
        Returns: string
      }
      finance_payment_lead_id: { Args: never; Returns: string }
      fmt_brl: { Args: { p_value: number }; Returns: string }
      fmt_qty: { Args: { p_value: number }; Returns: string }
      generate_installments: {
        Args: {
          p_company_id?: string | null
          p_description?: string
          p_first_due_date: string
          p_installments: number
          p_interval_days?: number
          p_payment_method?: Database["public"]["Enums"]["payment_method"] | null
          p_project_id: string | null
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
          invoice_file_path: string | null
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
          cost_scope: Database["public"]["Enums"]["cost_scope"]
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          is_fixed: boolean
          late_reason: string | null
          notes: string | null
          original_amount: number | null
          paid_at: string | null
          paid_late: boolean
          payee_account_type:
            | Database["public"]["Enums"]["bank_account_type"]
            | null
          payee_bank_account: string | null
          payee_bank_agency: string | null
          payee_bank_name: string | null
          payee_document: string | null
          payee_holder_name: string | null
          payee_name: string | null
          payee_pix_key: string | null
          payee_pix_key_type: Database["public"]["Enums"]["pix_key_type"] | null
          payee_profile_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_receipt_url: string | null
          penalty_amount: number | null
          penalty_reason: string | null
          project_id: string | null
          recurrence: Database["public"]["Enums"]["payable_recurrence"]
          recurrence_parent_id: string | null
          recurrence_until: string | null
          scheduled_at: string | null
          scheduled_by: string | null
          scheduled_for: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "payables"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      goal_approve: {
        Args: { p_due_date: string; p_goal_id: string }
        Returns: string
      }
      goal_check_milestones: { Args: { p_goal_id: string }; Returns: undefined }
      goal_closed_contracts: {
        Args: { p_goal_id: string; p_include_pending: boolean }
        Returns: {
          contract_value: number
          deal_id: string
        }[]
      }
      goal_closed_contracts_visible: {
        Args: { p_goal_id: string; p_include_pending: boolean }
        Returns: {
          contract_value: number
          deal_id: string
        }[]
      }
      goal_commission: {
        Args: {
          p_achieved: number
          p_min_pct: number
          p_mode: Database["public"]["Enums"]["goal_commission_mode"]
          p_rate: number
          p_target: number
        }
        Returns: number
      }
      goal_contract_rate: {
        Args: {
          p_achieved: number
          p_fallback: number
          p_locked: number
          p_min_pct: number
          p_rate: number
          p_target: number
        }
        Returns: number
      }
      goal_crm_candidates: {
        Args: { p_goal_id: string }
        Returns: {
          amount: number
          deal_id: string
          entry_date: string
          note: string
          source_key: string
        }[]
      }
      goal_deal_value: { Args: { p_deal_id: string }; Returns: number }
      goal_fmt: {
        Args: { p_is_money: boolean; p_value: number }
        Returns: string
      }
      goal_pay_contracts: {
        Args: { p_due_date: string; p_goal_id: string }
        Returns: string
      }
      goal_reviewers: { Args: { p_goal_id: string }; Returns: string[] }
      goal_sync_crm: { Args: { p_goal_id: string }; Returns: undefined }
      goal_sync_crm_internal: {
        Args: { p_goal_id: string }
        Returns: undefined
      }
      goal_sync_owner: { Args: { p_owner_id: string }; Returns: undefined }
      google_sync_dispatch: { Args: never; Returns: undefined }
      has_finance_access: { Args: never; Returns: boolean }
      has_open_auto_pauta: {
        Args: { p_ref_id: string; p_ref_type: string }
        Returns: boolean
      }
      has_open_deal_request: { Args: { p_deal_id: string }; Returns: boolean }
      in_squad: {
        Args: { p_squad: Database["public"]["Enums"]["squad"] }
        Returns: boolean
      }
      invoice_due_date: {
        Args: {
          p_day: number
          p_frequency: Database["public"]["Enums"]["invoice_frequency"]
          p_issue_date: string
          p_today: string
        }
        Returns: string
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_announcement_audience: {
        Args: {
          p_levels: Database["public"]["Enums"]["org_level"][]
          p_squads: Database["public"]["Enums"]["squad"][]
        }
        Returns: boolean
      }
      is_company_logo_path: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      is_director: { Args: never; Returns: boolean }
      is_head: { Args: never; Returns: boolean }
      is_leadership: { Args: never; Returns: boolean }
      is_master: { Args: never; Returns: boolean }
      is_pauta_creator: { Args: { p_pauta_id: string }; Returns: boolean }
      is_pauta_squad_manager: { Args: { p_pauta_id: string }; Returns: boolean }
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
      manages_pauta_squad: {
        Args: { p_squad: Database["public"]["Enums"]["squad"] }
        Returns: boolean
      }
      margin_alert_recipients: { Args: never; Returns: string[] }
      margin_status_for: { Args: { p_pct: number }; Returns: string }
      month_name_pt: { Args: { p_date: string }; Returns: string }
      my_google_account: {
        Args: never
        Returns: {
          connected_at: string
          google_email: string
          last_error: string
          last_sync_at: string
        }[]
      }
      notification_category: { Args: { p_type: string }; Returns: string }
      notified_today: {
        Args: { p_entity: string; p_recipient: string; p_type: string }
        Returns: boolean
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
      notify_finance_due_today: { Args: never; Returns: undefined }
      notify_invoices_due: { Args: never; Returns: undefined }
      notify_margin_monthly_report: { Args: never; Returns: undefined }
      notify_overdue_finance: { Args: never; Returns: undefined }
      notify_project_ready: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      notify_scheduled_payments: { Args: never; Returns: undefined }
      pauta_column_for_status: {
        Args: { p_status: Database["public"]["Enums"]["pauta_status"] }
        Returns: Database["public"]["Enums"]["pauta_column"]
      }
      pauta_deal_summary: {
        Args: { p_pauta_id: string }
        Returns: {
          can_open_deal: boolean
          code: string
          deal_id: string
          interactions_count: number
          last_interaction_at: string
          last_interaction_channel: Database["public"]["Enums"]["deal_interaction_channel"]
          last_interaction_kind: Database["public"]["Enums"]["deal_interaction_kind"]
          last_interaction_text: string
          negotiation_value: number
          next_action: string
          next_action_at: string
          open_requests: number
          owner_name: string
          responsible_name: string
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
        }[]
      }
      pauta_default_squad: {
        Args: {
          p_deal_id: string
          p_is_standalone: boolean
          p_owner_id: string
        }
        Returns: Database["public"]["Enums"]["squad"]
      }
      pauta_default_status: {
        Args: {
          p_column: Database["public"]["Enums"]["pauta_column"]
          p_old: Database["public"]["Enums"]["pauta_status"]
          p_squad: Database["public"]["Enums"]["squad"]
        }
        Returns: Database["public"]["Enums"]["pauta_status"]
      }
      pauta_handover: {
        Args: {
          p_assignee_id?: string
          p_due_date?: string
          p_due_time?: string
          p_function?: Database["public"]["Enums"]["production_function"]
          p_note?: string
          p_pauta_id: string
          p_status: Database["public"]["Enums"]["pauta_status"]
        }
        Returns: {
          archived_at: string | null
          board_column: Database["public"]["Enums"]["pauta_column"]
          briefing: string | null
          capture_type: Database["public"]["Enums"]["pauta_capture_type"][]
          client_waiting_since: string | null
          closure_label: string | null
          code: string | null
          contact_id: string | null
          contact_phone_override: string | null
          created_at: string
          created_by: string | null
          created_for: string | null
          current_assignee_id: string | null
          deal_id: string | null
          deal_stage: Database["public"]["Enums"]["deal_stage"] | null
          delivery_url: string | null
          direct_company_id: string | null
          drive_folder_url: string | null
          due_date: string | null
          due_time: string | null
          duration_minutes: number | null
          equipment_notes: string | null
          format: string | null
          freelancer_id: string | null
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
          self_complete: boolean
          source: string
          source_key: string | null
          source_period: string | null
          source_ref_id: string | null
          source_ref_type: string | null
          squad: Database["public"]["Enums"]["squad"]
          start_date: string | null
          status: Database["public"]["Enums"]["pauta_status"]
          title: string
          updated_at: string
          waiting_on_contact_id: string | null
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
          client_waiting_since: string | null
          closure_label: string | null
          code: string | null
          contact_id: string | null
          contact_phone_override: string | null
          created_at: string
          created_by: string | null
          created_for: string | null
          current_assignee_id: string | null
          deal_id: string | null
          deal_stage: Database["public"]["Enums"]["deal_stage"] | null
          delivery_url: string | null
          direct_company_id: string | null
          drive_folder_url: string | null
          due_date: string | null
          due_time: string | null
          duration_minutes: number | null
          equipment_notes: string | null
          format: string | null
          freelancer_id: string | null
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
          self_complete: boolean
          source: string
          source_key: string | null
          source_period: string | null
          source_ref_id: string | null
          source_ref_type: string | null
          squad: Database["public"]["Enums"]["squad"]
          start_date: string | null
          status: Database["public"]["Enums"]["pauta_status"]
          title: string
          updated_at: string
          waiting_on_contact_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pautas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pauta_noun: {
        Args: { p_squad: Database["public"]["Enums"]["squad"] }
        Returns: string
      }
      pauta_priority_label: {
        Args: { p_priority: Database["public"]["Enums"]["project_priority"] }
        Returns: string
      }
      pauta_status_label: {
        Args: {
          p_squad: Database["public"]["Enums"]["squad"]
          p_status: Database["public"]["Enums"]["pauta_status"]
        }
        Returns: string
      }
      pauta_statuses_for: {
        Args: { p_squad: Database["public"]["Enums"]["squad"] }
        Returns: Database["public"]["Enums"]["pauta_status"][]
      }
      pauta_system_write: { Args: never; Returns: boolean }
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
      payment_details_text: { Args: { p_profile_id: string }; Returns: string }
      process_squad: {
        Args: { p_process_id: string }
        Returns: Database["public"]["Enums"]["squad"]
      }
      project_apply_contract_change: {
        Args: {
          p_amount: number
          p_budget_id: string | null
          p_description: string
          p_mode: string
          p_note: string
          p_project_id: string
          p_regenerate: boolean
        }
        Returns: Json
      }
      project_contract_plan: {
        Args: {
          p_amount: number
          p_description?: string
          p_mode: string
          p_project_id: string
          p_regenerate: boolean
        }
        Returns: {
          amount: number
          description: string
          due_date: string
          op: string
          previous_amount: number
          receivable_id: string
          seq: number
        }[]
      }
      project_delete_summary: { Args: { p_project_id: string }; Returns: Json }
      project_finalization_status: {
        Args: { p_project_id: string }
        Returns: {
          finalized: boolean
          model: Database["public"]["Enums"]["project_model"]
          open_receivables: number
          pending_pautas: number
          project_name: string
          ready: boolean
        }[]
      }
      project_margin_check: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      project_margin_pct: { Args: { p_project_id: string }; Returns: number }
      publish_due_announcements: { Args: never; Returns: number }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      reopen_client: { Args: { p_company_id: string }; Returns: undefined }
      run_daily_all: { Args: never; Returns: undefined }
      run_daily_reminders: { Args: never; Returns: undefined }
      run_goal_reminders: { Args: never; Returns: undefined }
      set_company_logo: {
        Args: { p_company_id: string; p_logo_url: string }
        Returns: undefined
      }
      shares_squad_with: { Args: { p_profile_id: string }; Returns: boolean }
      sync_crm_alerts: { Args: never; Returns: number }
      text_has_credential: { Args: { p_text: string }; Returns: boolean }
      transfer_master: { Args: { p_new_master_id: string }; Returns: undefined }
      unregister_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
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
      bank_account_type: "corrente" | "poupanca" | "pagamento"
      budget_item_section: "profissional" | "custo"
      budget_status:
        | "rascunho"
        | "enviado"
        | "aprovado"
        | "recusado"
        | "em_ajuste"
      client_health: "ativo" | "atencao" | "tensao" | "churn"
      client_tier: "low_ticket" | "mid_ticket" | "high_ticket"
      closure_reason:
        | "churn"
        | "fim_de_contrato"
        | "projeto_concluido"
        | "pausa_temporaria"
        | "outro"
      commission_kind: "padrao" | "reaquecido"
      commitment_kind: "reuniao_comercial" | "captacao" | "entrega" | "interno"
      commitment_status:
        | "agendado"
        | "realizado"
        | "nao_compareceu"
        | "remarcado"
        | "cancelado"
      commitment_visibility: "privado" | "equipe"
      company_lifecycle: "prospect" | "client" | "former_client"
      company_source:
        | "crm"
        | "indicacao"
        | "cliente_antigo"
        | "instagram"
        | "site"
        | "evento"
        | "prospeccao_ativa"
        | "outro"
      cost_scope: "empresa" | "projeto"
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
      goal_commission_mode: "percentual" | "por_unidade" | "contratos_fechados"
      goal_entry_source: "manual" | "crm"
      goal_entry_status: "pendente" | "aprovado" | "recusado"
      goal_metric:
        | "vendas_valor"
        | "vendas_quantidade"
        | "reunioes_agendadas"
        | "reunioes_realizadas"
        | "novos_negocios"
        | "personalizada"
      goal_status: "ativa" | "em_revisao" | "aprovada" | "cancelada"
      google_sync_status:
        | "nao_sincronizado"
        | "pendente"
        | "sincronizado"
        | "erro"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      invoice_frequency: "mensal" | "unica"
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
      pauta_log_kind: "registro" | "entrega" | "ajuste" | "aprovacao"
      pauta_status:
        | "planejamento"
        | "captacao"
        | "edicao"
        | "revisao_interna"
        | "revisao_cliente"
        | "reajuste"
        | "aprovado"
        | "em_execucao"
        | "aguardando_retorno"
        | "aguardando_documento"
        | "em_analise"
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
        | "comissao"
        | "pro_labore"
      payable_recurrence: "none" | "mensal" | "trimestral" | "anual"
      payment_method:
        | "pix"
        | "boleto"
        | "transferencia"
        | "cartao"
        | "dinheiro"
        | "outro"
      pix_key_type: "cpf" | "cnpj" | "email" | "telefone" | "aleatoria"
      process_frequency:
        | "sob_demanda"
        | "diaria"
        | "semanal"
        | "mensal"
        | "trimestral"
      process_system_area:
        | "clientes"
        | "projetos"
        | "pautas"
        | "crm"
        | "financeiro"
        | "agenda"
        | "equipe"
        | "banco_de_horas"
        | "avisos"
        | "externo"
        | "nenhum"
      production_function:
        | "captacao"
        | "edicao"
        | "direcao"
        | "roteiro"
        | "motion"
        | "producao"
        | "fotografia"
        | "ajuste_crm"
        | "prospeccao"
        | "follow_up"
        | "proposta"
        | "reuniao_comercial"
        | "relatorio_comercial"
        | "cobranca"
        | "conciliacao"
        | "pagamentos"
        | "nota_fiscal"
        | "orcamento"
        | "relatorio_financeiro"
        | "aprovacao"
        | "planejamento_estrategico"
        | "revisao"
        | "reuniao"
        | "contratacao"
        | "relatorio_gerencial"
        | "outro"
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
        | "encerrado"
      proposal_channel:
        | "whatsapp_pdf"
        | "email"
        | "ligacao"
        | "meet"
        | "presencial"
        | "outro"
      proposal_status: "enviada" | "em_negociacao" | "aceita" | "recusada"
      prospect_potential: "alto" | "medio" | "baixo" | "nenhum"
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
      sync_job_status: "pendente" | "rodando" | "concluido" | "erro"
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
      bank_account_type: ["corrente", "poupanca", "pagamento"],
      budget_item_section: ["profissional", "custo"],
      budget_status: [
        "rascunho",
        "enviado",
        "aprovado",
        "recusado",
        "em_ajuste",
      ],
      client_health: ["ativo", "atencao", "tensao", "churn"],
      client_tier: ["low_ticket", "mid_ticket", "high_ticket"],
      closure_reason: [
        "churn",
        "fim_de_contrato",
        "projeto_concluido",
        "pausa_temporaria",
        "outro",
      ],
      commission_kind: ["padrao", "reaquecido"],
      commitment_kind: ["reuniao_comercial", "captacao", "entrega", "interno"],
      commitment_status: [
        "agendado",
        "realizado",
        "nao_compareceu",
        "remarcado",
        "cancelado",
      ],
      commitment_visibility: ["privado", "equipe"],
      company_lifecycle: ["prospect", "client", "former_client"],
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
      cost_scope: ["empresa", "projeto"],
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
      goal_commission_mode: ["percentual", "por_unidade", "contratos_fechados"],
      goal_entry_source: ["manual", "crm"],
      goal_entry_status: ["pendente", "aprovado", "recusado"],
      goal_metric: [
        "vendas_valor",
        "vendas_quantidade",
        "reunioes_agendadas",
        "reunioes_realizadas",
        "novos_negocios",
        "personalizada",
      ],
      goal_status: ["ativa", "em_revisao", "aprovada", "cancelada"],
      google_sync_status: [
        "nao_sincronizado",
        "pendente",
        "sincronizado",
        "erro",
      ],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      invoice_frequency: ["mensal", "unica"],
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
      pauta_log_kind: ["registro", "entrega", "ajuste", "aprovacao"],
      pauta_status: [
        "planejamento",
        "captacao",
        "edicao",
        "revisao_interna",
        "revisao_cliente",
        "reajuste",
        "aprovado",
        "em_execucao",
        "aguardando_retorno",
        "aguardando_documento",
        "em_analise",
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
        "comissao",
        "pro_labore",
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
      pix_key_type: ["cpf", "cnpj", "email", "telefone", "aleatoria"],
      process_frequency: [
        "sob_demanda",
        "diaria",
        "semanal",
        "mensal",
        "trimestral",
      ],
      process_system_area: [
        "clientes",
        "projetos",
        "pautas",
        "crm",
        "financeiro",
        "agenda",
        "equipe",
        "banco_de_horas",
        "avisos",
        "externo",
        "nenhum",
      ],
      production_function: [
        "captacao",
        "edicao",
        "direcao",
        "roteiro",
        "motion",
        "producao",
        "fotografia",
        "ajuste_crm",
        "prospeccao",
        "follow_up",
        "proposta",
        "reuniao_comercial",
        "relatorio_comercial",
        "cobranca",
        "conciliacao",
        "pagamentos",
        "nota_fiscal",
        "orcamento",
        "relatorio_financeiro",
        "aprovacao",
        "planejamento_estrategico",
        "revisao",
        "reuniao",
        "contratacao",
        "relatorio_gerencial",
        "outro",
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
        "encerrado",
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
      prospect_potential: ["alto", "medio", "baixo", "nenhum"],
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
      sync_job_status: ["pendente", "rodando", "concluido", "erro"],
      time_entry_kind: ["entrada", "saida"],
      time_entry_source: ["timer", "manual"],
    },
  },
} as const
