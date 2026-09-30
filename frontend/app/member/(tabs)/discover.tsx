import { ComingSoon } from '@/components/ComingSoon';
import { useAuth } from '@/features/auth/AuthContext';

export default function Discover() {
  const { user } = useAuth();
  const name = user?.profile?.display_name ?? 'there';
  return (
    <ComingSoon
      title={`Welcome, ${name}`}
      message="Your account is ready. Profile photos, interests and Catch or Swerve discovery arrive in the next phase."
    />
  );
}