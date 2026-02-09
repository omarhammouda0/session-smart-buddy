import { useState } from 'react';
import { StudentGroup, GroupMember } from '@/types/student';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  ChevronDown,
  ChevronUp,
  Clock,
  Monitor,
  MapPin,
  DollarSign,
  Calendar,
  Edit,
  Trash2,
  UserPlus,
  Phone
} from 'lucide-react';
import { DAY_NAMES_AR } from '@/lib/arabicConstants';
import { cn } from '@/lib/utils';

interface GroupCardProps {
  group: StudentGroup;
  onEdit?: (group: StudentGroup) => void;
  onDelete?: (groupId: string) => void;
  onAddMember?: (groupId: string) => void;
  onViewDetails?: (group: StudentGroup) => void;
  compact?: boolean;
}

// Format time in Arabic
const formatTimeAr = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

// Get color class based on group color
const getColorClass = (color: string) => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    green: { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
    pink: { bg: 'bg-pink-50 dark:bg-pink-950/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  };
  return colors[color] || colors.blue;
};

export const GroupCard = ({
  group,
  onEdit,
  onDelete,
  onAddMember,
  onViewDetails,
  compact = false,
}: GroupCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const activeMembers = group.members.filter(m => m.isActive);
  const colorClasses = getColorClass(group.color || 'blue');

  // Calculate schedule summary
  const scheduleDays = group.scheduleDays.map(d => DAY_NAMES_AR[d.dayOfWeek]).join('، ');

  // Calculate upcoming sessions
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingSessions = group.sessions.filter(s => {
    const sessionDate = new Date(s.date);
    return sessionDate >= today && s.status === 'scheduled';
  }).slice(0, 3);

  if (compact) {
    return (
      <div
        className={cn(
          "p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
          colorClasses.bg,
          colorClasses.border
        )}
        onClick={() => onViewDetails?.(group)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              `bg-${group.color || 'blue'}-500`
            )}>
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className={cn("font-medium text-sm", colorClasses.text)}>{group.name}</p>
              <p className="text-xs text-muted-foreground">{activeMembers.length} طالب</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", colorClasses.text)}>
            {group.sessionType === 'online' ? 'أونلاين' : 'حضوري'}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("overflow-hidden", colorClasses.border)}>
      <CardHeader className={cn("pb-3", colorClasses.bg)}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              `bg-${group.color || 'blue'}-500`
            )}>
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className={cn("font-semibold text-lg", colorClasses.text)}>{group.name}</h3>
              {group.description && (
                <p className="text-sm text-muted-foreground">{group.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(group)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(group.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {activeMembers.length} طالب
          </Badge>
          <Badge variant="secondary" className="gap-1">
            {group.sessionType === 'online' ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
            {group.sessionType === 'online' ? 'أونلاين' : 'حضوري'}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <DollarSign className="h-3 w-3" />
            {group.defaultPricePerStudent} ج.م
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {group.sessionDuration} دقيقة
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Schedule */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Calendar className="h-4 w-4" />
          <span>{scheduleDays}</span>
          <span className="text-xs">({formatTimeAr(group.sessionTime)})</span>
        </div>

        {/* Members Toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between py-2 text-sm font-medium hover:bg-muted/50 rounded px-2 -mx-2"
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            عرض الأعضاء ({activeMembers.length})
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Expanded Members List */}
        {expanded && (
          <div className="mt-3 space-y-2">
            {activeMembers.map(member => (
              <div
                key={member.studentId}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {member.studentName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.studentName}</p>
                    {member.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {member.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {member.customPrice ? (
                    <span className="text-amber-600 font-medium">{member.customPrice} ج.م</span>
                  ) : (
                    <span>{group.defaultPricePerStudent} ج.م</span>
                  )}
                </div>
              </div>
            ))}

            {/* Add Member Button */}
            {onAddMember && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddMember(group.id)}
                className="w-full mt-2"
              >
                <UserPlus className="h-4 w-4 ml-1" />
                إضافة عضو
              </Button>
            )}
          </div>
        )}

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && !expanded && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">الحصص القادمة:</p>
            <div className="flex flex-wrap gap-1">
              {upcomingSessions.map(session => (
                <Badge key={session.id} variant="outline" className="text-xs">
                  {new Date(session.date).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GroupCard;

