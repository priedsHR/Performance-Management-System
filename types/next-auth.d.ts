import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    division?: string | null;
    isExecutive?: boolean;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      division?: string | null;
      isExecutive?: boolean;
    };
  }
}
