// Generado con `generate_typescript_types` de Supabase. No editar a mano:
// regenerar si cambia el esquema.
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
          updated_at?: string
          wa_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          assigned_to: string | null
          contact_id: string
          created_at: string
          id: string
          is_pinned: boolean
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_message_type: string | null
          status: string
          unread_count: number
        }
        Insert: {
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_type?: string | null
          status?: string
          unread_count?: number
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_type?: string | null
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
          status: string
          type: string
          wa_message_id: string | null
          wa_timestamp: string | null
        }
        Insert: {
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
          status?: string
          type?: string
          wa_message_id?: string | null
          wa_timestamp?: string | null
        }
        Update: {
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
          status?: string
          type?: string
          wa_message_id?: string | null
          wa_timestamp?: string | null
        }
        Relationships: [
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
          author_id: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          shortcut: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut?: string
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
          name: string | null
          phone: string | null
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
      normalize_phone: { Args: { p: string }; Returns: string }
      resolve_suggestion: {
        Args: { p_accept: boolean; p_id: string }
        Returns: undefined
      }
      search_conversations: {
        Args: {
          p_assigned_to?: string
          p_conversation_id?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_statuses?: string[]
          p_tag_ids?: string[]
          p_to?: string
          p_unassigned?: boolean
          p_unread_only?: boolean
        }
        Returns: {
          assigned_to: string | null
          contact_id: string
          created_at: string
          id: string
          is_pinned: boolean
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_message_type: string | null
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
          name: string | null
          phone: string | null
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
      set_classification: {
        Args: {
          p_classification: string
          p_entity: string
          p_id: string
          p_reason?: string
        }
        Returns: undefined
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

type PublicSchema = Database["public"]
type TablesAndViews = PublicSchema["Tables"] & PublicSchema["Views"]

// Atajos para leer filas de las tablas (y vistas) públicas.
export type Tables<T extends keyof TablesAndViews> = TablesAndViews[T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
