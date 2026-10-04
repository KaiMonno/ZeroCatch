import { isAdminConfigured } from "@/lib/admin-session";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-10 w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
      <h1 className="text-lg font-semibold text-fg">Admin sign in</h1>
      {isAdminConfigured() ? (
        <LoginForm />
      ) : (
        <p className="mt-2 text-sm text-muted">
          Set <code className="text-fg">ADMIN_PASSWORD</code> in your environment to enable the review queue.
        </p>
      )}
    </div>
  );
}
