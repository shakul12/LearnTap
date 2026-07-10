export type Role = "student" | "teacher";

export type RequestStatus =
  | "open"
  | "matched"
  | "completed"
  | "cancelled"
  | "expired";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  languages: string[];
  subjects: string[];
  hourly_rate_cents: number;
  is_online: boolean;
  is_verified: boolean;
  notify_by_email: boolean;
  created_at: string;
}

export interface HelpRequest {
  id: string;
  student_id: string;
  subject: string;
  topic: string;
  duration_minutes: number;
  language: string;
  status: RequestStatus;
  starts_at: string;
  confirmed_at: string | null;
  declined_teacher_ids: string[];
  accepted_teacher_id: string | null;
  accepted_at: string | null;
  daily_room_name: string | null;
  daily_room_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  rate_cents_per_hour: number | null;
  final_cost_cents: number | null;
  notified_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface Review {
  id: string;
  request_id: string;
  student_id: string;
  teacher_id: string;
  rating: number;
  expertise_rating: number | null;
  professionalism_rating: number | null;
  communication_rating: number | null;
  comment: string;
  created_at: string;
}
