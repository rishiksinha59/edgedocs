import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your EdgeDocs account",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/5 via-primary/2 to-transparent blur-3xl" />
      </div>
      {children}
    </div>
  );
}
