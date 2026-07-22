const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";

import {
  LayoutDashboard, Sparkles, Inbox, Library, Dumbbell, LineChart,
  Bookmark, Settings, Users, ShieldCheck, ClipboardList, GraduationCap, LogOut,
  UserCheck, ScrollText, Menu, X, ChevronRight, MessageSquarePlus, Video, Upload, Shirt
} from "lucide-react";
import FloatingMascot from "@/components/mascot/FloatingMascot";
import MascotChat from "@/components/mascot/MascotChat";
import { useMascotProfile } from "@/hooks/useMascotProfile";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = {
  student: {
    main: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard },
      { label: "Ask Milo", to: "/ask", icon: Sparkles },
      { label: "My Requests", to: "/requests", icon: Inbox },
      { label: "Ask a Tutor", to: "/request-tutor", icon: MessageSquarePlus },
    ],
    practice: [
      { label: "Question Bank", to: "/bank", icon: Library },
      { label: "Study Hub", to: "/study", icon: Dumbbell },
      { label: "Video Library", to: "/videos", icon: Video },
      { label: "Progress", to: "/progress", icon: LineChart },
      { label: "Saved Items", to: "/saved", icon: Bookmark },
    ],
    other: [
      { label: "Become a Tutor", to: "/become-creator", icon: GraduationCap },
      { label: "Wardrobe", to: "/wardrobe", icon: Shirt },
    ],
  },
  creator: {
    main: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard },
      { label: "Ask Milo", to: "/ask", icon: Sparkles },
      { label: "Tutor Queue", to: "/queue", icon: ClipboardList },
    ],
    practice: [
      { label: "Question Bank", to: "/bank", icon: Library },
      { label: "Study Hub", to: "/study", icon: Dumbbell },
      { label: "Video Library", to: "/videos", icon: Video },
      { label: "My Videos", to: "/videos/manage", icon: Upload },
    ],
    other: [
      { label: "Wardrobe", to: "/wardrobe", icon: Shirt },
    ],
  },
  admin: {
    main: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard },
      { label: "Admin Panel", to: "/admin", icon: ShieldCheck },
      { label: "Tutor Queue", to: "/queue", icon: ClipboardList },
    ],
    practice: [
      { label: "Question Bank", to: "/bank", icon: Library },
      { label: "Video Library", to: "/videos", icon: Video },
      { label: "Manage Videos", to: "/videos/manage", icon: Upload },
      { label: "Users", to: "/admin/users", icon: Users },
      { label: "Creator Apps", to: "/admin/applications", icon: UserCheck },
      { label: "Audit Log", to: "/admin/audit", icon: ScrollText },
    ],
    other: [
      { label: "Ask Milo", to: "/ask", icon: Sparkles },
      { label: "Wardrobe", to: "/wardrobe", icon: Shirt },
    ],
  },
};

function NavItem({ item, active }) {
  return (
    <Link to={item.to}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        active
          ? "bg-accent/15 text-accent border border-accent/20 shadow-sm shadow-accent/10"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}>
      <item.icon className={cn("w-[17px] h-[17px] shrink-0 transition-colors", active ? "text-accent" : "group-hover:text-sidebar-foreground")} />
      <span>{item.label}</span>
      {active && <ChevronRight className="w-3 h-3 ml-auto text-accent/60" />}
    </Link>
  );
}

function NavSection({ label, items, location }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-1">
      {label && <p className="px-3 py-2 text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/30">{label}</p>}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavItem key={item.to} item={item} active={location.pathname === item.to} />
        ))}
      </div>
    </div>
  );
}

export default function Layout() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(false);
  const [unreadMsg, setUnreadMsg] = useState(null);
  const location = useLocation();

  useEffect(() => { db.auth.me().then(setUser).catch(() => {}); }, []);
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const { profile } = useMascotProfile(user);

  const openChat = () => {
    setChatOpen(true);
    setUnreadMsg(null);
  };

  const role = user?.role || "student";
  const sections = NAV[role] || NAV.student;

  const Sidebar = () => (
    <aside className={cn(
      "fixed z-40 inset-y-0 left-0 w-60 flex flex-col border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0",
      "bg-[hsl(var(--sidebar-background))]",
      open ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo */}
      <div className="h-[60px] flex items-center gap-3 px-5 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/30">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-display text-[1.1rem] font-semibold tracking-tight text-sidebar-foreground">Cognify</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-3">
        <NavSection label="Main" items={sections.main} location={location} />
        <NavSection label="Practice" items={sections.practice} location={location} />
        <NavSection label="" items={sections.other} location={location} />
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0 space-y-0.5">
        <Link to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all">
          <Settings className="w-[17px] h-[17px]" />
          <span>Settings</span>
        </Link>
        <button onClick={() => db.auth.logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-all">
          <LogOut className="w-[17px] h-[17px]" />
          <span>Sign out</span>
        </button>
        {user && (
          <div className="flex items-center gap-3 px-3 py-3 mt-1 rounded-xl bg-sidebar-accent">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-sm font-bold text-accent shrink-0">
              {(user.full_name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.full_name}</p>
              <p className="text-[10px] text-sidebar-foreground/40 capitalize">{user.role} · {user.tier || "free"}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 lg:ml-60 min-w-0">
        <header className={cn(
          "h-[60px] sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6",
          "bg-background/80 backdrop-blur-md border-b border-border/60"
        )}>
          <button className="lg:hidden p-2 rounded-lg hover:bg-secondary transition-colors" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main className="p-4 lg:p-8 max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Floating Milo — draggable AI assistant. Click to open the side chat. */}
      <FloatingMascot
        config={profile?.mascot_config}
        onOpenChat={openChat}
        unread={!!unreadMsg}
        unreadMsg={unreadMsg}
      />
      <MascotChat
        open={chatOpen}
        fullscreen={chatFullscreen}
        onClose={() => setChatOpen(false)}
        onToggleFullscreen={() => setChatFullscreen((f) => !f)}
        config={profile?.mascot_config}
        onUnread={(msg) => setUnreadMsg(msg)}
      />
    </div>
  );
}