const dict = {
  en: {
    title: 'NQU Campus Portal', studentId: 'Student ID', password: 'Password', login: 'Log in', logout: 'Log out',
    loggedOut: 'You have been logged out.', welcome: 'Welcome',
    'nav.courses': 'Courses', 'nav.timetable': 'Timetable', 'nav.leave': 'Leave', 'nav.grades': 'Grades',
    search: 'Search name / code / teacher', code: 'Code', name: 'Name', teacher: 'Teacher', credits: 'Credits', time: 'Time',
    seats: 'Enrolled / Capacity', status: 'Status', add: 'Add', drop: 'Drop', enrolled: 'Enrolled', full: 'Full', open: 'Open',
    totalCredits: 'Total credits', period: 'Period', empty: 'Nothing here yet.',
    'day.1': 'Mon', 'day.2': 'Tue', 'day.3': 'Wed', 'day.4': 'Thu', 'day.5': 'Fri', 'day.6': 'Sat', 'day.7': 'Sun',
    'leave.new': 'New leave request', type: 'Type', from: 'From', to: 'To', reason: 'Reason', proof: 'Proof image (optional)',
    remove: 'Remove', submit: 'Submit', myRequests: 'Requests', student: 'Student', approve: 'Approve', reject: 'Reject', submitted: 'Request submitted.',
    'type.sick': 'Sick leave', 'type.personal': 'Personal leave', 'type.official': 'Official leave', 'type.other': 'Other',
    'status.pending': 'Pending', 'status.approved': 'Approved', 'status.rejected': 'Rejected',
    semester: 'Semester', course: 'Course', score: 'Score', average: 'Weighted average',
    'nav.users': 'Users', registerLink: 'No account? Register', backToLogin: 'Back to log in', register: 'Register', fullName: 'Full name', role: 'Role',
    'role.student': 'Student', 'role.admin': 'Admin', 'users.new': 'Create account', create: 'Create', registered: 'Account created. You can log in now.',
    userCreated: 'Account created.', 'hint.user': 'ID: 3–20 letters or digits. Password: at least 8 characters.',
    'err.STUDENT_ID_TAKEN': 'That student ID is already registered.',
    'err.INVALID_CREDENTIALS': 'Wrong student ID or password.', 'err.UNAUTHORIZED': 'Please log in again.', 'err.FORBIDDEN': 'Not allowed.',
    'err.ALREADY_ENROLLED': 'You are already enrolled in this course.', 'err.COURSE_FULL': 'This course is full.',
    'err.TIME_CONFLICT': 'Time conflict with a course you are enrolled in.', 'err.CREDIT_CAP': 'Credit cap of 25 exceeded.',
    'err.INVALID_INPUT': 'Please check the form and try again.', 'err.INVALID_FILE': 'Only image files (PNG, JPG, GIF, WebP) are allowed.',
    'err.FILE_TOO_LARGE': 'File is larger than 2 MB.', 'err.COURSE_NOT_FOUND': 'Course not found.', 'err.NOT_ENROLLED': 'You are not enrolled in this course.',
    'err.NOT_FOUND': 'Not found.', 'err.TOO_MANY_ATTEMPTS': 'Too many attempts. Try again in 15 minutes.', 'err.SERVER_ERROR': 'Server error. Try again later.', 'err.NETWORK': 'Cannot reach the server.',
  },
  'zh-TW': {
    title: '國立金門大學校務系統', studentId: '學號', password: '密碼', login: '登入', logout: '登出',
    loggedOut: '您已登出。', welcome: '歡迎',
    'nav.courses': '選課', 'nav.timetable': '課表', 'nav.leave': '請假', 'nav.grades': '成績',
    search: '搜尋名稱／代碼／教師', code: '代碼', name: '課程名稱', teacher: '教師', credits: '學分', time: '時間',
    seats: '已選／名額', status: '狀態', add: '加選', drop: '退選', enrolled: '已選', full: '額滿', open: '可選',
    totalCredits: '總學分', period: '節次', empty: '目前沒有資料。',
    'day.1': '週一', 'day.2': '週二', 'day.3': '週三', 'day.4': '週四', 'day.5': '週五', 'day.6': '週六', 'day.7': '週日',
    'leave.new': '新增請假申請', type: '假別', from: '起日', to: '迄日', reason: '事由', proof: '證明圖片（選填）',
    remove: '移除', submit: '送出', myRequests: '申請紀錄', student: '學生', approve: '核准', reject: '駁回', submitted: '申請已送出。',
    'type.sick': '病假', 'type.personal': '事假', 'type.official': '公假', 'type.other': '其他',
    'status.pending': '待審核', 'status.approved': '已核准', 'status.rejected': '已駁回',
    semester: '學期', course: '課程', score: '成績', average: '加權平均',
    'nav.users': '使用者', registerLink: '還沒有帳號？註冊', backToLogin: '返回登入', register: '註冊', fullName: '姓名', role: '角色',
    'role.student': '學生', 'role.admin': '管理員', 'users.new': '建立帳號', create: '建立', registered: '帳號已建立，請登入。',
    userCreated: '帳號已建立。', 'hint.user': '學號：3–20 個英數字。密碼：至少 8 個字元。',
    'err.STUDENT_ID_TAKEN': '此學號已被註冊。',
    'err.INVALID_CREDENTIALS': '學號或密碼錯誤。', 'err.UNAUTHORIZED': '請重新登入。', 'err.FORBIDDEN': '無權限。',
    'err.ALREADY_ENROLLED': '您已加選此課程。', 'err.COURSE_FULL': '此課程已額滿。',
    'err.TIME_CONFLICT': '與已選課程時間衝堂。', 'err.CREDIT_CAP': '超過學分上限 25 學分。',
    'err.INVALID_INPUT': '請檢查表單後再試一次。', 'err.INVALID_FILE': '僅接受圖片檔（PNG、JPG、GIF、WebP）。',
    'err.FILE_TOO_LARGE': '檔案超過 2 MB。', 'err.COURSE_NOT_FOUND': '找不到此課程。', 'err.NOT_ENROLLED': '您尚未加選此課程。',
    'err.NOT_FOUND': '找不到資料。', 'err.TOO_MANY_ATTEMPTS': '嘗試次數過多，請 15 分鐘後再試。', 'err.SERVER_ERROR': '伺服器錯誤，請稍後再試。', 'err.NETWORK': '無法連線到伺服器。',
  },
};
const detect = () => { try { return localStorage.getItem('lang'); } catch { return null; } };
let lang = detect() || (navigator.language.startsWith('zh') ? 'zh-TW' : 'en');
const t = (k) => dict[lang][k] ?? k;
const getLang = () => lang;
function setLang(l) {
  lang = l;
  try { localStorage.setItem('lang', l); } catch {}
  document.documentElement.lang = l;
  document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));
  document.querySelectorAll('[data-i18n-ph]').forEach((e) => (e.placeholder = t(e.dataset.i18nPh)));
  document.title = t('title');
}
if (typeof module !== 'undefined') module.exports = { dict };
