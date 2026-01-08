import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Bell, MessageSquare, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Student } from '@/types/student';
import { cn } from '@/lib/utils';

interface StudentAtRisk {
  student: Student;
  count: number;
  limit: number;
  percentage: number;
  severity: 'safe' | 'warning' | 'critical' | 'exceeded';
  parentNotified: boolean;
}

interface AttendanceAlertsWidgetProps {
  studentsAtRisk: StudentAtRisk[];
  onNotifyParent: (studentId: string) => void;
  onViewDetails: (studentId: string) => void;
}

export const AttendanceAlertsWidget = ({
  studentsAtRisk,
  onNotifyParent,
  onViewDetails,
}: AttendanceAlertsWidgetProps) => {
  const [isOpen, setIsOpen] = useState(true);

  if (studentsAtRisk.length === 0) return null;

  const criticalCount = studentsAtRisk.filter(
    (s) => s.severity === 'exceeded' || s.severity === 'critical'
  ).length;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'exceeded':
        return 'bg-destructive';
      case 'critical':
        return 'bg-orange-500';
      case 'warning':
        return 'bg-amber-500';
      default:
        return 'bg-emerald-500';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'exceeded':
        return (
          <Badge variant="destructive" className="text-xs">
            تجاوز الحد
          </Badge>
        );
      case 'critical':
        return (
          <Badge className="text-xs bg-orange-500 hover:bg-orange-600">
            قريب من الحد
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="text-xs bg-amber-500 hover:bg-amber-600">
            تحذير
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} dir="rtl">
      <div className="rounded-lg border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-3 h-auto hover:bg-accent/50"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="font-medium">تنبيهات الحضور</span>
              {criticalCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalCount}
                </Badge>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {studentsAtRisk.map(({ student, count, limit, percentage, severity, parentNotified }) => (
              <div
                key={student.id}
                className={cn(
                  'p-3 rounded-lg border',
                  severity === 'exceeded'
                    ? 'bg-destructive/5 border-destructive/30'
                    : severity === 'critical'
                    ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                    : 'bg-muted/50 border-border'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{student.name}</span>
                      {getSeverityBadge(severity)}
                      {parentNotified && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Check className="h-3 w-3" />
                          تم الإبلاغ
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {count} من {limit}
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round(percentage)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(percentage, 100)}
                    className={cn('h-2', getSeverityColor(severity))}
                  />
                </div>

                {severity === 'exceeded' && (
                  <p className="text-xs text-destructive mt-2 font-medium">
                    ⚠️ تجاوز الحد الأقصى!
                  </p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  {!parentNotified && student.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-7"
                      onClick={() => onNotifyParent(student.id)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      إبلاغ الوالد
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-xs h-7"
                    onClick={() => onViewDetails(student.id)}
                  >
                    <ExternalLink className="h-3 w-3" />
                    التفاصيل
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
