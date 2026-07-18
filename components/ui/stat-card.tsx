import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accentClassName?: string;
}

/**
 * Consistent stat display used across dashboards/analytics pages, instead
 * of each page hand-rolling its own stat card with different padding,
 * number sizing, or icon treatment.
 */
export function StatCard({ icon: Icon, label, value, hint, accentClassName = 'text-primary' }: StatCardProps) {
  return (
    <Card className="p-5 border-border/70">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        {Icon && <Icon className={cn('w-5 h-5', accentClassName)} />}
      </div>
      <p className="font-numeric text-3xl font-semibold mt-2">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </Card>
  );
}
