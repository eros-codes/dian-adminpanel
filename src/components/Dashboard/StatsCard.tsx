import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  className 
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'fa' ? 'fa-IR' : 'en-US';

  return (
    <Card className={cn("hover:shadow-md transition-shadow duration-200", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="text-sm font-medium text-muted-foreground">
          {title}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">
          {typeof value === 'number' ? value.toLocaleString(locale) : value}
        </div>
        {trend && (
          <div className={cn(
            "text-xs flex items-center mt-1",
            trend.isPositive ? "text-green-600" : "text-red-600"
          )}>
            <span>
              {trend.isPositive ? '+' : ''}{trend.value.toLocaleString(locale)}%
            </span>
            <span className="text-muted-foreground mr-1">{t('dashboard.fromLastMonth')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;