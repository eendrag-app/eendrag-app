// Database types for supabase-js. Currently HAND-WRITTEN to match
// supabase/migrations exactly. After any schema change (and once a database
// is reachable) regenerate with:
//
//   npm run db:types        (local stack)
//   npx supabase gen types typescript --linked > src/core/db/database.types.ts
//
// The generated file drops in over this one — same shape, machine-made.

type Timestamptz = string;
type Uuid = string;

export type Database = {
  public: {
    Tables: {
      sections: {
        Row: {
          id: Uuid;
          name: string;
          color: string;
          sort_order: number;
        };
        Insert: {
          id?: Uuid;
          name: string;
          color: string;
          sort_order: number;
        };
        Update: {
          id?: Uuid;
          name?: string;
          color?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      sports: {
        Row: {
          id: Uuid;
          name: string;
          description: string;
          practice_info: string;
          venue: string;
          coach: string;
          is_active: boolean;
          rep_id: Uuid | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          name: string;
          description?: string;
          practice_info?: string;
          venue?: string;
          coach?: string;
          is_active?: boolean;
          rep_id?: Uuid | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          name?: string;
          description?: string;
          practice_info?: string;
          venue?: string;
          coach?: string;
          is_active?: boolean;
          rep_id?: Uuid | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: Uuid;
          email: string;
          full_name: string;
          section_id: Uuid | null;
          room_number: string;
          role: string;
          is_active: boolean;
          calendar_token: Uuid;
          quiet_hours_start: string;
          quiet_hours_end: string;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id: Uuid;
          email: string;
          full_name?: string;
          section_id?: Uuid | null;
          room_number?: string;
          role?: string;
          is_active?: boolean;
          calendar_token?: Uuid;
          quiet_hours_start?: string;
          quiet_hours_end?: string;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          email?: string;
          full_name?: string;
          section_id?: Uuid | null;
          room_number?: string;
          role?: string;
          is_active?: boolean;
          calendar_token?: Uuid;
          quiet_hours_start?: string;
          quiet_hours_end?: string;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      user_sports: {
        Row: {
          profile_id: Uuid;
          sport_id: Uuid;
        };
        Insert: {
          profile_id: Uuid;
          sport_id: Uuid;
        };
        Update: {
          profile_id?: Uuid;
          sport_id?: Uuid;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          profile_id: Uuid;
          category: string;
          enabled: boolean;
        };
        Insert: {
          profile_id: Uuid;
          category: string;
          enabled?: boolean;
        };
        Update: {
          profile_id?: Uuid;
          category?: string;
          enabled?: boolean;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: Uuid;
          profile_id: Uuid;
          category: string;
          title: string;
          body: string;
          url: string;
          source_module: string;
          source_ref: string;
          created_at: Timestamptz;
          read_at: Timestamptz | null;
        };
        Insert: {
          id?: Uuid;
          profile_id: Uuid;
          category: string;
          title: string;
          body?: string;
          url?: string;
          source_module: string;
          source_ref?: string;
          created_at?: Timestamptz;
          read_at?: Timestamptz | null;
        };
        Update: {
          id?: Uuid;
          profile_id?: Uuid;
          category?: string;
          title?: string;
          body?: string;
          url?: string;
          source_module?: string;
          source_ref?: string;
          created_at?: Timestamptz;
          read_at?: Timestamptz | null;
        };
        Relationships: [];
      };
      verified_emails: {
        Row: {
          email: string;
          note: string;
          created_at: Timestamptz;
        };
        Insert: {
          email: string;
          note?: string;
          created_at?: Timestamptz;
        };
        Update: {
          email?: string;
          note?: string;
          created_at?: Timestamptz;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: Uuid;
          title: string;
          description: string;
          category: string;
          section_id: Uuid | null;
          location: string;
          starts_at: Timestamptz;
          ends_at: Timestamptz | null;
          source_module: string | null;
          source_ref: string | null;
          created_by: Uuid | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          title: string;
          description?: string;
          category: string;
          section_id?: Uuid | null;
          location?: string;
          starts_at: Timestamptz;
          ends_at?: Timestamptz | null;
          source_module?: string | null;
          source_ref?: string | null;
          created_by?: Uuid | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          title?: string;
          description?: string;
          category?: string;
          section_id?: Uuid | null;
          location?: string;
          starts_at?: Timestamptz;
          ends_at?: Timestamptz | null;
          source_module?: string | null;
          source_ref?: string | null;
          created_by?: Uuid | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: Uuid;
          title: string;
          body: string;
          author_id: Uuid | null;
          is_urgent: boolean;
          is_system: boolean;
          target_section_id: Uuid | null;
          status: string;
          scheduled_for: Timestamptz | null;
          published_at: Timestamptz | null;
          image_path: string | null;
          pdf_path: string | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          title: string;
          body?: string;
          author_id?: Uuid | null;
          is_urgent?: boolean;
          is_system?: boolean;
          target_section_id?: Uuid | null;
          status?: string;
          scheduled_for?: Timestamptz | null;
          published_at?: Timestamptz | null;
          image_path?: string | null;
          pdf_path?: string | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          title?: string;
          body?: string;
          author_id?: Uuid | null;
          is_urgent?: boolean;
          is_system?: boolean;
          target_section_id?: Uuid | null;
          status?: string;
          scheduled_for?: Timestamptz | null;
          published_at?: Timestamptz | null;
          image_path?: string | null;
          pdf_path?: string | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      announcement_reads: {
        Row: {
          announcement_id: Uuid;
          profile_id: Uuid;
          read_at: Timestamptz;
        };
        Insert: {
          announcement_id: Uuid;
          profile_id: Uuid;
          read_at?: Timestamptz;
        };
        Update: {
          announcement_id?: Uuid;
          profile_id?: Uuid;
          read_at?: Timestamptz;
        };
        Relationships: [];
      };
      sport_fixtures: {
        Row: {
          id: Uuid;
          sport_id: Uuid;
          opponent: string;
          location: string;
          starts_at: Timestamptz;
          notes: string;
          created_by: Uuid | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          sport_id: Uuid;
          opponent?: string;
          location?: string;
          starts_at: Timestamptz;
          notes?: string;
          created_by?: Uuid | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          sport_id?: Uuid;
          opponent?: string;
          location?: string;
          starts_at?: Timestamptz;
          notes?: string;
          created_by?: Uuid | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      sport_results: {
        Row: {
          id: Uuid;
          sport_id: Uuid;
          fixture_id: Uuid | null;
          summary: string;
          score: string;
          played_at: Timestamptz;
          created_by: Uuid | null;
          created_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          sport_id: Uuid;
          fixture_id?: Uuid | null;
          summary: string;
          score?: string;
          played_at?: Timestamptz;
          created_by?: Uuid | null;
          created_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          sport_id?: Uuid;
          fixture_id?: Uuid | null;
          summary?: string;
          score?: string;
          played_at?: Timestamptz;
          created_by?: Uuid | null;
          created_at?: Timestamptz;
        };
        Relationships: [];
      };
      sport_signups: {
        Row: {
          sport_id: Uuid;
          profile_id: Uuid;
          note: string;
          created_at: Timestamptz;
        };
        Insert: {
          sport_id: Uuid;
          profile_id: Uuid;
          note?: string;
          created_at?: Timestamptz;
        };
        Update: {
          sport_id?: Uuid;
          profile_id?: Uuid;
          note?: string;
          created_at?: Timestamptz;
        };
        Relationships: [];
      };
      intersection_settings: {
        Row: {
          id: number;
          points_champion: number;
          points_runner_up: number;
          points_semis: number;
          points_quarters: number;
          points_group: number;
        };
        Insert: {
          id?: number;
          points_champion?: number;
          points_runner_up?: number;
          points_semis?: number;
          points_quarters?: number;
          points_group?: number;
        };
        Update: {
          id?: number;
          points_champion?: number;
          points_runner_up?: number;
          points_semis?: number;
          points_quarters?: number;
          points_group?: number;
        };
        Relationships: [];
      };
      intersection_events: {
        Row: {
          id: Uuid;
          name: string;
          start_date: string | null;
          rules: string;
          status: string;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          name: string;
          start_date?: string | null;
          rules?: string;
          status?: string;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          name?: string;
          start_date?: string | null;
          rules?: string;
          status?: string;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      intersection_groups: {
        Row: {
          id: Uuid;
          event_id: Uuid;
          name: string;
        };
        Insert: {
          id?: Uuid;
          event_id: Uuid;
          name: string;
        };
        Update: {
          id?: Uuid;
          event_id?: Uuid;
          name?: string;
        };
        Relationships: [];
      };
      intersection_group_teams: {
        Row: {
          group_id: Uuid;
          section_id: Uuid;
          slot: number;
        };
        Insert: {
          group_id: Uuid;
          section_id: Uuid;
          slot: number;
        };
        Update: {
          group_id?: Uuid;
          section_id?: Uuid;
          slot?: number;
        };
        Relationships: [];
      };
      intersection_matches: {
        Row: {
          id: Uuid;
          event_id: Uuid;
          stage: string;
          group_id: Uuid | null;
          slot: number | null;
          source_a: string | null;
          source_b: string | null;
          team_a_section_id: Uuid | null;
          team_b_section_id: Uuid | null;
          winner_section_id: Uuid | null;
          note: string | null;
          played: boolean;
          manual: boolean;
          scheduled_at: Timestamptz | null;
          sort_order: number;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          event_id: Uuid;
          stage: string;
          group_id?: Uuid | null;
          slot?: number | null;
          source_a?: string | null;
          source_b?: string | null;
          team_a_section_id?: Uuid | null;
          team_b_section_id?: Uuid | null;
          winner_section_id?: Uuid | null;
          note?: string | null;
          played?: boolean;
          manual?: boolean;
          scheduled_at?: Timestamptz | null;
          sort_order?: number;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          event_id?: Uuid;
          stage?: string;
          group_id?: Uuid | null;
          slot?: number | null;
          source_a?: string | null;
          source_b?: string | null;
          team_a_section_id?: Uuid | null;
          team_b_section_id?: Uuid | null;
          winner_section_id?: Uuid | null;
          note?: string | null;
          played?: boolean;
          manual?: boolean;
          scheduled_at?: Timestamptz | null;
          sort_order?: number;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Relationships: [];
      };
      intersection_players: {
        Row: {
          id: Uuid;
          profile_id: Uuid | null;
          name: string;
          section_id: Uuid;
          created_at: Timestamptz;
        };
        Insert: {
          id?: Uuid;
          profile_id?: Uuid | null;
          name: string;
          section_id: Uuid;
          created_at?: Timestamptz;
        };
        Update: {
          id?: Uuid;
          profile_id?: Uuid | null;
          name?: string;
          section_id?: Uuid;
          created_at?: Timestamptz;
        };
        Relationships: [];
      };
      intersection_rosters: {
        Row: {
          event_id: Uuid;
          player_id: Uuid;
        };
        Insert: {
          event_id: Uuid;
          player_id: Uuid;
        };
        Update: {
          event_id?: Uuid;
          player_id?: Uuid;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      announcement_read_counts: {
        Args: { announcement_ids: Uuid[] };
        Returns: { announcement_id: Uuid; read_count: number }[];
      };
      app_role: { Args: Record<string, never>; Returns: string };
      app_is_admin: { Args: Record<string, never>; Returns: boolean };
      app_section_id: { Args: Record<string, never>; Returns: Uuid };
      app_is_rep_of: { Args: { sport: Uuid }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
