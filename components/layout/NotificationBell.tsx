"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  sendNotifications,
  getWorkersForNotification,
  clearReadNotifications,
  clearAllNotifications,
} from "@/app/(dashboard)/notifications/actions";
import type { NotificationItem } from "@/app/(dashboard)/notifications/actions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const LINK_OPTIONS: { value: string; label: string }[] = [
  { value: "__none__", label: "No link" },
  { value: "/dashboard", label: "Dashboard" },
  { value: "/roster", label: "Roster" },
  { value: "/notes", label: "Notes" },
  { value: "/dashboard#worker-hours", label: "Hours (dashboard)" },
  { value: "/my-pay", label: "My Pay" },
  { value: "/incidents", label: "Incidents" },
  { value: "/follow-ups", label: "Follow-ups" },
  { value: "/calendar", label: "Calendar notes" },
  { value: "/service-users", label: "Service users" },
  { value: "/care-plans", label: "Care plans" },
];

export function NotificationBell({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<"all" | string>("all");
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [sendTitle, setSendTitle] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendLink, setSendLink] = useState("__none__");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    const [list, count] = await Promise.all([
      getMyNotifications(),
      getUnreadNotificationCount(),
    ]);
    setNotifications(list);
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Poll unread count when dropdown is closed (so badge updates)
  useEffect(() => {
    if (open) return;
    const t = setInterval(() => {
      getUnreadNotificationCount().then(setUnreadCount);
    }, 15000);
    return () => clearInterval(t);
  }, [open]);

  async function handleNotificationClick(n: NotificationItem) {
    if (!n.read) await markNotificationRead(n.id);
    setOpen(false);
    const path = n.link && n.link.trim() ? n.link.trim() : "/dashboard";
    router.push(path);
  }

  async function openSendDialog() {
    setOpen(false);
    setSendDialogOpen(true);
    setSendTitle("");
    setSendMessage("");
    setSendLink("__none__");
    if (isAdmin) {
      const w = await getWorkersForNotification();
      setWorkers(w);
    }
  }

  async function handleSend() {
    const title = sendTitle.trim();
    if (!title) {
      toast.error("Enter a title");
      return;
    }
    setSending(true);
    try {
      const workerIds = sendTarget === "all" ? "all" : [sendTarget];
      const res = await sendNotifications({
        workerIds,
        title,
        message: sendMessage.trim() || null,
        link: sendLink === "__none__" || !sendLink.trim() ? null : sendLink.trim(),
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Notification sent to ${res.count} worker(s)`);
        setSendDialogOpen(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          className="relative flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--foreground)]"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        >
          <span className="relative inline-flex size-9 flex-shrink-0 items-center justify-center">
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-[var(--primary-foreground)]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[280px] max-w-[90vw]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-7 gap-1"
                  onClick={(e) => {
                    e.preventDefault();
                    openSendDialog();
                  }}
                >
                  <Send className="size-3.5" />
                  Send
                </Button>
              )}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
              No notifications
            </div>
          ) : (
            <>
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleNotificationClick(n);
                    }}
                    className="flex flex-col items-start gap-0.5 py-3"
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className={n.read ? "font-normal" : "font-semibold"}>{n.title}</span>
                      {!n.read && (
                        <span className="size-2 shrink-0 rounded-full bg-[var(--primary)]" />
                      )}
                    </div>
                    {n.message && (
                      <span className="line-clamp-2 text-xs text-[var(--muted-foreground)]">
                        {n.message}
                      </span>
                    )}
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      {n.link ? " · Click to open" : ""}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <div className="flex flex-wrap gap-1 p-1.5">
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-7 gap-1.5 text-[var(--muted-foreground)]"
                  disabled={clearing || !notifications.some((n) => n.read)}
                  onClick={async (e) => {
                    e.preventDefault();
                    setClearing(true);
                    try {
                      const { deleted } = await clearReadNotifications();
                      if (deleted > 0) {
                        toast.success(`Cleared ${deleted} read notification(s)`);
                        await load();
                      }
                    } finally {
                      setClearing(false);
                    }
                  }}
                >
                  {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  Clear read
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-7 gap-1.5 text-[var(--muted-foreground)]"
                  disabled={clearing}
                  onClick={async (e) => {
                    e.preventDefault();
                    setClearing(true);
                    try {
                      const { deleted } = await clearAllNotifications();
                      if (deleted > 0) {
                        toast.success("All notifications cleared");
                        await load();
                        setOpen(false);
                      }
                    } finally {
                      setClearing(false);
                    }
                  }}
                >
                  Clear all
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isAdmin && (
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send notification to workers</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="notif-title">Title *</Label>
                <Input
                  id="notif-title"
                  value={sendTitle}
                  onChange={(e) => setSendTitle(e.target.value)}
                  placeholder="e.g. Important schedule update"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notif-message">Message (optional)</Label>
                <Textarea
                  id="notif-message"
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder="Additional details..."
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>Link (where to go when clicked)</Label>
                <Select value={sendLink} onValueChange={(v) => setSendLink(v ?? "__none__")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a page" />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Send to</Label>
                <Select value={sendTarget} onValueChange={(v) => setSendTarget(v ?? "all")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All workers</SelectItem>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending || !sendTitle.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
