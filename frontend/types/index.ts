export type UserStatus = 'active' | 'deactivated' | 'blacklisted';

export type Profile = {
  full_name: string;
  display_name: string;
  campus: string;
  year_of_study: string;
  course: string;
  graduation_year: number | null;
};

export type User = {
  id: number;
  email: string;
  status: UserStatus;
  is_admin: boolean;
  profile: Profile | null;
};

export type SessionResponse = {
  user: User;
  tokens?: { access_token: string; refresh_token: string } | null;
};

export type Appeal = {
  id: number;
  kind: 'deactivation' | 'blacklist';
  status: 'pending' | 'accepted' | 'rejected';
  message: string;
  admin_response: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type AccountStatus = {
  status: UserStatus;
  reason: string | null;
  deactivated_at: string | null;
  support_email: string;
  can_appeal: boolean;
  next_appeal_at: string | null;
  latest_appeal: Appeal | null;
};

export type AdminUser = User & {
  created_at: string;
  last_login_at: string | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
};

export type AdminAppeal = Appeal & { user: AdminUser; blacklist_reason: string | null };

export type AdminAction = {
  id: number;
  action: string;
  reason: string | null;
  admin_email: string | null;
  appeal_id: number | null;
  created_at: string;
};

export type PhotoRef = { id: number; url: string };

export type AdminUserDetail = {
  user: AdminUser;
  actions: AdminAction[];
  appeals: Appeal[];
  photos: PhotoRef[];
};

export type AdminReport = {
  id: number;
  reason: string;
  description: string;
  status: 'open' | 'dismissed' | 'reviewed' | 'actioned';
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  screenshot_url: string | null;
  reporter_email: string;
  reported: AdminUser;
};

export type MatchInfo = {
  score: number;
  explanation: string;
  shared_interests: string[];
};

export type Card = {
  user_id: number;
  display_name: string;
  gender: string | null;
  course: string;
  year_of_study: string;
  campus: string;
  interests: string[];
  music_genres: string[];
  looking_for: string[];
  photo: PhotoRef | null;
  match: MatchInfo;
};

export type OwnProfile = {
  user_id: number;
  full_name: string;
  display_name: string;
  opened_name: 'full_name' | 'display_name';
  campus: string;
  year_of_study: string;
  course: string;
  graduation_year: number | null;
  gender: string | null;
  gender_custom: string | null;
  bio: string | null;
  interests: string[];
  music_genres: string[];
  favourite_artist: string | null;
  looking_for: string[];
  visibility: 'everyone' | 'matching' | 'hidden';
  discovery_scope: 'all' | 'my_campus';
  photos: PhotoRef[];
  complete: boolean;
  missing: string[];
};

export type OpenedProfile = Card & {
  name: string;
  bio: string | null;
  favourite_artist: string | null;
  graduation_year: number | null;
  photos: PhotoRef[];
  relationship: 'self' | 'matched' | 'caught' | 'swerved' | 'none';
  match_id: number | null;
};

export type SwipeResult = { matched: boolean; person: Card | null };

export type CatchesResponse = {
  matches: { match_id: number; matched_at: string; person: Card }[];
  waiting: Card[];
};

export type MiniPerson = { user_id: number; display_name: string; photo: PhotoRef | null };

export type ChatMessage = {
  id: number;
  match_id: number;
  sender_id: number;
  body: string;
  created_at: string;
};

export type Conversation = {
  match_id: number;
  person: MiniPerson;
  last_message: { body: string; created_at: string; mine: boolean } | null;
  updated_at: string;
};

export type ActivityItem = {
  type: 'match' | 'message';
  at: string;
  match_id: number;
  person: MiniPerson;
  preview?: string;
};

export type ChatEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'chat_closed'; match_id: number }
  | { type: 'error'; code: string; detail: string };

export type BlockedUser = { user_id: number; display_name: string };