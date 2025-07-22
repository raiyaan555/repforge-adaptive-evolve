export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      active_workouts: {
        Row: {
          created_at: string
          current_day: number
          current_week: number
          id: string
          started_at: string
          updated_at: string
          user_id: string
          workout_id: string
          workout_type: string
        }
        Insert: {
          created_at?: string
          current_day?: number
          current_week?: number
          id?: string
          started_at?: string
          updated_at?: string
          user_id: string
          workout_id: string
          workout_type: string
        }
        Update: {
          created_at?: string
          current_day?: number
          current_week?: number
          id?: string
          started_at?: string
          updated_at?: string
          user_id?: string
          workout_id?: string
          workout_type?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          arms: number | null
          back: number | null
          body_weight: number | null
          calves: number | null
          chest: number | null
          created_at: string
          id: string
          measurement_date: string
          measurement_type: string
          measurement_unit: string | null
          mesocycle_id: string | null
          shoulders: number | null
          thighs: number | null
          updated_at: string
          user_id: string
          waist: number | null
          weight_unit: string | null
        }
        Insert: {
          arms?: number | null
          back?: number | null
          body_weight?: number | null
          calves?: number | null
          chest?: number | null
          created_at?: string
          id?: string
          measurement_date?: string
          measurement_type?: string
          measurement_unit?: string | null
          mesocycle_id?: string | null
          shoulders?: number | null
          thighs?: number | null
          updated_at?: string
          user_id: string
          waist?: number | null
          weight_unit?: string | null
        }
        Update: {
          arms?: number | null
          back?: number | null
          body_weight?: number | null
          calves?: number | null
          chest?: number | null
          created_at?: string
          id?: string
          measurement_date?: string
          measurement_type?: string
          measurement_unit?: string | null
          mesocycle_id?: string | null
          shoulders?: number | null
          thighs?: number | null
          updated_at?: string
          user_id?: string
          waist?: number | null
          weight_unit?: string | null
        }
        Relationships: []
      }
      custom_workouts: {
        Row: {
          created_at: string
          days_per_week: number
          duration_weeks: number
          id: string
          name: string
          program_type: string
          updated_at: string
          user_id: string
          workout_structure: Json
        }
        Insert: {
          created_at?: string
          days_per_week: number
          duration_weeks: number
          id?: string
          name: string
          program_type: string
          updated_at?: string
          user_id: string
          workout_structure: Json
        }
        Update: {
          created_at?: string
          days_per_week?: number
          duration_weeks?: number
          id?: string
          name?: string
          program_type?: string
          updated_at?: string
          user_id?: string
          workout_structure?: Json
        }
        Relationships: []
      }
      default_workouts: {
        Row: {
          created_at: string
          days_per_week: number
          duration_weeks: number
          id: string
          name: string
          program_type: string
          updated_at: string
          workout_structure: Json
        }
        Insert: {
          created_at?: string
          days_per_week?: number
          duration_weeks: number
          id?: string
          name: string
          program_type: string
          updated_at?: string
          workout_structure: Json
        }
        Update: {
          created_at?: string
          days_per_week?: number
          duration_weeks?: number
          id?: string
          name?: string
          program_type?: string
          updated_at?: string
          workout_structure?: Json
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          muscle_group: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          muscle_group: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          muscle_group?: string
          name?: string
        }
        Relationships: []
      }
      mesocycle: {
        Row: {
          actual_reps: number[] | null
          actual_sets: number | null
          can_add_sets: boolean | null
          created_at: string
          day_number: number
          exercise_name: string
          feedback_given: boolean | null
          id: string
          is_sore: boolean | null
          muscle_group: string
          plan_id: string | null
          planned_reps: number
          planned_sets: number
          pump_level: string | null
          rir: number | null
          updated_at: string
          user_id: string
          week_number: number
          weight_unit: string | null
          weight_used: number[] | null
          workout_name: string
        }
        Insert: {
          actual_reps?: number[] | null
          actual_sets?: number | null
          can_add_sets?: boolean | null
          created_at?: string
          day_number: number
          exercise_name: string
          feedback_given?: boolean | null
          id?: string
          is_sore?: boolean | null
          muscle_group: string
          plan_id?: string | null
          planned_reps: number
          planned_sets: number
          pump_level?: string | null
          rir?: number | null
          updated_at?: string
          user_id: string
          week_number: number
          weight_unit?: string | null
          weight_used?: number[] | null
          workout_name: string
        }
        Update: {
          actual_reps?: number[] | null
          actual_sets?: number | null
          can_add_sets?: boolean | null
          created_at?: string
          day_number?: number
          exercise_name?: string
          feedback_given?: boolean | null
          id?: string
          is_sore?: boolean | null
          muscle_group?: string
          plan_id?: string | null
          planned_reps?: number
          planned_sets?: number
          pump_level?: string | null
          rir?: number | null
          updated_at?: string
          user_id?: string
          week_number?: number
          weight_unit?: string | null
          weight_used?: number[] | null
          workout_name?: string
        }
        Relationships: []
      }
      muscle_soreness: {
        Row: {
          created_at: string
          healed: boolean
          id: string
          muscle_group: string
          soreness_level: string
          updated_at: string
          user_id: string
          workout_date: string
        }
        Insert: {
          created_at?: string
          healed?: boolean
          id?: string
          muscle_group: string
          soreness_level: string
          updated_at?: string
          user_id: string
          workout_date?: string
        }
        Update: {
          created_at?: string
          healed?: boolean
          id?: string
          muscle_group?: string
          soreness_level?: string
          updated_at?: string
          user_id?: string
          workout_date?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          achieved_date: string
          created_at: string
          exercise_name: string
          id: string
          max_reps: number
          max_weight: number
          muscle_group: string
          updated_at: string
          user_id: string
          weight_unit: string | null
        }
        Insert: {
          achieved_date?: string
          created_at?: string
          exercise_name: string
          id?: string
          max_reps: number
          max_weight: number
          muscle_group: string
          updated_at?: string
          user_id: string
          weight_unit?: string | null
        }
        Update: {
          achieved_date?: string
          created_at?: string
          exercise_name?: string
          id?: string
          max_reps?: number
          max_weight?: number
          muscle_group?: string
          updated_at?: string
          user_id?: string
          weight_unit?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          days_per_week: number | null
          duration_weeks: number
          exercises: string[]
          id: string
          is_active: boolean | null
          muscle_groups: string[]
          name: string
          program_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_per_week?: number | null
          duration_weeks: number
          exercises: string[]
          id?: string
          is_active?: boolean | null
          muscle_groups: string[]
          name: string
          program_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_per_week?: number | null
          duration_weeks?: number
          exercises?: string[]
          id?: string
          is_active?: boolean | null
          muscle_groups?: string[]
          name?: string
          program_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          unit_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          unit_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          unit_preference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pump_feedback: {
        Row: {
          created_at: string
          id: string
          muscle_group: string
          pump_level: string
          updated_at: string
          user_id: string
          workout_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          muscle_group: string
          pump_level: string
          updated_at?: string
          user_id: string
          workout_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          muscle_group?: string
          pump_level?: string
          updated_at?: string
          user_id?: string
          workout_date?: string
        }
        Relationships: []
      }
      user_current_stats: {
        Row: {
          arms: number | null
          back: number | null
          calves: number | null
          chest: number | null
          created_at: string
          current_weight: number | null
          id: string
          measurement_unit: string | null
          shoulders: number | null
          thighs: number | null
          updated_at: string
          user_id: string
          waist: number | null
          weight_unit: string | null
        }
        Insert: {
          arms?: number | null
          back?: number | null
          calves?: number | null
          chest?: number | null
          created_at?: string
          current_weight?: number | null
          id?: string
          measurement_unit?: string | null
          shoulders?: number | null
          thighs?: number | null
          updated_at?: string
          user_id: string
          waist?: number | null
          weight_unit?: string | null
        }
        Update: {
          arms?: number | null
          back?: number | null
          calves?: number | null
          chest?: number | null
          created_at?: string
          current_weight?: number | null
          id?: string
          measurement_unit?: string | null
          shoulders?: number | null
          thighs?: number | null
          updated_at?: string
          user_id?: string
          waist?: number | null
          weight_unit?: string | null
        }
        Relationships: []
      }
      workout_calendar: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
          workout_date: string
          workout_summary: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          status: string
          updated_at?: string
          user_id: string
          workout_date: string
          workout_summary?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          workout_date?: string
          workout_summary?: Json | null
        }
        Relationships: []
      }
      workouts: {
        Row: {
          created_at: string
          exercise_name: string
          feedback: string | null
          id: string
          plan_id: string | null
          reps: number
          sets: number
          unit: string | null
          user_id: string
          weight: number
          workout_date: string
        }
        Insert: {
          created_at?: string
          exercise_name: string
          feedback?: string | null
          id?: string
          plan_id?: string | null
          reps: number
          sets: number
          unit?: string | null
          user_id: string
          weight: number
          workout_date?: string
        }
        Update: {
          created_at?: string
          exercise_name?: string
          feedback?: string | null
          id?: string
          plan_id?: string | null
          reps?: number
          sets?: number
          unit?: string | null
          user_id?: string
          weight?: number
          workout_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
