/**
 * Public schema contract for Supabase clients. Keep this file synchronized
 * with `supabase/migrations/`; in a connected project it can be replaced by
 * the output of `supabase gen types typescript --project-id ...`.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationships = [];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          created_at: string;
          follower_count: number;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          created_at?: string;
          follower_count?: number;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
          created_at?: string;
          follower_count?: number;
        };
        Relationships: Relationships;
      };
      setups: {
        Row: {
          id: string;
          user_id: string;
          game: string;
          car: string;
          track: string;
          condition: string;
          lap_time: string | null;
          description: string;
          tags: string[];
          rig_profile: string;
          setup_values: Json | null;
          file_path: string | null;
          file_name: string | null;
          video_url: string | null;
          telemetry_file_path: string | null;
          telemetry_file_name: string | null;
          pace: number;
          predictability: number;
          rating_count: number;
          upvotes: number;
          downloads: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game: string;
          car: string;
          track: string;
          condition: string;
          lap_time?: string | null;
          description?: string;
          tags?: string[];
          rig_profile: string;
          setup_values?: Json | null;
          file_path?: string | null;
          file_name?: string | null;
          video_url?: string | null;
          telemetry_file_path?: string | null;
          telemetry_file_name?: string | null;
          pace?: number;
          predictability?: number;
          rating_count?: number;
          upvotes?: number;
          downloads?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          game?: string;
          car?: string;
          track?: string;
          condition?: string;
          lap_time?: string | null;
          description?: string;
          tags?: string[];
          rig_profile?: string;
          setup_values?: Json | null;
          file_path?: string | null;
          file_name?: string | null;
          video_url?: string | null;
          telemetry_file_path?: string | null;
          telemetry_file_name?: string | null;
          pace?: number;
          predictability?: number;
          rating_count?: number;
          upvotes?: number;
          downloads?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: Relationships;
      };
      setup_upvotes: {
        Row: { user_id: string; setup_id: string; created_at: string };
        Insert: { user_id: string; setup_id: string; created_at?: string };
        Update: { user_id?: string; setup_id?: string; created_at?: string };
        Relationships: Relationships;
      };
      setup_ratings: {
        Row: {
          user_id: string;
          setup_id: string;
          pace: number;
          predictability: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          setup_id: string;
          pace: number;
          predictability: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          setup_id?: string;
          pace?: number;
          predictability?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: Relationships;
      };
      follows: {
        Row: { follower_id: string; followed_id: string; created_at: string };
        Insert: { follower_id: string; followed_id: string; created_at?: string };
        Update: { follower_id?: string; followed_id?: string; created_at?: string };
        Relationships: Relationships;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string;
          setup_id: string | null;
          type: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id: string;
          setup_id?: string | null;
          type?: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          actor_id?: string;
          setup_id?: string | null;
          type?: string;
          read?: boolean;
          created_at?: string;
        };
        Relationships: Relationships;
      };
      setup_versions: {
        Row: {
          id: string;
          setup_id: string;
          edited_by: string;
          game: string;
          car: string;
          track: string;
          condition: string;
          lap_time: string | null;
          description: string;
          tags: string[];
          rig_profile: string;
          setup_values: Json | null;
          file_path: string | null;
          file_name: string | null;
          video_url: string | null;
          telemetry_file_path: string | null;
          telemetry_file_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          setup_id: string;
          edited_by: string;
          game: string;
          car: string;
          track: string;
          condition: string;
          lap_time?: string | null;
          description?: string;
          tags?: string[];
          rig_profile: string;
          setup_values?: Json | null;
          file_path?: string | null;
          file_name?: string | null;
          video_url?: string | null;
          telemetry_file_path?: string | null;
          telemetry_file_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          setup_id?: string;
          edited_by?: string;
          game?: string;
          car?: string;
          track?: string;
          condition?: string;
          lap_time?: string | null;
          description?: string;
          tags?: string[];
          rig_profile?: string;
          setup_values?: Json | null;
          file_path?: string | null;
          file_name?: string | null;
          video_url?: string | null;
          telemetry_file_path?: string | null;
          telemetry_file_name?: string | null;
          created_at?: string;
        };
        Relationships: Relationships;
      };
      garage_sessions: {
        Row: {
          id: string;
          user_id: string;
          source_setup_id: string | null;
          game: string;
          car: string;
          track: string;
          condition: string;
          rig: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_setup_id?: string | null;
          game: string;
          car: string;
          track: string;
          condition: string;
          rig?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_setup_id?: string | null;
          game?: string;
          car?: string;
          track?: string;
          condition?: string;
          rig?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: Relationships;
      };
      garage_revisions: {
        Row: {
          id: string;
          session_id: string;
          setup_values: Json;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          setup_values?: Json;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          setup_values?: Json;
          note?: string;
          created_at?: string;
        };
        Relationships: Relationships;
      };
      garage_run_plan_items: {
        Row: {
          id: string;
          session_id: string;
          revision_id: string;
          parameter: string;
          direction: string;
          amount: string;
          verdict: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          revision_id: string;
          parameter: string;
          direction: string;
          amount: string;
          verdict: string;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          revision_id?: string;
          parameter?: string;
          direction?: string;
          amount?: string;
          verdict?: string;
          note?: string;
          created_at?: string;
        };
        Relationships: Relationships;
      };
      garage_laps: {
        Row: {
          id: string;
          session_id: string;
          revision_id: string;
          lap_time_ms: number;
          condition: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          revision_id: string;
          lap_time_ms: number;
          condition: string;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          revision_id?: string;
          lap_time_ms?: number;
          condition?: string;
          note?: string;
          created_at?: string;
        };
        Relationships: Relationships;
      };
      setup_requests: {
        Row: {
          id: string;
          requester_id: string;
          game: string;
          car: string;
          track: string;
          notes: string;
          fulfilled_setup_id: string | null;
          fulfilled_by: string | null;
          fulfilled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          game: string;
          car: string;
          track: string;
          notes?: string;
          fulfilled_setup_id?: string | null;
          fulfilled_by?: string | null;
          fulfilled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          game?: string;
          car?: string;
          track?: string;
          notes?: string;
          fulfilled_setup_id?: string | null;
          fulfilled_by?: string | null;
          fulfilled_at?: string | null;
          created_at?: string;
        };
        Relationships: Relationships;
      };
      setup_favorites: {
        Row: { user_id: string; setup_id: string; created_at: string };
        Insert: { user_id: string; setup_id: string; created_at?: string };
        Update: { user_id?: string; setup_id?: string; created_at?: string };
        Relationships: Relationships;
      };
      setup_comments: {
        Row: {
          id: string;
          setup_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          setup_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          setup_id?: string;
          user_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: Relationships;
      };
      account_deletion_requests: {
        Row: {
          id: string;
          user_id: string;
          status: string;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: Relationships;
      };
      content_reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          details: string;
          status: string;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          details?: string;
          status?: string;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: string;
          target_id?: string;
          reason?: string;
          details?: string;
          status?: string;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Relationships: Relationships;
      };
    };
    Views: {
      setup_requests_most_wanted: {
        Row: {
          game: string;
          car: string;
          track: string;
          request_count: number;
          oldest_request_at: string;
          newest_request_at: string;
        };
        Relationships: Relationships;
      };
      leaderboard: {
        Row: {
          user_id: string;
          username: string;
          avatar_url: string | null;
          setup_count: number;
          total_upvotes: number;
          total_ratings: number;
        };
        Relationships: Relationships;
      };
      setup_search: {
        Row: {
          id: string;
          user_id: string;
          game: string;
          car: string;
          track: string;
          condition: string;
          lap_time: string | null;
          description: string;
          tags: string[];
          rig_profile: string;
          setup_values: Json | null;
          file_path: string | null;
          file_name: string | null;
          video_url: string | null;
          telemetry_file_path: string | null;
          telemetry_file_name: string | null;
          pace: number;
          predictability: number;
          rating_count: number;
          upvotes: number;
          downloads: number;
          created_at: string;
          updated_at: string;
          author_username: string | null;
        };
        Relationships: Relationships;
      };
    };
    Functions: {
      increment_downloads: {
        Args: { setup_id: string };
        Returns: undefined;
      };
      fulfill_setup_request: {
        Args: { request_id: string; setup_id: string };
        Returns: undefined;
      };
      create_setup_with_rating: {
        Args: {
          p_game: string;
          p_car: string;
          p_track: string;
          p_condition: string;
          p_lap_time: string | null;
          p_description: string;
          p_tags: string[];
          p_rig_profile: string;
          p_setup_values: Json | null;
          p_file_path: string | null;
          p_file_name: string | null;
          p_video_url: string | null;
          p_telemetry_file_path: string | null;
          p_telemetry_file_name: string | null;
          p_pace: number;
          p_predictability: number;
        };
        Returns: string;
      };
      is_valid_setup_values: {
        Args: { p_values: Json | null };
        Returns: boolean;
      };
      create_garage_session_with_baseline: {
        Args: {
          p_game: string;
          p_car: string;
          p_track: string;
          p_condition: string;
          p_rig: string | null;
          p_setup_values: Json;
          p_note: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
