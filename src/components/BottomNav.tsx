import { Link, useLocation } from "@tanstack/react-router";
import { Home, History, User, Camera } from "lucide-react";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/history", label: "History", icon: History },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const loc = useLocation();
  return (
    <>
      <Link
        to="/scan"
        aria-label="New scan"
        className="fixed bottom-20 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition-transform active:scale-95"
      >
        <Camera className="h-6 w-6" />
      </Link>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur safe-bottom">
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {items.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className={`flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
