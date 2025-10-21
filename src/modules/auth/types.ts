import { Roles } from '../../config/roles';

export interface GenerateAuthTokensArgs {
  id: string;
  role: Roles;
  isCheckedRemember: boolean;
}
