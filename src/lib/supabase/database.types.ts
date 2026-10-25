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
          company: string | null
          created_at: string
          custom_fields: Json
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          updated_at: string
          wa_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          wa_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          custom_fields?: Json
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          wa_id?: string
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
      [_ in never]: never
    }
    Functions: {
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

// Atajos para leer filas de las tablas públicas.
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
