import type { UserRepository } from "../ports/UserRepository";
import type { User } from "../domain/User";

type Deps = { repo: UserRepository };

export const getCurrentUser = async ({ repo }: Deps, profileId: string): Promise<User | null> =>
  repo.findById(profileId);
