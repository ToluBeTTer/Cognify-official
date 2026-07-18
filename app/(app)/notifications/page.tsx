'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  CheckCircle2,
  MessageSquare,
  Users,
  Star,
  Loader2,
  Check,
  ArrowRight,
  Trash2,
  Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Notification = Database['public']['Tables']['notifications']['Row'];

const notificationIcons: Record<Notification['type'], React.ReactNode> = {
  question_answered: <Bot className="h-5 w-5 text-primary" />,
  human_response_ready: <Users className="h-5 w-5 text-success" />,
  response_approved: <Star className="h-5 w-5 text-warning" />,
  claim_assigned: <MessageSquare className="h-5 w-5 text-info" />,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setNotifications(data || []);
      } catch (error: any) {
        toast.error(`Failed to load notifications: ${error?.message || 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();

    channelRef.current = supabase
      .channel(`notifications-page:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => { setNotifications((prev) => [payload.new as Notification, ...prev]); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => n.id === (payload.new as Notification).id ? { ...n, ...(payload.new as Notification) } : n)
          );
        })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read');
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const deleteAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id).eq('is_read', true);
    setNotifications((prev) => prev.filter((n) => !n.is_read));
    toast.success('Cleared read notifications');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const unread = notifications.filter((n) => !n.is_read);
  const allRead = notifications.every((n) => n.is_read);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-2">
            {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          {unread.length > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="h-4 w-4 mr-1" />Mark all read
            </Button>
          )}
          {allRead && notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={deleteAllRead} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" />Clear read
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue={unread.length > 0 ? 'unread' : 'all'}>
        <TabsList>
          <TabsTrigger value="unread">Unread ({unread.length})</TabsTrigger>
          <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="space-y-3 mt-6">
          {unread.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-success mb-4" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-muted-foreground">No unread notifications</p>
              </CardContent>
            </Card>
          ) : (
            unread.map((n) => (
              <NotificationCard key={n.id} notification={n} onMarkRead={() => markAsRead(n.id)} onDelete={() => deleteNotification(n.id)} />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3 mt-6">
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No notifications yet</p>
                <p className="text-muted-foreground">You'll be notified when something happens</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((n) => (
              <NotificationCard key={n.id} notification={n} onMarkRead={() => markAsRead(n.id)} onDelete={() => deleteNotification(n.id)} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationCard({ notification, onMarkRead, onDelete }: {
  notification: Notification;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const icon = notificationIcons[notification.type];
  const link = notification.question_id ? `/questions/${notification.question_id}` : null;
  const isRead = notification.is_read;

  const relativeTime = () => {
    const diff = Date.now() - new Date(notification.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(notification.created_at).toLocaleDateString();
  };

  return (
    <Card className={cn('transition-opacity', isRead && 'opacity-60')}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-0.5 relative">
            {icon}
            {!isRead && <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{notification.title}</p>
              {!isRead && <Badge variant="default" className="text-xs px-1.5 py-0">New</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{relativeTime()}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isRead && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMarkRead} title="Mark as read">
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            {link && (
              <Button variant="outline" size="sm" asChild>
                <Link href={link}>View<ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
