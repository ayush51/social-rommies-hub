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
      daily_posts: {
        Row: {
          caption: string | null
          created_at: string
          household_id: string
          id: string
          local_date: string
          photo_path: string
          selfie_path: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          household_id: string
          id?: string
          local_date?: string
          photo_path: string
          selfie_path?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          household_id?: string
          id?: string
          local_date?: string
          photo_path?: string
          selfie_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_posts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          daily_reset_time: string
          daily_reward: number
          id: string
          name: string
          starting_balance: number
          timezone: string
        }
        Insert: {
          created_at?: string
          daily_reset_time?: string
          daily_reward?: number
          id?: string
          name: string
          starting_balance?: number
          timezone?: string
        }
        Update: {
          created_at?: string
          daily_reset_time?: string
          daily_reward?: number
          id?: string
          name?: string
          starting_balance?: number
          timezone?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          household_id: string
          id: string
          max_uses: number
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          household_id: string
          id?: string
          max_uses?: number
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          household_id?: string
          id?: string
          max_uses?: number
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          counterparty: string | null
          created_at: string
          household_id: string
          id: number
          idempotency_key: string
          kind: string
          ref: string | null
          user_id: string
        }
        Insert: {
          amount: number
          counterparty?: string | null
          created_at?: string
          household_id: string
          id?: never
          idempotency_key: string
          kind: string
          ref?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          household_id?: string
          id?: never
          idempotency_key?: string
          kind?: string
          ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_counterparty_fkey"
            columns: ["counterparty"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          household_id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          household_id: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          household_id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          household_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          household_id: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          household_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_comments: {
        Row: {
          body: string
          created_at: string
          household_id: string
          id: string
          plan_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          household_id: string
          id?: string
          plan_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          household_id?: string
          id?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_comments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_comments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_rsvps: {
        Row: {
          household_id: string
          plan_id: string
          response: string
          updated_at: string
          user_id: string
        }
        Insert: {
          household_id: string
          plan_id: string
          response: string
          updated_at?: string
          user_id: string
        }
        Update: {
          household_id?: string
          plan_id?: string
          response?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_rsvps_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_rsvps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          household_id: string
          id: string
          location: string | null
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          household_id: string
          id?: string
          location?: string | null
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          household_id?: string
          id?: string
          location?: string | null
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          household_id: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          household_id: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          household_id?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "daily_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          emoji: string
          household_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          emoji: string
          household_id: string
          post_id: string
          user_id: string
        }
        Update: {
          emoji?: string
          household_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "daily_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          dob: string | null
          id: string
          last_seen_at: string | null
          nickname: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          dob?: string | null
          id: string
          last_seen_at?: string | null
          nickname?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          dob?: string | null
          id?: string
          last_seen_at?: string | null
          nickname?: string | null
        }
        Relationships: []
      }
      push_log: {
        Row: {
          created_at: string
          ref: string
        }
        Insert: {
          created_at?: string
          ref: string
        }
        Update: {
          created_at?: string
          ref?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          household_id: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          household_id: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          household_id?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          expires_at: string | null
          household_id: string
          kind: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          household_id: string
          kind: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          household_id?: string
          kind?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statuses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          household_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          household_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          household_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_daily_reward: { Args: never; Returns: number }
      create_household: {
        Args: { p_name: string; p_timezone?: string }
        Returns: string
      }
      create_invite: {
        Args: { p_household: string; p_max_uses?: number }
        Returns: string
      }
      drop_subscriptions: {
        Args: { p_endpoints: string[] }
        Returns: undefined
      }
      ensure_wallet: {
        Args: { p_hid: string; p_user: string }
        Returns: undefined
      }
      household_today: { Args: { hid: string }; Returns: string }
      is_household_admin: { Args: { hid: string }; Returns: boolean }
      is_household_member: { Args: { hid: string }; Returns: boolean }
      memories: {
        Args: { p_household: string; p_limit?: number }
        Returns: {
          caption: string | null
          created_at: string
          household_id: string
          id: string
          local_date: string
          photo_path: string
          selfie_path: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_wallet: { Args: never; Returns: number }
      post_ledger: {
        Args: {
          p_amount: number
          p_counter?: string
          p_hid: string
          p_key: string
          p_kind: string
          p_ref?: string
          p_user: string
        }
        Returns: boolean
      }
      push_targets: {
        Args: { p_kind: string; p_ref: string }
        Returns: {
          auth: string
          body: string
          endpoint: string
          p256dh: string
          title: string
          url: string
        }[]
      }
      redeem_invite: { Args: { p_code: string }; Returns: string }
      save_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
      }
      tip_post: {
        Args: { p_amount: number; p_key: string; p_post: string }
        Returns: undefined
      }
      touch_last_seen: { Args: never; Returns: undefined }
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
