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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_alerts: {
        Row: {
          agent_id: string
          audience: string
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          read_at: string | null
        }
        Insert: {
          agent_id: string
          audience?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
          read_at?: string | null
        }
        Update: {
          agent_id?: string
          audience?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_alerts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_alerts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_locked_config: {
        Row: {
          agent_id: string
          allowed_tools: string[]
          burst_gap_seconds: number
          business_info: string
          daily_cap_ceiling: number
          delay_seconds_max: number
          delay_seconds_min: number
          escalation_topics: string[]
          handoff_assign_to: string | null
          handoff_message: string
          history_max_tokens: number
          history_window_messages: number
          input_price_per_mtok: number
          kill_switch: boolean
          max_consecutive_ceiling: number
          max_output_tokens: number
          max_tool_calls: number
          max_wait_seconds: number
          model: string
          monthly_alert_threshold_pct: number
          monthly_token_cap: number
          output_price_per_mtok: number
          per_person_daily_ceiling: number
          reasoning_effort: string
          request_ttl_seconds: number
          safety_rules: string
          summary_max_chars: number
          system_prompt: string
          temperature: number | null
          tool_min_roles: Json
          tool_result_max_chars: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_id: string
          allowed_tools?: string[]
          burst_gap_seconds?: number
          business_info?: string
          daily_cap_ceiling?: number
          delay_seconds_max?: number
          delay_seconds_min?: number
          escalation_topics?: string[]
          handoff_assign_to?: string | null
          handoff_message?: string
          history_max_tokens?: number
          history_window_messages?: number
          input_price_per_mtok?: number
          kill_switch?: boolean
          max_consecutive_ceiling?: number
          max_output_tokens?: number
          max_tool_calls?: number
          max_wait_seconds?: number
          model?: string
          monthly_alert_threshold_pct?: number
          monthly_token_cap?: number
          output_price_per_mtok?: number
          per_person_daily_ceiling?: number
          reasoning_effort?: string
          request_ttl_seconds?: number
          safety_rules?: string
          summary_max_chars?: number
          system_prompt?: string
          temperature?: number | null
          tool_min_roles?: Json
          tool_result_max_chars?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_id?: string
          allowed_tools?: string[]
          burst_gap_seconds?: number
          business_info?: string
          daily_cap_ceiling?: number
          delay_seconds_max?: number
          delay_seconds_min?: number
          escalation_topics?: string[]
          handoff_assign_to?: string | null
          handoff_message?: string
          history_max_tokens?: number
          history_window_messages?: number
          input_price_per_mtok?: number
          kill_switch?: boolean
          max_consecutive_ceiling?: number
          max_output_tokens?: number
          max_tool_calls?: number
          max_wait_seconds?: number
          model?: string
          monthly_alert_threshold_pct?: number
          monthly_token_cap?: number
          output_price_per_mtok?: number
          per_person_daily_ceiling?: number
          reasoning_effort?: string
          request_ttl_seconds?: number
          safety_rules?: string
          summary_max_chars?: number
          system_prompt?: string
          temperature?: number | null
          tool_min_roles?: Json
          tool_result_max_chars?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_locked_config_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_locked_config_handoff_assign_to_fkey"
            columns: ["handoff_assign_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_locked_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_requests: {
        Row: {
          action: string
          assistant_chat_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          params: Json
          requested_by: string
          result: string | null
          run_id: string | null
          source_agent_id: string
          status: string
          target_agent_key: string
          updated_at: string
        }
        Insert: {
          action: string
          assistant_chat_id?: string | null
          confirmed_at?: string | null
          conversation_id: string
          created_at?: string
          executed_at?: string | null
          expires_at: string
          id?: string
          params?: Json
          requested_by: string
          result?: string | null
          run_id?: string | null
          source_agent_id: string
          status?: string
          target_agent_key: string
          updated_at?: string
        }
        Update: {
          action?: string
          assistant_chat_id?: string | null
          confirmed_at?: string | null
          conversation_id?: string
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          params?: Json
          requested_by?: string
          result?: string | null
          run_id?: string | null
          source_agent_id?: string
          status?: string
          target_agent_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_requests_assistant_chat_id_fkey"
            columns: ["assistant_chat_id"]
            isOneToOne: false
            referencedRelation: "assistant_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_requests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_scheduled_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_requests_source_agent_id_fkey"
            columns: ["source_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_scheduled_runs: {
        Row: {
          agent_id: string
          attempts: number
          conversation_id: string
          created_at: string
          first_pending_at: string | null
          id: string
          reason: string | null
          run_at: string
          seen_inbound_at: string | null
          seen_message_id: string | null
          status: string
          trigger_kind: string
          trigger_message_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          attempts?: number
          conversation_id: string
          created_at?: string
          first_pending_at?: string | null
          id?: string
          reason?: string | null
          run_at: string
          seen_inbound_at?: string | null
          seen_message_id?: string | null
          status?: string
          trigger_kind?: string
          trigger_message_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          attempts?: number
          conversation_id?: string
          created_at?: string
          first_pending_at?: string | null
          id?: string
          reason?: string | null
          run_at?: string
          seen_inbound_at?: string | null
          seen_message_id?: string | null
          status?: string
          trigger_kind?: string
          trigger_message_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_scheduled_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_scheduled_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_scheduled_runs_seen_message_id_fkey"
            columns: ["seen_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_scheduled_runs_trigger_message_id_fkey"
            columns: ["trigger_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_suggestions: {
        Row: {
          agent_id: string
          body: string
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          quick_reply_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string | null
          seen_inbound_at: string | null
          status: string
          trigger_message_id: string | null
        }
        Insert: {
          agent_id: string
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          quick_reply_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
          seen_inbound_at?: string | null
          status?: string
          trigger_message_id?: string | null
        }
        Update: {
          agent_id?: string
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          quick_reply_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string | null
          seen_inbound_at?: string | null
          status?: string
          trigger_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_suggestions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_suggestions_quick_reply_id_fkey"
            columns: ["quick_reply_id"]
            isOneToOne: false
            referencedRelation: "quick_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_suggestions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_suggestions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_scheduled_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_suggestions_trigger_message_id_fkey"
            columns: ["trigger_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_usage_log: {
        Row: {
          agent_id: string
          conversation_id: string | null
          coverage: Json | null
          created_at: string
          discarded_stale: boolean
          est_cost_usd: number
          handled_messages: number
          id: string
          input_tokens: number
          message_id: string | null
          messages_count: number
          model: string | null
          notes_created: number
          outcome: string
          output_tokens: number
          reason: string | null
          retried: boolean
          run_id: string | null
          summary_updated: boolean
        }
        Insert: {
          agent_id: string
          conversation_id?: string | null
          coverage?: Json | null
          created_at?: string
          discarded_stale?: boolean
          est_cost_usd?: number
          handled_messages?: number
          id?: string
          input_tokens?: number
          message_id?: string | null
          messages_count?: number
          model?: string | null
          notes_created?: number
          outcome: string
          output_tokens?: number
          reason?: string | null
          retried?: boolean
          run_id?: string | null
          summary_updated?: boolean
        }
        Update: {
          agent_id?: string
          conversation_id?: string | null
          coverage?: Json | null
          created_at?: string
          discarded_stale?: boolean
          est_cost_usd?: number
          handled_messages?: number
          id?: string
          input_tokens?: number
          message_id?: string | null
          messages_count?: number
          model?: string | null
          notes_created?: number
          outcome?: string
          output_tokens?: number
          reason?: string | null
          retried?: boolean
          run_id?: string | null
          summary_updated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_usage_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_usage_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_usage_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_usage_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_scheduled_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          config: Json
          enabled: boolean
          id: string
          key: string
          kind: string
          mode: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          enabled?: boolean
          id?: string
          key: string
          kind?: string
          mode?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          enabled?: boolean
          id?: string
          key?: string
          kind?: string
          mode?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_chats: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          min_role: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          min_role?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          min_role?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_daily_usage: {
        Row: {
          day: string
          questions: number
          user_id: string
        }
        Insert: {
          day: string
          questions?: number
          user_id: string
        }
        Update: {
          day?: string
          questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_daily_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          author_id: string | null
          chart: Json | null
          chat_id: string
          content: string
          created_at: string
          fetched_at: string | null
          id: string
          request_id: string | null
          role: string
          tool_data: Json | null
          tool_name: string | null
        }
        Insert: {
          author_id?: string | null
          chart?: Json | null
          chat_id: string
          content?: string
          created_at?: string
          fetched_at?: string | null
          id?: string
          request_id?: string | null
          role: string
          tool_data?: Json | null
          tool_name?: string | null
        }
        Update: {
          author_id?: string | null
          chart?: Json | null
          chat_id?: string
          content?: string
          created_at?: string
          fetched_at?: string | null
          id?: string
          request_id?: string | null
          role?: string
          tool_data?: Json | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "assistant_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "agent_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_code_limits: {
        Row: {
          failed_attempts: number
          key: string
          last_sent_at: string | null
          locked_until: string | null
          send_count: number
          send_window_start: string | null
          updated_at: string
        }
        Insert: {
          failed_attempts?: number
          key: string
          last_sent_at?: string | null
          locked_until?: string | null
          send_count?: number
          send_window_start?: string | null
          updated_at?: string
        }
        Update: {
          failed_attempts?: number
          key?: string
          last_sent_at?: string | null
          locked_until?: string | null
          send_count?: number
          send_window_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      classification_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string | null
          contact_id: string | null
          from_classification: string | null
          id: string
          reason: string | null
          source: string
          to_classification: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          from_classification?: string | null
          id?: string
          reason?: string | null
          source: string
          to_classification: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string | null
          contact_id?: string | null
          from_classification?: string | null
          id?: string
          reason?: string | null
          source?: string
          to_classification?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_suggestions: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          keyword: string
          message_id: string | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          keyword: string
          message_id?: string | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          keyword?: string
          message_id?: string | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_suggestions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_suggestions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          classification: string
          classification_source: string
          classified_at: string | null
          created_at: string
          created_by: string | null
          credit_authorized_at: string | null
          credit_authorized_by: string | null
          credit_days: number | null
          credit_limit: number | null
          custom_fields: Json
          email: string | null
          id: string
          last_purchase_at: string | null
          legal_name: string | null
          notes: string | null
          payment_terms: string
          phone: string | null
          phone_canonical: string | null
          purchase_count: number
          rfc: string | null
          trade_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          classification?: string
          classification_source?: string
          classified_at?: string | null
          created_at?: string
          created_by?: string | null
          credit_authorized_at?: string | null
          credit_authorized_by?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          custom_fields?: Json
          email?: string | null
          id?: string
          last_purchase_at?: string | null
          legal_name?: string | null
          notes?: string | null
          payment_terms?: string
          phone?: string | null
          phone_canonical?: string | null
          purchase_count?: number
          rfc?: string | null
          trade_name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          classification?: string
          classification_source?: string
          classified_at?: string | null
          created_at?: string
          created_by?: string | null
          credit_authorized_at?: string | null
          credit_authorized_by?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          custom_fields?: Json
          email?: string | null
          id?: string
          last_purchase_at?: string | null
          legal_name?: string | null
          notes?: string | null
          payment_terms?: string
          phone?: string | null
          phone_canonical?: string | null
          purchase_count?: number
          rfc?: string | null
          trade_name?: string
          updated_at?: string
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
            foreignKeyName: "companies_credit_authorized_by_fkey"
            columns: ["credit_authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_tags: {
        Row: {
          company_id: string
          tag_id: string
        }
        Insert: {
          company_id: string
          tag_id: string
        }
        Update: {
          company_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_roles: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      contact_summaries: {
        Row: {
          agent_id: string | null
          contact_id: string
          counters: Json
          created_at: string
          edited_by: string | null
          edited_by_user_at: string | null
          last_processed_at: string | null
          last_processed_message_id: string | null
          summary: string
          updated_at: string
          updated_by_agent_at: string | null
        }
        Insert: {
          agent_id?: string | null
          contact_id: string
          counters?: Json
          created_at?: string
          edited_by?: string | null
          edited_by_user_at?: string | null
          last_processed_at?: string | null
          last_processed_message_id?: string | null
          summary?: string
          updated_at?: string
          updated_by_agent_at?: string | null
        }
        Update: {
          agent_id?: string | null
          contact_id?: string
          counters?: Json
          created_at?: string
          edited_by?: string | null
          edited_by_user_at?: string | null
          last_processed_at?: string | null
          last_processed_message_id?: string | null
          summary?: string
          updated_at?: string
          updated_by_agent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_summaries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_summaries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_summaries_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_summaries_last_processed_message_id_fkey"
            columns: ["last_processed_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          classification: string
          classification_source: string
          classified_at: string | null
          company: string | null
          created_at: string
          custom_fields: Json
          email: string | null
          id: string
          last_purchase_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          phone_canonical: string | null
          purchase_count: number
          updated_at: string
          wa_id: string | null
        }
        Insert: {
          classification?: string
          classification_source?: string
          classified_at?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          last_purchase_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          phone_canonical?: string | null
          purchase_count?: number
          updated_at?: string
          wa_id?: string | null
        }
        Update: {
          classification?: string
          classification_source?: string
          classified_at?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          last_purchase_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          phone_canonical?: string | null
          purchase_count?: number
          updated_at?: string
          wa_id?: string | null
        }
        Relationships: []
      }
      conversation_events: {
        Row: {
          conversation_id: string
          created_at: string
          from_stage: string | null
          id: string
          note: string | null
          to_stage: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string | null
          to_stage?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string | null
          to_stage?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_consecutive_count: number
          agent_paused: boolean
          agent_paused_reason: string | null
          assigned_to: string | null
          contact_id: string
          created_at: string
          delivery_user_id: string | null
          human_seen_at: string | null
          id: string
          is_pinned: boolean
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_message_type: string | null
          stage: string
          stage_changed_at: string | null
          status: string
          unread_count: number
        }
        Insert: {
          agent_consecutive_count?: number
          agent_paused?: boolean
          agent_paused_reason?: string | null
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          delivery_user_id?: string | null
          human_seen_at?: string | null
          id?: string
          is_pinned?: boolean
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_type?: string | null
          stage?: string
          stage_changed_at?: string | null
          status?: string
          unread_count?: number
        }
        Update: {
          agent_consecutive_count?: number
          agent_paused?: boolean
          agent_paused_reason?: string | null
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          delivery_user_id?: string | null
          human_seen_at?: string | null
          id?: string
          is_pinned?: boolean
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_type?: string | null
          stage?: string
          stage_changed_at?: string | null
          status?: string
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_delivery_user_id_fkey"
            columns: ["delivery_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_notes: {
        Row: {
          body: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          event_on: string
          id: string
          kind: string
          requested_by: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          event_on?: string
          id?: string
          kind: string
          requested_by?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          event_on?: string
          id?: string
          kind?: string
          requested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_notes_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          company_id: string | null
          contact_id: string | null
          created_at: string
          due_on: string | null
          file_path: string | null
          folio: string
          id: string
          issued_on: string
          notes: string | null
          order_id: string | null
          recorded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          due_on?: string | null
          file_path?: string | null
          folio: string
          id?: string
          issued_on?: string
          notes?: string | null
          order_id?: string | null
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          due_on?: string | null
          file_path?: string | null
          folio?: string
          id?: string
          issued_on?: string
          notes?: string | null
          order_id?: string | null
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      link_roles: {
        Row: {
          link_id: string
          role_id: string
        }
        Insert: {
          link_id: string
          role_id: string
        }
        Update: {
          link_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_roles_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "person_company_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "contact_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_answered_through: string | null
          agent_id: string | null
          agent_run_id: string | null
          body: string | null
          conversation_id: string
          created_at: string
          direction: string
          error: string | null
          id: string
          media_error: string | null
          media_filename: string | null
          media_id: string | null
          media_mime: string | null
          media_path: string | null
          media_size: number | null
          media_status: string | null
          sender_id: string | null
          sent_by_agent: boolean
          status: string
          type: string
          wa_message_id: string | null
          wa_timestamp: string | null
        }
        Insert: {
          agent_answered_through?: string | null
          agent_id?: string | null
          agent_run_id?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          media_error?: string | null
          media_filename?: string | null
          media_id?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_size?: number | null
          media_status?: string | null
          sender_id?: string | null
          sent_by_agent?: boolean
          status?: string
          type?: string
          wa_message_id?: string | null
          wa_timestamp?: string | null
        }
        Update: {
          agent_answered_through?: string | null
          agent_id?: string | null
          agent_run_id?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          media_error?: string | null
          media_filename?: string | null
          media_id?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_size?: number | null
          media_status?: string | null
          sender_id?: string | null
          sent_by_agent?: boolean
          status?: string
          type?: string
          wa_message_id?: string | null
          wa_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_scheduled_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          agent_id: string | null
          agent_label: string | null
          author_id: string | null
          body: string
          conversation_id: string
          created_at: string
          dedupe_key: string | null
          id: string
          run_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          agent_label?: string | null
          author_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          run_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          agent_label?: string | null
          author_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_scheduled_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          description: string
          id: string
          line_total: number | null
          order_id: string
          position: number
          quantity: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          line_total?: number | null
          order_id: string
          position?: number
          quantity: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          line_total?: number | null
          order_id?: string
          position?: number
          quantity?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          authorization_note: string | null
          authorization_reasons: string[]
          authorized_at: string | null
          authorized_by: string | null
          collect_on_delivery: boolean
          company_id: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_number: number
          ordered_at: string
          requested_by: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          authorization_note?: string | null
          authorization_reasons?: string[]
          authorized_at?: string | null
          authorized_by?: string | null
          collect_on_delivery?: boolean
          company_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number?: never
          ordered_at?: string
          requested_by?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          authorization_note?: string | null
          authorization_reasons?: string[]
          authorized_at?: string | null
          authorized_by?: string | null
          collect_on_delivery?: boolean
          company_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number?: never
          ordered_at?: string
          requested_by?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          method: string
          notes: string | null
          order_id: string | null
          paid_at: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      person_company_links: {
        Row: {
          can_order: boolean
          company_id: string
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          order_limit: number | null
          requires_authorization: boolean
          updated_at: string
        }
        Insert: {
          can_order?: boolean
          company_id: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          order_limit?: number | null
          requires_authorization?: boolean
          updated_at?: string
        }
        Update: {
          can_order?: boolean
          company_id?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          order_limit?: number | null
          requires_authorization?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_company_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_company_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_company_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_match_dismissals: {
        Row: {
          company_id: string
          contact_id: string
          dismissed_at: string
          dismissed_by: string | null
        }
        Insert: {
          company_id: string
          contact_id: string
          dismissed_at?: string
          dismissed_by?: string | null
        }
        Update: {
          company_id?: string
          contact_id?: string
          dismissed_at?: string
          dismissed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_match_dismissals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_match_dismissals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_match_dismissals_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: number | null
          avatar_emoji: string | null
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          full_name: string | null
          id: string
          is_active: boolean
          job_title: string | null
          role: string
        }
        Insert: {
          avatar_color?: number | null
          avatar_emoji?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          role?: string
        }
        Update: {
          avatar_color?: number | null
          avatar_emoji?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          agent_permission: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          shortcut: string
          visible_para: string
          when_to_use: string | null
        }
        Insert: {
          agent_permission?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut: string
          visible_para?: string
          when_to_use?: string | null
        }
        Update: {
          agent_permission?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut?: string
          visible_para?: string
          when_to_use?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      account_balances: {
        Row: {
          balance: number | null
          company_id: string | null
          contact_id: string | null
          orders_total: number | null
          payments_total: number | null
        }
        Relationships: []
      }
      agent_usage_monthly: {
        Row: {
          agent_id: string | null
          est_cost_usd: number | null
          input_tokens: number | null
          month: string | null
          note_passes: number | null
          notes_created: number | null
          output_tokens: number | null
          replies: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_usage_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_directory: {
        Row: {
          classification: string | null
          conversation_id: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string | null
          is_inactive: boolean | null
          kind: string | null
          last_interaction: string | null
          last_purchase_at: string | null
          name: string | null
          phone: string | null
          purchase_count: number | null
          related_count: number | null
          related_names: string[] | null
          role_ids: string[] | null
          tag_ids: string[] | null
          wa_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_entity_note: {
        Args: {
          p_body: string
          p_date?: string
          p_entity: string
          p_id: string
        }
        Returns: {
          body: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          event_on: string
          id: string
          kind: string
          requested_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "entity_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_internal_note: {
        Args: { p_body: string; p_conversation_id: string }
        Returns: {
          agent_id: string | null
          agent_label: string | null
          author_id: string | null
          body: string
          conversation_id: string
          created_at: string
          dedupe_key: string | null
          id: string
          run_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_purchase_count: {
        Args: {
          p_count: number
          p_entity: string
          p_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      admin_revoke_sessions: { Args: { p_user_id: string }; Returns: undefined }
      agent_answered_through: {
        Args: { p_conversation_id: string }
        Returns: string
      }
      agent_burst_start: {
        Args: { p_conversation_id: string; p_gap_seconds: number }
        Returns: string
      }
      agent_handoff_to_sales: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      agent_limits: { Args: { p_key: string }; Returns: Json }
      agent_usage_summary: { Args: { p_key: string }; Returns: Json }
      approve_order: {
        Args: { p_note: string; p_order_id: string }
        Returns: {
          authorization_note: string | null
          authorization_reasons: string[]
          authorized_at: string | null
          authorized_by: string | null
          collect_on_delivery: boolean
          company_id: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_number: number
          ordered_at: string
          requested_by: string | null
          status: string
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assistant_consume_question: { Args: never; Returns: Json }
      auth_account_status: { Args: { p_email: string }; Returns: string }
      auth_code_lock_remaining: { Args: { p_key: string }; Returns: number }
      auth_code_register_failure: {
        Args: { p_key: string; p_lock_minutes?: number; p_max?: number }
        Returns: Json
      }
      auth_code_reserve_send: {
        Args: { p_cooldown?: number; p_key: string; p_max_per_hour?: number }
        Returns: Json
      }
      auth_code_reset: { Args: { p_key: string }; Returns: undefined }
      cancel_agent_request: {
        Args: { p_id: string }
        Returns: {
          action: string
          assistant_chat_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          params: Json
          requested_by: string
          result: string | null
          run_id: string | null
          source_agent_id: string
          status: string
          target_agent_key: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_notes_backfill: { Args: { p_agent_key: string }; Returns: number }
      change_conversation_stage: {
        Args: {
          p_action: string
          p_conversation_id: string
          p_delivery_user_id?: string
          p_note?: string
        }
        Returns: {
          agent_consecutive_count: number
          agent_paused: boolean
          agent_paused_reason: string | null
          assigned_to: string | null
          contact_id: string
          created_at: string
          delivery_user_id: string | null
          human_seen_at: string | null
          id: string
          is_pinned: boolean
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_message_type: string | null
          stage: string
          stage_changed_at: string | null
          status: string
          unread_count: number
        }
        SetofOptions: {
          from: "*"
          to: "conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_agent_runs: {
        Args: { p_limit?: number }
        Returns: {
          agent_id: string
          attempts: number
          conversation_id: string
          created_at: string
          first_pending_at: string | null
          id: string
          reason: string | null
          run_at: string
          seen_inbound_at: string | null
          seen_message_id: string | null
          status: string
          trigger_kind: string
          trigger_message_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_scheduled_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      company_phone_matches: {
        Args: { p_contact_id: string }
        Returns: {
          classification: string
          company_id: string
          trade_name: string
        }[]
      }
      confirm_agent_request: {
        Args: { p_id: string }
        Returns: {
          action: string
          assistant_chat_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          params: Json
          requested_by: string
          result: string | null
          run_id: string | null
          source_agent_id: string
          status: string
          target_agent_key: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      contacts_summary: {
        Args: never
        Returns: {
          companies: number
          contacts: number
          customers: number
          inactive_customers: number
        }[]
      }
      conversation_stage_counts: {
        Args: never
        Returns: {
          stage: string
          total: number
          unread: number
        }[]
      }
      create_agent_request: {
        Args: {
          p_action: string
          p_assistant_chat_id: string
          p_conversation_id: string
          p_params: Json
        }
        Returns: {
          action: string
          assistant_chat_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          params: Json
          requested_by: string
          result: string | null
          run_id: string | null
          source_agent_id: string
          status: string
          target_agent_key: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_company: {
        Args: {
          p_acknowledged?: string[]
          p_email?: string
          p_link_contact_id?: string
          p_phone?: string
          p_role_ids?: string[]
          p_trade_name: string
        }
        Returns: Json
      }
      create_order: {
        Args: {
          p_company_id: string
          p_contact_id: string
          p_conversation_id: string
          p_items: Json
          p_notes?: string
          p_requested_by: string
        }
        Returns: {
          authorization_note: string | null
          authorization_reasons: string[]
          authorized_at: string | null
          authorized_by: string | null
          collect_on_delivery: boolean
          company_id: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_number: number
          ordered_at: string
          requested_by: string | null
          status: string
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_person: {
        Args: {
          p_acknowledged?: string[]
          p_email?: string
          p_link_company_id?: string
          p_name: string
          p_phone?: string
          p_role_ids?: string[]
        }
        Returns: Json
      }
      delete_entity_note: { Args: { p_note_id: string }; Returns: undefined }
      enqueue_notes_backfill: { Args: { p_agent_key: string }; Returns: Json }
      find_phone_matches: {
        Args: {
          p_exclude_id?: string
          p_exclude_kind?: string
          p_phone: string
        }
        Returns: {
          classification: string
          has_conversation: boolean
          id: string
          is_linked: boolean
          kind: string
          name: string
        }[]
      }
      link_contact_to_company: {
        Args: {
          p_company_id: string
          p_contact_id: string
          p_role_ids?: string[]
        }
        Returns: string
      }
      normalize_phone: { Args: { p: string }; Returns: string }
      notes_backfill_status: { Args: { p_agent_key: string }; Returns: Json }
      register_purchase: {
        Args: {
          p_date?: string
          p_entity: string
          p_id: string
          p_note?: string
          p_requested_by?: string
        }
        Returns: {
          body: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          event_on: string
          id: string
          kind: string
          requested_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "entity_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_suggestion: {
        Args: { p_accept: boolean; p_id: string }
        Returns: undefined
      }
      save_assistant_turn: {
        Args: { p_chat_id: string; p_messages: Json; p_min_role: string }
        Returns: undefined
      }
      save_notes_pass: {
        Args: {
          p_agent_id: string
          p_agent_label: string
          p_contact_id: string
          p_conversation_id: string
          p_counters: Json
          p_expected_updated_at: string
          p_last_message_at: string
          p_last_message_id: string
          p_notes: Json
          p_run_id: string
          p_summary: string
          p_summary_changed: boolean
        }
        Returns: Json
      }
      schedule_agent_run: {
        Args: {
          p_agent_id: string
          p_conversation_id: string
          p_delay_seconds: number
          p_max_wait_seconds: number
          p_message_id: string
        }
        Returns: string
      }
      schedule_notes_run: {
        Args: {
          p_agent_id: string
          p_conversation_id: string
          p_delay_seconds: number
          p_max_wait_seconds: number
          p_message_id: string
          p_run_at?: string
          p_trigger?: string
        }
        Returns: string
      }
      search_conversations: {
        Args: {
          p_assigned_to?: string
          p_conversation_id?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_order?: string
          p_search?: string
          p_stages?: string[]
          p_statuses?: string[]
          p_tag_ids?: string[]
          p_to?: string
          p_unassigned?: boolean
          p_unread_only?: boolean
        }
        Returns: {
          agent_consecutive_count: number
          agent_paused: boolean
          agent_paused_reason: string | null
          assigned_to: string | null
          contact_id: string
          created_at: string
          delivery_user_id: string | null
          human_seen_at: string | null
          id: string
          is_pinned: boolean
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_message_type: string | null
          stage: string
          stage_changed_at: string | null
          status: string
          unread_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "conversations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_directory: {
        Args: {
          p_activity?: string
          p_classification?: string
          p_kind?: string
          p_limit?: number
          p_offset?: number
          p_role_ids?: string[]
          p_search?: string
          p_tag_ids?: string[]
        }
        Returns: {
          classification: string | null
          conversation_id: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string | null
          is_inactive: boolean | null
          kind: string | null
          last_interaction: string | null
          last_purchase_at: string | null
          name: string | null
          phone: string | null
          purchase_count: number | null
          related_count: number | null
          related_names: string[] | null
          role_ids: string[] | null
          tag_ids: string[] | null
          wa_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "contact_directory"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_agent_paused: {
        Args: { p_conversation_id: string; p_paused: boolean }
        Returns: {
          agent_consecutive_count: number
          agent_paused: boolean
          agent_paused_reason: string | null
          assigned_to: string | null
          contact_id: string
          created_at: string
          delivery_user_id: string | null
          human_seen_at: string | null
          id: string
          is_pinned: boolean
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_message_type: string | null
          stage: string
          stage_changed_at: string | null
          status: string
          unread_count: number
        }
        SetofOptions: {
          from: "*"
          to: "conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_classification: {
        Args: {
          p_classification: string
          p_entity: string
          p_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      update_agent_settings: {
        Args: {
          p_config: Json
          p_enabled: boolean
          p_key: string
          p_mode: string
        }
        Returns: {
          config: Json
          enabled: boolean
          id: string
          key: string
          kind: string
          mode: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "agents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_contact_summary: {
        Args: { p_contact_id: string; p_summary: string }
        Returns: {
          agent_id: string | null
          contact_id: string
          counters: Json
          created_at: string
          edited_by: string | null
          edited_by_user_at: string | null
          last_processed_at: string | null
          last_processed_message_id: string | null
          summary: string
          updated_at: string
          updated_by_agent_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "contact_summaries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_phone: {
        Args: {
          p_acknowledged?: string[]
          p_id: string
          p_kind: string
          p_link_id?: string
          p_phone: string
          p_role_ids?: string[]
        }
        Returns: Json
      }
      update_purchase_count: {
        Args: {
          p_action: string
          p_entity: string
          p_id: string
          p_undo?: Json
          p_value?: number
        }
        Returns: Json
      }
      upsert_whatsapp_contact: {
        Args: { p_name: string; p_wa_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
