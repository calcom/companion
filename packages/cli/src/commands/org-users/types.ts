import type {
  CreateOrganizationUserInput,
  GetOrganizationUserOutput,
  GetOrganizationUsersResponseDto,
  GetOrgUsersWithProfileOutput,
  UpdateOrganizationUserInput,
} from "../../generated/types.gen";

export type OrgUser = GetOrgUsersWithProfileOutput;
export type OrgUserList = GetOrganizationUsersResponseDto["data"];
export type OrgUserResponse = GetOrganizationUserOutput["data"];

export type { CreateOrganizationUserInput, UpdateOrganizationUserInput };
