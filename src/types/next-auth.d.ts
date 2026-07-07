import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    unitId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
      unitId?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    unitId?: string | null;
  }
}
