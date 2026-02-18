import { forwardRef } from 'react';
import { format, parseISO, getWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Student, Session, MonthlyPayment } from '@/types/student';
import { SessionNote, Homework } from '@/types/notes';
import { Check, X, Palmtree, FileText, BookOpen, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportData {
  student: Student;
  month: number;
  year: number;
  sessions: Session[];
  payment: MonthlyPayment | undefined;
  settings: {
    defaultPriceOnsite?: number;
    defaultPriceOnline?: number;
  };
  assessment?: {
    strengths: string;
    improvements: string;
    recommendations: string;
    nextMonthGoal: string;
  };
  tutorName?: string;
  tutorPhone?: string;
  tutorEmail?: string;
  notes?: SessionNote[];
  homework?: Homework[];
}

interface MonthlyReportPreviewProps {
  data: ReportData;
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MonthlyReportPreview = forwardRef<HTMLDivElement, MonthlyReportPreviewProps>(
  ({ data }, ref) => {
    const { student, month, year, sessions, payment, settings, assessment, tutorName, tutorPhone, tutorEmail, notes = [], homework = [] } = data;

    // Filter notes and homework that are included in report
    const includedNotes = notes.filter(n => n.include_in_report !== false);
    const includedHomework = homework.filter(h => h.include_in_report !== false);

    // Calculate stats
    const completed = sessions.filter(s => s.status === 'completed').length;
    const cancelled = sessions.filter(s => s.status === 'cancelled').length;
    const vacation = sessions.filter(s => s.status === 'vacation').length;
    const scheduled = sessions.filter(s => s.status === 'scheduled').length;
    const totalScheduled = sessions.length;
    
    // Attendance rate excludes vacation sessions
    const attendanceTotal = completed + cancelled;
    const attendanceRate = attendanceTotal > 0 ? Math.round((completed / attendanceTotal) * 100) : 0;

    // Homework stats from actual homework table
    const homeworkCompleted = includedHomework.filter(h => h.status === 'completed').length;
    const homeworkNotCompleted = includedHomework.filter(h => h.status === 'not_completed').length;
    const homeworkPending = includedHomework.filter(h => h.status === 'pending').length;
    const homeworkRate = includedHomework.length > 0 
      ? Math.round((homeworkCompleted / includedHomework.length) * 100) 
      : 100;

    // Price calculation
    const pricePerSession = student.useCustomSettings 
      ? (student.sessionType === 'online' ? student.customPriceOnline : student.customPriceOnsite) || 0
      : (student.sessionType === 'online' ? settings.defaultPriceOnline : settings.defaultPriceOnsite) || 0;
    const totalAmount = completed * pricePerSession;

    // Group sessions by week
    const sessionsByWeek = sessions.reduce((acc, session) => {
      const sessionDate = parseISO(session.date);
      const weekNum = getWeek(sessionDate, { weekStartsOn: 0 });
      if (!acc[weekNum]) acc[weekNum] = [];
      acc[weekNum].push(session);
      return acc;
    }, {} as Record<number, Session[]>);

    // Category icons and labels
    const getCategoryIcon = (category: string) => {
      switch (category) {
        case 'progress': return '📌';
        case 'challenge': return '⚠️';
        case 'achievement': return '🎯';
        default: return '📝';
      }
    };

    const getCategoryLabel = (category: string) => {
      switch (category) {
        case 'progress': return 'تقدم';
        case 'challenge': return 'تحدي';
        case 'achievement': return 'إنجاز';
        default: return 'عام';
      }
    };

    const reportDate = new Date();
    const isPartialMonth = month === reportDate.getMonth() && year === reportDate.getFullYear() && reportDate.getDate() < 28;

    return (
      <div 
        ref={ref}
        className="bg-white text-black p-3 sm:p-8 max-w-[800px] mx-auto font-sans print:p-6"
        dir="rtl"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
          <h1 className="text-2xl font-bold mb-1">تقرير التقدم الشهري</h1>
          <p className="text-sm text-gray-600 mb-4">MONTHLY PROGRESS REPORT</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm mt-4">
            <div className="text-right">
              <p><strong>الطالب:</strong> {student.name}</p>
              <p><strong>الشهر:</strong> {ARABIC_MONTHS[month]} {year}</p>
            </div>
            <div className="text-left" dir="ltr">
              <p><strong>Student:</strong> {student.name}</p>
              <p><strong>Month:</strong> {ENGLISH_MONTHS[month]} {year}</p>
            </div>
          </div>
          
          {tutorName && (
            <p className="text-sm mt-2">
              <strong>المعلم / Tutor:</strong> {tutorName}
            </p>
          )}
          
          <p className="text-xs text-gray-500 mt-2">
            تاريخ التقرير: {format(reportDate, 'd MMMM yyyy', { locale: ar })}
          </p>
        </div>

        {isPartialMonth && (
          <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mb-4 text-sm">
            <p className="text-yellow-800">
              ℹ️ <strong>ملاحظة:</strong> هذا تقرير جزئي - الشهر لم ينته بعد
            </p>
            <p className="text-yellow-700 text-xs mt-1">
              البيانات حتى: {format(reportDate, 'd MMMM yyyy', { locale: ar })}
            </p>
          </div>
        )}

        {/* Section 1: Attendance Summary */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-3 flex items-center gap-2">
            📊 ملخص الحضور / Attendance Summary
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm mb-4">
            <div className="space-y-1">
              <p>إجمالي الجلسات المجدولة: <strong>{totalScheduled} جلسة</strong></p>
              <p className="text-green-700">الجلسات المكتملة: <strong>{completed} جلسات ✓</strong></p>
              <p className="text-red-700">الجلسات الملغاة: <strong>{cancelled} جلسة ❌</strong></p>
              <p className="text-orange-600">الجلسات - إجازة: <strong>{vacation} جلسة 🏖️</strong></p>
              {scheduled > 0 && <p className="text-blue-600">الجلسات القادمة: <strong>{scheduled} جلسة</strong></p>}
            </div>
            <div className="text-left" dir="ltr">
              <p>Total Scheduled: <strong>{totalScheduled}</strong></p>
              <p className="text-green-700">Completed: <strong>{completed} ✓</strong></p>
              <p className="text-red-700">Cancelled: <strong>{cancelled} ❌</strong></p>
              <p className="text-orange-600">Vacation: <strong>{vacation} 🏖️</strong></p>
              {scheduled > 0 && <p className="text-blue-600">Upcoming: <strong>{scheduled}</strong></p>}
            </div>
          </div>
          
          <div className="bg-gray-100 p-3 rounded text-center">
            <p className="text-lg font-bold">
              نسبة الحضور: {attendanceRate}% ({completed}/{attendanceTotal})
            </p>
            <p className="text-xs text-gray-600 mt-1">
              ℹ️ جلسات الإجازة لا تحتسب في نسبة الحضور
            </p>
          </div>
        </div>

        {/* Section 2: Session Details */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-3 flex items-center gap-2">
            📝 تفاصيل الجلسات / Session Details
          </h2>
          
          {Object.entries(sessionsByWeek)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([weekNum, weekSessions]) => (
              <div key={weekNum} className="mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  الأسبوع {weekNum}
                </p>
                <div className="space-y-2">
                  {weekSessions
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(session => (
                      <div 
                        key={session.id}
                        className={cn(
                          "p-2 rounded border text-sm",
                          session.status === 'completed' && "bg-green-50 border-green-200",
                          session.status === 'cancelled' && "bg-red-50 border-red-200",
                          session.status === 'vacation' && "bg-orange-50 border-orange-200",
                          session.status === 'scheduled' && "bg-blue-50 border-blue-200"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-1 justify-between">
                          <div className="flex items-center gap-2">
                            {session.status === 'completed' && <Check className="h-4 w-4 text-green-600" />}
                            {session.status === 'cancelled' && <X className="h-4 w-4 text-red-600" />}
                            {session.status === 'vacation' && <Palmtree className="h-4 w-4 text-orange-600" />}
                            <span className="font-medium">
                              {format(parseISO(session.date), 'EEEE d MMMM', { locale: ar })}
                            </span>
                            <span className="text-gray-500">
                              {session.time || student.sessionTime || '16:00'}
                            </span>
                          </div>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            session.status === 'completed' && "bg-green-200 text-green-800",
                            session.status === 'cancelled' && "bg-red-200 text-red-800",
                            session.status === 'vacation' && "bg-orange-200 text-orange-800",
                            session.status === 'scheduled' && "bg-blue-200 text-blue-800"
                          )}>
                            {session.status === 'completed' && 'مكتملة'}
                            {session.status === 'cancelled' && 'ملغاة'}
                            {session.status === 'vacation' && 'إجازة'}
                            {session.status === 'scheduled' && 'مجدولة'}
                          </span>
                        </div>
                        
                        {session.status === 'completed' && (
                          <div className="mt-2 text-xs space-y-1 mr-6">
                            {session.topic && (
                              <p className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                <strong>الموضوع:</strong> {session.topic}
                              </p>
                            )}
                            {!session.topic && (
                              <p className="text-gray-500 italic">لا يوجد موضوع محدد</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>

        {/* Section 3: Teacher's Notes */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-3 flex items-center gap-2">
            📝 ملاحظات المعلم / Teacher's Notes
          </h2>
          
          {includedNotes.length === 0 ? (
            <p className="text-gray-500 text-sm">لا توجد ملاحظات لهذا الشهر</p>
          ) : (
            <div className="space-y-3">
              {includedNotes
                .sort((a, b) => a.session_date.localeCompare(b.session_date))
                .map(note => (
                  <div key={note.id} className="p-3 border rounded bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{getCategoryIcon(note.category)}</span>
                      <span className="text-xs font-semibold text-gray-600">
                        {getCategoryLabel(note.category)}
                      </span>
                      <span className="text-xs text-gray-500">
                        - {format(parseISO(note.session_date), 'd MMMM yyyy', { locale: ar })}
                      </span>
                    </div>
                    {note.title && (
                      <p className="font-medium text-sm mb-1">{note.title}</p>
                    )}
                    {note.content && (
                      <p className="text-sm whitespace-pre-line">{note.content}</p>
                    )}
                    {note.type === 'voice' && note.duration && (
                      <p className="text-xs text-gray-500 mt-1">🎤 تسجيل صوتي ({Math.floor(note.duration / 60)}:{(note.duration % 60).toString().padStart(2, '0')})</p>
                    )}
                    {note.type === 'file' && note.file_name && (
                      <p className="text-xs text-gray-500 mt-1">📎 ملف مرفق: {note.file_name}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Section 4: Homework Summary */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-3 flex items-center gap-2">
            📚 الواجبات المنزلية / Homework Assignments
          </h2>
          
          {includedHomework.length === 0 ? (
            <p className="text-gray-500 text-sm">لم يتم تعيين واجبات منزلية هذا الشهر</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm mb-4">
                <div>
                  <p>إجمالي الواجبات: <strong>{includedHomework.length}</strong></p>
                  <p className="text-green-700">تم إكماله: <strong>{homeworkCompleted} ✓</strong></p>
                  <p className="text-red-700">لم يكتمل: <strong>{homeworkNotCompleted} ❌</strong></p>
                  <p className="text-yellow-600">قيد الانتظار: <strong>{homeworkPending} ⏳</strong></p>
                </div>
                <div className="text-left" dir="ltr">
                  <p>Total Assignments: <strong>{includedHomework.length}</strong></p>
                  <p className="text-green-700">Completed: <strong>{homeworkCompleted} ✓</strong></p>
                  <p className="text-red-700">Not Completed: <strong>{homeworkNotCompleted} ❌</strong></p>
                  <p className="text-yellow-600">Pending: <strong>{homeworkPending} ⏳</strong></p>
                </div>
              </div>
              
              <div className="bg-gray-100 p-3 rounded text-center mb-4">
                <p className="text-lg font-bold">
                  نسبة الإكمال: {homeworkRate}%
                </p>
              </div>
              
              {/* Homework details */}
              <div className="space-y-2">
                {includedHomework
                  .sort((a, b) => a.session_date.localeCompare(b.session_date))
                  .map(hw => (
                    <div 
                      key={hw.id} 
                      className={cn(
                        "p-3 border rounded text-sm",
                        hw.status === 'completed' && "bg-green-50 border-green-200",
                        hw.status === 'not_completed' && "bg-red-50 border-red-200",
                        hw.status === 'pending' && "bg-yellow-50 border-yellow-200"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-1 justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {hw.status === 'completed' && <span>✅</span>}
                          {hw.status === 'not_completed' && <span>❌</span>}
                          {hw.status === 'pending' && <span>⏳</span>}
                          <span className="font-medium">{hw.description}</span>
                        </div>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded",
                          hw.status === 'completed' && "bg-green-200 text-green-800",
                          hw.status === 'not_completed' && "bg-red-200 text-red-800",
                          hw.status === 'pending' && "bg-yellow-200 text-yellow-800"
                        )}>
                          {hw.status === 'completed' && 'مُنجز'}
                          {hw.status === 'not_completed' && 'لم يُنجز'}
                          {hw.status === 'pending' && 'قيد الانتظار'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mr-6">
                        <p>تاريخ الجلسة: {format(parseISO(hw.session_date), 'd MMMM', { locale: ar })}</p>
                        <p>تاريخ التسليم: {format(parseISO(hw.due_date), 'd MMMM', { locale: ar })}</p>
                        {hw.status === 'completed' && hw.completed_at && (
                          <p className="text-green-700">
                            تم الإنجاز: {format(parseISO(hw.completed_at), 'd MMMM', { locale: ar })} ✓
                          </p>
                        )}
                        {hw.priority !== 'normal' && (
                          <p className={hw.priority === 'urgent' ? 'text-red-600' : 'text-orange-600'}>
                            الأولوية: {hw.priority === 'urgent' ? '🔴 عاجل' : '🟡 مهم'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>

        {/* Section 5: Overall Assessment */}
        {assessment && (assessment.strengths || assessment.improvements || assessment.recommendations || assessment.nextMonthGoal) && (
          <div className="mb-6">
            <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-3 flex items-center gap-2">
              ⭐ التقييم العام / Overall Assessment
            </h2>
            
            <div className="space-y-3 text-sm">
              {assessment.strengths && (
                <div>
                  <p className="font-semibold text-green-700">نقاط القوة / Strengths:</p>
                  <p className="whitespace-pre-line mr-4">{assessment.strengths}</p>
                </div>
              )}
              
              {assessment.improvements && (
                <div>
                  <p className="font-semibold text-orange-700">المجالات التي تحتاج تحسين / Areas for Improvement:</p>
                  <p className="whitespace-pre-line mr-4">{assessment.improvements}</p>
                </div>
              )}
              
              {assessment.recommendations && (
                <div>
                  <p className="font-semibold text-blue-700">التوصيات / Recommendations:</p>
                  <p className="whitespace-pre-line mr-4">{assessment.recommendations}</p>
                </div>
              )}
              
              {assessment.nextMonthGoal && (
                <div>
                  <p className="font-semibold text-purple-700">الهدف للشهر القادم / Next Month Goal:</p>
                  <p className="whitespace-pre-line mr-4">{assessment.nextMonthGoal}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 6: Payment Status */}
        <div className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-3 flex items-center gap-2">
            💰 حالة الدفع / Payment Status
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm mb-4">
            <div>
              <p>الجلسات المكتملة: <strong>{completed} جلسات</strong></p>
              <p>السعر لكل جلسة: <strong>{pricePerSession} جنيه</strong></p>
              <p>المبلغ الإجمالي: <strong>{totalAmount} جنيه</strong></p>
            </div>
            <div className="text-left" dir="ltr">
              <p>Completed Sessions: <strong>{completed}</strong></p>
              <p>Price per Session: <strong>{pricePerSession} EGP</strong></p>
              <p>Total Amount: <strong>{totalAmount} EGP</strong></p>
            </div>
          </div>
          
          <div className={cn(
            "p-3 rounded text-center",
            payment?.isPaid ? "bg-green-100" : "bg-yellow-100"
          )}>
            {payment?.isPaid ? (
              <>
                <p className="text-lg font-bold text-green-700">✓ مدفوع / Paid</p>
                {payment.paidAt && (
                  <p className="text-xs text-green-600 mt-1">
                    تاريخ الدفع: {format(parseISO(payment.paidAt), 'd MMMM yyyy', { locale: ar })}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-yellow-700">⚠️ غير مدفوع / Unpaid</p>
                <p className="text-xs text-yellow-600 mt-1">الرجاء التواصل لترتيب الدفع</p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-800 pt-4 text-center text-sm">
          {(tutorPhone || tutorEmail) && (
            <div className="mb-3">
              <p className="font-semibold">للاستفسارات أو الملاحظات / For inquiries or feedback:</p>
              {tutorPhone && <p>📱 WhatsApp: {tutorPhone}</p>}
              {tutorEmail && <p>📧 Email: {tutorEmail}</p>}
            </div>
          )}
          
          <p className="text-gray-600 text-xs">
            شكراً لثقتكم وتعاونكم
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Thank you for your trust and cooperation
          </p>
          <p className="text-gray-400 text-[10px] mt-3">
            تم إنشاء التقرير بواسطة Student Tracker • {format(reportDate, 'd MMMM yyyy', { locale: ar })}
          </p>
        </div>
      </div>
    );
  }
);

MonthlyReportPreview.displayName = 'MonthlyReportPreview';
