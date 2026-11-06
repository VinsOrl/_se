const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const schema = `
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, student_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','admin')));
CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY, code TEXT NOT NULL, name_en TEXT NOT NULL, name_zh TEXT NOT NULL,
  teacher_en TEXT NOT NULL, teacher_zh TEXT NOT NULL, credits INTEGER NOT NULL,
  day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 7), start_period INTEGER NOT NULL CHECK(start_period BETWEEN 1 AND 8),
  periods INTEGER NOT NULL, capacity INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS enrollments(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id), UNIQUE(user_id, course_id));
CREATE TABLE IF NOT EXISTS leave_requests(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL, date_from TEXT NOT NULL, date_to TEXT NOT NULL, reason TEXT NOT NULL, file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), semester TEXT NOT NULL,
  course_name_en TEXT NOT NULL, course_name_zh TEXT NOT NULL, credits INTEGER NOT NULL, score INTEGER NOT NULL);`;

// code, en, zh, teacher en, teacher zh, credits, day, start, periods, capacity
const courses = [
  ['CS101', 'Intro to Programming', '程式設計導論', 'Lin', '林老師', 3, 1, 1, 3, 30],
  ['CS201', 'Data Structures', '資料結構', 'Chen', '陳老師', 3, 2, 1, 3, 30],
  ['CS202', 'Algorithms', '演算法', 'Wang', '王老師', 3, 1, 2, 2, 30], // conflicts with CS101
  ['MA101', 'Calculus', '微積分', 'Huang', '黃老師', 3, 3, 1, 3, 40],
  ['EN101', 'English Reading', '英文閱讀', 'Smith', '史密斯老師', 2, 4, 1, 2, 40],
  ['PH101', 'General Physics', '普通物理', 'Wu', '吳老師', 3, 3, 5, 3, 40],
  ['CS301', 'Databases', '資料庫', 'Chen', '陳老師', 3, 4, 5, 3, 30],
  ['CS302', 'Operating Systems', '作業系統', 'Lin', '林老師', 3, 5, 1, 3, 30],
  ['AR101', 'Art Appreciation', '藝術欣賞', 'Tsai', '蔡老師', 2, 5, 5, 2, 50],
  ['CS999', 'Senior Seminar', '專題研討', 'Wang', '王老師', 1, 6, 1, 2, 1], // capacity 1
  ['PE101', 'Physical Education', '體育', 'Liu', '劉老師', 1, 2, 6, 2, 50],
  ['HI101', 'Kinmen History', '金門歷史', 'Yang', '楊老師', 2, 7, 1, 2, 50],
];
const gradeNames = [['Intro to Programming', '程式設計導論', 3], ['Calculus', '微積分', 3], ['English Reading', '英文閱讀', 2], ['Kinmen History', '金門歷史', 2]];

module.exports = (file) => {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  if (!db.prepare('SELECT 1 FROM users').get()) seed(db);
  return db;
};

function seed(db) {
  const hash = bcrypt.hashSync('demo1234', 10);
  const u = db.prepare('INSERT INTO users(student_id,name,password_hash,role) VALUES(?,?,?,?)');
  u.run('111210529', 'Student A', hash, 'student');
  u.run('111210555', 'Student B', hash, 'student');
  u.run('admin', 'Admin', hash, 'admin');
  const c = db.prepare('INSERT INTO courses(code,name_en,name_zh,teacher_en,teacher_zh,credits,day,start_period,periods,capacity) VALUES(?,?,?,?,?,?,?,?,?,?)');
  courses.forEach((r) => c.run(...r));
  const g = db.prepare('INSERT INTO grades(user_id,semester,course_name_en,course_name_zh,credits,score) VALUES(?,?,?,?,?,?)');
  for (const uid of [1, 2])
    ['112-1', '112-2', '113-1', '113-2', '114-1', '114-2', '115-1'].forEach((sem, si) =>
      gradeNames.forEach(([en, zh, cr], i) => g.run(uid, sem, en, zh, cr, 60 + ((uid * 7 + si * 5 + i * 11) % 40))));
}
