import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn("hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary/40", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">{title}</p>
            <p className="text-2xl font-bold text-foreground truncate">{value}</p>
            {trend && (
              <p className={cn(
                "text-xs mt-1.5 font-medium",
                trend.positive ? "text-green-600" : "text-destructive"
              )}>
                {trend.positive ? '+' : ''}{trend.value}% vs ultimo mes
              </p>
            )}
          </div>
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
