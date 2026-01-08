import { useState, useRef, useMemo, useEffect } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  FileText, 
  Download, 
  Send, 
  Edit, 
  Printer,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Student, MonthlyPayment, AppSettings } from '@/types/student';
import { SessionNote, Homework } from '@/types/notes';
import { MonthlyReportPreview } from './MonthlyReportPreview';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MonthlyReportDialogProps {
  students: Student[];
  payments: { studentId: string; payments: MonthlyPayment[] }[];
  settings: AppSettings;
  trigger?: React.ReactNode;
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export const MonthlyReportDialog = ({
  students,
  payments,
  settings,
  trigger,
}: MonthlyReportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'generate' | 'preview' | 'edit'>('generate');
  const [isSending, setIsSending] = useState(false);
  
  // Notes and homework from database
  const [studentNotes, setStudentNotes] = useState<SessionNote[]>([]);
  const [studentHomework, setStudentHomework] = useState<Homework[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Assessment fields
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [nextMonthGoal, setNextMonthGoal] = useState('');
  
  // Tutor info
  const [tutorName, setTutorName] = useState('');
  const [tutorPhone, setTutorPhone] = useState('');
  const [tutorEmail, setTutorEmail] = useState('');
  
  const reportRef = useRef<HTMLDivElement>(null);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  
  // Get sessions for the selected month
  const monthSessions = useMemo(() => {
    if (!selectedStudent) return [];
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
    const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
    
    return selectedStudent.sessions.filter(session => {
      const sessionDate = parseISO(session.date);
      return isWithinInterval(sessionDate, { start: monthStart, end: monthEnd });
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedStudent, selectedMonth, selectedYear]);

  // Get payment status for selected month
  const monthPayment = useMemo(() => {
    if (!selectedStudent) return undefined;
    const studentPayments = payments.find(p => p.studentId === selectedStudent.id);
    return studentPayments?.payments.find(p => p.month === selectedMonth && p.year === selectedYear);
  }, [selectedStudent, payments, selectedMonth, selectedYear]);

  // Calculate quick stats
  const stats = useMemo(() => {
    const completed = monthSessions.filter(s => s.status === 'completed').length;
    const cancelled = monthSessions.filter(s => s.status === 'cancelled').length;
    const vacation = monthSessions.filter(s => s.status === 'vacation').length;
    const attendanceTotal = completed + cancelled;
    const attendanceRate = attendanceTotal > 0 ? Math.round((completed / attendanceTotal) * 100) : 0;
    
    const sessionsWithHomework = monthSessions.filter(s => s.homework && s.homeworkStatus !== 'none');
    const homeworkCompleted = monthSessions.filter(s => s.homeworkStatus === 'completed').length;
    const homeworkRate = sessionsWithHomework.length > 0 
      ? Math.round((homeworkCompleted / sessionsWithHomework.length) * 100) 
      : 100;
    
    return { completed, cancelled, vacation, attendanceRate, homeworkRate };
  }, [monthSessions]);

  // Fetch notes and homework for selected student and month
  useEffect(() => {
    const fetchNotesAndHomework = async () => {
      if (!selectedStudentId) {
        setStudentNotes([]);
        setStudentHomework([]);
        return;
      }
      
      setIsLoadingData(true);
      
      const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
      const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');
      
      try {
        // Fetch notes
        const { data: notesData, error: notesError } = await supabase
          .from('session_notes')
          .select('*')
          .eq('student_id', selectedStudentId)
          .gte('session_date', startDate)
          .lte('session_date', endDate)
          .order('session_date', { ascending: true });
        
        if (notesError) throw notesError;
        
        // Fetch homework
        const { data: homeworkData, error: homeworkError } = await supabase
          .from('homework')
          .select('*')
          .eq('student_id', selectedStudentId)
          .gte('session_date', startDate)
          .lte('session_date', endDate)
          .order('session_date', { ascending: true });
        
        if (homeworkError) throw homeworkError;
        
        setStudentNotes((notesData || []).map(n => ({
          ...n,
          include_in_report: n.include_in_report ?? true
        })) as SessionNote[]);
        
        setStudentHomework((homeworkData || []).map(h => ({
          ...h,
          include_in_report: h.include_in_report ?? true
        })) as Homework[]);
        
      } catch (error) {
        console.error('Error fetching notes/homework:', error);
      } finally {
        setIsLoadingData(false);
      }
    };
    
    fetchNotesAndHomework();
  }, [selectedStudentId, selectedMonth, selectedYear]);

  // Generate available months (last 6 months + current)
  const availableMonths = useMemo(() => {
    const months: { month: number; year: number; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: date.getMonth(),
        year: date.getFullYear(),
        label: `${ARABIC_MONTHS[date.getMonth()]} ${date.getFullYear()}`
      });
    }
    return months;
  }, []);

  const handleGenerateReport = () => {
    if (!selectedStudentId) {
      toast({
        title: "اختر طالب",
        description: "الرجاء اختيار طالب لإنشاء التقرير",
        variant: "destructive",
      });
      return;
    }
    
    if (monthSessions.length === 0) {
      toast({
        title: "لا توجد جلسات",
        description: "لم تتم جدولة أي جلسات لهذا الطالب في هذا الشهر",
        variant: "destructive",
      });
      return;
    }
    
    setActiveTab('preview');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = async () => {
    if (!selectedStudent?.phone) {
      toast({
        title: "لا يوجد رقم هاتف",
        description: "الرجاء إضافة رقم هاتف للطالب أولاً",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    try {
      // Create a summary message
      const message = `📊 تقرير التقدم الشهري

الطالب: ${selectedStudent.name}
الشهر: ${ARABIC_MONTHS[selectedMonth]} ${selectedYear}

📈 ملخص الحضور:
• الجلسات المكتملة: ${stats.completed}
• نسبة الحضور: ${stats.attendanceRate}%

📚 الواجبات:
• نسبة الإكمال: ${stats.homeworkRate}%

💰 الدفع: ${monthPayment?.isPaid ? '✓ مدفوع' : '⚠️ غير مدفوع'}

${strengths ? `\n⭐ نقاط القوة:\n${strengths}` : ''}
${improvements ? `\n📝 مجالات التحسين:\n${improvements}` : ''}
${recommendations ? `\n💡 التوصيات:\n${recommendations}` : ''}

شكراً لثقتكم وتعاونكم 🙏`;

      const { error } = await supabase.functions.invoke('send-whatsapp-reminder', {
        body: {
          to: selectedStudent.phone,
          message,
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          type: 'report',
        }
      });

      if (error) throw error;

      toast({
        title: "تم الإرسال",
        description: `تم إرسال ملخص التقرير إلى ${selectedStudent.name}`,
      });
    } catch (error: any) {
      console.error('Error sending report:', error);
      toast({
        title: "فشل الإرسال",
        description: error.message || "حدث خطأ أثناء إرسال التقرير",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const reportData = selectedStudent ? {
    student: selectedStudent,
    month: selectedMonth,
    year: selectedYear,
    sessions: monthSessions,
    payment: monthPayment,
    settings: {
      defaultPriceOnsite: settings.defaultPriceOnsite,
      defaultPriceOnline: settings.defaultPriceOnline,
    },
    assessment: {
      strengths,
      improvements,
      recommendations,
      nextMonthGoal,
    },
    tutorName,
    tutorPhone,
    tutorEmail,
    notes: studentNotes,
    homework: studentHomework,
  } : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">التقارير</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileText className="h-5 w-5" />
            التقارير الشهرية
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 shrink-0">
            <TabsTrigger value="generate" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              إنشاء
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 text-xs" disabled={!selectedStudent || monthSessions.length === 0}>
              <FileText className="h-3.5 w-3.5" />
              معاينة
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-1.5 text-xs" disabled={!selectedStudent}>
              <Edit className="h-3.5 w-3.5" />
              تعديل
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            {/* Generate Tab */}
            <TabsContent value="generate" className="mt-4 h-full overflow-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Student Select */}
                  <div className="space-y-2">
                    <Label>اختر الطالب</Label>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر طالب..." />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map(student => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Month Select */}
                  <div className="space-y-2">
                    <Label>اختر الشهر</Label>
                    <Select 
                      value={`${selectedMonth}-${selectedYear}`} 
                      onValueChange={(v) => {
                        const [m, y] = v.split('-').map(Number);
                        setSelectedMonth(m);
                        setSelectedYear(y);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMonths.map(({ month, year, label }) => (
                          <SelectItem key={`${month}-${year}`} value={`${month}-${year}`}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Info box */}
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      ℹ️ سيتم تضمين:
                    </p>
                    <ul className="text-sm space-y-1 mr-4 list-disc list-inside">
                      <li>ملخص الحضور</li>
                      <li>ملاحظات الجلسات</li>
                      <li>الواجبات المنزلية</li>
                      <li>تقييم عام</li>
                      <li>حالة الدفع</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Quick preview if student selected */}
                {selectedStudent && monthSessions.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="font-medium mb-3">{selectedStudent.name} - {ARABIC_MONTHS[selectedMonth]} {selectedYear}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {monthSessions.length} جلسة
                        </Badge>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          الحضور: {stats.attendanceRate}%
                        </Badge>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          الواجبات: {stats.homeworkRate}%
                        </Badge>
                        <Badge variant={monthPayment?.isPaid ? "default" : "destructive"}>
                          {monthPayment?.isPaid ? '✓ مدفوع' : '⚠️ غير مدفوع'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedStudent && monthSessions.length === 0 && (
                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-yellow-800">
                        ⚠️ لا توجد جلسات لـ {selectedStudent.name} في {ARABIC_MONTHS[selectedMonth]} {selectedYear}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Button 
                  onClick={handleGenerateReport} 
                  className="w-full"
                  disabled={!selectedStudentId || monthSessions.length === 0}
                >
                  إنشاء التقرير
                </Button>
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="mt-4 h-full overflow-hidden flex flex-col">
              {reportData && (
                <>
                  <ScrollArea className="flex-1 border rounded-lg bg-white">
                    <MonthlyReportPreview ref={reportRef} data={reportData} />
                  </ScrollArea>
                  
                  <div className="flex flex-wrap gap-2 mt-4 justify-end">
                    <Button variant="outline" onClick={() => setActiveTab('edit')} className="gap-1.5">
                      <Edit className="h-4 w-4" />
                      تعديل التقييم
                    </Button>
                    <Button variant="outline" onClick={handlePrint} className="gap-1.5">
                      <Printer className="h-4 w-4" />
                      طباعة / PDF
                    </Button>
                    <Button 
                      onClick={handleSendWhatsApp} 
                      disabled={isSending || !selectedStudent?.phone}
                      className="gap-1.5"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                      إرسال ملخص واتساب
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Edit Tab */}
            <TabsContent value="edit" className="mt-4 h-full overflow-auto">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  أضف تقييمك ومعلومات التواصل لتظهر في التقرير
                </p>

                {/* Tutor Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>اسم المعلم</Label>
                    <Input
                      value={tutorName}
                      onChange={(e) => setTutorName(e.target.value)}
                      placeholder="اسمك"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الواتساب</Label>
                    <Input
                      value={tutorPhone}
                      onChange={(e) => setTutorPhone(e.target.value)}
                      placeholder="01012345678"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      value={tutorEmail}
                      onChange={(e) => setTutorEmail(e.target.value)}
                      placeholder="email@example.com"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Assessment */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-green-700">نقاط القوة</Label>
                    <Textarea
                      value={strengths}
                      onChange={(e) => setStrengths(e.target.value)}
                      placeholder="• فهم ممتاز للمفاهيم الأساسية&#10;• التزام جيد بالحضور&#10;• تحسن مستمر خلال الشهر"
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-orange-700">المجالات التي تحتاج تحسين</Label>
                    <Textarea
                      value={improvements}
                      onChange={(e) => setImprovements(e.target.value)}
                      placeholder="• إكمال الواجبات المنزلية بانتظام&#10;• المزيد من التدريب على الهندسة"
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-blue-700">التوصيات</Label>
                    <Textarea
                      value={recommendations}
                      onChange={(e) => setRecommendations(e.target.value)}
                      placeholder="• الاستمرار في التدريب المنتظم&#10;• تخصيص وقت إضافي للواجبات"
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-purple-700">الهدف للشهر القادم</Label>
                    <Textarea
                      value={nextMonthGoal}
                      onChange={(e) => setNextMonthGoal(e.target.value)}
                      placeholder="• تحسين نسبة إكمال الواجبات إلى 100%&#10;• إتقان موضوعات الهندسة"
                      className="min-h-[80px]"
                    />
                  </div>
                </div>

                <Button onClick={() => setActiveTab('preview')} className="w-full">
                  حفظ ومعاينة التقرير
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:p-6, .print\\:p-6 * {
            visibility: visible;
          }
          .print\\:p-6 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </Dialog>
  );
};
