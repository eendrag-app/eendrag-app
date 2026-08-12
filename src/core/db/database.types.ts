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
    PostgrestVersion: "14.15"
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
          author_id: string | null
          body: string
          created_at: string
          id: string
          image_path: string | null
          is_system: boolean
          is_urgent: boolean
          pdf_path: string | null
          published_at: string | null
          scheduled_for: string | null
          status: string
          target_section_id: string | null
          title: string
          updated_at: string
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          image_path?: string | null
          is_system?: boolean
          is_urgent?: boolean
          pdf_path?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          target_section_id?: string | null
          title: string
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          image_path?: string | null
          is_system?: boolean
          is_urgent?: boolean
          pdf_path?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          target_section_id?: string | null
          title?: string
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_target_section_id_fkey"
            columns: ["target_section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          ends_at: string | null
          id: string
          location: string
          section_id: string | null
          source_module: string | null
          source_ref: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          id?: string
          location?: string
          section_id?: string | null
          source_module?: string | null
          source_ref?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          id?: string
          location?: string
          section_id?: string | null
          source_module?: string | null
          source_ref?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      intersection_events: {
        Row: {
          created_at: string
          id: string
          name: string
          rules: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rules?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rules?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      intersection_group_teams: {
        Row: {
          group_id: string
          section_id: string
          slot: number
        }
        Insert: {
          group_id: string
          section_id: string
          slot: number
        }
        Update: {
          group_id?: string
          section_id?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "intersection_group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "intersection_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intersection_group_teams_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      intersection_groups: {
        Row: {
          event_id: string
          id: string
          name: string
        }
        Insert: {
          event_id: string
          id?: string
          name: string
        }
        Update: {
          event_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "intersection_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "intersection_events"
            referencedColumns: ["id"]
          },
        ]
      }
      intersection_matches: {
        Row: {
          created_at: string
          event_id: string
          group_id: string | null
          id: string
          manual: boolean
          note: string | null
          played: boolean
          scheduled_at: string | null
          slot: number | null
          sort_order: number
          source_a: string | null
          source_b: string | null
          stage: string
          team_a_section_id: string | null
          team_b_section_id: string | null
          updated_at: string
          winner_section_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          group_id?: string | null
          id?: string
          manual?: boolean
          note?: string | null
          played?: boolean
          scheduled_at?: string | null
          slot?: number | null
          sort_order?: number
          source_a?: string | null
          source_b?: string | null
          stage: string
          team_a_section_id?: string | null
          team_b_section_id?: string | null
          updated_at?: string
          winner_section_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          group_id?: string | null
          id?: string
          manual?: boolean
          note?: string | null
          played?: boolean
          scheduled_at?: string | null
          slot?: number | null
          sort_order?: number
          source_a?: string | null
          source_b?: string | null
          stage?: string
          team_a_section_id?: string | null
          team_b_section_id?: string | null
          updated_at?: string
          winner_section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intersection_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "intersection_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intersection_matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "intersection_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intersection_matches_team_a_section_id_fkey"
            columns: ["team_a_section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intersection_matches_team_b_section_id_fkey"
            columns: ["team_b_section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intersection_matches_winner_section_id_fkey"
            columns: ["winner_section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      intersection_players: {
        Row: {
          created_at: string
          id: string
          name: string
          profile_id: string | null
          section_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          profile_id?: string | null
          section_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          profile_id?: string | null
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intersection_players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intersection_players_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      intersection_rosters: {
        Row: {
          event_id: string
          player_id: string
        }
        Insert: {
          event_id: string
          player_id: string
        }
        Update: {
          event_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intersection_rosters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "intersection_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intersection_rosters_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "intersection_players"
            referencedColumns: ["id"]
          },
        ]
      }
      intersection_settings: {
        Row: {
          id: number
          points_champion: number
          points_group: number
          points_quarters: number
          points_runner_up: number
          points_semis: number
        }
        Insert: {
          id?: number
          points_champion?: number
          points_group?: number
          points_quarters?: number
          points_runner_up?: number
          points_semis?: number
        }
        Update: {
          id?: number
          points_champion?: number
          points_group?: number
          points_quarters?: number
          points_runner_up?: number
          points_semis?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          enabled: boolean
          profile_id: string
        }
        Insert: {
          category: string
          enabled?: boolean
          profile_id: string
        }
        Update: {
          category?: string
          enabled?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          deliver_at: string
          id: string
          profile_id: string
          pushed_at: string | null
          read_at: string | null
          source_module: string
          source_ref: string
          title: string
          url: string
        }
        Insert: {
          body?: string
          category: string
          created_at?: string
          deliver_at?: string
          id?: string
          profile_id: string
          pushed_at?: string | null
          read_at?: string | null
          source_module: string
          source_ref?: string
          title: string
          url?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          deliver_at?: string
          id?: string
          profile_id?: string
          pushed_at?: string | null
          read_at?: string | null
          source_module?: string
          source_ref?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          calendar_token: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          role: string
          room_number: string
          section_id: string | null
          updated_at: string
        }
        Insert: {
          calendar_token?: string
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          role?: string
          room_number?: string
          section_id?: string | null
          updated_at?: string
        }
        Update: {
          calendar_token?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          role?: string
          room_number?: string
          section_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
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
          user_agent: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          profile_id: string
          user_agent?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          profile_id?: string
          user_agent?: string
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
      sections: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      sport_fixtures: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location: string
          notes: string
          opponent: string
          sport_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string
          notes?: string
          opponent?: string
          sport_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string
          notes?: string
          opponent?: string
          sport_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_fixtures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_fixtures_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_results: {
        Row: {
          created_at: string
          created_by: string | null
          fixture_id: string | null
          id: string
          played_at: string
          score: string
          sport_id: string
          summary: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fixture_id?: string | null
          id?: string
          played_at?: string
          score?: string
          sport_id: string
          summary: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fixture_id?: string | null
          id?: string
          played_at?: string
          score?: string
          sport_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_results_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "sport_fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_results_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_signups: {
        Row: {
          created_at: string
          note: string
          profile_id: string
          sport_id: string
        }
        Insert: {
          created_at?: string
          note?: string
          profile_id: string
          sport_id: string
        }
        Update: {
          created_at?: string
          note?: string
          profile_id?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_signups_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_signups_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          coach: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          practice_info: string
          rep_id: string | null
          updated_at: string
          venue: string
        }
        Insert: {
          coach?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          practice_info?: string
          rep_id?: string | null
          updated_at?: string
          venue?: string
        }
        Update: {
          coach?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          practice_info?: string
          rep_id?: string | null
          updated_at?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sports: {
        Row: {
          profile_id: string
          sport_id: string
        }
        Insert: {
          profile_id: string
          sport_id: string
        }
        Update: {
          profile_id?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sports_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_emails: {
        Row: {
          created_at: string
          email: string
          note: string
        }
        Insert: {
          created_at?: string
          email: string
          note?: string
        }
        Update: {
          created_at?: string
          email?: string
          note?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      announcement_read_counts: {
        Args: { announcement_ids: string[] }
        Returns: {
          announcement_id: string
          read_count: number
        }[]
      }
      app_is_admin: { Args: never; Returns: boolean }
      app_is_any_sport_rep: { Args: never; Returns: boolean }
      app_is_rep_of: { Args: { sport: string }; Returns: boolean }
      app_role: { Args: never; Returns: string }
      app_section_id: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
