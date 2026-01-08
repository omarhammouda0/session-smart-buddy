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
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

type Step = 'select' | 'edit' | 'preview';

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
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
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
        const { data: notesData, error: notesError } = await supabase
          .from('session_notes')
          .select('*')
          .eq('student_id', selectedStudentId)
          .gte('session_date', startDate)
          .lte('session_date', endDate)
          .order('session_date', { ascending: true });
        
        if (notesError) throw notesError;
        
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

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep('select');
    }
  }, [open]);

  const handleNext = () => {
    if (currentStep === 'select') {
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
      
      setCurrentStep('edit');
    } else if (currentStep === 'edit') {
      setCurrentStep('preview');
    }
  };

  const handleBack = () => {
    if (currentStep === 'edit') {
      setCurrentStep('select');
    } else if (currentStep === 'preview') {
      setCurrentStep('edit');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current || !selectedStudent) return;
    
    setIsGeneratingPdf(true);
    
    try {
      const html2canvasModule = await import('html2canvas');
      const jsPDFModule = await import('jspdf');
      const html2canvas = html2canvasModule.default;
      const jsPDF = jsPDFModule.default;
      
      const element = reportRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      const fileName = `تقرير_${selectedStudent.name}_${ARABIC_MONTHS[selectedMonth]}_${selectedYear}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "تم التحميل",
        description: "تم تحميل التقرير بصيغة PDF بنجاح",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إنشاء ملف PDF",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
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

  const steps = [
    { id: 'select' as Step, label: 'اختر الطالب', icon: Users },
    { id: 'edit' as Step, label: 'تعديل التقييم', icon: Edit },
    { id: 'preview' as Step, label: 'معاينة', icon: Eye },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0" dir="rtl">
        {/* Header with step indicator */}
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="font-heading flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              التقارير الشهرية
            </DialogTitle>
            {selectedStudent && currentStep !== 'select' && (
              <Badge variant="secondary" className="text-sm">
                {selectedStudent.name} - {ARABIC_MONTHS[selectedMonth]} {selectedYear}
              </Badge>
            )}
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStepIndex > index;
              
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isCompleted || (index === 0)) {
                        setCurrentStep(step.id);
                      }
                    }}
                    disabled={!isCompleted && index > 0 && currentStep !== step.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                      isActive && "bg-primary text-primary-foreground",
                      isCompleted && !isActive && "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted && !isActive ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{index + 1}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Step 1: Select Student */}
          {currentStep === 'select' && (
            <div className="p-6 space-y-6 overflow-auto h-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      اختر الطالب
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger className="w-full">
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      اختر الشهر
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select 
                      value={`${selectedMonth}-${selectedYear}`} 
                      onValueChange={(v) => {
                        const [m, y] = v.split('-').map(Number);
                        setSelectedMonth(m);
                        setSelectedYear(y);
                      }}
                    >
                      <SelectTrigger className="w-full">
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
                  </CardContent>
                </Card>
              </div>

              {/* Quick preview if student selected */}
              {selectedStudent && (
                <Card className={cn(
                  monthSessions.length === 0 && "border-yellow-300 bg-yellow-50/50"
                )}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      ملخص سريع: {selectedStudent.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthSessions.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        <Badge variant="secondary" className="text-sm py-1 px-3">
                          📅 {monthSessions.length} جلسة
                        </Badge>
                        <Badge variant="outline" className="text-sm py-1 px-3 bg-green-50 text-green-700 border-green-200">
                          ✓ الحضور: {stats.attendanceRate}%
                        </Badge>
                        <Badge variant="outline" className="text-sm py-1 px-3 bg-blue-50 text-blue-700 border-blue-200">
                          📚 الواجبات: {stats.homeworkRate}%
                        </Badge>
                        <Badge variant={monthPayment?.isPaid ? "default" : "destructive"} className="text-sm py-1 px-3">
                          {monthPayment?.isPaid ? '💰 مدفوع' : '⚠️ غير مدفوع'}
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-yellow-800 text-sm">
                        ⚠️ لا توجد جلسات لهذا الطالب في {ARABIC_MONTHS[selectedMonth]} {selectedYear}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Info */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-2 font-medium">
                    ℹ️ سيتم تضمين في التقرير:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    <span className="flex items-center gap-1">✓ ملخص الحضور</span>
                    <span className="flex items-center gap-1">✓ ملاحظات الجلسات</span>
                    <span className="flex items-center gap-1">✓ الواجبات المنزلية</span>
                    <span className="flex items-center gap-1">✓ تقييم عام</span>
                    <span className="flex items-center gap-1">✓ حالة الدفع</span>
                    <span className="flex items-center gap-1">✓ معلومات المعلم</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Edit Assessment */}
          {currentStep === 'edit' && (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <p className="text-sm text-muted-foreground">
                  أضف تقييمك ومعلومات التواصل لتظهر في التقرير (اختياري)
                </p>

                {/* Tutor Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">معلومات المعلم</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  </CardContent>
                </Card>

                {/* Assessment */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">التقييم الشهري</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-green-700 flex items-center gap-2">
                        ⭐ نقاط القوة
                      </Label>
                      <Textarea
                        value={strengths}
                        onChange={(e) => setStrengths(e.target.value)}
                        placeholder="• فهم ممتاز للمفاهيم الأساسية&#10;• التزام جيد بالحضور"
                        className="min-h-[80px]"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-orange-700 flex items-center gap-2">
                        📝 المجالات التي تحتاج تحسين
                      </Label>
                      <Textarea
                        value={improvements}
                        onChange={(e) => setImprovements(e.target.value)}
                        placeholder="• إكمال الواجبات المنزلية بانتظام"
                        className="min-h-[80px]"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-blue-700 flex items-center gap-2">
                        💡 التوصيات
                      </Label>
                      <Textarea
                        value={recommendations}
                        onChange={(e) => setRecommendations(e.target.value)}
                        placeholder="• الاستمرار في التدريب المنتظم"
                        className="min-h-[80px]"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-purple-700 flex items-center gap-2">
                        🎯 الهدف للشهر القادم
                      </Label>
                      <Textarea
                        value={nextMonthGoal}
                        onChange={(e) => setNextMonthGoal(e.target.value)}
                        placeholder="• تحسين نسبة إكمال الواجبات إلى 100%"
                        className="min-h-[80px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}

          {/* Step 3: Preview */}
          {currentStep === 'preview' && reportData && (
            <div className="h-full flex flex-col overflow-hidden">
              <ScrollArea className="h-[calc(90vh-220px)] border-y bg-white">
                <div className="p-4">
                  <MonthlyReportPreview ref={reportRef} data={reportData} />
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="border-t bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Back button */}
            <div>
              {currentStep !== 'select' && (
                <Button variant="outline" onClick={handleBack} className="gap-2">
                  <ArrowRight className="h-4 w-4" />
                  رجوع
                </Button>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {currentStep === 'select' && (
                <Button 
                  onClick={handleNext} 
                  disabled={!selectedStudentId || monthSessions.length === 0}
                  className="gap-2"
                >
                  التالي
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}

              {currentStep === 'edit' && (
                <>
                  <Button variant="outline" onClick={() => setCurrentStep('preview')} className="gap-2">
                    <Eye className="h-4 w-4" />
                    تخطي للمعاينة
                  </Button>
                  <Button onClick={handleNext} className="gap-2">
                    حفظ ومعاينة
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </>
              )}

              {currentStep === 'preview' && (
                <>
                  <Button variant="outline" onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                    <span className="hidden sm:inline">طباعة</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleDownloadPdf} 
                    disabled={isGeneratingPdf}
                    className="gap-2"
                  >
                    {isGeneratingPdf ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">تحميل PDF</span>
                  </Button>
                  <Button 
                    onClick={handleSendWhatsApp} 
                    disabled={isSending || !selectedStudent?.phone}
                    className="gap-2"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                    إرسال واتساب
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
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
