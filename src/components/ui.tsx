import { Brand } from "./brand";
import { AuthStory } from "./auth-story";
import { LanguageSelect } from "./language-select";

export const inputClass = "field w-full";

export const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export const buttonClass = "button button-primary w-full";

export const secondaryButtonClass = "button button-secondary w-full";

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <AuthStory />
        <span className="auth-story-foot">
          THYROCARE
        </span>
      </section>
      <section className="auth-form-side">
        <div className="auth-language">
          <LanguageSelect />
        </div>
        <div className="auth-card">
          <span className="eyebrow">THYROCARE</span>
          <h1>{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
  );
}
