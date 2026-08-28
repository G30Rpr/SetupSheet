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
    };
    Views: {
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
