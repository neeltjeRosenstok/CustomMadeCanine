require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const cookieSession = require("cookie-session");
const multer = require("multer");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_VERSION = "21.9.8-online-test";
const SESSION_COOKIE = "cmc_session_online_test_2180";
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const PRIVATE_UPLOAD_DIR = path.join(DATA_DIR, "private-uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "canine.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK(role IN ('client','trainer')),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);

CREATE TABLE IF NOT EXISTS pets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT DEFAULT 'Dog',
  breed TEXT,
  age TEXT,
  notes TEXT,
  gender TEXT,
  neutered_spayed INTEGER NOT NULL DEFAULT 0,
  behavior_notes TEXT,
  medical_procedures TEXT,
  trainer_notes TEXT
);

CREATE TABLE IF NOT EXISTS pet_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('photo','vaccination')),
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pet_files_pet_kind ON pet_files(pet_id, kind);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  weekday TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 12,
  price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS class_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS class_enrolments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
  booking_ref TEXT UNIQUE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  enrolment_status TEXT NOT NULL DEFAULT 'active',
  rejected_reason TEXT,
  rejected_at TEXT,
  rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  refund_amount INTEGER,
  refund_confirmation_code TEXT,
  refund_recorded_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
  booking_ref TEXT UNIQUE NOT NULL,
  service TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK(location_type IN ('arena','home')),
  address TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  buffer_end_at TEXT NOT NULL,
  travel_minutes INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  mpesa_request_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS availability_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS service_availability_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_type TEXT NOT NULL CHECK(location_type IN ('arena','home')),
  start_at TEXT,
  end_at TEXT,
  reason TEXT,
  public_message TEXT,
  private_note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target TEXT NOT NULL CHECK(target IN ('amy','arena','home')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  public_message TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_dates ON schedule_blocks(active,start_date,end_date);

CREATE TABLE IF NOT EXISTS working_hours (
  weekday INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time TEXT NOT NULL DEFAULT '17:00'
);

CREATE TABLE IF NOT EXISTS working_hour_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_date TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  start_time TEXT,
  end_time TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS daily_location_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  arena_enabled INTEGER NOT NULL DEFAULT 1,
  home_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_daily_location_plan_date ON daily_location_plan(plan_date,start_time);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('video','image','pdf','link','audio')),
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resource_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS training_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  client_visible INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS booking_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);


// v21.7.5: allow one family to enrol several different dogs in the same course.
// Older databases had UNIQUE(class_id,user_id), so rebuild that table once while preserving all rows.
function ensureClassEnrolmentSchema(){
  const row=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='class_enrolments'").get();
  const normalized=String(row?.sql||"").replace(/\s+/g,"").toLowerCase();
  if(!normalized.includes("unique(class_id,user_id)"))return;
  db.pragma("foreign_keys = OFF");
  try{
    db.exec(`
      BEGIN;
      DROP TABLE IF EXISTS class_enrolments_legacy_v2175;
      DROP INDEX IF EXISTS uq_class_pet;
      ALTER TABLE class_enrolments RENAME TO class_enrolments_legacy_v2175;
      CREATE TABLE class_enrolments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
        booking_ref TEXT UNIQUE NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        enrolment_status TEXT NOT NULL DEFAULT 'active',
        rejected_reason TEXT,
        rejected_at TEXT,
        rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        refund_amount INTEGER,
        refund_confirmation_code TEXT,
        refund_recorded_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO class_enrolments(id,class_id,user_id,pet_id,booking_ref,payment_status,created_at)
        SELECT id,class_id,user_id,pet_id,booking_ref,payment_status,created_at
        FROM class_enrolments_legacy_v2175;
      DROP TABLE class_enrolments_legacy_v2175;
      COMMIT;
    `);
  }catch(e){
    try{db.exec("ROLLBACK");}catch{}
    throw e;
  }finally{
    db.pragma("foreign_keys = ON");
  }
}
ensureClassEnrolmentSchema();

db.exec(`CREATE TABLE IF NOT EXISTS activity_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

function logActivity({userId=null,petId=null,classId=null,actorUserId=null,actorRole="system",action,details=""}){
  try{
    db.prepare("INSERT INTO activity_history(user_id,pet_id,class_id,actor_user_id,actor_role,action,details) VALUES(?,?,?,?,?,?,?)")
      .run(userId,petId,classId,actorUserId,actorRole,action,String(details||""));
  }catch(e){ console.error("Activity history write failed:",e.message); }
}

function notifyTrainer({userId=null,petId=null,bookingId=null,kind,message}){
  try{db.prepare("INSERT INTO trainer_notifications(user_id,pet_id,booking_id,kind,message) VALUES(?,?,?,?,?)").run(userId,petId,bookingId,kind,String(message||""));}catch(e){console.error("Notification write failed:",e.message)}
}
function addHoursIso(hours){return new Date(Date.now()+hours*3600000).toISOString()}
function expiryIsPast(value){return !!value && new Date(String(value).replace(" ","T")+(/Z$|[+-]\d\d:\d\d$/.test(String(value))?"":"Z")).getTime()<=Date.now()}
function nairobiWallNowIso(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const m=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}:${m.second}`;
}
function normalizeLegacyPendingBookings(){
  const rows=db.prepare("SELECT id,start_at,created_at,hold_expires_at,status FROM bookings WHERE payment_status='pending' AND status='confirmed'").all();
  const nowWall=wallClockMs(nairobiWallNowIso());
  for(const b of rows){
    if(wallClockMs(b.start_at)<=nowWall){
      db.prepare("UPDATE bookings SET status='expired',payment_status='expired' WHERE id=?").run(b.id);
      continue;
    }
    const hold=b.hold_expires_at||db.prepare("SELECT datetime(?,'+24 hours') AS h").get(b.created_at).h;
    if(expiryIsPast(hold)){
      db.prepare("UPDATE bookings SET status='expired',payment_status='expired',hold_expires_at=? WHERE id=?").run(hold,b.id);
    }else{
      db.prepare("UPDATE bookings SET status='pending_payment',hold_expires_at=? WHERE id=?").run(hold,b.id);
    }
  }
}
function expireTimedHolds(){
  try{
    normalizeLegacyPendingBookings();
    const expired=db.prepare("SELECT id,package_id FROM bookings WHERE payment_status='pending' AND hold_expires_at IS NOT NULL AND datetime(hold_expires_at)<=datetime('now') AND status IN ('provisional','pending_payment')").all();
    for(const b of expired)db.prepare("UPDATE bookings SET status='expired',payment_status='expired' WHERE id=?").run(b.id);
    const packs=db.prepare("SELECT id FROM booking_packages WHERE payment_status='pending' AND hold_expires_at IS NOT NULL AND datetime(hold_expires_at)<=datetime('now') AND status='provisional'").all();
    for(const p of packs){db.prepare("UPDATE booking_packages SET status='expired',payment_status='expired' WHERE id=?").run(p.id);db.prepare("UPDATE bookings SET status='expired',payment_status='expired' WHERE package_id=? AND payment_status='pending'").run(p.id)}
    db.prepare("UPDATE class_enrolments SET enrolment_status='expired',payment_status='expired' WHERE payment_status='pending' AND hold_expires_at IS NOT NULL AND datetime(hold_expires_at)<=datetime('now') AND enrolment_status='active'").run();
    db.prepare("UPDATE reschedule_requests SET status='expired' WHERE status='pending' AND datetime(hold_expires_at)<=datetime('now')").run();
  }catch(e){console.error("Hold expiry cleanup failed:",e.message)}
}
function futureClientCommitment(userId){
 const now=nairobiDateKey(0)+"T00:00:00";
 if(db.prepare("SELECT 1 FROM bookings WHERE user_id=? AND status IN ('confirmed','provisional','pending_payment') AND payment_status IN ('paid','demo_paid','credit_paid','pending') AND start_at>=? LIMIT 1").get(userId,now))return true;
 if(db.prepare("SELECT 1 FROM class_enrolments e JOIN classes c ON c.id=e.class_id WHERE e.user_id=? AND e.enrolment_status='active' AND e.payment_status IN ('paid','demo_paid','credit_paid','pending') AND c.end_date>=? LIMIT 1").get(userId,nairobiDateKey(0)))return true;
 if(db.prepare("SELECT 1 FROM booking_packages WHERE user_id=? AND status IN ('provisional','confirmed') AND payment_status IN ('pending','paid','demo_paid','credit_paid') AND EXISTS(SELECT 1 FROM bookings b WHERE b.package_id=booking_packages.id AND b.start_at>=?) LIMIT 1").get(userId,now))return true;
 return false;
}
function calculatedClientStatus(u){
 if(u.status_override&&['current','dormant','archived'].includes(u.status_override))return u.status_override;
 if(futureClientCommitment(u.id))return 'current';
 const basis=u.last_login_at||u.created_at; if(!basis)return 'current';
 const days=(Date.now()-new Date(String(basis).replace(' ','T')+'Z').getTime())/86400000;
 return days>=365?'archived':days>=90?'dormant':'current';
}
function clientCreditBalance(userId){
 const r=db.prepare("SELECT COALESCE(SUM(amount_delta),0) balance FROM client_credit_ledger WHERE user_id=?").get(userId);
 return Number(r?.balance||0);
}
function packageSessionRefundableAmount(booking){
 if(!booking?.package_id)return Math.max(0,Number(booking?.price||0));
 const pkg=db.prepare("SELECT package_price FROM booking_packages WHERE id=?").get(booking.package_id);
 if(!pkg)return 0;
 const rows=db.prepare("SELECT id FROM bookings WHERE package_id=? ORDER BY start_at,id").all(booking.package_id);
 const n=Math.max(1,rows.length),total=Math.max(0,Math.round(Number(pkg.package_price||0)));
 const base=Math.floor(total/n),remainder=total-(base*n),index=rows.findIndex(x=>Number(x.id)===Number(booking.id));
 return base+(index>=0&&index<remainder?1:0);
}
function addClientCredit(userId,amount,sourceType,sourceId,note){
 const value=Math.round(Number(amount||0));if(!Number.isFinite(value)||value<=0)throw new Error("Credit amount must be greater than zero.");
 db.prepare("INSERT INTO client_credit_ledger(user_id,amount_delta,source_type,source_id,note) VALUES(?,?,?,?,?)").run(userId,value,sourceType||null,sourceId||null,note||null);
 return clientCreditBalance(userId);
}

function normalizeMpesaReference(value){
 return String(value||"").replace(/\s+/g,"").toUpperCase();
}
function paymentTargetForClient(userId,body){
 const type=String(body.type||"private");
 if(type==="package"){
   let pkg=null;
   if(body.packageId)pkg=db.prepare("SELECT * FROM booking_packages WHERE id=? AND user_id=?").get(Number(body.packageId),userId);
   if(!pkg&&body.id){const b=db.prepare("SELECT package_id FROM bookings WHERE id=? AND user_id=?").get(Number(body.id),userId);if(b?.package_id)pkg=db.prepare("SELECT * FROM booking_packages WHERE id=? AND user_id=?").get(b.package_id,userId)}
   if(!pkg)return null;
   return {type:"package",row:pkg,total:Number(pkg.package_price||0),used:Number(pkg.credit_applied||0)};
 }
 if(type==="class"){
   const row=db.prepare(`SELECT e.*,c.price FROM class_enrolments e JOIN classes c ON c.id=e.class_id WHERE e.booking_ref=? AND e.user_id=?`).get(String(body.bookingRef||""),userId);
   if(!row)return null;
   return {type:"class",row,total:Number(row.price||0),used:Number(row.credit_applied||0)};
 }
 const row=db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=?").get(Number(body.id),userId);
 if(!row)return null;
 return {type:"private",row,total:Number(row.price||0),used:Number(row.credit_applied||0)};
}
function paymentTargetRemaining(target){
 return Math.max(0,Math.round(Number(target.total||0)-Number(target.used||0)));
}

function activeRescheduleHoldConflict(startAt,endAt,excludeBookingId=null){
 expireTimedHolds();
 return db.prepare("SELECT * FROM reschedule_requests WHERE status='pending' AND datetime(hold_expires_at)>datetime('now')").all().find(r=>Number(r.booking_id)!==Number(excludeBookingId||0)&&overlaps(startAt,endAt,r.proposed_start_at,r.proposed_buffer_end_at))||null;
}
function isFirstAppointmentForDog(petId,bookingId=null){
 if(!petId)return false; const rows=db.prepare("SELECT id,start_at FROM bookings WHERE pet_id=? AND status='confirmed' AND payment_status IN ('paid','demo_paid') ORDER BY start_at,id").all(petId); if(!rows.length)return true; return bookingId?Number(rows[0].id)===Number(bookingId):false;
}

try { db.exec("ALTER TABLE resources ADD COLUMN category TEXT DEFAULT 'General'"); } catch {}
try { db.exec("ALTER TABLE resources ADD COLUMN archived INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN refund_amount INTEGER"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN refund_confirmation_code TEXT"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN refund_recorded_at TEXT"); } catch {}
try { db.exec("ALTER TABLE service_availability_blocks ADD COLUMN public_message TEXT"); } catch {}
try { db.exec("ALTER TABLE service_availability_blocks ADD COLUMN private_note TEXT"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN vaccination_rejection_note TEXT"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN date_of_birth TEXT"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN gender TEXT"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN neutered_spayed INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN behavior_notes TEXT"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN medical_procedures TEXT"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN trainer_notes TEXT"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN create_token TEXT"); } catch {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_pets_user_create_token ON pets(user_id,create_token) WHERE create_token IS NOT NULL"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN archived INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN archived_at TEXT"); } catch {}
try { db.exec("ALTER TABLE classes ADD COLUMN min_age_months INTEGER"); } catch {}
try { db.exec("ALTER TABLE classes ADD COLUMN max_age_months INTEGER"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN enrolment_status TEXT NOT NULL DEFAULT 'active'"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN rejected_reason TEXT"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN rejected_at TEXT"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN refund_amount INTEGER"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN refund_confirmation_code TEXT"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN refund_recorded_at TEXT"); } catch {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_class_pet ON class_enrolments(class_id,pet_id)"); } catch {}
db.exec(`CREATE TABLE IF NOT EXISTS recurring_blocks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 weekdays TEXT NOT NULL,
 start_time TEXT NOT NULL,
 end_time TEXT NOT NULL,
 reason TEXT,
 start_date TEXT,
 end_date TEXT,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
try { db.exec("ALTER TABLE recurring_blocks ADD COLUMN start_date TEXT"); } catch {}
try { db.exec("ALTER TABLE recurring_blocks ADD COLUMN end_date TEXT"); } catch {}
try { db.exec("ALTER TABLE reviews ADD COLUMN starred INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE reviews ADD COLUMN retired INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN client_status TEXT NOT NULL DEFAULT 'current'"); } catch {}
try { db.exec("ALTER TABLE classes ADD COLUMN location_type TEXT NOT NULL DEFAULT 'arena'"); } catch {}
try { db.exec("ALTER TABLE classes ADD COLUMN location_name TEXT"); } catch {}
for(let d=0; d<7; d++){
  db.prepare("INSERT OR IGNORE INTO working_hours(weekday,enabled,start_time,end_time) VALUES(?,?,?,?)")
    .run(d,d===0?0:1,"08:00","17:00");
}
try { db.exec("ALTER TABLE pets ADD COLUMN vaccination_status TEXT NOT NULL DEFAULT 'not_provided'"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN vaccination_verified_at TEXT"); } catch {}
try { db.exec("ALTER TABLE pets ADD COLUMN vaccination_verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL"); } catch {}
try { db.exec("ALTER TABLE reviews ADD COLUMN photo_filename TEXT"); } catch {}
try { db.exec("ALTER TABLE reviews ADD COLUMN photo_consent INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE resource_access ADD COLUMN note TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN whatsapp_phone TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN mpesa_phone TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN newsletter_opt_in INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN kra_pin TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN status_override TEXT"); } catch {}
try { db.exec("UPDATE users SET whatsapp_phone=COALESCE(NULLIF(whatsapp_phone,''),phone), mpesa_phone=COALESCE(NULLIF(mpesa_phone,''),phone) WHERE role='client'"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN hold_expires_at TEXT"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN package_id INTEGER"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN reschedule_count INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN terms_accepted_at TEXT"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN manual_payment_code TEXT"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN manual_payment_amount INTEGER"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN manual_payment_status TEXT"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN hold_expires_at TEXT"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN terms_accepted_at TEXT"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN manual_payment_code TEXT"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN manual_payment_amount INTEGER"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN manual_payment_status TEXT"); } catch {}
try { db.exec("ALTER TABLE schedule_blocks ADD COLUMN silent_calendar INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN credit_amount INTEGER"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN credit_amount INTEGER"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN credit_applied INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN payment_received_at TEXT"); } catch {}
try { db.exec("ALTER TABLE bookings ADD COLUMN mpesa_receipt_number TEXT"); } catch {}
try { db.exec("ALTER TABLE booking_packages ADD COLUMN credit_applied INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE booking_packages ADD COLUMN payment_received_at TEXT"); } catch {}
try { db.exec("ALTER TABLE booking_packages ADD COLUMN mpesa_receipt_number TEXT"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN credit_applied INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN payment_received_at TEXT"); } catch {}
try { db.exec("ALTER TABLE class_enrolments ADD COLUMN mpesa_receipt_number TEXT"); } catch {}


db.exec(`CREATE TABLE IF NOT EXISTS booking_packages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
 name TEXT NOT NULL,
 service TEXT NOT NULL,
 location_type TEXT NOT NULL,
 address TEXT,
 package_price INTEGER NOT NULL DEFAULT 0,
 payment_status TEXT NOT NULL DEFAULT 'pending',
 status TEXT NOT NULL DEFAULT 'provisional',
 hold_expires_at TEXT,
 mpesa_request_id TEXT,
 reschedule_count INTEGER NOT NULL DEFAULT 0,
 manual_payment_code TEXT,
 manual_payment_amount INTEGER,
 manual_payment_status TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS client_credit_ledger (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 amount_delta INTEGER NOT NULL,
 source_type TEXT,
 source_id INTEGER,
 note TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_client_credit_user ON client_credit_ledger(user_id,created_at);
CREATE TABLE IF NOT EXISTS reschedule_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 old_start_at TEXT NOT NULL,
 proposed_start_at TEXT NOT NULL,
 proposed_end_at TEXT NOT NULL,
 proposed_buffer_end_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 hold_expires_at TEXT NOT NULL,
 client_note TEXT,
 trainer_note TEXT,
 decided_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS trainer_notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
 booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
 kind TEXT NOT NULL,
 message TEXT NOT NULL,
 resolved INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reschedule_hold ON reschedule_requests(status,hold_expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_open ON trainer_notifications(resolved,created_at);
`);
try { db.exec("UPDATE pets SET vaccination_status='pending' WHERE vaccination_status='not_provided' AND id IN (SELECT pet_id FROM pet_files WHERE kind='vaccination')"); } catch {}


function seed() {
  const adminEmail = process.env.ADMIN_EMAIL || "amy@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "change-me";
  const existing = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
  if (!existing) {
    db.prepare("INSERT INTO users(role,name,email,phone,password_hash) VALUES('trainer',?,?,?,?)")
      .run("Amy", adminEmail, "", bcrypt.hashSync(adminPassword, 12));
  }

  // Local trial account: makes account-separation testing repeatable.
  // This is never created in production.
  if (process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_CLIENT !== "false") {
    const demoEmail = "david@example.com";
    const demo = db.prepare("SELECT id FROM users WHERE email=?").get(demoEmail);
    if (!demo) {
      const clientId = db.prepare("INSERT INTO users(role,name,email,phone,password_hash) VALUES('client',?,?,?,?)")
        .run("David", demoEmail, "254700000000", bcrypt.hashSync("David123!", 12)).lastInsertRowid;
      db.prepare("INSERT INTO pets(user_id,name,species,breed,age,date_of_birth,notes) VALUES(?,?,?,?,?,?,?)")
        .run(clientId, "Doodle", "Dog", "Poodle mix", "Adult", null, "Local trial client and dog.");
    }
  }

  // V21.1 starts with no example classes. Amy creates courses herself.
}
seed();

if(process.env.NODE_ENV==="production") app.set("trust proxy",1);

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(cookieSession({
  name: SESSION_COOKIE,
  keys: [process.env.SESSION_SECRET || "development-only-secret-change-me"],
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV==="production",
  maxAge: 1000 * 60 * 60 * 24 * 30
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomUUID() + ext);
    }
  }),
  limits: {fileSize: 50 * 1024 * 1024}
});

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, PRIVATE_UPLOAD_DIR),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomUUID() + ext);
    }
  }),
  limits: {fileSize: 20 * 1024 * 1024, files: 7},
  fileFilter: (_, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  }
});

app.get("/api/health",(req,res)=>res.json({ok:true,version:APP_VERSION}));

app.use("/uploads", express.static(UPLOAD_DIR));
app.use((req,res,next)=>{if(req.path==="/"||req.path==="/index.html"||req.path.endsWith(".js")||req.path.endsWith(".css"))res.set("Cache-Control","no-store, no-cache, must-revalidate");next();});
app.use(express.static(path.join(__dirname,"public")));

function currentUser(req) {
  if (!req.session?.userId || req.session.appVersion !== APP_VERSION) return null;
  return db.prepare("SELECT id,role,name,email,phone,whatsapp_phone,mpesa_phone,newsletter_opt_in,kra_pin,last_login_at FROM users WHERE id=?").get(req.session.userId) || null;
}
function requireAuth(req,res,next) {
  const u=currentUser(req);
  if (!u) return res.status(401).json({error:"Please sign in."});
  req.user=u; next();
}
function requireTrainer(req,res,next) {
  const u=currentUser(req);
  if (!u || u.role!=="trainer") return res.status(403).json({error:"Trainer access required."});
  req.user=u; next();
}
function ref(prefix="CMC") {
  return `${prefix}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}
function isoDateTime(date,time) {
  return `${date}T${time}:00`;
}
// Treat ISO-like values as Nairobi wall-clock fields, not as the computer's local/UTC timezone.
function wallClockMs(value) {
  const text=String(value||"");
  const m=text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if(m) return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0));
  return Date.parse(text);
}
function wallClockIso(ms) {
  return new Date(ms).toISOString().slice(0,19);
}
function addMinutes(iso, mins) {
  return wallClockIso(wallClockMs(iso)+Number(mins||0)*60000);
}
function toDateInput(iso) {
  return String(iso||"").slice(0,16);
}
function overlaps(aStart,aEnd,bStart,bEnd) {
  return wallClockMs(aStart) < wallClockMs(bEnd) && wallClockMs(aEnd) > wallClockMs(bStart);
}
function nairobiDateKey(offsetDays=0){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const map=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  const base=Date.UTC(Number(map.year),Number(map.month)-1,Number(map.day));
  return new Date(base+Number(offsetDays||0)*86400000).toISOString().slice(0,10);
}
function privateBookingDateAllowed(value){
  const date=String(value||"").slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date>=nairobiDateKey(1);
}
function nextDateKey(date){
  const m=String(date||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return date;
  return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+1)).toISOString().slice(0,10);
}
function previousDateKey(date){
  const m=String(date||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return date;
  return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])-1)).toISOString().slice(0,10);
}

async function routeTravelMinutes(origin,destination) {
  if (!origin || !destination || !process.env.GOOGLE_MAPS_API_KEY) return 0;
  try {
    const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
    const response = await fetch(url, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "X-Goog-Api-Key":process.env.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask":"routes.duration"
      },
      body: JSON.stringify({
        origin:{address:origin},
        destination:{address:destination},
        travelMode:"DRIVE"
      })
    });
    if (!response.ok) return 0;
    const data=await response.json();
    const seconds=Number(String(data.routes?.[0]?.duration || "0s").replace("s",""));
    return Math.max(0,Math.ceil(seconds/60));
  } catch {
    return 0;
  }
}

async function initiateMpesa(phone,amount,accountRef) {
  if(process.env.ONLINE_TEST==="true") return {demo:true, checkoutRequestId:"DEMO-"+crypto.randomUUID()};
  const key=process.env.MPESA_CONSUMER_KEY;
  const secret=process.env.MPESA_CONSUMER_SECRET;
  const shortcode=process.env.MPESA_SHORTCODE;
  const passkey=process.env.MPESA_PASSKEY;
  const callback=process.env.MPESA_CALLBACK_URL;
  if (!key || !secret || !shortcode || !passkey || !callback) {
    return {demo:true, checkoutRequestId:"DEMO-"+crypto.randomUUID()};
  }

  const host=process.env.MPESA_ENV==="production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

  const basic=Buffer.from(`${key}:${secret}`).toString("base64");
  const tokenRes=await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`,{
    headers:{Authorization:`Basic ${basic}`}
  });
  const tokenData=await tokenRes.json();
  if (!tokenData.access_token) throw new Error("M-Pesa OAuth failed.");

  const timestamp=new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,14);
  const password=Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const res=await fetch(`${host}/mpesa/stkpush/v1/processrequest`,{
    method:"POST",
    headers:{
      Authorization:`Bearer ${tokenData.access_token}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      BusinessShortCode:shortcode,
      Password:password,
      Timestamp:timestamp,
      TransactionType:process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
      Amount:Math.max(1,Math.round(amount)),
      PartyA:phone,
      PartyB:shortcode,
      PhoneNumber:phone,
      CallBackURL:callback,
      AccountReference:accountRef,
      TransactionDesc:"The Custom Made Canine booking"
    })
  });
  const data=await res.json();
  if (!res.ok || data.ResponseCode !== "0") throw new Error(data.errorMessage || data.ResponseDescription || "M-Pesa request failed.");
  return {demo:false, ...data, checkoutRequestId:data.CheckoutRequestID};
}

// Auth
app.post("/api/auth/register", (req,res)=>{
 const {name,email,whatsappPhone,mpesaPhone,password,newsletterOptIn}=req.body;
 const whats=String(whatsappPhone||"").trim(),mpesa=String(mpesaPhone||"").trim()||whats,cleanEmail=String(email||"").trim().toLowerCase();
 if(!name||!cleanEmail||!whats||!password)return res.status(400).json({error:"Please complete name, WhatsApp number, email and password."});
 if(password.length<6)return res.status(400).json({error:"Password must be at least 6 characters."});
 if(db.prepare("SELECT id FROM users WHERE email=?").get(cleanEmail))return res.status(409).json({error:"That email is already registered. Please sign in instead.",code:"EMAIL_EXISTS"});
 let id=null;
 try{
  const hash=bcrypt.hashSync(password,12);
  id=db.prepare("INSERT INTO users(role,name,email,phone,whatsapp_phone,mpesa_phone,newsletter_opt_in,last_login_at,password_hash) VALUES('client',?,?,?,?,?,?,CURRENT_TIMESTAMP,?)").run(String(name).trim(),cleanEmail,whats,whats,mpesa,newsletterOptIn?1:0,hash).lastInsertRowid;
 }catch(e){
  const nowExists=db.prepare("SELECT id FROM users WHERE email=?").get(cleanEmail);
  if(nowExists)return res.status(409).json({error:"An account with this email has just been created. Please try signing in.",code:"EMAIL_JUST_CREATED"});
  console.error("Registration insert failed:",e);return res.status(500).json({error:"Your account could not be created. Please try again."});
 }
 try{logActivity({userId:Number(id),actorUserId:Number(id),actorRole:"client",action:"account_created",details:`New client account created — ${String(name).trim()}.`})}catch(e){console.error(e)}
 try{notifyTrainer({userId:Number(id),kind:"new_account",message:`New client account created — ${String(name).trim()}.`})}catch(e){console.error(e)}
 req.session={userId:id,appVersion:APP_VERSION};res.json({user:currentUser(req)});
});
app.post("/api/auth/login",(req,res)=>{
  const {email,password}=req.body;
  const u=db.prepare("SELECT * FROM users WHERE email=?").get(String(email||"").toLowerCase());
  if (!u || !u.password_hash || !bcrypt.compareSync(password||"",u.password_hash)) return res.status(401).json({error:"Incorrect email or password."});
  db.prepare("UPDATE users SET last_login_at=CURRENT_TIMESTAMP,status_override=NULL,client_status='current' WHERE id=?").run(u.id);
  if(u.role==='client')logActivity({userId:u.id,actorUserId:u.id,actorRole:'client',action:'client_login',details:'Client signed in.'});
  req.session = {userId:u.id, appVersion:APP_VERSION};
  res.json({user:currentUser(req)});
});
app.post("/api/auth/logout",(req,res)=>{req.session=null;res.json({ok:true})});
app.post("/api/auth/change-password",requireAuth,(req,res)=>{
  const current=String(req.body.currentPassword||"");
  const next=String(req.body.newPassword||"");
  if(next.length<6)return res.status(400).json({error:"New password must be at least 6 characters."});
  const u=db.prepare("SELECT password_hash FROM users WHERE id=?").get(req.user.id);
  if(!u || !bcrypt.compareSync(current,u.password_hash||"")) return res.status(401).json({error:"Current password is incorrect."});
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(next,12),req.user.id);
  res.json({ok:true});
});
app.post("/api/auth/forgot-password",(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase();
  if(!email) return res.status(400).json({error:"Please enter your email address."});
  const u=db.prepare("SELECT id FROM users WHERE email=? AND role='client'").get(email);
  // Trial-friendly local reset: return a one-time code only when the account exists.
  if(!u) return res.status(404).json({error:"We couldn't find a client account with that email address."});
  const token=crypto.randomBytes(24).toString("hex");
  const hash=crypto.createHash("sha256").update(token).digest("hex");
  db.prepare("UPDATE password_resets SET used=1 WHERE user_id=? AND used=0").run(u.id);
  db.prepare("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+30 minutes'))").run(u.id,hash);
  res.json({ok:true,resetCode:token,trial:true,message:"For this local trial, use the reset code shown below. In the live version this will be delivered securely."});
});
app.post("/api/auth/reset-password",(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase();
  const token=String(req.body.resetCode||"").trim();
  const next=String(req.body.newPassword||"");
  if(!email||!token||!next) return res.status(400).json({error:"Please complete all fields."});
  if(next.length<6) return res.status(400).json({error:"New password must be at least 6 characters."});
  const u=db.prepare("SELECT id FROM users WHERE email=? AND role='client'").get(email);
  if(!u) return res.status(400).json({error:"The reset details are not valid."});
  const hash=crypto.createHash("sha256").update(token).digest("hex");
  const r=db.prepare("SELECT id FROM password_resets WHERE user_id=? AND token_hash=? AND used=0 AND expires_at>datetime('now') ORDER BY id DESC LIMIT 1").get(u.id,hash);
  if(!r) return res.status(400).json({error:"That reset code is invalid or has expired."});
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(next,12),u.id);
  db.prepare("UPDATE password_resets SET used=1 WHERE id=?").run(r.id);
  res.json({ok:true});
});
app.get("/api/auth/me",(req,res)=>res.json({user:currentUser(req)}));

// Public
app.get("/api/classes",(req,res)=>{
  const rows=db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM class_enrolments e WHERE e.class_id=c.id AND e.enrolment_status='active' AND e.payment_status IN ('pending','paid','demo_paid','credit_paid')) enrolled
    FROM classes c ORDER BY c.start_date,c.start_time
  `).all().map(c=>({...c,remaining:Math.max(0,c.capacity-c.enrolled),sessions:db.prepare("SELECT * FROM class_sessions WHERE class_id=? ORDER BY session_date").all(c.id)}));
  res.json(rows);
});
app.get("/api/day-status",(req,res)=>{
 const date=String(req.query.date||""); if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Choose a date."});
 const restrictions={};
 for(const type of ["arena","home"]){
   const legacy=serviceBlockForDate(type,date),unified=fullDayScheduleBlock(type,date),row=unified||legacy;
   restrictions[type]=row?{available:false,reason:row.public_message||row.reason||"Temporarily unavailable",blockId:row.id}:{available:true,reason:""};
 }
 const amyBlock=fullDayScheduleBlock("amy",date);
 res.json({working:workingWindowForDate(date),restrictions,amyBlock:amyBlock?{reason:amyBlock.public_message||amyBlock.reason||"Amy is unavailable on this date."}:null,scheduleBlocks:activeScheduleBlocks().filter(x=>scheduleBlockAppliesOnDate(x,date)&&!x.silent_calendar)});
});
app.get("/api/reviews",(req,res)=>{
  const rows=db.prepare("SELECT r.id,r.rating,r.text,r.created_at,r.photo_filename,r.photo_consent,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.status='approved' ORDER BY r.created_at DESC LIMIT 6").all();
  res.json(rows.map(r=>({...r,photo_url:(r.photo_filename&&r.photo_consent)?`/api/reviews/${r.id}/photo`:null})));
});
app.get("/api/reviews/:id/photo",(req,res)=>{
  const r=db.prepare("SELECT id,status,photo_filename,photo_consent FROM reviews WHERE id=?").get(req.params.id);
  if(!r||r.status!=='approved'||!r.photo_filename||!r.photo_consent)return res.status(404).end();
  const full=path.join(PRIVATE_UPLOAD_DIR,r.photo_filename); if(!fs.existsSync(full))return res.status(404).end(); res.sendFile(full);
});
app.get("/api/config",(req,res)=>res.json({
  appName:process.env.APP_NAME||"The Custom Made Canine",
  whatsapp:process.env.WHATSAPP_NUMBER||"",
  mapsEnabled:Boolean(process.env.GOOGLE_MAPS_API_KEY),
  onlineTest:process.env.ONLINE_TEST==="true",
  serviceStatus:currentServiceStatus()
}));

// Location/service availability
function activeServiceBlocks(locationType){
  return db.prepare("SELECT * FROM service_availability_blocks WHERE active=1 AND location_type=? ORDER BY created_at DESC").all(locationType)
    .map(b=>({...b,public_message:b.public_message||b.reason||"Temporarily unavailable"}));
}
function serviceBlockForDate(locationType,date){
  const ds=wallClockMs(`${date}T00:00:00`),de=wallClockMs(`${nextDateKey(date)}T00:00:00`);
  return activeServiceBlocks(locationType).find(b=>{
    const bs=b.start_at?wallClockMs(b.start_at):-Infinity,be=b.end_at?wallClockMs(b.end_at):Infinity;
    return ds<be&&de>bs;
  })||null;
}
function serviceUnavailable(locationType,startAt,endAt){
  const startMs=wallClockMs(startAt), endMs=wallClockMs(endAt||startAt);
  return activeServiceBlocks(locationType).some(b=>{
    const bs=b.start_at?wallClockMs(b.start_at):-Infinity;
    const be=b.end_at?wallClockMs(b.end_at):Infinity;
    return startMs<be && endMs>bs;
  });
}
function serviceStatusForDate(date){
  const result={arena:{available:true,reason:""},home:{available:true,reason:""}};
  for(const type of ["arena","home"]){
    const block=serviceBlockForDate(type,date);
    if(block)result[type]={available:false,reason:block.public_message||block.reason||"Temporarily unavailable",blockId:block.id};
  }
  return result;
}
function currentServiceStatus(){ return serviceStatusForDate(nairobiDateKey(0)); }
function activeScheduleBlocks(){return db.prepare("SELECT * FROM schedule_blocks WHERE active=1 ORDER BY start_date,start_time,id").all()}
function scheduleBlockAppliesOnDate(row,date){return !!row&&row.active!==0&&date>=row.start_date&&date<=row.end_date}
function scheduleBlockTimes(row,date){return {start:`${date}T${row.all_day?"00:00:00":String(row.start_time||"00:00")+":00"}`,end:`${date}T${row.all_day?"23:59:59":String(row.end_time||"23:59")+":00"}`}}
function scheduleBlockConflict(locationType,startAt,endAt){
 const date=String(startAt||"").slice(0,10),target=locationType;
 return activeScheduleBlocks().find(r=>{
   if(!scheduleBlockAppliesOnDate(r,date))return false;
   if(r.target!=="amy"&&r.target!==target)return false;
   const x=scheduleBlockTimes(r,date);return overlaps(startAt,endAt,x.start,x.end);
 })||null;
}
function fullDayScheduleBlock(target,date){return activeScheduleBlocks().find(r=>scheduleBlockAppliesOnDate(r,date)&&r.all_day&&(r.target==="amy"||r.target===target))||null}

function dailyLocationPlan(date){
  return db.prepare("SELECT id,plan_date,start_time,end_time,arena_enabled,home_enabled FROM daily_location_plan WHERE plan_date=? ORDER BY start_time").all(date);
}
function locationPlanAllows(){return true}

function workingWindowForDate(dateStr){
  const ex=db.prepare("SELECT * FROM working_hour_exceptions WHERE exception_date=?").get(dateStr);
  if(ex) return {enabled:!!ex.enabled,start_time:ex.start_time,end_time:ex.end_time,note:ex.note||"",exception:true};
  const d=new Date(`${dateStr}T12:00:00`);
  const row=db.prepare("SELECT * FROM working_hours WHERE weekday=?").get(d.getDay());
  return row?{enabled:!!row.enabled,start_time:row.start_time,end_time:row.end_time,exception:false}:{enabled:true,start_time:"08:00",end_time:"17:00"};
}
function withinWorkingHours(startAt,endAt){
  const date=String(startAt).slice(0,10);
  const w=workingWindowForDate(date);
  if(!w.enabled||!w.start_time||!w.end_time)return false;
  const ws=wallClockMs(`${date}T${w.start_time}:00`);
  const we=wallClockMs(`${date}T${w.end_time}:00`);
  return wallClockMs(startAt)>=ws && wallClockMs(endAt)<=we;
}

function petAgeMonthsOn(dob,onDate){
 if(!dob)return null; const a=new Date(`${dob}T12:00:00`),b=new Date(`${onDate}T12:00:00`);
 if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return null;
 let m=(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth(); if(b.getDate()<a.getDate())m--; return Math.max(0,m);
}
function recurringBlockAppliesOnDate(row,date){
 if(row.start_date&&date<row.start_date)return false;
 if(row.end_date&&date>row.end_date)return false;
 const wd=new Date(`${date}T12:00:00`).getDay();
 return String(row.weekdays||"").split(",").map(Number).includes(wd);
}
function recurringBlockConflict(startAt,endAt){
 const date=String(startAt).slice(0,10),st=String(startAt).slice(11,16),en=String(endAt).slice(11,16);
 return db.prepare("SELECT * FROM recurring_blocks WHERE active=1").all().find(r=>recurringBlockAppliesOnDate(r,date)&&st<r.end_time&&en>r.start_time)||null;
}

// Availability
app.get("/api/availability",async(req,res)=>{
  expireTimedHolds();
  const {date,locationType,address,service,extraMinutes}=req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({error:"Please provide a complete date."});
  if(!privateBookingDateAllowed(`${date}T00:00:00`))return res.status(400).json({error:"Private appointments can be booked from tomorrow onwards."});
  if (!service || !["consultation","standard","extra"].includes(service)) return res.status(400).json({error:"Please choose a training type."});
  if (!["arena","home"].includes(locationType)) return res.status(400).json({error:"Please choose a location."});

  const durations={consultation:90,standard:60,extra:90};
  const duration=durations[service] || 60;
  const extra=Math.max(0,Number(extraMinutes||0));
  const total=duration+extra;
  const candidates=[];
  const working=workingWindowForDate(date);
  if(!working.enabled||!working.start_time||!working.end_time)return res.json([]);
  const ws=wallClockMs(isoDateTime(date,working.start_time)),we=wallClockMs(isoDateTime(date,working.end_time));
  for(let cursor=ws;cursor<we;cursor+=30*60000){
      const start=wallClockIso(cursor);
      const end=addMinutes(start,total);
      if(new Date(end).getDate()!==new Date(start).getDate()) continue;

      let travel=0;
      if(locationType==="home" && address) travel=await routeTravelMinutes(address,"Nairobi, Kenya");
      const buffer=locationType==="arena"?0:Math.max(30,travel);
      const bufferEnd=addMinutes(end,buffer);

      if(serviceUnavailable(locationType,start,bufferEnd)) continue;
      if(scheduleBlockConflict(locationType,start,bufferEnd)) continue;
      const existing=db.prepare("SELECT start_at,buffer_end_at FROM bookings WHERE status NOT IN ('cancelled','expired') AND payment_status IN ('pending','paid','demo_paid','credit_paid')").all();
      const blocked=db.prepare("SELECT start_at,end_at FROM availability_blocks").all();
      const classSessions=db.prepare("SELECT session_date,start_time,end_time FROM class_sessions").all();

      const badBooking=existing.some(x=>overlaps(start,bufferEnd,x.start_at,x.buffer_end_at));
      const badRescheduleHold=!!activeRescheduleHoldConflict(start,bufferEnd);
      const badBlock=blocked.some(x=>overlaps(start,bufferEnd,x.start_at,x.end_at));
      const badClass=classSessions.some(x=>overlaps(start,bufferEnd,isoDateTime(x.session_date,x.start_time),isoDateTime(x.session_date,x.end_time)));
      const recurring=recurringBlockConflict(start,end);
      if(wallClockMs(end)<=we && !badBooking && !badBlock && !badClass && !recurring && !badRescheduleHold) candidates.push({start,end,travelMinutes:travel,bufferMinutes:buffer});
  }
  res.json(candidates);
});

// Booking
app.post("/api/bookings/private",requireAuth,async(req,res)=>{
  const {petId,service,locationType,address,startAt,notes,termsAccepted}=req.body;
  if(!["consultation","standard","extra"].includes(service)) return res.status(400).json({error:"Invalid service."});
  if(!termsAccepted)return res.status(400).json({error:"Please acknowledge the Booking Terms & Cancellation Policy before confirming."});
  if(!["arena","home"].includes(locationType)) return res.status(400).json({error:"Invalid location."});
  if(locationType==="home" && !address) return res.status(400).json({error:"Please enter the home address."});
  if(!startAt) return res.status(400).json({error:"Please choose a time."});
  if(!privateBookingDateAllowed(startAt)) return res.status(409).json({error:"Private appointments can be booked from tomorrow onwards."});
  if(!petId) return res.status(400).json({error:"Please select which dog this training is for."});
  const bookingPet=db.prepare("SELECT id,name,archived FROM pets WHERE id=? AND user_id=?").get(petId,req.user.id);
  if(!bookingPet) return res.status(400).json({error:"Please select one of your dogs."});
  if(bookingPet.archived) return res.status(409).json({error:"That dog is archived. Restore the dog in the Client Portal before making a new booking."});

  const base={consultation:90,standard:60,extra:90}[service];
  const travel=locationType==="home" ? await routeTravelMinutes(address,"Nairobi, Kenya") : 0;
  const duration=base;
  const endAt=addMinutes(startAt,duration);
  const buffer=locationType==="arena"?0:Math.max(30,travel);
  const bufferEnd=addMinutes(endAt,buffer);

  if(!withinWorkingHours(startAt,endAt)) return res.status(409).json({error:"This appointment is outside Amy's available working hours."});
  if(recurringBlockConflict(startAt,endAt)) return res.status(409).json({error:"This time is blocked in Amy's recurring schedule."});
  if(serviceUnavailable(locationType,startAt,bufferEnd)) return res.status(409).json({error:locationType==="home"?"Home visits are unavailable at that time.":"Amy's arena is unavailable at that time."});
  const unifiedBlock=scheduleBlockConflict(locationType,startAt,bufferEnd);if(unifiedBlock)return res.status(409).json({error:unifiedBlock.public_message||unifiedBlock.reason||"That time is blocked."});
  const existing=db.prepare("SELECT start_at,buffer_end_at FROM bookings WHERE status!='cancelled' AND payment_status IN ('pending','paid','demo_paid','credit_paid')").all();
  if(existing.some(x=>overlaps(startAt,bufferEnd,x.start_at,x.buffer_end_at))||activeRescheduleHoldConflict(startAt,bufferEnd)) return res.status(409).json({error:"That time is no longer available."});
  const blocks=db.prepare("SELECT start_at,end_at FROM availability_blocks").all();
  if(blocks.some(x=>overlaps(startAt,bufferEnd,x.start_at,x.end_at))) return res.status(409).json({error:"That time is blocked."});
  const classSessions=db.prepare("SELECT session_date,start_time,end_time FROM class_sessions").all();
  if(classSessions.some(x=>overlaps(startAt,bufferEnd,isoDateTime(x.session_date,x.start_time),isoDateTime(x.session_date,x.end_time)))) return res.status(409).json({error:"That time overlaps a class session."});

  const price={consultation:5000,standard:4000,extra:6000}[service];
  const bookingRef=ref("PRV");
  const holdExpires=addHoursIso(24);
  const id=db.prepare(`
    INSERT INTO bookings(user_id,pet_id,booking_ref,service,location_type,address,start_at,end_at,buffer_end_at,travel_minutes,price,payment_status,status,notes,hold_expires_at,terms_accepted_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
  `).run(req.user.id,petId||null,bookingRef,service,locationType,address||null,startAt,endAt,bufferEnd,travel,price,"pending","pending_payment",notes||null,holdExpires).lastInsertRowid;
  logActivity({userId:req.user.id,petId:Number(petId),actorUserId:req.user.id,actorRole:'client',action:'booking_started',details:`Private booking ${bookingRef} created; payment pending.`});
  const creditAvailable=clientCreditBalance(req.user.id);
  if(creditAvailable>0){
    return res.json({bookingRef,id,amount:price,holdExpiresAt:holdExpires,firstAppointment:isFirstAppointmentForDog(petId),creditAvailable,creditApplied:0,paymentStartRequired:true,mpesaDemo:false,mpesaMessage:"Client credit is available. Apply it first, or continue with M-Pesa."});
  }
  try {
    const payPhone=req.user.mpesa_phone||req.user.phone;
    const mpesa=await initiateMpesa(payPhone,price,bookingRef);
    db.prepare("UPDATE bookings SET mpesa_request_id=? WHERE id=?").run(mpesa.checkoutRequestId,id);
    res.json({bookingRef,id,amount:price,holdExpiresAt:holdExpires,firstAppointment:isFirstAppointmentForDog(petId),creditAvailable:0,creditApplied:0,mpesaDemo:mpesa.demo,mpesaMessage:mpesa.demo?"Demo payment mode: complete the trial payment.":"M-Pesa prompt sent. Approve it on your phone."});
  } catch(e) {
    res.status(502).json({error:(e.message||"Could not start M-Pesa payment.")+" Your booking is still held for 24 hours. Retry the STK Push or use the manual fallback on the payment screen.",bookingRef,id,amount:price,holdExpiresAt:holdExpires,firstAppointment:isFirstAppointmentForDog(petId),creditAvailable:0,creditApplied:0,paymentPending:true});
  }
});

app.post("/api/bookings/:ref/demo-pay",requireAuth,(req,res)=>{
  if(!String(req.params.ref).startsWith("PRV-")) return res.status(400).json({error:"Demo payment unavailable."});
  const r=db.prepare("UPDATE bookings SET payment_status='demo_paid',status='confirmed',payment_received_at=CURRENT_TIMESTAMP WHERE booking_ref=? AND user_id=? AND payment_status='pending'").run(req.params.ref,req.user.id);
  if(!r.changes) return res.status(404).json({error:"Booking not found."});
  res.json({ok:true});
});

app.get("/api/my/bookings",requireAuth,(req,res)=>{
  expireTimedHolds();
  const privateBookings=db.prepare(`SELECT b.*,p.name AS pet_name,bp.name package_name,bp.package_price,bp.status package_status
    FROM bookings b LEFT JOIN pets p ON p.id=b.pet_id LEFT JOIN booking_packages bp ON bp.id=b.package_id
    WHERE b.user_id=? ORDER BY b.start_at`).all(req.user.id).map(b=>({...b,first_appointment:isFirstAppointmentForDog(b.pet_id,b.id),refundable_amount:packageSessionRefundableAmount(b)}));
  const classBookings=db.prepare(`SELECT e.*,c.title,c.description,c.start_date,c.end_date,c.start_time,c.end_time,p.name AS pet_name
    FROM class_enrolments e JOIN classes c ON c.id=e.class_id LEFT JOIN pets p ON p.id=e.pet_id
    WHERE e.user_id=? ORDER BY c.start_date`).all(req.user.id);
  const packages=db.prepare("SELECT bp.*,p.name pet_name,(SELECT COUNT(*) FROM bookings b WHERE b.package_id=bp.id) session_count FROM booking_packages bp LEFT JOIN pets p ON p.id=bp.pet_id WHERE bp.user_id=? ORDER BY bp.created_at DESC").all(req.user.id);
  const rescheduleRequests=db.prepare("SELECT rr.*,b.booking_ref FROM reschedule_requests rr JOIN bookings b ON b.id=rr.booking_id WHERE rr.user_id=? ORDER BY rr.created_at DESC").all(req.user.id);
  res.json({privateBookings,classBookings,packages,rescheduleRequests});
});
app.post("/api/my/bookings/:id/reschedule",requireAuth,(req,res)=>createClientRescheduleRequest(req,res));
app.post("/api/my/bookings/:id/cancel",requireAuth,(req,res)=>cancelBookingInternal(req,res,"client"));
app.post("/api/my/class-enrolments/:id/cancel",requireAuth,(req,res)=>{
 const e=db.prepare(`SELECT e.*,c.title,c.price,p.name pet_name FROM class_enrolments e JOIN classes c ON c.id=e.class_id LEFT JOIN pets p ON p.id=e.pet_id WHERE e.id=? AND e.user_id=?`).get(req.params.id,req.user.id);
 if(!e)return res.status(404).json({error:"Class enrolment not found."});
 if(e.enrolment_status!=="active")return res.status(409).json({error:"This class enrolment is already cancelled."});
 const note=String(req.body.note||"").trim();const paid=["paid","demo_paid","credit_paid"].includes(e.payment_status);
 db.prepare("UPDATE class_enrolments SET enrolment_status='cancelled_by_client',rejected_reason=?,rejected_at=CURRENT_TIMESTAMP,rejected_by=?,payment_status=? WHERE id=?").run(note||"Cancelled by client",req.user.id,paid?"refund_pending":"cancelled",e.id);
 logActivity({userId:req.user.id,petId:e.pet_id,classId:e.class_id,actorUserId:req.user.id,actorRole:"client",action:"class_cancel_requested",details:`${e.pet_name||"Dog"} cancelled from ${e.title}.${note?` Note: ${note}`:""}${paid?" Refund decision required.":""}`});
 res.json({ok:true,refundPending:paid});
});
app.get("/api/my/training-notes",requireAuth,(req,res)=>res.json(db.prepare("SELECT n.*,p.name pet_name FROM training_notes n LEFT JOIN pets p ON p.id=n.pet_id WHERE n.user_id=? AND n.client_visible=1 ORDER BY n.created_at DESC").all(req.user.id)));

app.post("/api/classes/:id/enrol",requireAuth,(req,res)=>{
  expireTimedHolds();
  if(!req.body.termsAccepted)return res.status(400).json({error:"Please acknowledge the Booking Terms & Cancellation Policy before confirming."});
  const c=db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if(!c) return res.status(404).json({error:"Class not found."});
  const count=db.prepare("SELECT COUNT(*) c FROM class_enrolments WHERE class_id=? AND enrolment_status='active' AND payment_status IN ('pending','paid','demo_paid','credit_paid')").get(c.id).c;
  if(count>=c.capacity) return res.status(409).json({error:"This class is full."});
  const firstSession=db.prepare("SELECT session_date FROM class_sessions WHERE class_id=? ORDER BY session_date LIMIT 1").get(c.id);
  if(!firstSession) return res.status(400).json({error:"Class schedule is incomplete."});
  if(new Date(firstSession.session_date+"T23:59:59") < new Date()) return res.status(400).json({error:"This course has already started."});

  const petId=Number(req.body.petId);
  if(!petId) return res.status(400).json({error:"Please select which dog this class is for."});
  const pet=db.prepare("SELECT id,name,date_of_birth,archived FROM pets WHERE id=? AND user_id=?").get(petId,req.user.id);
  if(!pet) return res.status(400).json({error:"Please select one of your dogs."});
  if(pet.archived) return res.status(409).json({error:`${pet.name} is archived. Restore the dog before joining a class.`});
  if(db.prepare("SELECT id,enrolment_status FROM class_enrolments WHERE class_id=? AND pet_id=?").get(c.id,petId)) {
    return res.status(409).json({error:`${pet.name} already has an enrolment record for this course.`});
  }

  const minAge=c.min_age_months==null?null:Number(c.min_age_months);
  const maxAge=c.max_age_months==null?null:Number(c.max_age_months);
  if(minAge!=null||maxAge!=null){
    if(!pet.date_of_birth) return res.status(409).json({
      error:`Please add ${pet.name}'s date of birth before enrolling in this age-restricted course.`,
      code:"DOB_REQUIRED",
      petId:pet.id
    });
    const months=petAgeMonthsOn(pet.date_of_birth,c.start_date);
    if(months==null) return res.status(409).json({error:`${pet.name}'s date of birth could not be checked. Please correct the dog profile first.`});
    if((minAge!=null&&months<minAge)||(maxAge!=null&&months>maxAge)){
      const range=minAge!=null&&maxAge!=null?`${minAge}–${maxAge} months`:minAge!=null?`${minAge}+ months`:`up to ${maxAge} months`;
      return res.status(409).json({
        error:`This course is for dogs aged ${range} at the course start. ${pet.name} will be ${months} month${months===1?"":"s"} old.`,
        code:"AGE_RESTRICTED",
        petId:pet.id,
        ageMonths:months
      });
    }
  }

  const bookingRef=ref("CLS");
  try {
    db.prepare("INSERT INTO class_enrolments(class_id,user_id,pet_id,booking_ref,payment_status,enrolment_status,hold_expires_at,terms_accepted_at) VALUES(?,?,?,?,?,'active',?,CURRENT_TIMESTAMP)")
      .run(c.id,req.user.id,petId,bookingRef,"pending",addHoursIso(24));
    logActivity({userId:req.user.id,petId,classId:c.id,actorUserId:req.user.id,actorRole:"client",action:"class_enrolled",details:`${pet.name} enrolled in ${c.title}.`});
    res.json({bookingRef,amount:c.price,creditAvailable:clientCreditBalance(req.user.id),creditApplied:0,mpesaDemo:true,mpesaMessage:"Trial mode: complete the trial payment to confirm enrolment."});
  } catch(e) {
    res.status(409).json({error:`${pet.name} already has an enrolment record for this course.`});
  }
});
app.post("/api/classes/:ref/demo-pay",requireAuth,(req,res)=>{
  const r=db.prepare("UPDATE class_enrolments SET payment_status='demo_paid',payment_received_at=CURRENT_TIMESTAMP WHERE booking_ref=? AND user_id=? AND payment_status='pending' AND enrolment_status='active'").run(req.params.ref,req.user.id);
  if(!r.changes) return res.status(404).json({error:"Enrolment not found."});
  res.json({ok:true});
});

// Client profile
function petDetailsForUser(userId,includeTrainer=false) {
  return db.prepare(`
    SELECT p.*,
      (SELECT id FROM pet_files f WHERE f.pet_id=p.id AND f.kind='photo' ORDER BY f.created_at DESC LIMIT 1) AS photo_file_id,
      (SELECT COUNT(*) FROM pet_files f WHERE f.pet_id=p.id AND f.kind='vaccination') AS vaccination_count,
      p.vaccination_status,
      p.vaccination_verified_at
    FROM pets p WHERE p.user_id=? ORDER BY p.archived, p.name
  `).all(userId).map(p => {
    const row={...p,photo_url:p.photo_file_id?`/api/pets/${p.id}/photo`:null};
    if(!includeTrainer) delete row.trainer_notes;
    return row;
  });
}

app.get("/api/my/profile",requireAuth,(req,res)=>{
  const user=db.prepare("SELECT id,role,name,email,phone,whatsapp_phone,mpesa_phone,newsletter_opt_in,kra_pin,last_login_at FROM users WHERE id=?").get(req.user.id);
  res.json({user,pets:petDetailsForUser(req.user.id),creditBalance:clientCreditBalance(req.user.id),creditHistory:db.prepare("SELECT * FROM client_credit_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 20").all(req.user.id)});
});
app.put("/api/my/profile",requireAuth,(req,res)=>{
  const before=db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  const name=String(req.body.name||before.name).trim(), whats=String(req.body.whatsappPhone??before.whatsapp_phone??before.phone??"").trim(), mpesa=String(req.body.mpesaPhone??before.mpesa_phone??whats).trim()||whats, kra=String(req.body.kraPin??before.kra_pin??"").trim()||null;
  const newsletter=req.body.newsletterOptIn===true||req.body.newsletterOptIn===1||String(req.body.newsletterOptIn)==='true'?1:0;
  db.prepare("UPDATE users SET name=?,phone=?,whatsapp_phone=?,mpesa_phone=?,newsletter_opt_in=?,kra_pin=? WHERE id=?").run(name,whats,whats,mpesa,newsletter,kra,req.user.id);
  const changes=[]; if(before.name!==name)changes.push('name'); if((before.whatsapp_phone||before.phone||'')!==whats)changes.push('WhatsApp number'); if((before.mpesa_phone||before.phone||'')!==mpesa)changes.push('M-Pesa number'); if(Number(before.newsletter_opt_in||0)!==newsletter)changes.push('newsletter preference'); if((before.kra_pin||'')!==(kra||''))changes.push('billing/KRA details');
  if(changes.length)logActivity({userId:req.user.id,actorUserId:req.user.id,actorRole:'client',action:'account_edited',details:`Client updated ${changes.join(', ')}.`});
  res.json({user:db.prepare("SELECT id,role,name,email,phone,whatsapp_phone,mpesa_phone,newsletter_opt_in,kra_pin,last_login_at FROM users WHERE id=?").get(req.user.id)});
});
app.post("/api/my/pets",requireAuth,imageUpload.fields([
  {name:"dogPhoto",maxCount:1},
  {name:"vaccinationPages",maxCount:6}
]),(req,res)=>{
  const {name,species,breed,age,dateOfBirth,notes,gender,neuteredSpayed,behaviorNotes,medicalProcedures,createToken}=req.body;
  if(!name) return res.status(400).json({error:"Dog name required."});
  const cleanToken=String(createToken||"").trim()||null;
  if(cleanToken){
    const existing=db.prepare("SELECT id FROM pets WHERE user_id=? AND create_token=?").get(req.user.id,cleanToken);
    if(existing)return res.json(petDetailsForUser(req.user.id).find(p=>p.id===Number(existing.id)));
  }
  const cleanGender=["male","female"].includes(String(gender||"").toLowerCase())?String(gender).toLowerCase():null;
  let id;
  try{
    id=db.prepare("INSERT INTO pets(user_id,name,species,breed,age,date_of_birth,notes,gender,neutered_spayed,behavior_notes,medical_procedures,create_token) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(req.user.id,name,species||"Dog",breed||"",age||"",dateOfBirth||null,notes||"",cleanGender,neuteredSpayed?1:0,String(behaviorNotes||""),String(medicalProcedures||""),cleanToken).lastInsertRowid;
  }catch(err){
    if(cleanToken&&String(err.message||"").includes("UNIQUE")){
      const existing=db.prepare("SELECT id FROM pets WHERE user_id=? AND create_token=?").get(req.user.id,cleanToken);
      if(existing)return res.json(petDetailsForUser(req.user.id).find(p=>p.id===Number(existing.id)));
    }
    throw err;
  }
  const add=db.prepare("INSERT INTO pet_files(pet_id,kind,original_name,mime_type,file_path) VALUES(?,?,?,?,?)");
  const dogPhoto=req.files?.dogPhoto?.[0];
  if(dogPhoto) add.run(id,"photo",dogPhoto.originalname,dogPhoto.mimetype,dogPhoto.filename);
  const vaccinationFiles=req.files?.vaccinationPages||[];
  for(const f of vaccinationFiles) add.run(id,"vaccination",f.originalname,f.mimetype,f.filename);
  if(vaccinationFiles.length) db.prepare("UPDATE pets SET vaccination_status='pending', vaccination_verified_at=NULL, vaccination_verified_by=NULL, vaccination_rejection_note=NULL WHERE id=?").run(id);
  logActivity({userId:req.user.id,petId:Number(id),actorUserId:req.user.id,actorRole:"client",action:"dog_added",details:`Dog profile created: ${name}.`});
  res.json(petDetailsForUser(req.user.id).find(p=>p.id===Number(id)));
});


app.put("/api/my/pets/:id",requireAuth,(req,res)=>{
  const pet=db.prepare("SELECT * FROM pets WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
  if(!pet)return res.status(404).json({error:"Dog not found."});
  const name=String(req.body.name||"").trim(),breed=String(req.body.breed||"").trim(),dateOfBirth=String(req.body.dateOfBirth||"").trim()||null,notes=String(req.body.notes||"");
  const gender=["male","female"].includes(String(req.body.gender||"").toLowerCase())?String(req.body.gender).toLowerCase():null;
  const neuteredSpayed=req.body.neuteredSpayed?1:0,behaviorNotes=String(req.body.behaviorNotes||""),medicalProcedures=String(req.body.medicalProcedures||"");
  if(!name)return res.status(400).json({error:"Dog name required."});
  if(dateOfBirth&&!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))return res.status(400).json({error:"Choose a valid date of birth."});
  if(dateOfBirth&&dateOfBirth>new Date().toISOString().slice(0,10))return res.status(400).json({error:"Date of birth cannot be in the future."});
  db.prepare("UPDATE pets SET name=?,breed=?,date_of_birth=?,notes=?,gender=?,neutered_spayed=?,behavior_notes=?,medical_procedures=? WHERE id=?").run(name,breed,dateOfBirth,notes,gender,neuteredSpayed,behaviorNotes,medicalProcedures,pet.id);
  logActivity({userId:req.user.id,petId:pet.id,actorUserId:req.user.id,actorRole:"client",action:"dog_edited",details:`Dog details updated: ${pet.name} → ${name}.`});
  res.json(petDetailsForUser(req.user.id).find(p=>p.id===Number(pet.id)));
});

app.post("/api/my/pets/:id/archive",requireAuth,(req,res)=>{
  const pet=db.prepare("SELECT * FROM pets WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
  if(!pet)return res.status(404).json({error:"Dog not found."});
  db.prepare("UPDATE pets SET archived=1,archived_at=CURRENT_TIMESTAMP WHERE id=?").run(pet.id);
  logActivity({userId:req.user.id,petId:pet.id,actorUserId:req.user.id,actorRole:"client",action:"dog_archived",details:`${pet.name} archived. Existing history and bookings were kept.`});
  res.json({ok:true});
});

app.post("/api/my/pets/:id/restore",requireAuth,(req,res)=>{
  const pet=db.prepare("SELECT * FROM pets WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
  if(!pet)return res.status(404).json({error:"Dog not found."});
  db.prepare("UPDATE pets SET archived=0,archived_at=NULL WHERE id=?").run(pet.id);
  logActivity({userId:req.user.id,petId:pet.id,actorUserId:req.user.id,actorRole:"client",action:"dog_restored",details:`${pet.name} restored to active dogs.`});
  res.json({ok:true});
});

app.post("/api/my/pets/:id/files",requireAuth,imageUpload.fields([
  {name:"dogPhoto",maxCount:1},
  {name:"vaccinationPages",maxCount:6}
]),(req,res)=>{
  const pet=db.prepare("SELECT * FROM pets WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
  if(!pet) return res.status(404).json({error:"Dog not found."});
  const add=db.prepare("INSERT INTO pet_files(pet_id,kind,original_name,mime_type,file_path) VALUES(?,?,?,?,?)");
  const dogPhoto=req.files?.dogPhoto?.[0];
  if(dogPhoto) {
    const old=db.prepare("SELECT file_path FROM pet_files WHERE pet_id=? AND kind='photo'").all(pet.id);
    for(const f of old){ try{fs.unlinkSync(path.join(PRIVATE_UPLOAD_DIR,f.file_path));}catch{} }
    db.prepare("DELETE FROM pet_files WHERE pet_id=? AND kind='photo'").run(pet.id);
    add.run(pet.id,"photo",dogPhoto.originalname,dogPhoto.mimetype,dogPhoto.filename);
  }
  const vaccinationFiles=req.files?.vaccinationPages||[];
  if(vaccinationFiles.length && pet.vaccination_status==="rejected"){
    const oldVaccinations=db.prepare("SELECT file_path FROM pet_files WHERE pet_id=? AND kind='vaccination'").all(pet.id);
    for(const f of oldVaccinations){try{fs.unlinkSync(path.join(PRIVATE_UPLOAD_DIR,f.file_path));}catch{}}
    db.prepare("DELETE FROM pet_files WHERE pet_id=? AND kind='vaccination'").run(pet.id);
  }
  for(const f of vaccinationFiles) add.run(pet.id,"vaccination",f.originalname,f.mimetype,f.filename);
  if(vaccinationFiles.length){ db.prepare("UPDATE pets SET vaccination_status='pending', vaccination_verified_at=NULL, vaccination_verified_by=NULL, vaccination_rejection_note=NULL WHERE id=?").run(pet.id); logActivity({userId:req.user.id,petId:pet.id,actorUserId:req.user.id,actorRole:"client",action:"vaccination_uploaded",details:`Vaccination record uploaded/replaced for ${pet.name}.`}); }
  if(dogPhoto)logActivity({userId:req.user.id,petId:pet.id,actorUserId:req.user.id,actorRole:"client",action:"dog_photo_updated",details:`Dog photo updated for ${pet.name}.`});
  res.json(petDetailsForUser(req.user.id).find(p=>p.id===Number(pet.id)));
});

function canViewPetFile(req, petId) {
  const pet=db.prepare("SELECT id,user_id FROM pets WHERE id=?").get(petId);
  if(!pet) return null;
  if(req.user.role==='trainer' || pet.user_id===req.user.id) return pet;
  return null;
}

app.delete("/api/my/pets/:id/photo",requireAuth,(req,res)=>{
  const pet=db.prepare("SELECT id FROM pets WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
  if(!pet)return res.status(404).json({error:"Dog not found."});
  const files=db.prepare("SELECT file_path FROM pet_files WHERE pet_id=? AND kind='photo'").all(pet.id);
  for(const f of files){try{fs.unlinkSync(path.join(PRIVATE_UPLOAD_DIR,f.file_path));}catch{}}
  db.prepare("DELETE FROM pet_files WHERE pet_id=? AND kind='photo'").run(pet.id);
  res.json({ok:true});
});

app.get("/api/pets/:id/photo",requireAuth,(req,res)=>{
  if(!canViewPetFile(req,req.params.id)) return res.status(404).end();
  const f=db.prepare("SELECT * FROM pet_files WHERE pet_id=? AND kind='photo' ORDER BY created_at DESC LIMIT 1").get(req.params.id);
  if(!f) return res.status(404).end();
  const full=path.join(PRIVATE_UPLOAD_DIR,f.file_path);
  if(!fs.existsSync(full)) return res.status(404).end();
  res.type(f.mime_type);
  res.sendFile(full);
});

app.get("/api/pets/:id/vaccinations/:fileId",requireAuth,(req,res)=>{
  if(!canViewPetFile(req,req.params.id)) return res.status(404).end();
  const f=db.prepare("SELECT * FROM pet_files WHERE id=? AND pet_id=? AND kind='vaccination'").get(req.params.fileId,req.params.id);
  if(!f) return res.status(404).end();
  const full=path.join(PRIVATE_UPLOAD_DIR,f.file_path);
  if(!fs.existsSync(full)) return res.status(404).end();
  res.type(f.mime_type);
  res.setHeader("Content-Disposition", `inline; filename="${f.original_name.replace(/[^a-zA-Z0-9._-]/g,"_")}"`);
  res.sendFile(full);
});

app.get("/api/my/pets/:id/vaccinations",requireAuth,(req,res)=>{
  const pet=db.prepare("SELECT id FROM pets WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
  if(!pet) return res.status(404).json({error:"Dog not found."});
  res.json(db.prepare("SELECT id,original_name,created_at FROM pet_files WHERE pet_id=? AND kind='vaccination' ORDER BY created_at DESC").all(pet.id)
    .map(f=>({...f,url:`/api/pets/${pet.id}/vaccinations/${f.id}`})));
});
app.delete("/api/my/pets/:id/vaccinations",requireAuth,(req,res)=>{
  const pet=db.prepare("SELECT id FROM pets WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
  if(!pet) return res.status(404).json({error:"Dog not found."});
  const files=db.prepare("SELECT file_path FROM pet_files WHERE pet_id=? AND kind='vaccination'").all(pet.id);
  for(const f of files){try{fs.unlinkSync(path.join(PRIVATE_UPLOAD_DIR,f.file_path));}catch{}}
  db.prepare("DELETE FROM pet_files WHERE pet_id=? AND kind='vaccination'").run(pet.id);
  db.prepare("UPDATE pets SET vaccination_status='not_provided',vaccination_verified_at=NULL,vaccination_verified_by=NULL,vaccination_rejection_note=NULL WHERE id=?").run(pet.id);
  logActivity({userId:req.user.id,petId:pet.id,actorUserId:req.user.id,actorRole:"client",action:"vaccination_removed",details:"Vaccination record removed."});
  res.json({ok:true});
});

// Vaccination verification — trainer only
app.get("/api/trainer/vaccinations",requireTrainer,(req,res)=>{
  const rows=db.prepare(`
    SELECT p.id pet_id,p.name pet_name,p.breed,p.vaccination_status,p.vaccination_verified_at,
           u.id user_id,u.name client_name,u.email,u.phone,
           (SELECT COUNT(*) FROM pet_files f WHERE f.pet_id=p.id AND f.kind='vaccination') vaccination_count
    FROM pets p JOIN users u ON u.id=p.user_id
    WHERE COALESCE(p.archived,0)=0 AND p.vaccination_status IN ('pending','rejected','not_provided')
    ORDER BY p.name
  `).all();
  res.json(rows);
});
app.get("/api/trainer/pets/:id/vaccinations",requireTrainer,(req,res)=>{
  const pet=db.prepare("SELECT id,name,vaccination_status,vaccination_verified_at,vaccination_rejection_note FROM pets WHERE id=?").get(req.params.id);
  if(!pet) return res.status(404).json({error:"Dog not found."});
  const files=db.prepare("SELECT id,original_name,mime_type,created_at FROM pet_files WHERE pet_id=? AND kind='vaccination' ORDER BY created_at DESC").all(pet.id)
    .map(f=>({...f,url:`/api/pets/${pet.id}/vaccinations/${f.id}`}));
  res.json({...pet,files});
});
app.post("/api/trainer/pets/:id/vaccination-status",requireTrainer,(req,res)=>{
  const status=String(req.body.status||"");
  if(!["verified","rejected","pending"].includes(status)) return res.status(400).json({error:"Invalid vaccination status."});
  const pet=db.prepare("SELECT id,user_id,name FROM pets WHERE id=?").get(req.params.id);
  if(!pet) return res.status(404).json({error:"Dog not found."});
  const note=String(req.body.note||"").trim();
  if(status==="verified"){
    db.prepare("UPDATE pets SET vaccination_status='verified',vaccination_verified_at=CURRENT_TIMESTAMP,vaccination_verified_by=?,vaccination_rejection_note=NULL WHERE id=?").run(req.user.id,pet.id);
  } else if(status==="rejected"){
    db.prepare("UPDATE pets SET vaccination_status='rejected',vaccination_verified_at=NULL,vaccination_verified_by=NULL,vaccination_rejection_note=? WHERE id=?").run(note||"Please upload a replacement vaccination record.",pet.id);
  } else {
    db.prepare("UPDATE pets SET vaccination_status='pending',vaccination_verified_at=NULL,vaccination_verified_by=NULL,vaccination_rejection_note=NULL WHERE id=?").run(pet.id);
  }
  logActivity({userId:pet.user_id,petId:pet.id,actorUserId:req.user.id,actorRole:"trainer",action:`vaccination_${status}`,details:status==="rejected"?(note||"Replacement vaccination record requested."):`Vaccination status changed to ${status}.`});
  res.json({ok:true,petId:pet.id,status});
});

// Resources
app.get("/api/my/resources",requireAuth,(req,res)=>{
  const rows=db.prepare(`
    SELECT r.*,
      (SELECT a.note FROM resource_access a WHERE a.resource_id=r.id AND a.user_id=? ORDER BY a.id DESC LIMIT 1) AS access_note
    FROM resources r
    WHERE r.archived=0 AND EXISTS (
      SELECT 1 FROM resource_access a
      LEFT JOIN pets p ON p.id=a.pet_id
      WHERE a.resource_id=r.id AND (a.user_id=? OR p.user_id=?
        OR a.class_id IN (SELECT class_id FROM class_enrolments WHERE user_id=? AND enrolment_status='active' AND payment_status IN ('paid','demo_paid')))
    )
    ORDER BY r.created_at DESC
  `).all(req.user.id,req.user.id,req.user.id,req.user.id);
  res.json(rows);
});

// Reviews
app.post("/api/reviews",requireAuth,imageUpload.single("photo"),(req,res)=>{
  const body=req.body||{};
  const rating=Number(body.rating), text=String(body.text||"").trim();
  if(rating<1||rating>5||!text) return res.status(400).json({error:"Please provide a rating and review."});
  const photoFilename=req.file?.filename||null;
  const photoConsent=String(body.photoConsent||"").toLowerCase()==="true"?1:0;
  const id=db.prepare("INSERT INTO reviews(user_id,rating,text,photo_filename,photo_consent) VALUES(?,?,?,?,?)").run(req.user.id,rating,text,photoFilename,photoConsent).lastInsertRowid;
  res.json({id,status:"pending"});
});

// Trainer
app.get("/api/trainer/calendar",requireTrainer,(req,res)=>{
  const start=String(req.query.start||"");
  const end=String(req.query.end||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))
    return res.status(400).json({error:"Please provide a valid calendar date range."});
  const bookings=db.prepare(`
    SELECT b.id,b.user_id,b.booking_ref,b.service,b.location_type,b.address,b.start_at,b.end_at,b.buffer_end_at,b.travel_minutes,b.payment_status,
           u.name client,u.phone,p.name pet_name,p.breed pet_breed
    FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id
    WHERE substr(b.start_at,1,10)>=? AND substr(b.start_at,1,10)<=?
      AND b.status NOT IN ('cancelled','expired') AND b.payment_status IN ('paid','demo_paid','credit_paid','pending')
    ORDER BY b.start_at
  `).all(start,end);
  const classRows=db.prepare(`
    SELECT s.id session_id,s.session_date,s.start_time,s.end_time,c.id class_id,c.title,c.capacity,c.location_type,c.location_name,
           (SELECT COUNT(*) FROM class_enrolments e WHERE e.class_id=c.id AND e.enrolment_status='active' AND e.payment_status IN ('pending','paid','demo_paid','credit_paid')) enrolled
    FROM class_sessions s JOIN classes c ON c.id=s.class_id
    WHERE s.session_date>=? AND s.session_date<=? AND c.status='open'
    ORDER BY s.session_date,s.start_time
  `).all(start,end);
  const blocks=db.prepare(`SELECT * FROM availability_blocks WHERE substr(start_at,1,10)<=? AND substr(end_at,1,10)>=? ORDER BY start_at`).all(end,start);
  const serviceBlocks=db.prepare(`SELECT * FROM service_availability_blocks WHERE active=1 AND (end_at IS NULL OR substr(end_at,1,10)>=?) AND (start_at IS NULL OR substr(start_at,1,10)<=?) ORDER BY start_at`).all(start,end).map(b=>({...b,public_message:b.public_message||b.reason||"Temporarily unavailable"}));
  const scheduleBlocks=db.prepare("SELECT * FROM schedule_blocks WHERE active=1 AND COALESCE(silent_calendar,0)=0 AND start_date<=? AND end_date>=? ORDER BY start_date,start_time").all(end,start);
  res.json({start,end,bookings,classSessions:classRows,blocks,serviceBlocks,scheduleBlocks});
});

app.get("/api/trainer/summary",requireTrainer,(req,res)=>{
  expireTimedHolds(); const today=nairobiDateKey(0);
  res.json({
    todayBookings:db.prepare("SELECT b.*,u.name client,p.name pet_name FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id WHERE substr(b.start_at,1,10)=? AND b.status NOT IN ('cancelled','expired') ORDER BY b.start_at").all(today),
    classes:db.prepare("SELECT c.*,(SELECT COUNT(*) FROM class_enrolments e WHERE e.class_id=c.id AND e.enrolment_status='active' AND e.payment_status IN ('pending','paid','demo_paid','credit_paid')) enrolled FROM classes c ORDER BY c.start_date DESC").all(),
    pendingReviews:db.prepare("SELECT r.*,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.created_at DESC").all(),
    vaccinationAttention:db.prepare(`SELECT p.id pet_id,p.name pet_name,p.breed,p.vaccination_status,p.vaccination_verified_at,u.id user_id,u.name client_name,(SELECT COUNT(*) FROM pet_files f WHERE f.pet_id=p.id AND f.kind='vaccination') vaccination_count FROM pets p JOIN users u ON u.id=p.user_id WHERE COALESCE(p.archived,0)=0 AND p.vaccination_status IN ('pending','rejected','not_provided') ORDER BY p.name`).all(),
    cancellationAttention:db.prepare(`SELECT b.id,b.user_id,b.pet_id,b.booking_ref,b.start_at,b.end_at,b.service,b.location_type,b.address,b.payment_status,b.status,b.price,b.package_id,b.refund_amount,b.refund_confirmation_code,b.credit_amount,u.name client_name,u.email client_email,COALESCE(u.whatsapp_phone,u.phone) client_phone,p.name pet_name,bp.name package_name,bp.package_price FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id LEFT JOIN booking_packages bp ON bp.id=b.package_id WHERE b.payment_status='refund_pending' ORDER BY b.start_at DESC`).all().map(b=>({...b,refundable_amount:packageSessionRefundableAmount(b)})),
    classRefundAttention:db.prepare(`SELECT e.id,e.class_id,e.booking_ref,e.payment_status,c.title,c.price,u.name client_name,p.name pet_name FROM class_enrolments e JOIN classes c ON c.id=e.class_id JOIN users u ON u.id=e.user_id LEFT JOIN pets p ON p.id=e.pet_id WHERE e.enrolment_status IN ('rejected','cancelled_by_client') AND e.payment_status='refund_pending' ORDER BY e.rejected_at DESC`).all(),
    rescheduleAttention:db.prepare(`SELECT rr.*,b.booking_ref,b.service,b.location_type,u.name client_name,p.name pet_name FROM reschedule_requests rr JOIN bookings b ON b.id=rr.booking_id JOIN users u ON u.id=rr.user_id LEFT JOIN pets p ON p.id=b.pet_id WHERE rr.status='pending' AND datetime(rr.hold_expires_at)>datetime('now') ORDER BY rr.created_at`).all(),
    manualPaymentAttention:db.prepare(`SELECT b.id,b.booking_ref,COALESCE(NULLIF(b.price,0),bp.package_price,0) price,b.manual_payment_code,b.manual_payment_amount,u.name client_name,p.name pet_name FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id LEFT JOIN booking_packages bp ON bp.id=b.package_id WHERE b.manual_payment_status='submitted' ORDER BY b.created_at`).all(),
    notifications:db.prepare("SELECT n.*,u.name client_name,p.name pet_name FROM trainer_notifications n LEFT JOIN users u ON u.id=n.user_id LEFT JOIN pets p ON p.id=n.pet_id WHERE n.resolved=0 ORDER BY n.created_at DESC LIMIT 30").all(),
    blocks:db.prepare("SELECT * FROM availability_blocks ORDER BY start_at DESC LIMIT 20").all(),resources:db.prepare("SELECT * FROM resources ORDER BY created_at DESC").all(),clientCount:db.prepare("SELECT COUNT(*) n FROM users WHERE role='client'").get().n
  });
});
app.get("/api/trainer/schedule-blocks",requireTrainer,(req,res)=>res.json(activeScheduleBlocks()));
app.post("/api/trainer/schedule-blocks",requireTrainer,(req,res)=>{
 const target=String(req.body.target||""),startDate=String(req.body.startDate||""),endDate=String(req.body.endDate||startDate),allDay=!!req.body.allDay,allowExisting=!!req.body.allowExisting,silentCalendar=!!req.body.silentCalendar;
 const startTime=String(req.body.startTime||""),endTime=String(req.body.endTime||""),reason=String(req.body.reason||"Unavailable").trim()||"Unavailable",publicMessage=String(req.body.publicMessage||reason).trim()||reason;
 if(!["amy","arena","home"].includes(target))return res.status(400).json({error:"Choose what is being blocked: Amy, arena or home visits."});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||endDate<startDate)return res.status(400).json({error:"Choose a valid first and last date."});
 if(!allDay&&(!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(startTime)||!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(endTime)||startTime>=endTime))return res.status(400).json({error:"Choose valid half-hour start and end times."});
 if(allowExisting&&(target!=="amy"||startDate!==endDate||!allDay))return res.status(400).json({error:"Quick close is only available for Amy for one whole day."});
 let d=startDate,days=0,conflicts=[],classConflicts=[];
 while(d<=endDate&&days<367){
   const st=`${d}T${allDay?"00:00:00":startTime+":00"}`,en=`${d}T${allDay?"23:59:59":endTime+":00"}`;
   const bookings=db.prepare(`SELECT b.id,b.booking_ref,b.start_at,b.end_at,b.buffer_end_at,b.location_type,u.name client,p.name pet_name FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id WHERE substr(b.start_at,1,10)=? AND b.status!='cancelled' AND b.payment_status IN ('pending','paid','demo_paid','credit_paid')`).all(d).filter(b=>(target==="amy"||b.location_type===target)&&overlaps(st,en,b.start_at,b.buffer_end_at||b.end_at));
   conflicts.push(...bookings);
   if(target!=="home"){
     const rows=db.prepare(`SELECT s.session_date,s.start_time,s.end_time,c.title,c.location_type FROM class_sessions s JOIN classes c ON c.id=s.class_id WHERE s.session_date=? AND c.status!='cancelled'`).all(d).filter(x=>(target==="amy"||(target==="arena"&&COALESCE_CLASS_ARENA(x)))&&overlaps(st,en,isoDateTime(x.session_date,x.start_time),isoDateTime(x.session_date,x.end_time)));
     classConflicts.push(...rows);
   }
   d=nextDateKey(d);days++;
 }
 if(days>=367)return res.status(400).json({error:"Please keep one block to 366 days or fewer."});
 if(!allowExisting&&(conflicts.length||classConflicts.length))return res.status(409).json({error:"This block conflicts with an existing booking or class. Reschedule the affected item first.",conflicts,classConflicts});
 const id=db.prepare("INSERT INTO schedule_blocks(target,start_date,end_date,start_time,end_time,all_day,reason,public_message,silent_calendar,active) VALUES(?,?,?,?,?,?,?,?,?,1)").run(target,startDate,endDate,allDay?null:startTime,allDay?null:endTime,allDay?1:0,reason,publicMessage,silentCalendar?1:0).lastInsertRowid;
 res.json({ok:true,id});
});
function COALESCE_CLASS_ARENA(x){return !x.location_type||x.location_type==="arena"}
app.delete("/api/trainer/schedule-blocks/:id",requireTrainer,(req,res)=>{db.prepare("UPDATE schedule_blocks SET active=0 WHERE id=?").run(req.params.id);res.json({ok:true})});

app.post("/api/trainer/blocks",requireTrainer,(req,res)=>{
  const {startAt,endAt,reason}=req.body;
  if(!startAt||!endAt) return res.status(400).json({error:"Start and end required."});
  const startMs=wallClockMs(startAt), endMs=wallClockMs(endAt);
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)) return res.status(400).json({error:"Please choose a valid start and end date/time."});
  if(startMs>=endMs) return res.status(400).json({error:"End must be after start."});

  const activeBookings=db.prepare(`
    SELECT b.id,b.booking_ref,b.start_at,b.end_at,b.buffer_end_at,b.status,b.payment_status,
           u.name client,p.name pet_name
    FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id
    WHERE COALESCE(b.status,'confirmed')!='cancelled'
      AND COALESCE(b.payment_status,'pending') NOT IN ('failed','cancelled')
  `).all();
  const conflicts=activeBookings.filter(b=>{
    const bs=wallClockMs(b.start_at), be=wallClockMs(b.buffer_end_at||b.end_at);
    return Number.isFinite(bs)&&Number.isFinite(be)&&startMs<be&&endMs>bs;
  });

  const classRows=db.prepare(`
    SELECT s.id,s.session_date,s.start_time,s.end_time,c.title
    FROM class_sessions s JOIN classes c ON c.id=s.class_id
    WHERE COALESCE(c.status,'open')!='cancelled'
  `).all();
  const classConflicts=classRows.filter(x=>{
    const cs=wallClockMs(isoDateTime(x.session_date,x.start_time));
    const ce=wallClockMs(isoDateTime(x.session_date,x.end_time));
    return Number.isFinite(cs)&&Number.isFinite(ce)&&startMs<ce&&endMs>cs;
  });

  if(conflicts.length||classConflicts.length) return res.status(409).json({
    error:"This time cannot be blocked because it overlaps an existing booking, required booking buffer, provisional hold, or class session.",
    conflicts,classConflicts
  });
  const id=db.prepare("INSERT INTO availability_blocks(start_at,end_at,reason) VALUES(?,?,?)").run(startAt,endAt,reason||"Unavailable").lastInsertRowid;
  res.json({ok:true,id});
});
app.delete("/api/trainer/blocks/:id",requireTrainer,(req,res)=>{db.prepare("DELETE FROM availability_blocks WHERE id=?").run(req.params.id);res.json({ok:true})});
app.get("/api/trainer/service-availability",requireTrainer,(req,res)=>{
  res.json({
    today:nairobiDateKey(0),
    status:serviceStatusForDate(nairobiDateKey(0)),
    blocks:db.prepare("SELECT * FROM service_availability_blocks WHERE active=1 AND (end_at IS NULL OR end_at>?) ORDER BY COALESCE(start_at,'0000')").all(`${nairobiDateKey(0)}T00:00:00`).map(b=>({...b,public_message:b.public_message||b.reason||"Temporarily unavailable"}))
  });
});
app.post("/api/trainer/service-availability",requireTrainer,(req,res)=>{
  const locationType=String(req.body.locationType||"");
  const publicMessage=String(req.body.publicMessage||req.body.reason||"").trim();
  const privateNote=String(req.body.privateNote||"").trim();
  const untilFurtherNotice=!!req.body.untilFurtherNotice;
  const startDate=String(req.body.startDate||"");
  const endDate=String(req.body.endDate||"");
  if(!["arena","home"].includes(locationType)) return res.status(400).json({error:"Choose arena or home visits."});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({error:"Choose the first unavailable date."});
  if(!publicMessage)return res.status(400).json({error:"Write the short message clients will see."});
  if(!untilFurtherNotice&&!/^\d{4}-\d{2}-\d{2}$/.test(endDate))return res.status(400).json({error:"Choose the last unavailable date."});
  if(!untilFurtherNotice&&endDate<startDate)return res.status(400).json({error:"The last unavailable date cannot be before the first."});
  const startAt=`${startDate}T00:00:00`,endAt=untilFurtherNotice?null:`${nextDateKey(endDate)}T00:00:00`;
  const startMs=wallClockMs(startAt), endMs=endAt?wallClockMs(endAt):Infinity;

  const conflicts=db.prepare(`
    SELECT b.id,b.booking_ref,b.start_at,b.end_at,b.location_type,u.name client,p.name pet_name
    FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id
    WHERE b.status!='cancelled' AND b.payment_status IN ('pending','paid','demo_paid','credit_paid') AND b.location_type=?
  `).all(locationType).filter(b=>startMs<wallClockMs(b.end_at)&&endMs>wallClockMs(b.start_at));
  if(conflicts.length)return res.status(409).json({error:"Existing bookings use this location during the selected dates. Reschedule or cancel them before adding the restriction.",conflicts});
  if(locationType==="arena"){
    const classes=db.prepare(`SELECT s.*,c.title FROM class_sessions s JOIN classes c ON c.id=s.class_id WHERE c.status!='cancelled' AND COALESCE(c.location_type,'arena')='arena'`).all().filter(x=>{
      const cs=wallClockMs(isoDateTime(x.session_date,x.start_time)),ce=wallClockMs(isoDateTime(x.session_date,x.end_time));
      return startMs<ce&&endMs>cs;
    });
    if(classes.length)return res.status(409).json({error:"A class uses the arena during these dates. Reschedule the class before adding the arena restriction.",classConflicts:classes});
  }
  const id=db.prepare("INSERT INTO service_availability_blocks(location_type,start_at,end_at,reason,public_message,private_note,active) VALUES(?,?,?,?,?,?,1)")
    .run(locationType,startAt,endAt,publicMessage,publicMessage,privateNote).lastInsertRowid;
  res.json({ok:true,id,status:serviceStatusForDate(nairobiDateKey(0))});
});
app.delete("/api/trainer/service-availability/:id",requireTrainer,(req,res)=>{
  db.prepare("UPDATE service_availability_blocks SET active=0 WHERE id=?").run(req.params.id);
  res.json({ok:true,status:serviceStatusForDate(nairobiDateKey(0))});
});

app.get("/api/trainer/day-meta",requireTrainer,(req,res)=>{
  const date=String(req.query.date||"");if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Choose a date."});
  const restrictions={};for(const type of ["arena","home"]){const b=serviceBlockForDate(type,date);restrictions[type]=b?{available:false,id:b.id,public_message:b.public_message||b.reason||"Temporarily unavailable",private_note:b.private_note||"",untilFurther:!b.end_at}:{available:true};}
  const recurring=db.prepare("SELECT * FROM recurring_blocks WHERE active=1 ORDER BY start_time").all();
  const scheduleBlocks=activeScheduleBlocks().filter(x=>scheduleBlockAppliesOnDate(x,date)&&!x.silent_calendar);
  res.json({date,working:workingWindowForDate(date),restrictions,recurringBlocks:recurring,scheduleBlocks});
});
app.get("/api/trainer/location-plan",requireTrainer,(req,res)=>{
  const date=String(req.query.date||"");if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Choose a date."});res.json({date,periods:dailyLocationPlan(date)});
});
app.post("/api/trainer/location-plan",requireTrainer,(req,res)=>{
  const date=String(req.body.date||""),periods=Array.isArray(req.body.periods)?req.body.periods:[];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Choose a date."});
  const clean=periods.map(p=>({start_time:String(p.start_time||""),end_time:String(p.end_time||""),arena_enabled:p.arena_enabled?1:0,home_enabled:p.home_enabled?1:0}));
  for(const p of clean){if(!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(p.start_time)||!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(p.end_time)||p.start_time>=p.end_time)return res.status(400).json({error:"Location-plan periods must use valid half-hour start and end times."});}
  const sorted=[...clean].sort((x,y)=>x.start_time.localeCompare(y.start_time));for(let i=1;i<sorted.length;i++)if(sorted[i].start_time<sorted[i-1].end_time)return res.status(400).json({error:"Location-plan periods cannot overlap."});
  if(clean.length){
    const allowed=(type,start,end)=>clean.some(p=>p[type==="arena"?"arena_enabled":"home_enabled"]&&String(start).slice(11,16)>=p.start_time&&String(end).slice(11,16)<=p.end_time);
    const bookings=db.prepare("SELECT b.*,u.name client,p.name pet_name FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id WHERE substr(b.start_at,1,10)=? AND b.status!='cancelled' AND b.payment_status IN ('pending','paid','demo_paid','credit_paid')").all(date);
    const badBookings=bookings.filter(b=>!allowed(b.location_type,b.start_at,b.end_at));
    const classRows=db.prepare("SELECT s.*,c.title FROM class_sessions s JOIN classes c ON c.id=s.class_id WHERE s.session_date=? AND c.status!='cancelled' AND COALESCE(c.location_type,'arena')='arena'").all(date);
    const badClasses=classRows.filter(x=>!allowed("arena",isoDateTime(x.session_date,x.start_time),isoDateTime(x.session_date,x.end_time)));
    if(badBookings.length||badClasses.length)return res.status(409).json({error:"This location plan would make an existing booking or arena class unavailable. Adjust the plan or reschedule the conflicting item first.",conflicts:badBookings,classConflicts:badClasses});
  }
  db.transaction(()=>{db.prepare("DELETE FROM daily_location_plan WHERE plan_date=?").run(date);const ins=db.prepare("INSERT INTO daily_location_plan(plan_date,start_time,end_time,arena_enabled,home_enabled) VALUES(?,?,?,?,?)");for(const p of clean)ins.run(date,p.start_time,p.end_time,p.arena_enabled,p.home_enabled)})();
  res.json({ok:true,date,periods:dailyLocationPlan(date)});
});
app.delete("/api/trainer/location-plan",requireTrainer,(req,res)=>{const date=String(req.query.date||"");if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Choose a date."});db.prepare("DELETE FROM daily_location_plan WHERE plan_date=?").run(date);res.json({ok:true});});

app.get("/api/trainer/recurring-blocks",requireTrainer,(req,res)=>res.json(db.prepare("SELECT * FROM recurring_blocks WHERE active=1 ORDER BY start_time").all()));
app.post("/api/trainer/recurring-blocks",requireTrainer,(req,res)=>{
 const weekdays=Array.isArray(req.body.weekdays)?[...new Set(req.body.weekdays.map(Number).filter(x=>x>=0&&x<=6))]:[];
 const start=String(req.body.start_time||""),end=String(req.body.end_time||""),reason=String(req.body.reason||"Blocked").trim()||"Blocked";
 const startDate=String(req.body.start_date||""),endDate=String(req.body.end_date||"");
 if(!weekdays.length||!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(start)||!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(end)||start>=end)return res.status(400).json({error:"Choose at least one weekday and valid half-hour start/end times."});
 if(startDate&&!/^\d{4}-\d{2}-\d{2}$/.test(startDate))return res.status(400).json({error:"Choose a valid first date."});
 if(endDate&&!/^\d{4}-\d{2}-\d{2}$/.test(endDate))return res.status(400).json({error:"Choose a valid last date."});
 if(startDate&&endDate&&endDate<startDate)return res.status(400).json({error:"The last date must be on or after the first date."});
 const applies=date=>{if(startDate&&date<startDate)return false;if(endDate&&date>endDate)return false;return weekdays.includes(new Date(`${date}T12:00:00`).getDay())};
 const bookings=db.prepare(`SELECT b.id,b.booking_ref,b.start_at,b.end_at,u.name client,p.name pet_name FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id WHERE b.status!='cancelled' AND b.payment_status IN ('pending','paid','demo_paid','credit_paid')`).all()
   .filter(b=>{const d=String(b.start_at).slice(0,10),st=String(b.start_at).slice(11,16),en=String(b.end_at).slice(11,16);return applies(d)&&st<end&&en>start});
 const classes=db.prepare(`SELECT s.session_date,s.start_time,s.end_time,c.title FROM class_sessions s JOIN classes c ON c.id=s.class_id WHERE c.status!='cancelled'`).all()
   .filter(x=>applies(x.session_date)&&x.start_time<end&&x.end_time>start);
 if(bookings.length||classes.length)return res.status(409).json({error:"This recurring block conflicts with an existing booking or class. Adjust the dates/times or reschedule the conflicting item first.",conflicts:bookings,classConflicts:classes});
 const x=db.prepare("INSERT INTO recurring_blocks(weekdays,start_time,end_time,reason,start_date,end_date) VALUES(?,?,?,?,?,?)").run(weekdays.join(","),start,end,reason,startDate||null,endDate||null);
 res.json({ok:true,id:x.lastInsertRowid});
});
app.delete("/api/trainer/recurring-blocks/:id",requireTrainer,(req,res)=>{db.prepare("UPDATE recurring_blocks SET active=0 WHERE id=?").run(req.params.id);res.json({ok:true})});
app.get("/api/trainer/working-hours",requireTrainer,(req,res)=>{
  res.json({
    weekly:db.prepare("SELECT * FROM working_hours ORDER BY weekday").all(),
    exceptions:db.prepare("SELECT * FROM working_hour_exceptions WHERE exception_date>=? ORDER BY exception_date LIMIT 100").all(nairobiDateKey(0)), recurringBlocks:db.prepare("SELECT * FROM recurring_blocks WHERE active=1 ORDER BY start_time").all(), dateBlocks:db.prepare("SELECT * FROM availability_blocks WHERE substr(end_at,1,10)>=? ORDER BY start_at LIMIT 100").all(nairobiDateKey(0))
  });
});
app.post("/api/trainer/working-hours",requireTrainer,(req,res)=>{
  const weekly=Array.isArray(req.body.weekly)?req.body.weekly:[];
  try{
    const tx=db.transaction(()=>{
      for(const row of weekly){
        const weekday=Number(row.weekday),enabled=row.enabled?1:0,start=String(row.start_time||""),end=String(row.end_time||"");
        if(weekday<0||weekday>6)continue;
        if(enabled&&(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||start>=end))throw new Error("Choose valid start and end times.");
        db.prepare("INSERT INTO working_hours(weekday,enabled,start_time,end_time) VALUES(?,?,?,?) ON CONFLICT(weekday) DO UPDATE SET enabled=excluded.enabled,start_time=excluded.start_time,end_time=excluded.end_time")
          .run(weekday,enabled,start||"08:00",end||"17:00");
      }
    });
    tx();res.json({ok:true});
  }catch(e){res.status(400).json({error:e.message})}
});
app.post("/api/trainer/working-hours/exception",requireTrainer,(req,res)=>{
  const date=String(req.body.date||""),enabled=req.body.enabled?1:0,start=String(req.body.start_time||""),end=String(req.body.end_time||""),note=String(req.body.note||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Choose a date."});
  if(enabled&&(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||start>=end))return res.status(400).json({error:"Choose valid exception hours."});
  const allowedStart=enabled?`${date}T${start}:00`:null,allowedEnd=enabled?`${date}T${end}:00`:null;
  const bookings=db.prepare("SELECT b.*,u.name client,p.name pet_name FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id WHERE substr(b.start_at,1,10)=? AND b.status!='cancelled' AND b.payment_status IN ('pending','paid','demo_paid','credit_paid')").all(date);
  const badBookings=enabled?bookings.filter(b=>wallClockMs(b.start_at)<wallClockMs(allowedStart)||wallClockMs(b.end_at)>wallClockMs(allowedEnd)):bookings;
  const classes=db.prepare("SELECT s.*,c.title FROM class_sessions s JOIN classes c ON c.id=s.class_id WHERE s.session_date=? AND c.status!='cancelled'").all(date);
  const badClasses=enabled?classes.filter(x=>x.start_time<start||x.end_time>end):classes;
  if(badBookings.length||badClasses.length)return res.status(409).json({error:"This one-off working-hours change conflicts with an existing booking or class. Reschedule the conflicting item first.",conflicts:badBookings,classConflicts:badClasses});
  db.prepare("INSERT INTO working_hour_exceptions(exception_date,enabled,start_time,end_time,note) VALUES(?,?,?,?,?) ON CONFLICT(exception_date) DO UPDATE SET enabled=excluded.enabled,start_time=excluded.start_time,end_time=excluded.end_time,note=excluded.note").run(date,enabled,start||null,end||null,note);
  res.json({ok:true});
});
app.delete("/api/trainer/working-hours/exception/:id",requireTrainer,(req,res)=>{
  db.prepare("DELETE FROM working_hour_exceptions WHERE id=?").run(req.params.id);
  res.json({ok:true});
});


app.get("/api/trainer/activity",requireTrainer,(req,res)=>{
  const generic=db.prepare(`
    SELECT a.created_at,a.actor_role,a.action,a.details,
           u.name client_name,p.name pet_name,c.title class_title
    FROM activity_history a
    LEFT JOIN users u ON u.id=a.user_id
    LEFT JOIN pets p ON p.id=a.pet_id
    LEFT JOIN classes c ON c.id=a.class_id
  `).all().map(x=>({...x,source:"activity"}));
  const bookings=db.prepare(`
    SELECT h.created_at,h.actor_role,h.action,h.details,
           u.name client_name,p.name pet_name,NULL class_title
    FROM booking_history h
    LEFT JOIN bookings b ON b.id=h.booking_id
    LEFT JOIN users u ON u.id=b.user_id
    LEFT JOIN pets p ON p.id=b.pet_id
  `).all().map(x=>({...x,source:"booking"}));
  const rows=[...generic,...bookings].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,500);
  res.json(rows);
});

app.get("/api/trainer/reviews",requireTrainer,(req,res)=>{
  res.json(db.prepare("SELECT r.*,u.name FROM reviews r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC").all());
});
app.post("/api/trainer/reviews/:id/manage",requireTrainer,(req,res)=>{
  const action=String(req.body.action||"");
  if(action==="star") db.prepare("UPDATE reviews SET starred=CASE WHEN starred=1 THEN 0 ELSE 1 END WHERE id=?").run(req.params.id);
  else if(action==="retire") db.prepare("UPDATE reviews SET retired=1 WHERE id=?").run(req.params.id);
  else if(action==="restore") db.prepare("UPDATE reviews SET retired=0 WHERE id=?").run(req.params.id);
  else return res.status(400).json({error:"Unknown review action."});
  res.json({ok:true});
});
app.post("/api/trainer/clients/:id/status",requireTrainer,(req,res)=>{
  const status=String(req.body.status||"");if(!["current","dormant","archived","automatic"].includes(status))return res.status(400).json({error:"Invalid client status."});
  const u=db.prepare("SELECT id,name FROM users WHERE id=? AND role='client'").get(req.params.id);if(!u)return res.status(404).json({error:"Client not found."});
  db.prepare("UPDATE users SET status_override=?,client_status=? WHERE id=?").run(status==='automatic'?null:status,status==='automatic'?'current':status,u.id);
  logActivity({userId:u.id,actorUserId:req.user.id,actorRole:'trainer',action:'client_status_changed',details:status==='automatic'?'Client returned to automatic status rules.':`Amy set client status to ${status}.`});
  res.json({ok:true});
});
app.get("/api/trainer/classes-detail",requireTrainer,(req,res)=>{
  const rows=db.prepare("SELECT * FROM classes ORDER BY start_date DESC").all();
  const sessionQ=db.prepare("SELECT * FROM class_sessions WHERE class_id=? ORDER BY session_date,start_time");
  const enrolQ=db.prepare(`
    SELECT e.id,e.payment_status,e.enrolment_status,e.rejected_reason,e.rejected_at,
           e.refund_amount,e.refund_confirmation_code,e.booking_ref,
           u.id user_id,u.name client_name,u.email,u.phone,
           p.id pet_id,p.name pet_name,p.breed,p.date_of_birth,p.archived,p.vaccination_status
    FROM class_enrolments e
    JOIN users u ON u.id=e.user_id
    LEFT JOIN pets p ON p.id=e.pet_id
    WHERE e.class_id=?
    ORDER BY CASE WHEN e.enrolment_status='active' THEN 0 ELSE 1 END,u.name,p.name
  `);
  res.json(rows.map(c=>({...c,sessions:sessionQ.all(c.id),enrolments:enrolQ.all(c.id)})));
});

app.post("/api/trainer/class-enrolments/:id/reject",requireTrainer,(req,res)=>{
  const e=db.prepare(`
    SELECT e.*,c.title,p.name pet_name
    FROM class_enrolments e
    JOIN classes c ON c.id=e.class_id
    LEFT JOIN pets p ON p.id=e.pet_id
    WHERE e.id=?
  `).get(req.params.id);
  if(!e)return res.status(404).json({error:"Class enrolment not found."});
  if(e.enrolment_status==='rejected')return res.status(409).json({error:"This dog has already been rejected from the class."});
  const reason=String(req.body.reason||"").trim();
  if(!reason)return res.status(400).json({error:"Please record a short reason for rejecting this dog from the class."});
  const paid=['paid','demo_paid','credit_paid'].includes(e.payment_status);
  db.prepare(`UPDATE class_enrolments
              SET enrolment_status='rejected',rejected_reason=?,rejected_at=CURRENT_TIMESTAMP,rejected_by=?,
                  payment_status=?
              WHERE id=?`)
    .run(reason,req.user.id,paid?'refund_pending':'cancelled',e.id);
  logActivity({userId:e.user_id,petId:e.pet_id,classId:e.class_id,actorUserId:req.user.id,actorRole:"trainer",action:"class_rejected",details:`${e.pet_name||"Dog"} rejected from ${e.title}. Reason: ${reason}${paid?" Refund decision required.":""}`});
  res.json({ok:true,refundPending:paid});
});

app.post("/api/trainer/class-enrolments/:id/refund",requireTrainer,(req,res)=>{
  const e=db.prepare(`
    SELECT e.*,c.price,c.title,p.name pet_name
    FROM class_enrolments e
    JOIN classes c ON c.id=e.class_id
    LEFT JOIN pets p ON p.id=e.pet_id
    WHERE e.id=?
  `).get(req.params.id);
  if(!e)return res.status(404).json({error:"Class enrolment not found."});
  if(!['rejected','cancelled_by_client'].includes(e.enrolment_status))return res.status(409).json({error:"Only cancelled class enrolments can have a refund decision."});
  const decision=String(req.body.decision||"");
  if(!["full","partial","none"].includes(decision))return res.status(400).json({error:"Choose full, partial or no refund."});
  let amount=null,code=null,status="no_refund";
  if(decision!=="none"){
    amount=Number(req.body.amount);
    code=String(req.body.code||"").trim();
    if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:"Enter the refund amount in KES."});
    if(!code)return res.status(400).json({error:"Enter the M-Pesa refund/transaction confirmation code."});
    if(decision==="full"&&amount!==Number(e.price||0))return res.status(400).json({error:`A full refund must equal KES ${Number(e.price||0).toLocaleString()}.`});
    status=decision==="full"?"refunded":"refund_partial";
  }
  db.prepare("UPDATE class_enrolments SET payment_status=?,refund_amount=?,refund_confirmation_code=?,refund_recorded_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(status,amount,code,e.id);
  const details=decision==="none"?`No refund recorded for ${e.pet_name||"dog"} after rejection from ${e.title}.`:`${decision==="full"?"Full":"Partial"} class refund KES ${amount}; M-Pesa ${code}.`;
  logActivity({userId:e.user_id,petId:e.pet_id,classId:e.class_id,actorUserId:req.user.id,actorRole:"trainer",action:"class_refund_decision",details});
  res.json({ok:true});
});
app.put("/api/trainer/classes/:id",requireTrainer,(req,res)=>{
  const current=db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if(!current)return res.status(404).json({error:"Course not found."});
  const {title,startDate,startTime,endTime,price,capacity,count,recurrence,customDates,locationType,locationName,minAgeMonths,maxAgeMonths}=req.body;
  if(!title||!startTime||!endTime)return res.status(400).json({error:"Please complete the course details."});
  const chosenLocation=locationType||"arena";
  if(!["arena","alternate"].includes(chosenLocation))return res.status(400).json({error:"Choose the class location."});
  if(chosenLocation==="alternate"&&!String(locationName||"").trim())return res.status(400).json({error:"Enter the alternate class location."});
  const n=Math.max(1,Math.min(20,Number(count||5)));
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)||startTime>=endTime)return res.status(400).json({error:"Choose valid start and end times."});
  let dates=[];
  if(recurrence==="custom"){
    dates=Array.isArray(customDates)?customDates.filter(Boolean).slice(0,n):[];
    if(dates.length!==n)return res.status(400).json({error:`Please provide exactly ${n} class dates.`});
  }else{
    if(!startDate)return res.status(400).json({error:"Please choose a first date."});
    const first=new Date(startDate+"T12:00:00");if(Number.isNaN(first.getTime()))return res.status(400).json({error:"Please choose a valid first date."});
    const step=recurrence==="biweekly"?2:recurrence==="weekly"?1:null;if(!step)return res.status(400).json({error:"Please choose a recurrence pattern."});
    for(let i=0;i<n;i++){const d=new Date(first);d.setDate(d.getDate()+i*7*step);dates.push(d.toISOString().slice(0,10));}
  }
  dates=[...new Set(dates)].sort();if(dates.length!==n)return res.status(400).json({error:"Class dates must be unique."});
  const minAge=minAgeMonths===""||minAgeMonths==null?null:Number(minAgeMonths),maxAge=maxAgeMonths===""||maxAgeMonths==null?null:Number(maxAgeMonths);
  if((minAge!=null&&!Number.isInteger(minAge))||(maxAge!=null&&!Number.isInteger(maxAge))||(minAge!=null&&minAge<0)||(maxAge!=null&&maxAge<0)|| (minAge!=null&&maxAge!=null&&minAge>maxAge))return res.status(400).json({error:"Please check the course age limits."});
  const conflicts=[];
  for(const date of dates){
    const st=isoDateTime(date,startTime),en=isoDateTime(date,endTime);
    const blocks=db.prepare("SELECT * FROM availability_blocks WHERE start_at < ? AND end_at > ?").all(en,st);
    const bookings=db.prepare("SELECT b.booking_ref,b.start_at,b.end_at,u.name client FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.status!='cancelled' AND b.payment_status IN ('paid','demo_paid','credit_paid','pending')").all().filter(b=>overlaps(st,en,b.start_at,b.buffer_end_at));
    const classes=db.prepare("SELECT s.session_date,s.start_time,s.end_time,c.title FROM class_sessions s JOIN classes c ON c.id=s.class_id WHERE c.status='open' AND c.id!=?").all(current.id).filter(x=>overlaps(st,en,isoDateTime(x.session_date,x.start_time),isoDateTime(x.session_date,x.end_time)));
    const arenaUnavailable=(chosenLocation==="arena"&&serviceUnavailable("arena",st,en))||scheduleBlockConflict(chosenLocation==="arena"?"arena":"alternate",st,en);
    if(blocks.length||bookings.length||classes.length||arenaUnavailable)conflicts.push({date,blocks,bookings,classes,arenaUnavailable});
  }
  if(conflicts.length)return res.status(409).json({error:"One or more edited course dates conflict with blocked, booked, class, or arena-unavailable time.",conflicts});
  const cap=Math.max(1,Number(capacity||12));
  const activeCount=db.prepare("SELECT COUNT(*) n FROM class_enrolments WHERE class_id=? AND enrolment_status='active'").get(current.id).n;
  if(cap<activeCount)return res.status(400).json({error:`Capacity cannot be lower than the ${activeCount} active enrolment(s).`});
  db.transaction(()=>{
    db.prepare("UPDATE classes SET title=?,start_date=?,end_date=?,weekday=?,start_time=?,end_time=?,capacity=?,price=?,location_type=?,location_name=?,min_age_months=?,max_age_months=? WHERE id=?")
      .run(String(title).trim(),dates[0],dates[dates.length-1],weekdayName(dates[0]),startTime,endTime,cap,Number(price||0),chosenLocation,chosenLocation==="alternate"?String(locationName).trim():null,minAge,maxAge,current.id);
    db.prepare("DELETE FROM class_sessions WHERE class_id=?").run(current.id);
    const add=db.prepare("INSERT INTO class_sessions(class_id,session_date,start_time,end_time) VALUES(?,?,?,?)");
    for(const d of dates)add.run(current.id,d,startTime,endTime);
  })();
  logActivity({classId:Number(current.id),actorUserId:req.user.id,actorRole:"trainer",action:"class_edited",details:`Course updated: ${title}; ${dates.length} session(s).`});
  res.json({ok:true,id:Number(current.id),dates});
});

app.delete("/api/trainer/classes/:id",requireTrainer,(req,res)=>{
  const course=db.prepare("SELECT * FROM classes WHERE id=?").get(req.params.id);
  if(!course)return res.status(404).json({error:"Course not found."});
  const enrolments=db.prepare("SELECT COUNT(*) n FROM class_enrolments WHERE class_id=?").get(course.id).n;
  if(enrolments)return res.status(409).json({error:"This course has enrolment history and cannot be deleted. Cancel or handle the enrolments instead."});
  db.prepare("DELETE FROM classes WHERE id=?").run(course.id);
  logActivity({classId:Number(course.id),actorUserId:req.user.id,actorRole:"trainer",action:"class_deleted",details:`Course deleted: ${course.title}.`});
  res.json({ok:true});
});

app.post("/api/trainer/classes",requireTrainer,(req,res)=>{
  const {title,description,startDate,startTime,endTime,price,capacity,count,recurrence,customDates,locationType,locationName,minAgeMonths,maxAgeMonths}=req.body;
  if(!title||!startDate||!startTime||!endTime)return res.status(400).json({error:"Please complete the course details."});
  const chosenLocation=locationType||"arena";
  if(!["arena","alternate"].includes(chosenLocation))return res.status(400).json({error:"Choose the class location."});
  if(chosenLocation==="alternate"&&!String(locationName||"").trim())return res.status(400).json({error:"Enter the alternate class location."});
  const n=Math.max(1,Math.min(20,Number(count||5)));
  const validTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime);
  if(!validTime)return res.status(400).json({error:"Please choose valid start and end times."});
  if(startTime>=endTime)return res.status(400).json({error:"End time must be after start time."});
  let dates=[];
  if(recurrence==='custom'){
    dates=Array.isArray(customDates)?customDates.filter(Boolean).slice(0,n):[];
    if(dates.length!==n)return res.status(400).json({error:`Please provide exactly ${n} class dates.`});
  } else {
    const first=new Date(startDate+'T12:00:00');
    if(Number.isNaN(first.getTime()))return res.status(400).json({error:"Please choose a valid first date."});
    const targetDay=first.getDay();
    if(recurrence==='weekly' || recurrence==='biweekly'){
      const step=recurrence==='biweekly'?2:1;
      for(let i=0;i<n;i++){const d=new Date(first);d.setDate(d.getDate()+i*7*step);dates.push(d.toISOString().slice(0,10));}
    } else return res.status(400).json({error:"Please choose a recurrence pattern."});
  }
  dates=[...new Set(dates)];
  if(dates.length!==n)return res.status(400).json({error:"Class dates must be unique."});
  const minAge=minAgeMonths===""||minAgeMonths==null?null:Number(minAgeMonths);
  const maxAge=maxAgeMonths===""||maxAgeMonths==null?null:Number(maxAgeMonths);
  if((minAge!=null&&!Number.isInteger(minAge))||(maxAge!=null&&!Number.isInteger(maxAge))||(minAge!=null&&minAge<0)||(maxAge!=null&&maxAge<0))return res.status(400).json({error:"Age limits must be whole numbers of months."});
  if(minAge!=null&&maxAge!=null&&minAge>maxAge)return res.status(400).json({error:"Minimum age cannot be greater than maximum age."});
  const conflicts=[];
  for(const date of dates){
    const s=isoDateTime(date,startTime),e=isoDateTime(date,endTime);
    const blocks=db.prepare("SELECT * FROM availability_blocks WHERE start_at < ? AND end_at > ?").all(e,s);
    const bookings=db.prepare("SELECT b.booking_ref,b.start_at,b.end_at,u.name client FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.status!='cancelled' AND b.payment_status IN ('paid','demo_paid','credit_paid','pending')").all().filter(b=>overlaps(s,e,b.start_at,b.buffer_end_at));
    const classes=db.prepare("SELECT s.session_date,s.start_time,s.end_time,c.title FROM class_sessions s JOIN classes c ON c.id=s.class_id WHERE c.status='open'").all().filter(x=>overlaps(s,e,isoDateTime(x.session_date,x.start_time),isoDateTime(x.session_date,x.end_time)));
    const arenaUnavailable=(chosenLocation==="arena"&&serviceUnavailable("arena",s,e))||scheduleBlockConflict(chosenLocation==="arena"?"arena":"alternate",s,e);
    if(blocks.length||bookings.length||classes.length||arenaUnavailable)conflicts.push({date,blocks,bookings,classes,arenaUnavailable});
  }
  if(conflicts.length)return res.status(409).json({error:"One or more course dates conflict with blocked, booked, class, or arena-unavailable time. Please choose different dates, choose an alternate venue, or resolve the restriction first.",dates,conflicts});
  const id=db.transaction(()=>{
    const row=db.prepare(`INSERT INTO classes(title,description,start_date,end_date,weekday,start_time,end_time,capacity,price,location_type,location_name,min_age_months,max_age_months) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(title,description||"",dates[0],dates[dates.length-1],weekdayName(dates[0]),startTime,endTime,Number(capacity||12),Number(price||0),chosenLocation,chosenLocation==="alternate"?String(locationName).trim():null,minAge,maxAge).lastInsertRowid;
    const add=db.prepare("INSERT INTO class_sessions(class_id,session_date,start_time,end_time) VALUES(?,?,?,?)");
    for(const d of dates)add.run(row,d,startTime,endTime);
    return row;
  })();
  logActivity({classId:Number(id),actorUserId:req.user.id,actorRole:"trainer",action:"class_created",details:`Course created: ${title}; ${dates.length} session(s).`});
  res.json({id,dates,conflicts});
});
function weekdayName(date){return new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long'});}

function resourceType(file){const m=file?.mimetype||"";if(m.includes("pdf"))return"pdf";if(m.startsWith("image/"))return"image";if(m.startsWith("video/"))return"video";if(m.startsWith("audio/"))return"audio";return"link"}
app.get("/api/trainer/resources",requireTrainer,(req,res)=>res.json(db.prepare("SELECT * FROM resources WHERE archived=0 ORDER BY created_at DESC").all()));
app.post("/api/trainer/resources",requireTrainer,upload.single("file"),(req,res)=>{let url=req.body.url||"",type=req.body.type||"";if(req.file)type=resourceType(req.file);if(!req.body.title||(!url&&!req.file))return res.status(400).json({error:"Please provide a title and a file or link."});if(!["video","image","pdf","link","audio"].includes(type))type="link";const id=db.prepare("INSERT INTO resources(title,description,type,url,category) VALUES(?,?,?,?,?)").run(req.body.title,req.body.description||"",type,url,req.body.category||"General").lastInsertRowid;if(req.file){url=`/api/trainer/resources/${id}/file`;db.prepare("UPDATE resources SET url=?,description=? WHERE id=?").run(url,`__FILE__${req.file.filename} ${req.body.description||""}`.trim(),id)}res.json(db.prepare("SELECT * FROM resources WHERE id=?").get(id))});
app.get("/api/trainer/resources/:id/file",requireAuth,(req,res)=>{const r=db.prepare("SELECT * FROM resources WHERE id=?").get(req.params.id);if(!r)return res.status(404).end();if(req.user.role!=="trainer"){const ok=db.prepare(`SELECT 1 FROM resource_access a LEFT JOIN pets p ON p.id=a.pet_id WHERE a.resource_id=? AND (a.user_id=? OR p.user_id=? OR a.class_id IN (SELECT class_id FROM class_enrolments WHERE user_id=? AND enrolment_status='active' AND payment_status IN ('paid','demo_paid'))) LIMIT 1`).get(r.id,req.user.id,req.user.id,req.user.id);if(!ok)return res.status(403).end()}const m=(r.description||"").match(/^__FILE__([^ ]+)/);if(!m)return res.status(404).end();const full=path.join(UPLOAD_DIR,m[1]);if(!fs.existsSync(full))return res.status(404).end();res.sendFile(full)});
app.delete("/api/trainer/resources/:id",requireTrainer,(req,res)=>{db.prepare("UPDATE resources SET archived=1 WHERE id=?").run(req.params.id);res.json({ok:true})});
app.post("/api/trainer/resources/:id/access",requireTrainer,(req,res)=>{const {userId,note}=req.body;if(!userId)return res.status(400).json({error:"Choose a client."});db.prepare("INSERT INTO resource_access(resource_id,user_id,pet_id,class_id,note) VALUES(?,?,NULL,NULL,?)").run(req.params.id,userId,note||null);const r=db.prepare("SELECT title FROM resources WHERE id=?").get(req.params.id);logActivity({userId:Number(userId),actorUserId:req.user.id,actorRole:'trainer',action:'resource_assigned',details:`Amy shared resource: ${r?.title||'Training resource'}.`});res.json({ok:true})});
app.get("/api/trainer/resources/:id/access",requireTrainer,(req,res)=>res.json(db.prepare(`SELECT a.*,u.name user_name,p.name pet_name,c.title class_title FROM resource_access a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN pets p ON p.id=a.pet_id LEFT JOIN classes c ON c.id=a.class_id WHERE a.resource_id=?`).all(req.params.id)));
app.delete("/api/trainer/resources/access/:id",requireTrainer,(req,res)=>{db.prepare("DELETE FROM resource_access WHERE id=?").run(req.params.id);res.json({ok:true})});

app.post("/api/trainer/clients/:userId/provisional-booking",requireTrainer,async(req,res)=>{
  expireTimedHolds();
  const user=db.prepare("SELECT id,name,phone,whatsapp_phone,mpesa_phone FROM users WHERE id=? AND role='client'").get(req.params.userId);if(!user)return res.status(404).json({error:"Client not found."});
  const {petId,service,locationType,address,startAt,requestedDate,repeatType,sessionCount,customDates,packageName,packagePrice}=req.body;
  if(!["consultation","standard","extra"].includes(service))return res.status(400).json({error:"Choose a valid training type."});if(!["arena","home"].includes(locationType))return res.status(400).json({error:"Choose arena or home visit."});
  const pet=db.prepare("SELECT id,name,archived FROM pets WHERE id=? AND user_id=?").get(petId,user.id);if(!pet||pet.archived)return res.status(400).json({error:"Choose an active dog for this client."});if(locationType==='home'&&!String(address||'').trim())return res.status(400).json({error:"Enter the home-visit address."});
  const duration={consultation:90,standard:60,extra:90}[service], dates=[]; const first=String(startAt||''); if(!first||!privateBookingDateAllowed(first))return res.status(409).json({error:"Choose a valid appointment from tomorrow onwards."});
  const n=Math.max(1,Math.min(20,Number(sessionCount||1))); const mode=String(repeatType||'once');
  if(mode==='custom'){const arr=Array.isArray(customDates)?customDates:[];for(const d of arr.slice(0,n)){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!privateBookingDateAllowed(`${d}T${first.slice(11,16)}:00`))return res.status(400).json({error:"Check the custom session dates."});dates.push(`${d}T${first.slice(11,16)}:00`)}}
  else {for(let i=0;i<n;i++){const step=mode==='biweekly'?14:mode==='weekly'?7:0;const d=new Date(first);d.setDate(d.getDate()+i*step);dates.push(wallClockIso(d.getTime()))}}
  if(dates.length!==n)return res.status(400).json({error:`Please provide exactly ${n} session dates.`});
  const travel=locationType==='home'?await routeTravelMinutes(address,'Nairobi, Kenya'):0,buffer=locationType==='arena'?0:Math.max(30,travel),proposed=[];
  for(const st of dates){const en=addMinutes(st,duration),be=addMinutes(en,buffer);if(!withinWorkingHours(st,en)||recurringBlockConflict(st,en)||serviceUnavailable(locationType,st,be)||scheduleBlockConflict(locationType,st,be)||activeRescheduleHoldConflict(st,be))return res.status(409).json({error:`${st.slice(0,10)} ${st.slice(11,16)} is unavailable.`});const existing=db.prepare("SELECT * FROM bookings WHERE status NOT IN ('cancelled','expired') AND payment_status IN ('pending','paid','demo_paid','credit_paid')").all();if(existing.some(x=>overlaps(st,be,x.start_at,x.buffer_end_at)))return res.status(409).json({error:`${st.slice(0,10)} ${st.slice(11,16)} conflicts with another booking.`});const classes=db.prepare("SELECT * FROM class_sessions").all();if(classes.some(x=>overlaps(st,be,isoDateTime(x.session_date,x.start_time),isoDateTime(x.session_date,x.end_time))))return res.status(409).json({error:`${st.slice(0,10)} ${st.slice(11,16)} overlaps a class.`});proposed.push({st,en,be})}
  const standardPrice={consultation:5000,standard:4000,extra:6000}[service],totalPrice=Number(packagePrice)>0?Number(packagePrice):standardPrice*n,hold=addHoursIso(24);
  let packageId=null;if(n>1){packageId=db.prepare("INSERT INTO booking_packages(user_id,pet_id,name,service,location_type,address,package_price,payment_status,status,hold_expires_at) VALUES(?,?,?,?,?,?,?,'pending','provisional',?)").run(user.id,pet.id,String(packageName||`${pet.name} – ${n} Session Training Package`).trim(),service,locationType,address||null,totalPrice,hold).lastInsertRowid}
  const ids=[];for(const p of proposed){const refCode=ref('PRV');const id=db.prepare("INSERT INTO bookings(user_id,pet_id,booking_ref,service,location_type,address,start_at,end_at,buffer_end_at,travel_minutes,price,payment_status,status,notes,hold_expires_at,package_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(user.id,pet.id,refCode,service,locationType,address||null,p.st,p.en,p.be,travel,packageId?0:totalPrice,'pending','provisional',packageId?'Part of provisional package created by Amy.':'Created by Amy; client confirmation and payment required.',hold,packageId).lastInsertRowid;ids.push(id);db.prepare("INSERT INTO booking_history(booking_id,actor_role,action,details) VALUES(?,?,?,?)").run(id,'trainer','provisional_created',`Held until ${hold}`)}
  logActivity({userId:user.id,petId:pet.id,actorUserId:req.user.id,actorRole:'trainer',action:packageId?'package_proposed':'provisional_booking_created',details:packageId?`${n}-session private package proposed at KES ${totalPrice}.`:`Provisional booking created; held 24 hours.`});
  res.json({ok:true,ids,packageId,holdExpiresAt:hold,amount:totalPrice});
});
app.post("/api/my/bookings/:id/accept-provisional",requireAuth,async(req,res)=>{
 expireTimedHolds();
 const b=db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
 if(!b||b.status!=='provisional'||b.payment_status!=='pending')return res.status(404).json({error:"This provisional booking is no longer available."});
 if(expiryIsPast(b.hold_expires_at))return res.status(409).json({error:"The 24-hour hold has expired. Please contact Amy or book again."});
 const pkg=b.package_id?db.prepare("SELECT * FROM booking_packages WHERE id=? AND user_id=?").get(b.package_id,req.user.id):null;
 const amount=pkg?Number(pkg.package_price):Number(b.price),reference=pkg?`PKG-${pkg.id}`:b.booking_ref,creditAvailable=clientCreditBalance(req.user.id);
 if(creditAvailable>0)return res.json({bookingRef:reference,id:b.id,packageId:pkg?.id||null,amount,holdExpiresAt:b.hold_expires_at,firstAppointment:isFirstAppointmentForDog(b.pet_id),creditAvailable,creditApplied:Number(pkg?.credit_applied||b.credit_applied||0),paymentStartRequired:true,mpesaDemo:false,mpesaMessage:"Client credit is available. Apply it first, or continue with M-Pesa.",type:pkg?'package':'private'});
 try{
  const mpesa=await initiateMpesa(req.user.mpesa_phone||req.user.phone,amount,reference);
  if(pkg)db.prepare("UPDATE booking_packages SET mpesa_request_id=? WHERE id=?").run(mpesa.checkoutRequestId,pkg.id);
  else db.prepare("UPDATE bookings SET mpesa_request_id=? WHERE id=?").run(mpesa.checkoutRequestId,b.id);
  res.json({bookingRef:reference,id:b.id,packageId:pkg?.id||null,amount,holdExpiresAt:b.hold_expires_at,firstAppointment:isFirstAppointmentForDog(b.pet_id),creditAvailable:0,creditApplied:Number(pkg?.credit_applied||b.credit_applied||0),mpesaDemo:mpesa.demo,mpesaMessage:mpesa.demo?"Demo payment mode: complete the trial payment.":"M-Pesa prompt sent. Approve it on your phone.",type:pkg?'package':'private'});
 }catch(e){
  res.status(502).json({error:(e.message||'Could not start M-Pesa payment.')+' The hold remains active. Retry the STK Push or use the manual fallback below.',bookingRef:reference,id:b.id,packageId:pkg?.id||null,amount,creditAvailable:0,creditApplied:Number(pkg?.credit_applied||b.credit_applied||0),paymentPending:true,type:pkg?'package':'private'});
 }
});
app.post("/api/my/bookings/:id/decline-provisional",requireAuth,(req,res)=>{
 const b=db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=? AND status='provisional'").get(req.params.id,req.user.id);
 if(!b)return res.status(404).json({error:"Provisional booking not found."});
 if(b.package_id){
   db.prepare("UPDATE booking_packages SET status='cancelled',payment_status='cancelled' WHERE id=? AND user_id=?").run(b.package_id,req.user.id);
   db.prepare("UPDATE bookings SET status='cancelled',payment_status='cancelled' WHERE package_id=? AND user_id=? AND status='provisional'").run(b.package_id,req.user.id);
 }else db.prepare("UPDATE bookings SET status='cancelled',payment_status='cancelled' WHERE id=?").run(b.id);
 logActivity({userId:req.user.id,petId:b.pet_id,actorUserId:req.user.id,actorRole:'client',action:b.package_id?'provisional_package_declined':'provisional_booking_declined',details:b.package_id?'Client did not accept the proposed private training package.':'Client did not accept the proposed appointment.'});
 res.json({ok:true,packageDeclined:!!b.package_id});
});
app.post("/api/trainer/notes",requireTrainer,(req,res)=>{const {userId,petId,bookingId,note,clientVisible}=req.body;if(!userId||!String(note||"").trim())return res.status(400).json({error:"Client and note are required."});const id=db.prepare("INSERT INTO training_notes(user_id,pet_id,booking_id,note,client_visible) VALUES(?,?,?,?,?)").run(userId,petId||null,bookingId||null,String(note).trim(),clientVisible?1:0).lastInsertRowid;if(bookingId)db.prepare("INSERT INTO booking_history(booking_id,actor_role,action,details) VALUES(?,?,?,?)").run(bookingId,"trainer","note_added",String(note).trim());res.json({id})});
app.get("/api/trainer/notes/:userId",requireTrainer,(req,res)=>res.json(db.prepare("SELECT n.*,p.name pet_name FROM training_notes n LEFT JOIN pets p ON p.id=n.pet_id WHERE n.user_id=? ORDER BY n.created_at DESC").all(req.params.userId)));
app.post("/api/trainer/bookings/:id/reschedule",requireTrainer,(req,res)=>rescheduleBookingInternal(req,res,"trainer"));
app.post("/api/trainer/bookings/:id/cancel",requireTrainer,(req,res)=>cancelBookingInternal(req,res,"trainer"));
app.post("/api/trainer/bookings/:id/refund",requireTrainer,(req,res)=>{
 const decision=String(req.body.decision||"");if(!["full","partial","credit_full","credit_partial","none"].includes(decision))return res.status(400).json({error:"Choose a refund or credit decision."});
 const b=db.prepare("SELECT * FROM bookings WHERE id=?").get(req.params.id);if(!b)return res.status(404).json({error:"Booking not found."});
 const refundable=packageSessionRefundableAmount(b);
 if(decision==="none"){db.prepare("UPDATE bookings SET payment_status='no_refund',refund_amount=NULL,refund_confirmation_code=NULL,credit_amount=NULL,refund_recorded_at=CURRENT_TIMESTAMP WHERE id=?").run(b.id);db.prepare("INSERT INTO booking_history(booking_id,actor_role,action,details) VALUES(?,?,?,?)").run(b.id,"trainer","refund_decision","No refund or client credit approved.");return res.json({ok:true,status:"no_refund",refundableAmount:refundable})}
 const isCredit=decision.startsWith("credit_"),isFull=decision==="full"||decision==="credit_full",amount=isFull?refundable:Math.round(Number(req.body.amount));
 if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:isCredit?"Enter the client credit amount in KES.":"Enter the refund amount in KES."});
 if(amount>refundable)return res.status(400).json({error:`Amount cannot exceed the refundable value of KES ${refundable.toLocaleString()}.`});
 if(isCredit){const status=isFull?"credited":"credit_partial";db.prepare("UPDATE bookings SET payment_status=?,credit_amount=?,refund_amount=NULL,refund_confirmation_code=NULL,refund_recorded_at=CURRENT_TIMESTAMP WHERE id=?").run(status,amount,b.id);const balance=addClientCredit(b.user_id,amount,"booking",b.id,`${isFull?"Full":"Partial"} client credit from cancelled booking ${b.booking_ref}.`);db.prepare("INSERT INTO booking_history(booking_id,actor_role,action,details) VALUES(?,?,?,?)").run(b.id,"trainer","credit_decision",`${isFull?"Full":"Partial"} client credit: KES ${amount}.`);logActivity({userId:b.user_id,petId:b.pet_id,actorUserId:req.user.id,actorRole:"trainer",action:"client_credit_added",details:`KES ${amount} client credit added from cancelled booking ${b.booking_ref}. Balance KES ${balance}.`});return res.json({ok:true,status,amount,creditBalance:balance,refundableAmount:refundable})}
 const code=String(req.body.confirmationCode||"").trim();if(!code)return res.status(400).json({error:"Enter the M-Pesa refund/transaction confirmation code."});
 const status=isFull?"refunded":"refund_partial";db.prepare("UPDATE bookings SET payment_status=?,refund_amount=?,refund_confirmation_code=?,credit_amount=NULL,refund_recorded_at=CURRENT_TIMESTAMP WHERE id=?").run(status,amount,code,b.id);db.prepare("INSERT INTO booking_history(booking_id,actor_role,action,details) VALUES(?,?,?,?)").run(b.id,"trainer","refund_decision",`${isFull?"Full":"Partial"} refund: KES ${amount}; M-Pesa confirmation ${code}`);res.json({ok:true,status,amount,confirmationCode:code,refundableAmount:refundable});
});
function rescheduleBookingInternal(req,res,actor){
  const b=db.prepare("SELECT * FROM bookings WHERE id=?").get(req.params.id);
  if(!b)return res.status(404).json({error:"Booking not found."});
  if(actor==='client'&&b.user_id!==req.user.id)return res.status(403).json({error:"Booking not found."});
  const startAt=req.body.startAt;if(!startAt)return res.status(400).json({error:"New time required."});
  if(!privateBookingDateAllowed(startAt))return res.status(409).json({error:"Private appointments can be rescheduled from tomorrow onwards."});
  const duration=Math.round((wallClockMs(b.end_at)-wallClockMs(b.start_at))/60000);
  const buffer=b.location_type==="arena"?0:Math.max(30,b.travel_minutes||0),endAt=addMinutes(startAt,duration),bufferEnd=addMinutes(endAt,buffer);
  if(!withinWorkingHours(startAt,endAt))return res.status(409).json({error:"That appointment would finish outside Amy's working hours."});
  if(typeof recurringBlockConflict==='function'&&recurringBlockConflict(startAt,endAt))return res.status(409).json({error:"That time is blocked in Amy's recurring schedule."});
  if(serviceUnavailable(b.location_type,startAt,bufferEnd))return res.status(409).json({error:b.location_type==='home'?"Home visits are unavailable then.":"Amy's arena is unavailable then."});
  const unifiedBlock=scheduleBlockConflict(b.location_type,startAt,bufferEnd);if(unifiedBlock)return res.status(409).json({error:unifiedBlock.public_message||unifiedBlock.reason||"That new time is blocked."});
  if(!locationPlanAllows(b.location_type,startAt,endAt))return res.status(409).json({error:b.location_type==='home'?"Amy is not offering home appointments at that time.":"Amy is not offering arena appointments at that time."});
  const others=db.prepare("SELECT * FROM bookings WHERE id!=? AND status!='cancelled' AND payment_status IN ('paid','demo_paid','credit_paid','pending')").all(b.id);
  if(others.some(o=>overlaps(startAt,bufferEnd,o.start_at,o.buffer_end_at)))return res.status(409).json({error:"That new time conflicts with another booking."});
  if(db.prepare("SELECT 1 FROM availability_blocks WHERE start_at < ? AND end_at > ?").get(bufferEnd,startAt))return res.status(409).json({error:"That new time is blocked."});
  const classRows=db.prepare("SELECT s.session_date,s.start_time,s.end_time FROM class_sessions s JOIN classes c ON c.id=s.class_id WHERE c.status='open'").all();
  if(classRows.some(x=>overlaps(startAt,bufferEnd,isoDateTime(x.session_date,x.start_time),isoDateTime(x.session_date,x.end_time))))return res.status(409).json({error:"That new time overlaps a class."});
  db.prepare("UPDATE bookings SET start_at=?,end_at=?,buffer_end_at=? WHERE id=?").run(startAt,endAt,bufferEnd,b.id);
  db.prepare("INSERT INTO booking_history(booking_id,actor_role,action,details) VALUES(?,?,?,?)").run(b.id,actor,"rescheduled",`${b.start_at} → ${startAt}`);
  res.json({ok:true});
}function cancelBookingInternal(req,res,actor){const b=db.prepare("SELECT * FROM bookings WHERE id=?").get(req.params.id);if(!b)return res.status(404).json({error:"Booking not found."});if(actor==='client'&&b.user_id!==req.user.id)return res.status(403).json({error:"Booking not found."});db.prepare("UPDATE bookings SET status='cancelled',payment_status=CASE WHEN payment_status IN ('paid','demo_paid') THEN 'refund_pending' ELSE 'cancelled' END WHERE id=?").run(b.id);db.prepare("INSERT INTO booking_history(booking_id,actor_role,action,details) VALUES(?,?,?,?)").run(b.id,actor,"cancelled",req.body.reason||`Cancelled by ${actor}; refund decision pending.`);res.json({ok:true})}

app.get("/api/trainer/reviews/:id/photo",requireTrainer,(req,res)=>{
  const r=db.prepare("SELECT photo_filename FROM reviews WHERE id=?").get(req.params.id);
  if(!r?.photo_filename)return res.status(404).end(); const full=path.join(PRIVATE_UPLOAD_DIR,r.photo_filename); if(!fs.existsSync(full))return res.status(404).end(); res.sendFile(full);
});
app.post("/api/trainer/reviews/:id/status",requireTrainer,(req,res)=>{
  if(!["approved","rejected"].includes(req.body.status)) return res.status(400).json({error:"Invalid status."});
  db.prepare("UPDATE reviews SET status=? WHERE id=?").run(req.body.status,req.params.id);
  res.json({ok:true});
});
app.get("/api/trainer/clients",requireTrainer,(req,res)=>{
  expireTimedHolds();
  const users=db.prepare("SELECT id,name,email,phone,whatsapp_phone,mpesa_phone,newsletter_opt_in,kra_pin,created_at,last_login_at,status_override,COALESCE(client_status,'current') client_status FROM users WHERE role='client' ORDER BY name").all();
  const petRows=db.prepare(`SELECT p.id,p.user_id,p.name,p.gender,p.date_of_birth,p.archived,(SELECT COUNT(*) FROM bookings b WHERE b.pet_id=p.id AND b.status!='cancelled') private_count,(SELECT COUNT(*) FROM class_enrolments e WHERE e.pet_id=p.id AND e.enrolment_status='active') class_count FROM pets p ORDER BY p.archived,p.name`).all();
  res.json(users.map(u=>({...u,client_status:calculatedClientStatus(u),pets:petRows.filter(p=>p.user_id===u.id)})));
});
app.get("/api/trainer/client/:id",requireTrainer,(req,res)=>{
  const user=db.prepare("SELECT id,name,email,phone,whatsapp_phone,mpesa_phone,newsletter_opt_in,kra_pin,created_at,last_login_at,status_override,COALESCE(client_status,'current') client_status FROM users WHERE id=? AND role='client'").get(req.params.id);
  if(!user)return res.status(404).json({error:"Client not found."}); user.client_status=calculatedClientStatus(user);
  res.json({user,pets:petDetailsForUser(user.id,true),bookings:db.prepare("SELECT * FROM bookings WHERE user_id=? ORDER BY start_at DESC").all(user.id),packages:db.prepare("SELECT * FROM booking_packages WHERE user_id=? ORDER BY created_at DESC").all(user.id),classes:db.prepare("SELECT e.*,c.title,c.start_date,c.end_date FROM class_enrolments e JOIN classes c ON c.id=e.class_id WHERE e.user_id=?").all(user.id),creditBalance:clientCreditBalance(user.id),creditHistory:db.prepare("SELECT * FROM client_credit_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 30").all(user.id),activity:db.prepare(`SELECT a.created_at,a.action,a.details,p.name pet_name,c.title class_title FROM activity_history a LEFT JOIN pets p ON p.id=a.pet_id LEFT JOIN classes c ON c.id=a.class_id WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 50`).all(user.id)});
});
app.put("/api/trainer/pets/:id/private-notes",requireTrainer,(req,res)=>{
  const pet=db.prepare("SELECT id,user_id,name FROM pets WHERE id=?").get(req.params.id);
  if(!pet)return res.status(404).json({error:"Dog not found."});
  const trainerNotes=String(req.body.trainerNotes||"");
  db.prepare("UPDATE pets SET trainer_notes=? WHERE id=?").run(trainerNotes,pet.id);
  logActivity({userId:pet.user_id,petId:pet.id,actorUserId:req.user.id,actorRole:"trainer",action:"trainer_dog_notes_updated",details:`Amy updated private notes for ${pet.name}.`});
  res.json({ok:true,trainer_notes:trainerNotes});
});


// v21.8 payment recovery, reschedule requests, reports and notifications

app.post("/api/my/payments/apply-credit",requireAuth,(req,res)=>{
 const target=paymentTargetForClient(req.user.id,req.body||{});
 if(!target)return res.status(404).json({error:"Payment record not found."});
 if(target.type==="package"&&target.row.payment_status!=="pending")return res.status(409).json({error:"This package is no longer awaiting payment."});
 if(target.type==="private"&&(target.row.payment_status!=="pending"||["cancelled","expired"].includes(target.row.status)))return res.status(409).json({error:"This booking is no longer awaiting payment."});
 if(target.type==="class"&&(target.row.payment_status!=="pending"||target.row.enrolment_status!=="active"))return res.status(409).json({error:"This class place is no longer awaiting payment."});
 const available=clientCreditBalance(req.user.id),remaining=paymentTargetRemaining(target);
 if(available<=0)return res.status(409).json({error:"There is no client credit available to apply."});
 if(remaining<=0)return res.status(409).json({error:"This payment is already covered."});
 const applied=Math.min(available,remaining),newUsed=Number(target.used||0)+applied,newRemaining=remaining-applied;
 const tx=db.transaction(()=>{
   db.prepare("INSERT INTO client_credit_ledger(user_id,amount_delta,source_type,source_id,note) VALUES(?,?,?,?,?)")
     .run(req.user.id,-applied,"payment",target.row.id,`Credit applied to ${target.type} payment.`);
   if(target.type==="package"){
     if(newRemaining===0){
       db.prepare("UPDATE booking_packages SET credit_applied=?,payment_status='credit_paid',status='confirmed',hold_expires_at=NULL,payment_received_at=CURRENT_TIMESTAMP WHERE id=?").run(newUsed,target.row.id);
       db.prepare("UPDATE bookings SET payment_status='credit_paid',status='confirmed',hold_expires_at=NULL WHERE package_id=?").run(target.row.id);
     }else db.prepare("UPDATE booking_packages SET credit_applied=? WHERE id=?").run(newUsed,target.row.id);
   }else if(target.type==="class"){
     if(newRemaining===0)db.prepare("UPDATE class_enrolments SET credit_applied=?,payment_status='credit_paid',payment_received_at=CURRENT_TIMESTAMP WHERE id=?").run(newUsed,target.row.id);
     else db.prepare("UPDATE class_enrolments SET credit_applied=? WHERE id=?").run(newUsed,target.row.id);
   }else{
     if(newRemaining===0)db.prepare("UPDATE bookings SET credit_applied=?,payment_status='credit_paid',status='confirmed',hold_expires_at=NULL,payment_received_at=CURRENT_TIMESTAMP WHERE id=?").run(newUsed,target.row.id);
     else db.prepare("UPDATE bookings SET credit_applied=? WHERE id=?").run(newUsed,target.row.id);
   }
 });
 tx();
 const balance=clientCreditBalance(req.user.id);
 logActivity({userId:req.user.id,petId:target.row.pet_id||null,actorUserId:req.user.id,actorRole:"client",action:"client_credit_used",details:`KES ${applied} client credit applied to ${target.type} payment. Remaining credit KES ${balance}.`});
 res.json({ok:true,applied,remaining:newRemaining,creditBalance:balance,settled:newRemaining===0});
});

app.post("/api/my/bookings/:id/resume-payment",requireAuth,async(req,res)=>{
 expireTimedHolds();
 const b=db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
 if(!b||b.payment_status!=='pending'||!['pending_payment','provisional','confirmed'].includes(b.status))return res.status(404).json({error:"This pending booking cannot be resumed."});
 if(expiryIsPast(b.hold_expires_at))return res.status(409).json({error:"The hold has expired. Please book again."});
 const pkg=b.package_id?db.prepare("SELECT * FROM booking_packages WHERE id=? AND user_id=?").get(b.package_id,req.user.id):null;
 const total=pkg?Number(pkg.package_price||0):Number(b.price||0),used=pkg?Number(pkg.credit_applied||0):Number(b.credit_applied||0),amount=Math.max(0,total-used),reference=pkg?`PKG-${pkg.id}`:b.booking_ref;
 if(amount<=0)return res.json({bookingRef:reference,id:b.id,packageId:pkg?.id||null,amount:0,creditAvailable:clientCreditBalance(req.user.id),settled:true,type:pkg?'package':'private'});
 try{
  const m=await initiateMpesa(req.user.mpesa_phone||req.user.phone,amount,reference);
  if(pkg)db.prepare("UPDATE booking_packages SET mpesa_request_id=? WHERE id=?").run(m.checkoutRequestId,pkg.id);
  else db.prepare("UPDATE bookings SET mpesa_request_id=? WHERE id=?").run(m.checkoutRequestId,b.id);
  res.json({bookingRef:reference,id:b.id,packageId:pkg?.id||null,amount,holdExpiresAt:b.hold_expires_at,firstAppointment:isFirstAppointmentForDog(b.pet_id),creditAvailable:clientCreditBalance(req.user.id),creditApplied:used,mpesaDemo:m.demo,mpesaMessage:m.demo?"Demo payment mode: complete the trial payment.":"M-Pesa prompt sent. Approve it on your phone.",type:pkg?'package':'private'});
 }catch(e){
  res.status(502).json({error:(e.message||'Could not start M-Pesa payment.')+' Your booking remains held. You can retry the STK Push or use the manual fallback below.',bookingRef:reference,id:b.id,packageId:pkg?.id||null,amount,creditAvailable:clientCreditBalance(req.user.id),creditApplied:used,paymentPending:true,type:pkg?'package':'private'});
 }
});
app.post("/api/my/bookings/:id/cancel-pending",requireAuth,(req,res)=>{const b=db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=?").get(req.params.id,req.user.id);if(!b||b.payment_status!=='pending')return res.status(404).json({error:"Pending booking not found."});if(b.package_id){db.prepare("UPDATE booking_packages SET status='cancelled',payment_status='cancelled' WHERE id=?").run(b.package_id);db.prepare("UPDATE bookings SET status='cancelled',payment_status='cancelled' WHERE package_id=?").run(b.package_id)}else db.prepare("UPDATE bookings SET status='cancelled',payment_status='cancelled' WHERE id=?").run(b.id);logActivity({userId:req.user.id,petId:b.pet_id,actorUserId:req.user.id,actorRole:'client',action:'pending_booking_cancelled',details:`Unpaid booking ${b.booking_ref} cancelled; slot released.`});res.json({ok:true})});
app.post("/api/my/bookings/:id/manual-payment",requireAuth,(req,res)=>{
 const b=db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=?").get(req.params.id,req.user.id);
 if(!b||b.payment_status!=='pending')return res.status(404).json({error:"Pending booking not found."});
 const code=normalizeMpesaReference(req.body.confirmationCode),amount=Number(req.body.amount);
 if(!/^[A-Z0-9]{10}$/.test(code))return res.status(400).json({error:"Enter the full 10-character M-Pesa confirmation reference."});
 if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:"Enter the amount sent in KES."});
 const pkg=b.package_id?db.prepare("SELECT * FROM booking_packages WHERE id=? AND user_id=?").get(b.package_id,req.user.id):null;
 const total=pkg?Number(pkg.package_price||0):Number(b.price||0),used=pkg?Number(pkg.credit_applied||0):Number(b.credit_applied||0),due=Math.max(0,total-used);
 if(pkg?.manual_payment_status==='submitted'||b.manual_payment_status==='submitted')return res.status(409).json({error:"This payment confirmation has already been submitted to Amy."});
 if(amount!==due)return res.status(400).json({error:`The manual payment should be KES ${due.toLocaleString()}. Please check the amount before submitting the reference.`});
 db.prepare("UPDATE bookings SET manual_payment_code=?,manual_payment_amount=?,manual_payment_status='submitted' WHERE id=?").run(code,amount,b.id);
 if(pkg)db.prepare("UPDATE booking_packages SET manual_payment_code=?,manual_payment_amount=?,manual_payment_status='submitted' WHERE id=?").run(code,amount,pkg.id);
 notifyTrainer({userId:req.user.id,petId:b.pet_id,bookingId:b.id,kind:'manual_payment',message:`Manual M-Pesa payment submitted for ${pkg?`package ${pkg.name}`:b.booking_ref}: ${code}, KES ${amount}.`});
 logActivity({userId:req.user.id,petId:b.pet_id,actorUserId:req.user.id,actorRole:'client',action:'manual_payment_submitted',details:`Manual M-Pesa reference ${code} submitted for ${pkg?`package ${pkg.name}`:b.booking_ref}.`});
 res.json({ok:true,packageId:pkg?.id||null,amount,mpesaRef:code});
});
app.post("/api/trainer/bookings/:id/manual-payment",requireTrainer,(req,res)=>{
 const b=db.prepare("SELECT * FROM bookings WHERE id=?").get(req.params.id);
 if(!b||b.manual_payment_status!=='submitted')return res.status(404).json({error:"Manual payment submission not found."});
 const approve=!!req.body.approve;
 if(approve){
  db.prepare("UPDATE bookings SET payment_status='paid',status='confirmed',manual_payment_status='verified',hold_expires_at=NULL,payment_received_at=CURRENT_TIMESTAMP,mpesa_receipt_number=? WHERE id=?").run(b.manual_payment_code,b.id);
  if(b.package_id){
   const pkg=db.prepare("SELECT * FROM booking_packages WHERE id=?").get(b.package_id);
   db.prepare("UPDATE booking_packages SET payment_status='paid',status='confirmed',manual_payment_status='verified',hold_expires_at=NULL,payment_received_at=CURRENT_TIMESTAMP,mpesa_receipt_number=? WHERE id=?").run(pkg?.manual_payment_code||b.manual_payment_code,b.package_id);
   db.prepare("UPDATE bookings SET payment_status='paid',status='confirmed',hold_expires_at=NULL WHERE package_id=?").run(b.package_id);
  }
 }else{
  db.prepare("UPDATE bookings SET manual_payment_status=NULL,manual_payment_code=NULL,manual_payment_amount=NULL WHERE id=?").run(b.id);
  if(b.package_id){
   db.prepare("UPDATE booking_packages SET manual_payment_status=NULL,manual_payment_code=NULL,manual_payment_amount=NULL WHERE id=?").run(b.package_id);
   db.prepare("UPDATE bookings SET manual_payment_status=NULL,manual_payment_code=NULL,manual_payment_amount=NULL WHERE package_id=?").run(b.package_id);
  }
 }
 db.prepare("UPDATE trainer_notifications SET resolved=1 WHERE booking_id=? AND kind='manual_payment'").run(b.id);
 logActivity({userId:b.user_id,petId:b.pet_id,actorUserId:req.user.id,actorRole:'trainer',action:approve?'manual_payment_verified':'manual_payment_rejected',details:approve?`Manual payment verified for ${b.booking_ref}.`:`Manual payment rejected for ${b.booking_ref}.`});
 res.json({ok:true});
});


function createClientRescheduleRequest(req,res){expireTimedHolds();const b=db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=?").get(req.params.id,req.user.id);if(!b||b.status!=='confirmed'||!["paid","demo_paid","credit_paid"].includes(b.payment_status))return res.status(404).json({error:"Confirmed booking not found."});const used=b.package_id?db.prepare("SELECT reschedule_count n FROM booking_packages WHERE id=?").get(b.package_id)?.n:Number(b.reschedule_count||0);if(Number(used)>=3)return res.status(409).json({error:"The three client-requested reschedules have been used. Please contact Amy."});if(db.prepare("SELECT 1 FROM reschedule_requests WHERE booking_id=? AND status='pending'").get(b.id))return res.status(409).json({error:"A reschedule request is already waiting for Amy."});const startAt=String(req.body.startAt||'');if(!privateBookingDateAllowed(startAt))return res.status(409).json({error:"Choose an appointment from tomorrow onwards."});const duration=Math.round((wallClockMs(b.end_at)-wallClockMs(b.start_at))/60000),buffer=b.location_type==='arena'?0:Math.max(30,b.travel_minutes||0),endAt=addMinutes(startAt,duration),bufferEnd=addMinutes(endAt,buffer);if(!withinWorkingHours(startAt,endAt)||recurringBlockConflict(startAt,endAt)||serviceUnavailable(b.location_type,startAt,bufferEnd)||scheduleBlockConflict(b.location_type,startAt,bufferEnd))return res.status(409).json({error:"That requested time is unavailable."});const others=db.prepare("SELECT * FROM bookings WHERE id!=? AND status NOT IN ('cancelled','expired') AND payment_status IN ('paid','demo_paid','credit_paid','pending')").all(b.id);if(others.some(o=>overlaps(startAt,bufferEnd,o.start_at,o.buffer_end_at))||activeRescheduleHoldConflict(startAt,bufferEnd,b.id))return res.status(409).json({error:"That requested time is already held or booked."});const classes=db.prepare("SELECT * FROM class_sessions").all();if(classes.some(x=>overlaps(startAt,bufferEnd,isoDateTime(x.session_date,x.start_time),isoDateTime(x.session_date,x.end_time))))return res.status(409).json({error:"That requested time overlaps a class."});const hold=addHoursIso(24);const id=db.prepare("INSERT INTO reschedule_requests(booking_id,user_id,old_start_at,proposed_start_at,proposed_end_at,proposed_buffer_end_at,hold_expires_at,client_note) VALUES(?,?,?,?,?,?,?,?)").run(b.id,req.user.id,b.start_at,startAt,endAt,bufferEnd,hold,String(req.body.note||'').trim()||null).lastInsertRowid;notifyTrainer({userId:req.user.id,petId:b.pet_id,bookingId:b.id,kind:'reschedule_request',message:`Client requested a reschedule for ${b.booking_ref}: ${b.start_at} → ${startAt}.`});logActivity({userId:req.user.id,petId:b.pet_id,actorUserId:req.user.id,actorRole:'client',action:'reschedule_requested',details:`${b.start_at} → ${startAt}; held for Amy until ${hold}.`});res.json({ok:true,id,holdExpiresAt:hold})}
app.post("/api/trainer/reschedule-requests/:id/decision",requireTrainer,(req,res)=>{expireTimedHolds();const r=db.prepare("SELECT rr.*,b.package_id,b.pet_id FROM reschedule_requests rr JOIN bookings b ON b.id=rr.booking_id WHERE rr.id=?").get(req.params.id);if(!r||r.status!=='pending')return res.status(404).json({error:"Reschedule request not found or expired."});const decision=String(req.body.decision||'');if(!['approve','decline'].includes(decision))return res.status(400).json({error:"Choose approve or decline."});const note=String(req.body.note||'').trim();if(decision==='approve'){db.prepare("UPDATE bookings SET start_at=?,end_at=?,buffer_end_at=?,reschedule_count=reschedule_count+1 WHERE id=?").run(r.proposed_start_at,r.proposed_end_at,r.proposed_buffer_end_at,r.booking_id);if(r.package_id)db.prepare("UPDATE booking_packages SET reschedule_count=reschedule_count+1 WHERE id=?").run(r.package_id);db.prepare("UPDATE reschedule_requests SET status='approved',trainer_note=?,decided_at=CURRENT_TIMESTAMP WHERE id=?").run(note||null,r.id)}else db.prepare("UPDATE reschedule_requests SET status='declined',trainer_note=?,decided_at=CURRENT_TIMESTAMP WHERE id=?").run(note||null,r.id);db.prepare("UPDATE trainer_notifications SET resolved=1 WHERE booking_id=? AND kind='reschedule_request'").run(r.booking_id);logActivity({userId:r.user_id,petId:r.pet_id,actorUserId:req.user.id,actorRole:'trainer',action:decision==='approve'?'reschedule_approved':'reschedule_declined',details:decision==='approve'?`${r.old_start_at} → ${r.proposed_start_at}.`:`Reschedule request declined.${note?' '+note:''}`});res.json({ok:true})});
app.post("/api/trainer/notifications/:id/resolve",requireTrainer,(req,res)=>{db.prepare("UPDATE trainer_notifications SET resolved=1 WHERE id=?").run(req.params.id);res.json({ok:true})});

app.post("/api/bookings/package/:id/demo-pay",requireAuth,(req,res)=>{const p=db.prepare("SELECT * FROM booking_packages WHERE id=? AND user_id=? AND payment_status='pending'").get(req.params.id,req.user.id);if(!p)return res.status(404).json({error:"Package not found."});db.prepare("UPDATE booking_packages SET payment_status='demo_paid',status='confirmed',hold_expires_at=NULL,payment_received_at=CURRENT_TIMESTAMP WHERE id=?").run(p.id);db.prepare("UPDATE bookings SET payment_status='demo_paid',status='confirmed',hold_expires_at=NULL WHERE package_id=?").run(p.id);res.json({ok:true})});

app.get("/api/trainer/reports/:type",requireTrainer,(req,res)=>{
  expireTimedHolds(); const type=String(req.params.type||''),from=String(req.query.from||nairobiDateKey(-30)),to=String(req.query.to||nairobiDateKey(30)); let rows=[],title='Report';
  if(type==='daily'){title='Daily Sheet';rows=db.prepare(`SELECT b.start_at,b.end_at,u.name client,p.name dog,COALESCE(u.whatsapp_phone,u.phone) whatsapp,b.service,CASE WHEN b.location_type='arena' THEN 'Amy''s Arena in Ridgeways' ELSE 'Home visit' END location,b.address,b.payment_status FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id WHERE substr(b.start_at,1,10)=? AND b.status NOT IN ('cancelled','expired') ORDER BY b.start_at`).all(from)}
  else if(type==='appointments'){title='Appointments';rows=db.prepare(`SELECT b.start_at,b.end_at,u.name client,p.name dog,b.service,b.location_type,b.address,b.status,b.payment_status,CASE WHEN b.package_id IS NOT NULL THEN COALESCE(bp.package_price,0) ELSE b.price END price,b.booking_ref,bp.name package_name FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id LEFT JOIN booking_packages bp ON bp.id=b.package_id WHERE substr(b.start_at,1,10) BETWEEN ? AND ? ORDER BY b.start_at`).all(from,to)}
  else if(type==='payments'){
    title='Payments';
    const privateRows=db.prepare(`
      SELECT COALESCE(b.payment_received_at,b.created_at) received_at,
             u.name client,
             CASE WHEN b.payment_status='credit_paid' THEN 0
                  WHEN b.manual_payment_status='verified' AND b.manual_payment_amount IS NOT NULL THEN b.manual_payment_amount
                  ELSE MAX(COALESCE(b.price,0)-COALESCE(b.credit_applied,0),0) END amount,
             COALESCE(b.mpesa_receipt_number,b.manual_payment_code,'') mpesa_ref,
             b.payment_status status,
             TRIM(
               CASE WHEN COALESCE(b.refund_amount,0)>0 THEN 'Refund KES '||b.refund_amount||' ' ELSE '' END ||
               CASE WHEN COALESCE(b.credit_amount,0)>0 THEN 'Credit granted KES '||b.credit_amount||' ' ELSE '' END ||
               CASE WHEN COALESCE(b.credit_applied,0)>0 THEN 'Credit applied KES '||b.credit_applied ELSE '' END
             ) refund_credit,
             'Private' source,p.name dog,b.booking_ref
      FROM bookings b JOIN users u ON u.id=b.user_id LEFT JOIN pets p ON p.id=b.pet_id
      WHERE b.package_id IS NULL AND b.payment_status NOT IN ('pending','cancelled','failed')
        AND substr(COALESCE(b.payment_received_at,b.created_at),1,10) BETWEEN ? AND ?`).all(from,to);
    const packageRows=db.prepare(`
      SELECT COALESCE(bp.payment_received_at,bp.created_at) received_at,
             u.name client,
             CASE WHEN bp.payment_status='credit_paid' THEN 0
                  WHEN bp.manual_payment_status='verified' AND bp.manual_payment_amount IS NOT NULL THEN bp.manual_payment_amount
                  ELSE MAX(COALESCE(bp.package_price,0)-COALESCE(bp.credit_applied,0),0) END amount,
             COALESCE(bp.mpesa_receipt_number,bp.manual_payment_code,'') mpesa_ref,
             bp.payment_status status,
             CASE WHEN COALESCE(bp.credit_applied,0)>0 THEN 'Credit applied KES '||bp.credit_applied ELSE '' END refund_credit,
             'Package' source,p.name dog,('PACKAGE-'||bp.id) booking_ref
      FROM booking_packages bp JOIN users u ON u.id=bp.user_id LEFT JOIN pets p ON p.id=bp.pet_id
      WHERE bp.payment_status NOT IN ('pending','cancelled','failed')
        AND substr(COALESCE(bp.payment_received_at,bp.created_at),1,10) BETWEEN ? AND ?`).all(from,to);
    const classRows=db.prepare(`
      SELECT COALESCE(e.payment_received_at,e.created_at) received_at,
             u.name client,
             CASE WHEN e.payment_status='credit_paid' THEN 0
                  WHEN e.manual_payment_status='verified' AND e.manual_payment_amount IS NOT NULL THEN e.manual_payment_amount
                  ELSE MAX(COALESCE(c.price,0)-COALESCE(e.credit_applied,0),0) END amount,
             COALESCE(e.mpesa_receipt_number,e.manual_payment_code,'') mpesa_ref,
             e.payment_status status,
             TRIM(
               CASE WHEN COALESCE(e.refund_amount,0)>0 THEN 'Refund KES '||e.refund_amount||' ' ELSE '' END ||
               CASE WHEN COALESCE(e.credit_amount,0)>0 THEN 'Credit granted KES '||e.credit_amount||' ' ELSE '' END ||
               CASE WHEN COALESCE(e.credit_applied,0)>0 THEN 'Credit applied KES '||e.credit_applied ELSE '' END
             ) refund_credit,
             'Class' source,p.name dog,e.booking_ref
      FROM class_enrolments e JOIN users u ON u.id=e.user_id LEFT JOIN pets p ON p.id=e.pet_id JOIN classes c ON c.id=e.class_id
      WHERE e.payment_status NOT IN ('pending','cancelled','failed')
        AND substr(COALESCE(e.payment_received_at,e.created_at),1,10) BETWEEN ? AND ?`).all(from,to);
    rows=[...privateRows,...packageRows,...classRows].sort((x,y)=>String(x.received_at).localeCompare(String(y.received_at)));
  }
  else if(type==='clients'){title='Clients';rows=db.prepare(`SELECT u.id,u.name,u.email,COALESCE(u.whatsapp_phone,u.phone) whatsapp,COALESCE(u.mpesa_phone,u.phone) mpesa,u.kra_pin,u.newsletter_opt_in,u.created_at,u.last_login_at,u.status_override,GROUP_CONCAT(CASE WHEN p.archived=0 THEN p.name END, ', ') dogs FROM users u LEFT JOIN pets p ON p.user_id=u.id WHERE u.role='client' GROUP BY u.id ORDER BY u.name`).all().map(u=>({...u,status:calculatedClientStatus(u)}))}
  else if(type==='vaccinations'){title='Vaccinations';rows=db.prepare(`SELECT u.name client,p.name dog,p.vaccination_status,p.vaccination_verified_at,(SELECT COUNT(*) FROM pet_files f WHERE f.pet_id=p.id AND f.kind='vaccination') files FROM pets p JOIN users u ON u.id=p.user_id WHERE p.archived=0 ORDER BY u.name,p.name`).all()}
  else if(type==='newsletter'){title='The Canine Grapevine';rows=db.prepare(`SELECT name,email,COALESCE(whatsapp_phone,phone) whatsapp,last_login_at FROM users WHERE role='client' AND newsletter_opt_in=1 ORDER BY name`).all()}
  else return res.status(404).json({error:'Unknown report.'}); res.json({title,type,from,to,generatedAt:new Date().toISOString(),rows});
});

// M-Pesa callback
app.post("/api/mpesa/callback",(req,res)=>{
 const cb=req.body?.Body?.stkCallback;
 if(cb?.CheckoutRequestID){
  const status=Number(cb.ResultCode)===0?"paid":"failed";
  const items=Array.isArray(cb.CallbackMetadata?.Item)?cb.CallbackMetadata.Item:[];
  const receipt=normalizeMpesaReference(items.find(x=>x?.Name==="MpesaReceiptNumber")?.Value||"")||null;
  const bk=db.prepare("SELECT * FROM bookings WHERE mpesa_request_id=?").get(cb.CheckoutRequestID);
  if(bk)db.prepare(`UPDATE bookings SET payment_status=?,status=CASE WHEN ?='paid' THEN 'confirmed' ELSE status END,hold_expires_at=CASE WHEN ?='paid' THEN NULL ELSE hold_expires_at END,payment_received_at=CASE WHEN ?='paid' THEN CURRENT_TIMESTAMP ELSE payment_received_at END,mpesa_receipt_number=CASE WHEN ?='paid' THEN ? ELSE mpesa_receipt_number END WHERE id=?`).run(status,status,status,status,status,receipt,bk.id);
  const pkg=db.prepare("SELECT * FROM booking_packages WHERE mpesa_request_id=?").get(cb.CheckoutRequestID);
  if(pkg){
   db.prepare(`UPDATE booking_packages SET payment_status=?,status=CASE WHEN ?='paid' THEN 'confirmed' ELSE status END,hold_expires_at=CASE WHEN ?='paid' THEN NULL ELSE hold_expires_at END,payment_received_at=CASE WHEN ?='paid' THEN CURRENT_TIMESTAMP ELSE payment_received_at END,mpesa_receipt_number=CASE WHEN ?='paid' THEN ? ELSE mpesa_receipt_number END WHERE id=?`).run(status,status,status,status,status,receipt,pkg.id);
   db.prepare("UPDATE bookings SET payment_status=?,status=CASE WHEN ?='paid' THEN 'confirmed' ELSE status END,hold_expires_at=CASE WHEN ?='paid' THEN NULL ELSE hold_expires_at END WHERE package_id=?").run(status,status,status,pkg.id);
  }
 }
 res.json({ResultCode:0,ResultDesc:"Accepted"});
});


app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({error:"That image is too large. Please use an image of 20 MB or less."});
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(413).json({error:"You can upload a maximum of 7 images at a time."});
    }
    return res.status(400).json({error:"The image upload could not be completed. Please check the files and try again."});
  }
  if (err) {
    console.error("Upload/server error:", err);
    return res.status(500).json({error:"Something went wrong while processing that request. Please try again."});
  }
  next();
});

app.use((req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.use((err,req,res,next)=>{
  if(err instanceof multer.MulterError){
    const msg=err.code==='LIMIT_FILE_SIZE'?'The selected file is too large. Please choose a file of 50 MB or less.':err.message;
    return res.status(400).json({error:msg});
  }
  console.error(err);
  res.status(500).json({error:'The server could not complete that request.'});
});

app.listen(PORT,"0.0.0.0",()=>console.log(`The Custom Made Canine v${APP_VERSION} listening on port ${PORT}`));
