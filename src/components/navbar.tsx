import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export function Navbar({
  name,
  homeHref,
}: {
  name?: string;
  homeHref?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href={homeHref ?? "/"}
          className="text-xl font-bold tracking-tight text-ink"
        >
          LearnTap<span className="text-sage">.</span>
        </Link>
        {name ? (
          <nav className="flex items-center gap-4">
            <Link
              href="/settings"
              className="text-sm font-medium text-ink/60 hover:text-ink"
            >
              {name}
            </Link>
            <SignOutButton />
          </nav>
        ) : (
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-ink/60 hover:text-ink"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-deep"
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
