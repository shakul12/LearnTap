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
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={homeHref ?? "/"} className="text-lg font-bold text-indigo-600">
          LearnTap
        </Link>
        {name ? (
          <nav className="flex items-center gap-4">
            <Link
              href="/settings"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              {name}
            </Link>
            <SignOutButton />
          </nav>
        ) : (
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
