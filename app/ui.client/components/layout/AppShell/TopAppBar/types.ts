import type { AuthenticatedUserDto } from "@backend-application/authentication/auth.dto";

export interface TopAppBarProps {
  user: AuthenticatedUserDto;
  onSignOut: () => void;
}
