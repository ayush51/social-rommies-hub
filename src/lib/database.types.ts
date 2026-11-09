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
      card_days: {
        Row: {
          household_id: string
          local_date: string
          prompt: string
          suggested_by: string | null
        }
        Insert: {
          household_id: string
          local_date: string
          prompt: string
          suggested_by?: string | null
        }
        Update: {
          household_id?: string
          local_date?: string
          prompt?: string
          suggested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_days_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_days_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_picks: {
        Row: {
          household_id: string
          local_date: string
          pick_id: string
          picked_at: string
          voter_id: string
        }
        Insert: {
          household_id: string
          local_date: string
          pick_id: string
          picked_at?: string
          voter_id: string
        }
        Update: {
          household_id?: string
          local_date?: string
          pick_id?: string
          picked_at?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_picks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_picks_pick_id_fkey"
            columns: ["pick_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_picks_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_prompts: {
        Row: {
          id: number
          text: string
        }
        Insert: {
          id?: never
          text: string
        }
        Update: {
          id?: never
          text?: string
        }
        Relationships: []
      }
      card_results: {
        Row: {
          household_id: string
          local_date: string
          settled_at: string
          winner_ids: string[]
        }
        Insert: {
          household_id: string
          local_date: string
          settled_at?: string
          winner_ids?: string[]
        }
        Update: {
          household_id?: string
          local_date?: string
          settled_at?: string
          winner_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "card_results_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      card_suggestions: {
        Row: {
          created_at: string
          household_id: string
          id: string
          reviewed_at: string | null
          status: string
          text: string
          used_on: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          reviewed_at?: string | null
          status?: string
          text: string
          used_on?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          text?: string
          used_on?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_suggestions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reads: {
        Row: {
          last_read_at: string
          thread: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          thread: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          thread?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      dishes: {
        Row: {
          active: boolean
          created_at: string
          household_id: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          household_id: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          household_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "dishes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_comments: {
        Row: {
          body: string
          created_at: string
          household_id: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          household_id: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          household_id?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_comments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          created_by: string
          description: string | null
          household_id: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          household_id: string
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          household_id?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_requests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_votes: {
        Row: {
          household_id: string
          request_id: string
          user_id: string
        }
        Insert: {
          household_id: string
          request_id: string
          user_id: string
        }
        Update: {
          household_id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_votes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_votes_user_id_fkey"
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
          cook_name: string
          created_at: string
          daily_reset_time: string
          daily_reward: number
          id: string
          name: string
          poll_lock_dow: number
          poll_lock_time: string
          starting_balance: number
          timezone: string
        }
        Insert: {
          cook_name?: string
          created_at?: string
          daily_reset_time?: string
          daily_reward?: number
          id?: string
          name: string
          poll_lock_dow?: number
          poll_lock_time?: string
          starting_balance?: number
          timezone?: string
        }
        Update: {
          cook_name?: string
          created_at?: string
          daily_reset_time?: string
          daily_reward?: number
          id?: string
          name?: string
          poll_lock_dow?: number
          poll_lock_time?: string
          starting_balance?: number
          timezone?: string
        }
        Relationships: []
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
      location_shares: {
        Row: {
          accuracy_m: number | null
          expires_at: string
          household_id: string
          lat: number
          lng: number
          paused: boolean
          precision: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          expires_at: string
          household_id: string
          lat: number
          lng: number
          paused?: boolean
          precision: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          expires_at?: string
          household_id?: string
          lat?: number
          lng?: number
          paused?: boolean
          precision?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_shares_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_bets: {
        Row: {
          amount: number
          created_at: string
          household_id: string
          market_id: string
          option_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          household_id: string
          market_id: string
          option_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          household_id?: string
          market_id?: string
          option_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_bets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_bets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_bets_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_options: {
        Row: {
          id: string
          label: string
          market_id: string
          position: number
        }
        Insert: {
          id?: string
          label: string
          market_id: string
          position: number
        }
        Update: {
          id?: string
          label?: string
          market_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_options_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          cancel_reason: string | null
          closes_at: string
          created_at: string
          created_by: string
          description: string | null
          household_id: string
          id: string
          question: string
          resolved_at: string | null
          resolved_option_id: string | null
          resolver_id: string
          status: string
        }
        Insert: {
          cancel_reason?: string | null
          closes_at: string
          created_at?: string
          created_by: string
          description?: string | null
          household_id: string
          id?: string
          question: string
          resolved_at?: string | null
          resolved_option_id?: string | null
          resolver_id: string
          status?: string
        }
        Update: {
          cancel_reason?: string | null
          closes_at?: string
          created_at?: string
          created_by?: string
          description?: string | null
          household_id?: string
          id?: string
          question?: string
          resolved_at?: string | null
          resolved_option_id?: string | null
          resolver_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "markets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_resolved_option_fk"
            columns: ["resolved_option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markets_resolver_id_fkey"
            columns: ["resolver_id"]
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
          edited_at: string | null
          household_id: string
          id: string
          image_path: string | null
          recipient_id: string | null
          reply_to: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          edited_at?: string | null
          household_id: string
          id?: string
          image_path?: string | null
          recipient_id?: string | null
          reply_to?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          edited_at?: string | null
          household_id?: string
          id?: string
          image_path?: string | null
          recipient_id?: string | null
          reply_to?: string | null
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
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
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
      monopoly_events: {
        Row: {
          actor: string | null
          created_at: string
          game_id: string
          household_id: string
          id: string
          notify_mode: string
          notify_user: string | null
          seq: number
          text: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          game_id: string
          household_id: string
          id?: string
          notify_mode?: string
          notify_user?: string | null
          seq?: never
          text: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          game_id?: string
          household_id?: string
          id?: string
          notify_mode?: string
          notify_user?: string | null
          seq?: never
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "monopoly_events_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "monopoly_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_events_notify_user_fkey"
            columns: ["notify_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monopoly_games: {
        Row: {
          buy_in: number
          created_at: string
          current_seat: number | null
          doubles: number
          finished_at: string | null
          host_id: string
          household_id: string
          id: string
          last_actor: string | null
          last_dice: number[] | null
          max_players: number
          started_at: string | null
          status: string
          turn_no: number
          turn_phase: string
          turn_started_at: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          buy_in: number
          created_at?: string
          current_seat?: number | null
          doubles?: number
          finished_at?: string | null
          host_id: string
          household_id: string
          id?: string
          last_actor?: string | null
          last_dice?: number[] | null
          max_players: number
          started_at?: string | null
          status?: string
          turn_no?: number
          turn_phase?: string
          turn_started_at?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          buy_in?: number
          created_at?: string
          current_seat?: number | null
          doubles?: number
          finished_at?: string | null
          host_id?: string
          household_id?: string
          id?: string
          last_actor?: string | null
          last_dice?: number[] | null
          max_players?: number
          started_at?: string | null
          status?: string
          turn_no?: number
          turn_phase?: string
          turn_started_at?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monopoly_games_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_games_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_games_last_actor_fkey"
            columns: ["last_actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monopoly_players: {
        Row: {
          bankrupt: boolean
          cash: number
          game_id: string
          household_id: string
          idle_skips: number
          in_jail: boolean
          jail_turns: number
          joined_at: string
          position: number
          seat: number
          user_id: string
        }
        Insert: {
          bankrupt?: boolean
          cash?: number
          game_id: string
          household_id: string
          idle_skips?: number
          in_jail?: boolean
          jail_turns?: number
          joined_at?: string
          position?: number
          seat: number
          user_id: string
        }
        Update: {
          bankrupt?: boolean
          cash?: number
          game_id?: string
          household_id?: string
          idle_skips?: number
          in_jail?: boolean
          jail_turns?: number
          joined_at?: string
          position?: number
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monopoly_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "monopoly_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_players_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monopoly_props: {
        Row: {
          game_id: string
          household_id: string
          level: number
          owner_id: string
          space: number
        }
        Insert: {
          game_id: string
          household_id: string
          level?: number
          owner_id: string
          space: number
        }
        Update: {
          game_id?: string
          household_id?: string
          level?: number
          owner_id?: string
          space?: number
        }
        Relationships: [
          {
            foreignKeyName: "monopoly_props_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "monopoly_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_props_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_props_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monopoly_props_space_fkey"
            columns: ["space"]
            isOneToOne: false
            referencedRelation: "monopoly_spaces"
            referencedColumns: ["idx"]
          },
        ]
      }
      monopoly_spaces: {
        Row: {
          amount: number | null
          color: string | null
          idx: number
          kind: string
          name: string
          price: number | null
          rent: number[] | null
          upgrade_cost: number | null
        }
        Insert: {
          amount?: number | null
          color?: string | null
          idx: number
          kind: string
          name: string
          price?: number | null
          rent?: number[] | null
          upgrade_cost?: number | null
        }
        Update: {
          amount?: number | null
          color?: string | null
          idx?: number
          kind?: string
          name?: string
          price?: number | null
          rent?: number[] | null
          upgrade_cost?: number | null
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          muted: string[]
          quiet_end: string | null
          quiet_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          muted?: string[]
          quiet_end?: string | null
          quiet_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          muted?: string[]
          quiet_end?: string | null
          quiet_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      poll_votes: {
        Row: {
          dish_id: string
          household_id: string
          user_id: string
          voted_at: string
          week_start: string
        }
        Insert: {
          dish_id: string
          household_id: string
          user_id: string
          voted_at?: string
          week_start: string
        }
        Update: {
          dish_id?: string
          household_id?: string
          user_id?: string
          voted_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      push_events: {
        Row: {
          actor: string
          body: string
          category: string
          created_at: string
          household_id: string
          id: string
          notify_user: string | null
          title: string
          url: string
        }
        Insert: {
          actor: string
          body: string
          category: string
          created_at?: string
          household_id: string
          id?: string
          notify_user?: string | null
          title: string
          url: string
        }
        Update: {
          actor?: string
          body?: string
          category?: string
          created_at?: string
          household_id?: string
          id?: string
          notify_user?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_events_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_events_notify_user_fkey"
            columns: ["notify_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      rallies: {
        Row: {
          created_at: string
          household_id: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          label: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rallies_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rallies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_outbox: {
        Row: {
          body: string
          created_at: string
          household_id: string
          id: number
          kind: string
          recipients: string[]
          ref: string
          sent_at: string | null
          title: string
          url: string
        }
        Insert: {
          body: string
          created_at?: string
          household_id: string
          id?: never
          kind: string
          recipients: string[]
          ref: string
          sent_at?: string | null
          title: string
          url: string
        }
        Update: {
          body?: string
          created_at?: string
          household_id?: string
          id?: never
          kind?: string
          recipients?: string[]
          ref?: string
          sent_at?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_outbox_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
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
      birthday_reminders_at: { Args: { p_now: string }; Returns: number }
      cancel_market: {
        Args: { p_market: string; p_reason?: string }
        Returns: undefined
      }
      card_ensure_day: {
        Args: { p_date: string; p_hid: string }
        Returns: undefined
      }
      card_history: { Args: { p_limit?: number }; Returns: Json }
      card_past: { Args: { p_days?: number }; Returns: Json }
      card_prompt_for: { Args: { d: string; hid: string }; Returns: string }
      card_today: { Args: never; Returns: Json }
      chat_unread: { Args: never; Returns: Json }
      claim_daily_reward: { Args: never; Returns: number }
      create_market: {
        Args: {
          p_closes_at: string
          p_description: string
          p_options: string[]
          p_question: string
          p_resolver: string
        }
        Returns: string
      }
      do_vote: {
        Args: { p_dish: string; p_now: string; p_user: string }
        Returns: undefined
      }
      drop_subscriptions: {
        Args: { p_endpoints: string[] }
        Returns: undefined
      }
      emit_push_event: {
        Args: {
          p_actor: string
          p_body: string
          p_category: string
          p_household: string
          p_title: string
          p_url: string
          p_user?: string
        }
        Returns: string
      }
      enqueue_birthdays_reminders: { Args: never; Returns: number }
      enqueue_location_reminders: { Args: never; Returns: number }
      enqueue_market_reminders: { Args: { p_now?: string }; Returns: number }
      enqueue_reminders: { Args: { p_now?: string }; Returns: number }
      enqueue_reminders_all: { Args: never; Returns: number }
      ensure_wallet: {
        Args: { p_hid: string; p_user: string }
        Returns: undefined
      }
      household_today: { Args: { hid: string }; Returns: string }
      is_household_admin: { Args: { hid: string }; Returns: boolean }
      is_household_member: { Args: { hid: string }; Returns: boolean }
      location_pause: { Args: { p_paused: boolean }; Returns: undefined }
      location_round: {
        Args: { p_precision: string; p_v: number }
        Returns: number
      }
      location_share: {
        Args: {
          p_accuracy: number
          p_lat: number
          p_lng: number
          p_minutes: number
          p_precision: string
        }
        Returns: string
      }
      location_stop: { Args: never; Returns: undefined }
      location_update: {
        Args: { p_accuracy: number; p_lat: number; p_lng: number }
        Returns: boolean
      }
      mark_chat_read: { Args: { p_thread: string }; Returns: undefined }
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
      mono_advance: { Args: { p_game: string }; Returns: string }
      mono_after_bankrupt: {
        Args: { p_game: string; p_user: string }
        Returns: string
      }
      mono_buy: {
        Args: { p_buy: boolean; p_game: string; p_user: string }
        Returns: string
      }
      mono_end_turn: {
        Args: { p_game: string; p_user: string }
        Returns: string
      }
      mono_finish_if_won: { Args: { p_game: string }; Returns: string }
      mono_log: {
        Args: {
          p_actor: string
          p_game: string
          p_mode?: string
          p_text: string
          p_user?: string
        }
        Returns: string
      }
      mono_name: { Args: { u: string }; Returns: string }
      mono_pass_turn: {
        Args: { p_actor: string; p_game: string; p_text: string }
        Returns: string
      }
      mono_pay: {
        Args: {
          p_amount: number
          p_creditor: string
          p_debtor: string
          p_game: string
        }
        Returns: boolean
      }
      mono_pay_jail: {
        Args: { p_game: string; p_user: string }
        Returns: string
      }
      mono_refund: {
        Args: {
          p_amount: number
          p_game: string
          p_hid: string
          p_user: string
        }
        Returns: undefined
      }
      mono_rent: {
        Args: {
          p_dice: number
          p_game: string
          p_owner: string
          p_space: number
        }
        Returns: number
      }
      mono_resign: { Args: { p_game: string; p_user: string }; Returns: string }
      mono_roll: {
        Args: {
          d1: number
          d2: number
          p_card: number
          p_game: string
          p_user: string
        }
        Returns: string
      }
      mono_skip: { Args: { p_caller: string; p_game: string }; Returns: string }
      mono_stake: {
        Args: {
          p_amount: number
          p_game: string
          p_hid: string
          p_user: string
        }
        Returns: undefined
      }
      mono_turn: {
        Args: { p_game: string; p_phases: string[]; p_user: string }
        Returns: undefined
      }
      mono_upgrade: {
        Args: { p_game: string; p_space: number; p_user: string }
        Returns: string
      }
      monopoly_buy: { Args: { p_buy: boolean; p_game: string }; Returns: Json }
      monopoly_cancel: { Args: { p_game: string }; Returns: Json }
      monopoly_create: {
        Args: { p_buy_in: number; p_max: number }
        Returns: Json
      }
      monopoly_end_turn: { Args: { p_game: string }; Returns: Json }
      monopoly_join: { Args: { p_game: string }; Returns: Json }
      monopoly_leave: { Args: { p_game: string }; Returns: Json }
      monopoly_pay_jail: { Args: { p_game: string }; Returns: Json }
      monopoly_resign: { Args: { p_game: string }; Returns: Json }
      monopoly_roll: { Args: { p_game: string }; Returns: Json }
      monopoly_skip: { Args: { p_game: string }; Returns: Json }
      monopoly_start: { Args: { p_game: string }; Returns: Json }
      monopoly_upgrade: {
        Args: { p_game: string; p_space: number }
        Returns: Json
      }
      my_wallet: { Args: never; Returns: number }
      pick_card: { Args: { p_pick: string }; Returns: undefined }
      place_bet: {
        Args: {
          p_amount: number
          p_key: string
          p_market: string
          p_option: string
        }
        Returns: undefined
      }
      poll_state: { Args: { p_now: string; p_user: string }; Returns: Json }
      poll_window: {
        Args: { hid: string; p_now: string }
        Returns: {
          cook_day: string
          cook_name: string
          lock_at: string
          lock_dow: number
          lock_time: string
          phase: string
          week_start: string
        }[]
      }
      poll_winner_name: { Args: { hid: string; ws: string }; Returns: string }
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
      push_allowed: {
        Args: { p_category: string; p_user: string }
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
      reminder_category: { Args: { p_kind: string }; Returns: string }
      reminders_claim: {
        Args: { p_secret: string }
        Returns: {
          auth: string
          body: string
          endpoint: string
          p256dh: string
          title: string
          url: string
        }[]
      }
      reminders_drop: {
        Args: { p_endpoints: string[]; p_secret: string }
        Returns: undefined
      }
      resolve_market: {
        Args: { p_market: string; p_option: string }
        Returns: undefined
      }
      review_question: {
        Args: { p_approve: boolean; p_id: string }
        Returns: undefined
      }
      save_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
      }
      set_notification_prefs: {
        Args: { p_muted: string[]; p_quiet_end: string; p_quiet_start: string }
        Returns: undefined
      }
      settle_cards: { Args: { p_hid: string }; Returns: undefined }
      start_rally: { Args: { p_label: string }; Returns: string }
      suggest_question: { Args: { p_text: string }; Returns: undefined }
      thursday_poll: { Args: never; Returns: Json }
      tip_post: {
        Args: { p_amount: number; p_key: string; p_post: string }
        Returns: undefined
      }
      touch_last_seen: { Args: never; Returns: undefined }
      vote_dish: { Args: { p_dish: string }; Returns: undefined }
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
