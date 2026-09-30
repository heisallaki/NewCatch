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

export type AdminAppeal = Appeal & { user: AdminUser };

export type AdminAction = {
  id: number;
  action: string;
  reason: string | null;
  admin_email: string | null;
  appeal_id: number | null;
  created_at: string;
};

export type AdminUserDetail = {
  user: AdminUser;
  actions: AdminAction[];
  appeals: Appeal[];
};