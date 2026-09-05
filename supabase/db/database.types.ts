export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      monitor_logs: {
        Row: {
          checked_at: string | null;
          content_snippet: string | null;
          error_message: string | null;
          id: string;
          monitor_id: string;
          response_time: number | null;
          status: string;
        };
        Insert: {
          checked_at?: string | null;
          content_snippet?: string | null;
          error_message?: string | null;
          id?: string;
          monitor_id: string;
          response_time?: number | null;
          status: string;
        };
        Update: {
          checked_at?: string | null;
          content_snippet?: string | null;
          error_message?: string | null;
          id?: string;
          monitor_id?: string;
          response_time?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monitor_logs_monitor_id_fkey";
            columns: ["monitor_id"];
            isOneToOne: false;
            referencedRelation: "monitors";
            referencedColumns: ["id"];
          },
        ];
      };
      monitors: {
        Row: {
          check_interval: number;
          created_at: string | null;
          id: string;
          is_active: boolean;
          last_checked: string | null;
          last_status: string | null;
          name: string;
          notification_channels: Json | null;
          pattern: string;
          pattern_type: string;
          updated_at: string | null;
          url: string;
          user_id: string;
        };
        Insert: {
          check_interval?: number;
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          last_checked?: string | null;
          last_status?: string | null;
          name: string;
          notification_channels?: Json | null;
          pattern: string;
          pattern_type?: string;
          updated_at?: string | null;
          url: string;
          user_id: string;
        };
        Update: {
          check_interval?: number;
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          last_checked?: string | null;
          last_status?: string | null;
          name?: string;
          notification_channels?: Json | null;
          pattern?: string;
          pattern_type?: string;
          updated_at?: string | null;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          channel: string;
          created_at: string | null;
          error_message: string | null;
          id: string;
          message: string;
          message_id: string | null;
          monitor_id: string;
          sent_at: string | null;
          status: string;
          type: string;
          user_id: string;
        };
        Insert: {
          channel: string;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          message: string;
          message_id?: string | null;
          monitor_id: string;
          sent_at?: string | null;
          status?: string;
          type: string;
          user_id: string;
        };
        Update: {
          channel?: string;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          message?: string;
          message_id?: string | null;
          monitor_id?: string;
          sent_at?: string | null;
          status?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_monitor_id_fkey";
            columns: ["monitor_id"];
            isOneToOne: false;
            referencedRelation: "monitors";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string | null;
          display_name: string | null;
          email: string;
          id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          display_name?: string | null;
          email: string;
          id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          display_name?: string | null;
          email?: string;
          id?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _get_cron_auth_headers: { Args: never; Returns: Json };
      _get_cron_headers: { Args: never; Returns: Json };
      _get_monitor_check_url: { Args: never; Returns: string };
      check_cron_job_exists: { Args: { job_name: string }; Returns: boolean };
      create_monitor_cron_job: {
        Args: {
          cron_schedule: string;
          job_name: string;
          monitor_id: string;
          user_id: string;
        };
        Returns: boolean;
      };
      delete_monitor_cron_job: { Args: { job_name: string }; Returns: boolean };
      get_cron_job_info: { Args: { job_name: string }; Returns: Json };
      get_cron_secret: { Args: never; Returns: string };
      list_user_cron_jobs: { Args: { user_id: string }; Returns: string[] };
      update_monitor_cron_job: {
        Args: { cron_schedule: string; job_name: string; monitor_id: string };
        Returns: boolean;
      };
      vault_get: { Args: { secret_name: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema =
  DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Tables"
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Views"
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Views"
    ]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema["Tables"]
    & DefaultSchema["Views"]
  ) ? (
      & DefaultSchema["Tables"]
      & DefaultSchema["Views"]
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
    EnumName
  ]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
