const app=document.getElementById("app");
const state={user:null,menu:false,view:"home",classes:[],reviews:[],config:null,selectedService:null,selectedLocation:null,selectedDate:null,address:"",slots:[],selectedSlot:null,selectedClass:null,selectedPet:null,showAddPet:false,trainerCalendar:null,trainerWeekStart:null,trainerSelectedDate:null,scheduleModal:null,resourceUploadOpen:false,accountOpen:false,pendingBlock:null,authEmailRemembered:"",vaccinationReview:null,trainerMonthDate:null,trainerMonthCalendar:null,serviceAvailability:null,serviceAvailabilityModal:null,trainerClientBooking:null,trainerClientBookingSlots:[],trainerAdminPage:null,workingHours:null,reviewAdmin:null,clientAdmin:null,selectedReviewAdmin:null,rescheduleDraft:null,classAdmin:null,selectedClassAdmin:null,editPet:null,workingExceptionModal:null,activityAdmin:null,selectedDayStatus:null,trainerDayMeta:null,locationPlanModal:null,recurringBlockModal:null,addPetBookingContext:null,schedulingDate:null,scheduleBlocks:[]};

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money=n=>`KES ${Number(n||0).toLocaleString()}`;
const fmt=d=>new Date(d).toLocaleString("en-KE",{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
const toDateTimeLocal=d=>{const x=new Date(d);const pad=n=>String(n).padStart(2,"0");return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`};
async function api(url,opt={}) {
  const headers={...(opt.headers||{})};
  if(opt.body && !(opt.body instanceof FormData) && !headers["Content-Type"]) headers["Content-Type"]="application/json";
  const r=await fetch(url,{headers,...opt});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(data.error||"Something went wrong.");Object.assign(e,data);throw e;}
  return data;
}
async function init(){
  state.startupError=""; state.starting=true; render();
  try {
    const me=await api("/api/auth/me");
    state.user=me.user||null;
    if(state.user?.role==="trainer"){
      state.view="trainer"; state.menu=false;
      try{ state.trainer=await api("/api/trainer/summary"); await loadTrainerCalendar(new Date()); await loadTrainerMonth(new Date()); state.serviceAvailability=await api("/api/trainer/service-availability"); }
      catch(e){ state.startupError=e.message||"Could not load Amy's dashboard."; }
    } else if(state.user?.role==="client"){
      state.view="portal"; state.menu=false;
      try{
        state.profile=await api("/api/my/profile");
        state.bookings=await api("/api/my/bookings");
        state.resources=await api("/api/my/resources");
        state.trainingNotes=await api("/api/my/training-notes");
      }catch(e){ state.startupError=e.message||"Could not load your client portal."; }
    } else state.view="home";
    const results=await Promise.allSettled([api("/api/classes"),api("/api/reviews"),api("/api/config")]);
    const [classes,reviews,config]=results;
    if(classes.status==="fulfilled"&&Array.isArray(classes.value)) state.classes=classes.value;
    if(reviews.status==="fulfilled"&&Array.isArray(reviews.value)) state.reviews=reviews.value;
    if(config.status==="fulfilled") state.config=config.value||{};
    if(!state.startupError){const failed=results.find(x=>x.status==="rejected");if(failed)state.startupError=failed.reason?.message||"One part of the app could not be loaded.";}
  }catch(e){state.user=null;state.view="home";state.startupError=e.message||"Could not start the application.";}
  finally{state.starting=false;render();}
}
function shell(content){
  return `<div class="app-shell">
    <header class="topbar">
      <div class="brand"><img class="brand-logo" src="/brand-logo.png" alt="The Custom Made Canine logo"><div class="brand-name">The Custom Made Canine</div></div>
      <button class="menu-btn" aria-label="Open menu" onclick="toggleMenu()">☰</button>
    </header>
    <main onclick="if(state.menu){state.menu=false;render()}">${state.config?.onlineTest?`<div class="online-test-banner" role="status"><span>TEST VERSION</span><span>Demo payments only · Please do not upload real vaccination or other sensitive documents.</span></div>`:""}${state.startupError?`<div class="startup-warning" role="status"><b>Some information could not be loaded.</b><span>${esc(state.startupError)}</span><button class="secondary compact-button" onclick="init()">Retry</button></div>`:''}${content}</main>
    ${state.menu?`<nav class="menu" aria-label="Main menu">
      <button onclick="go('about')">More about Amy</button>
      <button onclick="portal()">Client Portal</button>
      <button onclick="contactAmy()">Contact Amy</button>
      ${state.user?.role==="trainer"?`<button onclick="go('trainer')">Trainer Dashboard</button>`:""}
      ${state.user?`<button onclick="go('account')">Account & security</button><button onclick="logout()">Sign out</button>`:""}
    </nav>`:""}
  </div>`;
}
function toggleMenu(){state.menu=!state.menu;render()}
function go(v){state.view=v;state.menu=false;render()}
function home(){
 const reviews=state.reviews||[];
 return `<section class="screen home-screen"><div class="home-layout">
  <div class="home-intro">
    <div class="eyebrow">Dog training · Nairobi</div>
    <h1>Set your dog up for life!</h1>
    <p class="lead">Work with Amy through one-on-one training or an upcoming course. Simple booking, clear guidance and a private place for your training resources.</p>
    <div class="home-actions">
      <button class="primary home-action" onclick="startPrivate()"><strong>Private Training</strong><span>One-on-One training at home or at Amy's arena</span></button>
      <button class="secondary home-action" onclick="go('classes')"><strong>Take part in Class</strong><span>Reserve your spot in the upcoming course</span></button>
    </div>
  </div>
  <aside class="home-reviews" aria-label="Client reviews">
    <div class="home-reviews-head"><div><div class="eyebrow">Client stories</div><h2>What clients say</h2></div></div>
    <div class="home-review-list">${reviews.length?reviews.map(r=>`<article class="home-review">${r.photo_url?`<img class="review-photo" src="${r.photo_url}" alt="Photo shared with ${esc(r.name)}’s review">`:""}<div><div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</div><b>${esc(r.name)}</b><p>${esc(r.text)}</p></div></article>`).join(""):`<div class="review-empty">Client reviews appear here.</div>`}</div>
  </aside>
 </div>${floatingWhatsapp()}</section>`;
}
function about(){
 return `<section class="screen meet-amy-screen"><button class="back" onclick="go('home')">← Home</button><div class="center"><div class="meet-amy-content">
  <div class="eyebrow">Meet Amy</div><h1>Thoughtful training, built around real life.</h1>
  <div class="amy-photo-slot" role="img" aria-label="Space for Amy's photograph"><span>Photo of Amy</span></div>
  <div class="amy-bio"><p class="lead">Amy helps families build practical skills, clearer communication and calmer routines with their dogs.</p>
  <p>Replace this text with Amy's own story, qualifications, training philosophy and the kinds of cases she most enjoys helping.</p></div>
  <div class="actions"><button class="primary" onclick="startPrivate()">Book private training</button><button class="secondary" onclick="contactAmy()">WhatsApp Amy</button></div>
 </div></div></section>`;
}
function bookingBackView(){return state.bookingOrigin==="portal"?"portal":"home"}
function openPortalClasses(){state.bookingOrigin="portal";state.selectedClass=null;go("classes")}
function classes(){
 return `<section class="screen"><button class="back" onclick="go(bookingBackView())">← Back</button><div class="two-col">
  <div><h2>Take part in Class</h2><p class="page-subtitle">Reserve your spot in the upcoming course</p><p class="small">Courses may contain different numbers of connected sessions. Your booking reserves the complete course.</p>
    <div class="list">${state.classes.map(c=>`<button class="card ${state.selectedClass?.id===c.id?"selected":""}" onclick="selectClass(${c.id})" style="text-align:left">
      <h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><p><b>${c.start_date}</b> → <b>${c.end_date}</b> · ${c.start_time}–${c.end_time}</p>
      <p><b>${c.remaining}</b> places left · ${money(c.price)}</p>
    </button>`).join("")}</div>
  </div>
  <div class="panel">${state.selectedClass?classDetails():`<div class="center"><p>Select a course to see its dates and details.</p></div>`}</div>
 </div></section>`;
}
function ageMonthsOnClient(dob,onDate){
 if(!dob||!onDate)return null;
 const a=parseDateKey(dob),b=parseDateKey(onDate);if(!a||!b)return null;
 let m=(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth();
 if(b.getDate()<a.getDate())m--;
 return Math.max(0,m);
}
function classAgeLabel(c){
 if(c.min_age_months==null&&c.max_age_months==null)return "Any age";
 if(c.min_age_months!=null&&c.max_age_months!=null)return `${c.min_age_months}–${c.max_age_months} months`;
 if(c.min_age_months!=null)return `${c.min_age_months}+ months`;
 return `Up to ${c.max_age_months} months`;
}
function dogClassEligibility(p,c){
 if(!c||(c.min_age_months==null&&c.max_age_months==null))return {ok:true,label:"Eligible"};
 if(!p.date_of_birth)return {ok:false,code:"dob",label:"Add date of birth"};
 const months=ageMonthsOnClient(p.date_of_birth,c.start_date);
 if(months==null)return {ok:false,code:"dob",label:"Check date of birth"};
 if(c.min_age_months!=null&&months<Number(c.min_age_months))return {ok:false,code:"age",label:`${months} months · too young`};
 if(c.max_age_months!=null&&months>Number(c.max_age_months))return {ok:false,code:"age",label:`${months} months · too old`};
 return {ok:true,label:`${months} months at course start`};
}
function classDetails(){
 const c=state.selectedClass;
 return `<div><div class="eyebrow">${c.sessions.length}-session course</div><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p>
 <div class="notice">All ${c.sessions.length} sessions are included. Individual class dates cannot be changed and new clients cannot join after the course starts.</div>
 <div class="class-age-rule">Age range at course start: ${esc(classAgeLabel(c))}</div>
 <div class="list">${c.sessions.map((s,i)=>`<div class="kpi"><span>Class ${i+1}</span><span>${new Date(s.session_date+"T12:00:00").toLocaleDateString("en-KE",{weekday:"short",day:"numeric",month:"short"})} · ${s.start_time}–${s.end_time}</span></div>`).join("")}</div>
 ${state.user?dogPicker("class"):"<div class=\"notice\">Your dog will be selected after you sign in or create your client account. Your course choice is saved.</div>"}
 <div class="actions"><button class="primary" ${state.user&&!state.selectedPet?"disabled":""} onclick="joinClass()">Take part in Class · ${money(c.price)}</button></div>
 </div>`;
}
function startPrivate(origin){state.bookingOrigin=origin||"home";state.selectedService=null;state.selectedLocation=null;state.selectedDate=null;state.slots=[];state.selectedSlot=null;state.selectedPet=null;state.selectedDayStatus=null;go("private")}
function dogPicker(context){
 const pets=(state.profile?.pets||[]).filter(p=>!p.archived);
 return `<div class="booking-dog-picker"><div class="eyebrow">For which dog?</div><h3>Select the dog being trained</h3>
 ${pets.length?`<div class="booking-dog-grid">${pets.map(p=>{const eligibility=context==="class"?dogClassEligibility(p,state.selectedClass):{ok:true,label:""};return `<button type="button" class="booking-dog ${state.selectedPet===p.id?"selected":""} ${!eligibility.ok?"dog-ineligible":""}" ${!eligibility.ok?"disabled":""} aria-pressed="${state.selectedPet===p.id}" onclick="selectPetForBooking(${p.id})"><span class="booking-dog-photo">${p.photo_url?`<img src="${p.photo_url}" alt="">`:`🐕`}</span><span><span class="dog-picker-name">${esc(p.name)}</span><small>${esc(p.breed||p.species||"Dog")}${context==="class"?` · ${esc(eligibility.label)}`:""}</small></span><span>${state.selectedPet===p.id?"✓":""}</span></button>`}).join("")}</div>`:`<div class="notice">No active dog profiles yet. Add your dog here to continue.</div>`}
 <div class="actions booking-add-dog-row"><button type="button" class="secondary compact-button" onclick="startAddDogFromBooking('${context}')">＋ Add dog</button></div>
 ${context==="class"&&state.selectedClass&&(state.selectedClass.min_age_months!=null||state.selectedClass.max_age_months!=null)?`<p class="class-age-help">Only dogs matching the course age range can be selected. If a date of birth is missing, add or edit it before joining the course.</p>`:""}
 ${state.showAddPet&&state.addPetBookingContext===context?addDogModal():""}
 </div>`;
}
function selectPetForBooking(id){state.selectedPet=Number(id);render()}
function startAddDogFromBooking(context){state.addPetBookingContext=context;state.showAddPet=true;state.editPet=null;render()}
function closeAddDogModal(){state.showAddPet=false;state.addPetBookingContext=null;render()}
function selectPetForBooking(id){state.selectedPet=Number(id);render()}
function privateView(){
 return `<section class="screen"><button class="back" onclick="go(bookingBackView())">← Back</button><div class="two-col">
 <div><h2>Private Training</h2><p class="page-subtitle">One-on-One training at home or at Amy’s arena</p><div class="card-grid">
  ${serviceCard("consultation","Initial consultation","90 minutes · KES 5,000")}
  ${serviceCard("standard","Training session","60 minutes · KES 4,000")}
  ${serviceCard("extra","Training + extra time","90 minutes · KES 6,000")}
 </div>
 <h3 style="margin-top:14px">Where?</h3><div class="actions" style="margin-top:5px">
  <button class="${state.selectedLocation==="arena"?"primary":"secondary"}" onclick="pickLocation('arena')">Amy's arena</button>
  <button class="${state.selectedLocation==="home"?"primary":"secondary"}" onclick="pickLocation('home')">At my home</button>
 </div>
 ${state.selectedLocation==="home"?`<label style="margin-top:12px">Home address<input id="address" value="${esc(state.address||"")}" placeholder="Estate, road, Nairobi" oninput="state.address=this.value;updatePrivateContinueState()"></label>`:""}
 <label style="margin-top:12px">Date<input type="date" id="privateDate" value="${state.selectedDate||""}" min="${earliestPrivateDate()}" aria-describedby="dateHelp"></label>
 <div class="actions" style="margin-top:8px"><button type="button" class="secondary" onclick="checkAvailability()">Check available times</button></div>
 <p id="dateHelp" class="small">The earliest appointment is tomorrow. Choose a date, then select Check available times. You can check availability before signing in.</p>
 </div>
 <div class="panel"><h2>Choose a time</h2>${state.selectedDayStatus?.restrictionMessage?`<div class="notice service-client-message">${esc(state.selectedDayStatus.restrictionMessage)}</div>`:""}${state.slots.length?`<div class="time-grid">${state.slots.map(s=>`<button class="time ${state.selectedSlot?.start===s.start?"selected":""}" onclick='selectSlot(${JSON.stringify(s)})'>${String(s.start).slice(11,16)}${s.travelMinutes?`<small><br>${s.travelMinutes} min travel</small>`:""}</button>`).join("")}</div>`:`<div class="center"><p>${state.selectedService&&state.selectedLocation&&state.selectedDate?"No suitable times are available on this date.":"Choose a service, location and date."}</p></div>`}
 ${state.selectedSlot?(state.user?dogPicker("private"):`<div class="notice"><b>Your dog will be selected after you sign in or create your client account.</b><br>Your training choices are saved.</div>`):""}
 ${state.selectedSlot?`${state.user&&state.selectedLocation==="home"?`<p id="privateAddressNeeded" class="notice" ${privateAddressReady()?"hidden":""}>Add the home address above to continue.</p>`:""}<div class="actions"><button id="privateContinueBtn" class="primary" ${state.user&&(!state.selectedPet||!privateAddressReady())?"disabled":""} onclick="confirmPrivate()">Continue to details</button></div>`:""}
 </div></div></section>`;
}
function serviceCard(id,title,desc){
 return `<button type="button" class="choice ${state.selectedService===id?"selected":""}" aria-pressed="${state.selectedService===id}" onclick="changePrivateService('${id}')"><strong>${title}</strong><span>${desc}</span><span class="choice-status">${state.selectedService===id?"✓ Selected":"Select this option"}</span></button>`;
}
async function changePrivateService(id){
 const date=document.getElementById("privateDate")?.value||state.selectedDate||"";
 if(/^\d{4}-\d{2}-\d{2}$/.test(date))state.selectedDate=date;
 state.selectedService=id;state.selectedSlot=null;state.slots=[];state.selectedDayStatus=null;render();
 if(state.selectedDate&&state.selectedLocation)setTimeout(checkAvailability,0);
}
async function pickLocation(x){
 const date=document.getElementById("privateDate")?.value||state.selectedDate||"";
 if(/^\d{4}-\d{2}-\d{2}$/.test(date))state.selectedDate=date;
 state.address=document.getElementById("address")?.value||state.address||"";
 state.selectedLocation=x;state.selectedSlot=null;state.slots=[];state.selectedDayStatus=null;render();
 if(state.selectedDate&&state.selectedService)setTimeout(checkAvailability,0);
}
async function checkAvailability(){
 const dateInput=document.getElementById("privateDate");
 const value=dateInput?.value||state.selectedDate||"";
 if(!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)){alert("Please enter or select a complete date first.");return;}
 state.selectedDate=value;
 if(value<earliestPrivateDate()){state.slots=[];state.selectedSlot=null;state.selectedDayStatus=null;render();return alert("Private appointments can be booked from tomorrow onwards.");}
 if(!state.selectedService || !state.selectedLocation){alert("Please choose a training type and location first.");render();return;}
 const address=document.getElementById("address")?.value||state.address||"";state.address=address;
 try{
  const status=await api(`/api/day-status?date=${encodeURIComponent(value)}`);
  const r=status.restrictions?.[state.selectedLocation];
  state.selectedDayStatus={...status,restrictionMessage:status.amyBlock?`Sorry, Amy has no training availability on ${displayDate(value,{day:"numeric",month:"long",year:"numeric"})}. ${status.amyBlock.reason||""}`:!r?.available?`Sorry, Amy can’t offer ${state.selectedLocation==="arena"?"arena training":"home appointments"} on ${displayDate(value,{day:"numeric",month:"long",year:"numeric"})}. ${r.reason||"This location is unavailable."}`:""};
  state.slots=await api(`/api/availability?date=${encodeURIComponent(value)}&locationType=${state.selectedLocation}&address=${encodeURIComponent(address)}&service=${state.selectedService}`);
  state.selectedSlot=null;render();
 }catch(e){state.slots=[];state.selectedSlot=null;render();alert(e.message)}
}
function selectSlot(s){state.selectedSlot=s;render()}
function auth(message=""){
 state.authMessage=message;
 state.authReturnToBooking=/time is selected|place is selected/i.test(String(message||""));
 state.authMode="choice";
 go("auth");
}
function bookingSavedSummary(){
 const parts=[];
 if(state.selectedService){parts.push(state.selectedService==="consultation"?"Initial consultation":state.selectedService==="extra"?"Training + extra time":"Training session")}
 if(state.selectedLocation)parts.push(state.selectedLocation==="home"?"At my home":"Amy's arena")
 if(state.selectedDate)parts.push(new Date(state.selectedDate+"T12:00:00").toLocaleDateString("en-KE",{weekday:"short",day:"numeric",month:"short",year:"numeric"}))
 if(state.selectedSlot)parts.push(new Date(state.selectedSlot.start).toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit"}))
 if(state.address && state.selectedLocation==="home")parts.push(state.address);
 return parts;
}
function authView(){
 const parts=bookingSavedSummary();
 const hasBooking=!!(state.selectedService||state.selectedClass);
 return `<section class="screen"><button class="back" onclick="go(state.selectedService?'private':'classes')">← Back to booking</button><div class="center"><div class="panel auth-panel">
 <div class="eyebrow">One quick step</div><h2>${hasBooking?"Your booking is saved":"Client Portal"}</h2>
 ${hasBooking?`<div class="notice good saved-notice"><b>✓ All your changes have been saved.</b><br>Your booking choices will stay here while you sign in or create your client account.</div>`:""}
 <p class="auth-message">${esc(state.authMessage||"To continue, choose the option that applies to you.")}</p>
 ${state.authMode==="choice"?`<div class="auth-choice-grid">
   <button class="auth-choice" onclick="state.authMode='login';render()"><span class="auth-choice-icon">↪</span><strong>I already have an account</strong><span>Sign in to continue with your saved booking.</span></button>
   <button class="auth-choice" onclick="state.authMode='register';render()"><span class="auth-choice-icon">＋</span><strong>I'm a new client</strong><span>Create an account to continue. It only takes a moment.</span></button>
 </div>`:`<button class="back auth-back" onclick="state.authMode='choice';render()">← Choose another option</button>
 ${state.authMode==="register"?`<label>Name<input id="authName" autocomplete="name"></label>`:""}
 <label>Email<input id="authEmail" type="email" autocomplete="email" value="${esc(localStorage.getItem("cmc_last_email")||"")}"></label>
 ${state.authMode==="register"?`<label>Mobile / M-Pesa number<input id="authPhone" placeholder="2547..." autocomplete="tel"></label>`:""}
 <label>Password<input id="authPassword" type="password" autocomplete="current-password"></label>
 <div class="actions"><button class="primary" onclick="submitAuth()">${state.authMode==="register"?"Create my account":"Sign in and continue"}</button></div>
 ${state.authMode==="login"?`<button class="text-button" onclick="showForgotPassword()">Forgot your password?</button>
 ${localStorage.getItem("cmc_last_email")?`<div class="notice compact"><b>Email remembered:</b> ${esc(localStorage.getItem("cmc_last_email"))}. Your password is never stored here.</div>`:""}`:""}` }
 </div></div></section>`;
}
function showForgotPassword(){
 state.authMode="forgot"; state.menu=false; render();
}
function forgotPasswordView(){
 return `<section class="screen narrow"><div class="panel"><div class="eyebrow">Account recovery</div><h2>Reset your password</h2>
 <p>Enter your client account email. For this local trial, the reset code will be shown on screen; the live system will deliver it securely.</p>
 <label>Email<input id="resetEmail" type="email" autocomplete="email" value="${esc(localStorage.getItem("cmc_last_email")||"")}"></label>
 <div class="actions"><button class="primary" onclick="requestReset()">Send reset code</button><button class="secondary" onclick="state.authMode='login';render()">Back to sign in</button></div>
 </div></section>`;
}
async function requestReset(){
 try{
  const email=document.getElementById("resetEmail").value.trim();
  const d=await api("/api/auth/forgot-password",{method:"POST",body:JSON.stringify({email})});
  state.resetEmail=email; state.resetCode=d.resetCode; state.authMode="reset"; render();
 }catch(e){alert(e.message)}
}
function resetPasswordView(){
 return `<section class="screen narrow"><div class="panel"><div class="eyebrow">Account recovery</div><h2>Choose a new password</h2>
 <div class="notice good"><b>Your trial reset code</b><br><code class="reset-code">${esc(state.resetCode||"")}</code><br>It expires in 30 minutes and can only be used once.</div>
 <label>Email<input id="resetEmail2" type="email" value="${esc(state.resetEmail||"")}" autocomplete="email"></label>
 <label>Reset code<input id="resetCode" value="${esc(state.resetCode||"")}" autocomplete="one-time-code"></label>
 <label>New password<input id="resetNewPassword" type="password" autocomplete="new-password"></label>
 <label>Confirm new password<input id="resetConfirmPassword" type="password" autocomplete="new-password"></label>
 <div class="actions"><button class="primary" onclick="completeReset()">Set new password</button></div>
 </div></section>`;
}
async function completeReset(){
 const email=document.getElementById("resetEmail2").value.trim(), code=document.getElementById("resetCode").value.trim();
 const a=document.getElementById("resetNewPassword").value,b=document.getElementById("resetConfirmPassword").value;
 if(a!==b)return alert("The new passwords do not match.");
 try{await api("/api/auth/reset-password",{method:"POST",body:JSON.stringify({email,resetCode:code,newPassword:a})});
 localStorage.setItem("cmc_last_email",email); state.authMode="login"; state.authMessage="Your password has been reset. You can now sign in."; render();
 }catch(e){alert(e.message)}
}
async function submitAuth(){
 try{
  const body={email:document.getElementById("authEmail").value.trim(),password:document.getElementById("authPassword").value};
  if((state.authMode||"login")==="register"){body.name=document.getElementById("authName").value;body.phone=document.getElementById("authPhone").value}
  localStorage.setItem("cmc_last_email",body.email);
  const d=await api(`/api/auth/${(state.authMode||"login")==="register"?"register":"login"}`,{method:"POST",body:JSON.stringify(body)});
  state.user=d.user;
  if(state.user.role==="trainer"){
    state.authReturnToBooking=false;state.menu=false;state.trainer=await api("/api/trainer/summary");await loadTrainerCalendar(new Date());await loadTrainerMonth(new Date());state.serviceAvailability=await api("/api/trainer/service-availability");go("trainer");
  }else{
    state.profile=await api("/api/my/profile");
    if(state.authReturnToBooking){
      state.authReturnToBooking=false;
      if(state.selectedClass) go("classes"); else if(state.selectedService) go("private"); else await portal();
    }else{
      clearBookingDraft();
      await portal();
    }
  }
 }catch(e){alert(e.message)}
}
function clearBookingDraft(){
 state.selectedService=null;state.selectedLocation=null;state.selectedDate=null;state.slots=[];state.selectedSlot=null;state.selectedClass=null;state.selectedPet=null;state.address="";state.confirm=null;
}
function privateAddressReady(){return state.selectedLocation!=="home"||!!String(state.address||"").trim()}
function updatePrivateContinueState(){
 const v=document.getElementById("address")?.value||"";state.address=v;const btn=document.getElementById("privateContinueBtn"),note=document.getElementById("privateAddressNeeded");
 if(btn)btn.disabled=!!state.user&&(!state.selectedPet||!privateAddressReady());if(note)note.hidden=privateAddressReady();
}
async function confirmPrivate(){
 if(!state.user)return auth("Your time is selected. Please sign in or create an account to continue to payment.");
 if(!state.selectedPet)return alert("Please select which dog this training is for.");
 const address=document.getElementById("address")?.value||state.address||"";
 state.address=address;if(state.selectedLocation==="home"&&!address.trim())return alert("Please add the home address before continuing.");
 const d=await api("/api/bookings/private",{method:"POST",body:JSON.stringify({
  service:state.selectedService,locationType:state.selectedLocation,address,startAt:state.selectedSlot.start,petId:state.selectedPet
 })});
 state.confirm={...d,type:"private",service:state.selectedService,locationType:state.selectedLocation,address,startAt:state.selectedSlot.start,endAt:state.selectedSlot.end};go("payment");
}
async function joinClass(){
 if(!state.user)return auth("Your place is selected. Please sign in or create an account to continue to payment.");
 if(!state.selectedPet)return alert("Please select which dog this class is for.");
 const pet=(state.profile?.pets||[]).find(p=>p.id===state.selectedPet);
 if(!pet||pet.archived)return alert("Please select an active dog.");
 const eligibility=dogClassEligibility(pet,state.selectedClass);
 if(!eligibility.ok){
   if(eligibility.code==="dob"){alert(`Please add ${pet.name}'s date of birth in the Dogs area before joining this age-restricted course.`);state.portalTab="dogs";return portal();}
   return alert(`${pet.name} does not meet this course's age range.`);
 }
 try{
  const d=await api(`/api/classes/${state.selectedClass.id}/enrol`,{method:"POST",body:JSON.stringify({petId:state.selectedPet})});
  state.confirm={...d,type:"class",classId:state.selectedClass.id};go("payment");
 }catch(e){if(e.code==="DOB_REQUIRED"){state.portalTab="dogs";alert(e.message);return portal();}alert(e.message)}
}
function paymentView(){
 const c=state.confirm;
 return `<section class="screen"><div class="center"><div class="panel" style="width:min(620px,100%)">
 <div class="eyebrow">Almost there</div><h1 style="font-size:48px">M-Pesa</h1>
 <p class="lead">${esc(c.mpesaMessage||"Approve the payment on your phone.")}</p>
 <div class="notice"><b>Reference:</b> ${esc(c.bookingRef)}<br><b>Amount:</b> ${money(c.amount)}</div>
 ${c.mpesaDemo?`<button class="primary" onclick="demoPay()">Confirm trial payment</button>`:`<p class="small">After payment, return here. Your booking will be confirmed when the M-Pesa callback is received.</p>`}
 </div></div></section>`;
}
async function demoPay(){
 const c=state.confirm;
 await api(`/api/${c.type==="private"?"bookings":"classes"}/${c.bookingRef}/demo-pay`,{method:"POST"});
 state.completedBooking={...c};
 state.selectedService=null;state.selectedLocation=null;state.selectedDate=null;state.slots=[];state.selectedSlot=null;state.selectedClass=null;state.address="";
 go("confirmation");
}
function confirmationView(){
 const c=state.completedBooking||state.confirm||{};
 const isClass=c.type==="class";
 const title=isClass?(state.selectedClass?.title||"Five-class course"):privateServiceLabel(c.service);
 const dog=state.profile?.pets?.find(p=>p.id===state.selectedPet)?.name;
 return `<section class="screen"><div class="center"><div style="max-width:700px">
 <div class="eyebrow">Booking confirmed</div><h1>You're booked.</h1>
 <p class="lead">${esc(title)}${dog?` · ${esc(dog)}`:""}</p>
 <div class="notice good"><b>Payment received.</b><br>Keep your booking reference <b>${esc(c.bookingRef)}</b>.</div>
 <div class="actions calendar-actions">${isClass?`<button class="primary" onclick="addClassCalendarFromConfirmation()">＋ Add all 5 classes to calendar</button>`:`<button class="primary" onclick="addPrivateCalendarFromConfirmation()">＋ Add to calendar</button>`}</div>
 <p class="small">The calendar file works with Google Calendar, Apple Calendar, Outlook and most calendar apps.</p>
 <div class="actions"><button class="secondary" onclick="portal()">Open Client Portal</button><button class="secondary" onclick="go('home')">Back home</button></div>
 </div></div></section>`;
}
function privateServiceLabel(id){return id==="consultation"?"Initial consultation":id==="extra"?"Training + extra time":"Training session"}
function icsEscape(value){return String(value||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n")}
function icsDate(value){const d=new Date(value);return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")}
function downloadIcs(filename,events){
 const now=icsDate(new Date());
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//The Custom Made Canine//Nairobi//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
 events.forEach((e,i)=>{lines.push("BEGIN:VEVENT",`UID:${icsEscape(e.uid||`cmc-${Date.now()}-${i}@custommadecanine`)}`,`DTSTAMP:${now}`,`DTSTART:${icsDate(e.start)}`,`DTEND:${icsDate(e.end)}`,`SUMMARY:${icsEscape(e.title)}`,`LOCATION:${icsEscape(e.location)}`,`DESCRIPTION:${icsEscape(e.description||"")}`,"END:VEVENT")});
 lines.push("END:VCALENDAR");
 const blob=new Blob([lines.join("\r\n")+"\r\n"],{type:"text/calendar;charset=utf-8"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function addPrivateCalendarFromConfirmation(){
 const c=state.confirm||{};
 const location=c.locationType==="home"?(c.address||"Client home, Nairobi"):("Amy's arena, Nairobi, Kenya");
 downloadIcs(`custom-made-canine-${c.bookingRef||"booking"}.ics`,[{uid:`${c.bookingRef||Date.now()}@custommadecanine`,start:c.startAt,end:c.endAt,title:`${privateServiceLabel(c.service)} — The Custom Made Canine`,location,description:`Booking reference: ${c.bookingRef||""}`}]);
}
function addClassCalendarFromConfirmation(){
 const c=state.selectedClass;
 if(!c||!c.sessions)return alert("The class schedule could not be loaded. Please open My Bookings and try again.");
 const events=c.sessions.map((s,i)=>{const start=`${s.session_date}T${s.start_time}:00+03:00`;const end=`${s.session_date}T${s.end_time}:00+03:00`;return {uid:`${c.id}-${i}-${state.confirm?.bookingRef||"class"}@custommadecanine`,start,end,title:`${c.title} — Class ${i+1}`,location:"Amy's arena, Nairobi, Kenya",description:`Five-class course\nBooking reference: ${state.confirm?.bookingRef||""}`}});
 downloadIcs(`custom-made-canine-${c.title.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()}.ics`,events);
}
async function portal(){
 if(!state.user)return auth("Your Client Portal is available after you sign in.");
 state.menu=false;state.view="portal";if(!state.portalTab)state.portalTab="dogs";
 state.profile=await api("/api/my/profile");
 state.bookings=await api("/api/my/bookings");
 state.resources=await api("/api/my/resources");state.trainingNotes=await api("/api/my/training-notes");
 render();
}
function portalView(){
 const p=state.profile,b=state.bookings,r=state.resources,tab=state.portalTab||"dogs";
 const body=tab==="media"?resourceList(r):tab==="bookings"?bookingsHub(b):petsView(p.pets);
 return `<section class="screen client-dashboard"><div class="eyebrow">Client Portal</div><h2>Welcome, ${esc(state.user.name.split(" ")[0])}</h2>
 <div class="portal-menu portal-menu-primary"><button class="${tab==="dogs"?"active":""}" onclick="state.portalTab='dogs';render()"><span>Dogs</span><small>Profiles & vaccination</small></button><button class="${tab==="bookings"?"active":""}" onclick="state.portalTab='bookings';render()"><span>Bookings</span><small>Bookings & new training</small></button><button class="${tab==="media"?"active":""}" onclick="state.portalTab='media';render()"><span>Resources</span><small>Training material</small></button></div>
 <div class="panel client-dashboard-main">${body}</div>
 <div class="portal-menu portal-menu-secondary"><button onclick="state.portalTab='review';render()"><span>Review</span></button><button onclick="go('account')"><span>Account</span></button></div>
 ${tab==="review"?`<div class="panel client-secondary-panel">${reviewPage()}</div>`:""}${floatingWhatsapp()}</section>`;
}
function bookingsHub(b){return `<div class="bookings-panel"><h3>My bookings</h3><div class="actions client-booking-actions"><button class="secondary" onclick="startPrivate('portal')">Book private training</button><button class="secondary" onclick="openPortalClasses()">View classes</button></div>${bookingsView(b)}</div>`}
function reviewPage(){return `<h3>Leave a review</h3><label>Rating<select id="reviewRating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label><label>Review<textarea id="reviewText" rows="4"></textarea></label><label>Photo (optional)<input id="reviewPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="review-consent"><input id="reviewPhotoConsent" type="checkbox"> I give The Custom Made Canine permission to publish this photo with my review.</label><p class="review-helper">Amy would love to read your review and see your photo. Even if you do not want the photo published, feel free to keep it private, but if you don't mind, she'll love being able to show it off even more.</p><button class="primary" onclick="submitReview()">Submit for approval</button>`}
function accountInline(){return `<p>Use the Account button above to manage your account.</p>`}
function floatingWhatsapp(){return `<button class="floating-whatsapp" onclick="contactAmy()">WhatsApp Amy</button>`}

function bookingsView(b){
 const privateRows=Array.isArray(b?.privateBookings)?b.privateBookings:[];
 const classRows=Array.isArray(b?.classBookings)?b.classBookings:[];
 return `<div class="list">${privateRows.map(x=>`<div class="card ${x.status==="provisional"?"provisional-card":""}"><h3>${x.status==="provisional"?"Action required · ":""}Private training · ${esc(x.pet_name||'Dog not recorded')}</h3><p>${fmt(x.start_at)} · ${x.location_type==='home'?'Home visit':"Amy's arena"}</p><p>${esc(x.booking_ref)} · ${x.status==="provisional"?"Awaiting your confirmation and payment":esc(x.payment_status)}${x.status==='cancelled'?' · Cancelled':''}${x.refund_amount?` · Refund KES ${Number(x.refund_amount).toLocaleString()}`:""}</p>${x.status==="provisional"?`<div class="notice">Amy has proposed this appointment. Confirm the time and pay with M-Pesa to secure it.</div><div class="actions"><button class="primary compact-button" onclick="acceptProvisional(${x.id})">Confirm & Pay</button><button class="secondary compact-button" onclick="declineProvisional(${x.id})">Decline</button></div>`:""}${x.status==="cancelled"&&x.payment_status==="refund_pending"?`<div class="notice">Cancellation received. Amy needs to record the refund or alternative arrangement.</div>`:""}${x.payment_status==="refund_partial"||x.payment_status==="refunded"?`<div class="notice good">${x.payment_status==="refunded"?"Refunded":"Partially refunded"} KES ${Number(x.refund_amount||0).toLocaleString()}${x.refund_confirmation_code?` · M-Pesa ${esc(x.refund_confirmation_code)}`:""}</div>`:""}${['paid','demo_paid'].includes(x.payment_status)&&x.status!=='cancelled'?`<div class="actions"><button class="secondary compact-button" onclick="addPrivateCalendarByRef('${esc(x.booking_ref)}')">＋ Add to calendar</button><button class="secondary compact-button" onclick="clientReschedule(${x.id})">Reschedule</button><button class="danger compact-button" onclick="clientCancel(${x.id})">Cancel</button></div>`:''}</div>`).join('')}${classRows.map(x=>`<div class="card ${["rejected","cancelled_by_client"].includes(x.enrolment_status)?"class-rejected-card":""}"><h3>${esc(x.title)} · ${esc(x.pet_name||"Dog not recorded")}</h3><p>${displayDate(x.start_date,{day:"numeric",month:"short",year:"numeric"})}–${displayDate(x.end_date,{day:"numeric",month:"short",year:"numeric"})} · ${esc(x.start_time||"")}–${esc(x.end_time||"")}</p><p>${esc(x.booking_ref)} · ${x.enrolment_status==="cancelled_by_client"?"Cancellation sent to Amy":x.enrolment_status==="rejected"?"Enrolment cancelled":esc(x.payment_status)}</p>${["rejected","cancelled_by_client"].includes(x.enrolment_status)?`<div class="notice ${x.enrolment_status==="rejected"?"bad":""}">${x.enrolment_status==="cancelled_by_client"?"Your class place has been cancelled and Amy has been notified.":x.rejected_reason?`Amy's note: ${esc(x.rejected_reason)}`:"This class enrolment has been cancelled."}${x.payment_status==="refund_pending"?" A refund decision is pending.":""}${["refunded","refund_partial"].includes(x.payment_status)?` Refund recorded: KES ${Number(x.refund_amount||0).toLocaleString()}.`:""}</div>`:""}${x.enrolment_status==="active"&&["paid","demo_paid"].includes(x.payment_status)?`<div class="actions"><button class="secondary compact-button" onclick="addClassCalendarByRef('${esc(x.booking_ref)}')">＋ Add all classes</button><button class="danger compact-button" onclick="clientCancelClass(${x.id})">Cancel class place</button></div>`:""}</div>`).join('')}${!privateRows.length&&!classRows.length?'<div class="center"><p>No bookings yet.</p></div>':''}</div>`;
}
async function clientCancelClass(id){
 if(!confirm("Cancel this class place? Amy will be notified and will decide any refund."))return;
 const note=prompt("Anything you would like Amy to know about the cancellation? (optional)","");if(note===null)return;
 try{const d=await api(`/api/my/class-enrolments/${id}/cancel`,{method:"POST",body:JSON.stringify({note:note.trim()})});state.bookings=await api("/api/my/bookings");render();alert(d.refundPending?"Cancellation sent to Amy. A refund decision is now pending.":"Your class place has been cancelled and Amy has been notified.")}catch(e){alert(e.message)}
}
async function acceptProvisional(id){
 try{
  const d=await api(`/api/my/bookings/${id}/accept-provisional`,{method:"POST",body:JSON.stringify({})});
  state.confirm={...d,type:"private"};go("payment");
 }catch(e){alert(e.message)}
}
async function declineProvisional(id){
 if(!confirm("Decline this proposed appointment?"))return;
 try{await api(`/api/my/bookings/${id}/decline-provisional`,{method:"POST",body:JSON.stringify({})});await portal();}catch(e){alert(e.message)}
}
function clientReschedule(id){
 const b=(state.bookings?.privateBookings||[]).find(x=>x.id===id);if(!b)return;
 state.rescheduleDraft={bookingId:id,booking:b,date:String(b.start_at).slice(0,10),slots:[],selected:null};render();
}
async function loadRescheduleSlots(){
 const r=state.rescheduleDraft;if(!r)return;
 const date=document.getElementById("rescheduleDate")?.value||r.date;if(!date)return alert("Choose a date.");r.date=date;
 try{r.slots=await api(`/api/availability?date=${encodeURIComponent(date)}&locationType=${encodeURIComponent(r.booking.location_type)}&address=${encodeURIComponent(r.booking.address||"")}&service=${encodeURIComponent(r.booking.service)}`);r.selected=null;render()}catch(e){alert(e.message)}
}
function chooseRescheduleSlot(slot){state.rescheduleDraft.selected=slot;render()}
async function confirmClientReschedule(){const r=state.rescheduleDraft;if(!r?.selected)return;try{await api(`/api/my/bookings/${r.bookingId}/reschedule`,{method:"POST",body:JSON.stringify({startAt:r.selected.start})});state.rescheduleDraft=null;await portal();alert("Your booking has been rescheduled.")}catch(e){alert(e.message)}}
function closeClientReschedule(){state.rescheduleDraft=null;render()}
function clientRescheduleModal(){
 const r=state.rescheduleDraft;if(!r)return "";const b=r.booking;
 return `<div class="modal-overlay"><div class="trainer-modal schedule-modal"><button class="close-btn modal-close" onclick="closeClientReschedule()">×</button><div class="eyebrow">Reschedule</div><h2>Choose a new appointment slot</h2><p>${esc(privateServiceLabel(b.service))} · ${b.location_type==="home"?"Home visit":"Amy's arena"}. The duration stays the same.</p><label>Date<input id="rescheduleDate" type="date" min="${earliestPrivateDate()}" value="${esc(r.date||"")}" onchange="state.rescheduleDraft.date=this.value"></label><div class="actions"><button class="secondary" onclick="loadRescheduleSlots()">Check available times</button></div><div class="time-grid">${(r.slots||[]).map(slot=>`<button class="time ${r.selected?.start===slot.start?"selected":""}" onclick='chooseRescheduleSlot(${JSON.stringify(slot)})'>${String(slot.start).slice(11,16)}</button>`).join("")}</div><div class="actions"><button class="secondary" onclick="closeClientReschedule()">Cancel</button><button class="primary" ${!r.selected?"disabled":""} onclick="confirmClientReschedule()">Confirm new slot</button></div></div></div>`;
}

async function clientCancel(id){if(!confirm('Cancel this confirmed booking? Amy will be notified and will decide the refund or alternative arrangement.'))return;try{await api(`/api/my/bookings/${id}/cancel`,{method:'POST',body:JSON.stringify({reason:'Cancelled by client'})});await portal();alert('Cancellation sent to Amy. Your refund decision is pending.')}catch(e){alert(e.message)}}
async function addPrivateCalendarByRef(ref){
 const x=state.bookings?.privateBookings?.find(b=>b.booking_ref===ref);
 if(!x)return alert("Booking details could not be found.");
 const title=privateServiceLabel(x.service);
 const location=x.location_type==="home"?(x.address||"Client home, Nairobi"):("Amy's arena, Nairobi, Kenya");
 downloadIcs(`custom-made-canine-${ref}.ics`,[{uid:`${ref}@custommadecanine`,start:x.start_at,end:x.end_at,title:`${title} — The Custom Made Canine`,location,description:`Booking reference: ${ref}`}]);
}
async function addClassCalendarByRef(ref){
 const x=state.bookings?.classBookings?.find(b=>b.booking_ref===ref);
 if(!x)return alert("Class booking details could not be found.");
 const c=state.classes.find(c=>c.id===x.class_id);
 if(!c)return alert("The class schedule could not be found. Please refresh the Client Portal.");
 const events=c.sessions.map((s,i)=>({uid:`${c.id}-${i}-${ref}@custommadecanine`,start:`${s.session_date}T${s.start_time}:00+03:00`,end:`${s.session_date}T${s.end_time}:00+03:00`,title:`${c.title} — Class ${i+1}`,location:"Amy's arena, Nairobi, Kenya",description:`Five-class course\nBooking reference: ${ref}`}));
 downloadIcs(`custom-made-canine-${ref}.ics`,events);
}
function petDobDisplay(p){return p.date_of_birth?displayDate(p.date_of_birth,{day:"numeric",month:"long",year:"numeric"}):"Date of birth not added"}
function petCard(p,archived=false){
 const vaccination=p.vaccination_status==="verified"?"Verified ✓":p.vaccination_status==="pending"?"Awaiting Amy":p.vaccination_status==="rejected"?"Replacement needed":"Needs upload";
 return `<article class="dog-card-v2176 ${archived?"pet-archived":""}">
   <div class="dog-card-header"><div class="dog-card-photo">${p.photo_url?`<img src="${p.photo_url}" alt="Photo of ${esc(p.name)}">`:`<span aria-hidden="true">🐕</span>`}</div><div class="dog-card-identity"><h3>${esc(p.name)}</h3><p>${esc(p.breed||p.species||"Dog")}</p><p>${p.date_of_birth?`Born ${esc(petDobDisplay(p))} · ${esc(dogAgeLabel(p))}`:"Date of birth not added"}${p.gender?` · ${p.gender==="male"?"Male":"Female"}`:""}${p.neutered_spayed?" · Neutered/spayed":""}</p>${p.behavior_notes?`<p class="dog-profile-note"><span>Behaviour:</span> ${esc(p.behavior_notes)}</p>`:""}${p.medical_procedures?`<p class="dog-profile-note"><span>Medical:</span> ${esc(p.medical_procedures)}</p>`:""}</div><button class="secondary compact-button dog-edit-button" onclick="editDog(${p.id})">Edit details</button></div>
   ${archived?`<div class="dog-archive-message">This dog is archived. Training history remains available, but the dog cannot be selected for new bookings.</div><div class="dog-card-footer"><button class="secondary compact-button" onclick="restoreDog(${p.id})">Restore dog</button></div>`:`
   <div class="dog-status-row"><span>Photo ${p.photo_url?"✓":"not added"}</span><span>Vaccination ${esc(vaccination)}</span></div>
   ${p.vaccination_status==="rejected"?`<div class="notice bad">${esc(p.vaccination_rejection_note||`Please replace ${p.name}’s vaccination record.`)}</div>`:""}
   <div class="dog-file-grid">
    <section class="dog-file-panel"><h4>Dog photo</h4><div class="dog-file-actions">${p.photo_url?`<button class="secondary compact-button" onclick="viewDogPhoto(${p.id})">View</button>`:""}<label class="file-button">${p.photo_url?"Replace":"Add photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onchange="uploadDogPhoto(${p.id},this)"></label>${p.photo_url?`<button class="secondary compact-button" onclick="removeDogPhoto(${p.id})">Remove photo</button>`:""}</div></section>
    <section class="dog-file-panel"><h4>Vaccination record</h4><p>${esc(vaccination)}</p><div class="dog-file-actions">${p.vaccination_count?`<button class="secondary compact-button" onclick="viewVaccinations(${p.id})">View</button>`:""}<label class="file-button">${p.vaccination_count?"Replace":"Upload"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="uploadVaccinations(${p.id},this)"></label>${p.vaccination_count?`<button class="secondary compact-button" onclick="removeVaccinations(${p.id})">Remove</button>`:""}</div></section>
   </div>
   <div class="dog-card-footer"><button class="quiet-action" onclick="archiveDog(${p.id})">Archive dog</button></div>`}
 </article>`;
}
function petsView(pets){
 const active=(pets||[]).filter(p=>!p.archived),archived=(pets||[]).filter(p=>p.archived);
 return `<div class="pets-layout"><div class="pets-head"><div><h3>My dogs</h3><p class="small">Edit details if something was entered incorrectly. Archive a dog when no new training is needed.</p></div><button class="primary compact-button" onclick="state.addPetBookingContext=null;state.showAddPet=true;state.editPet=null;render()">+ Add a dog</button></div>${active.length?`<div class="pet-grid">${active.map(p=>petCard(p,false)).join("")}</div>`:`<div class="empty-pets"><div class="pet-photo"><span aria-hidden="true">🐕</span></div><div><h3>No active dogs</h3><p class="small">Add a dog or restore one from Archived dogs.</p></div></div>`}${archived.length?`<details class="archived-dogs"><summary>Archived dogs · ${archived.length}</summary><div class="pet-grid">${archived.map(p=>petCard(p,true)).join("")}</div></details>`:""}${state.showAddPet?addDogModal():""}${state.editPet?editDogModal():""}</div>`;
}
function addDogModal(){const fromBooking=!!state.addPetBookingContext;return `<div class="pet-add-overlay" role="dialog" aria-modal="true" aria-labelledby="addDogTitle"><div class="pet-add-card"><div class="pet-add-head"><div><div class="eyebrow">${fromBooking?"Booking":"Client profile"}</div><h3 id="addDogTitle">${fromBooking?"Add a dog to this booking":"Add a dog"}</h3></div><button class="close-btn close-light" aria-label="Close add dog form" onclick="closeAddDogModal()">×</button></div>${fromBooking?`<p class="small booking-dog-helper">Your booking choices stay exactly as they are. After saving, this dog will be selected automatically.</p>`:""}
 <div class="form-grid"><label>Name<input id="petName" autocomplete="off"></label><label>Breed<input id="petBreed"></label></div>
 <div class="form-grid dog-demographic-row"><fieldset class="dog-radio-field"><legend>Gender</legend><label class="inline-radio"><input type="radio" name="petGender" value="male"> Male</label><label class="inline-radio"><input type="radio" name="petGender" value="female"> Female</label></fieldset><label class="dog-check-field"><span>Neutered / spayed</span><span class="check-row"><input id="petNeutered" type="checkbox"> Yes</span></label></div>
 <label>Date of birth<input id="petDob" type="date"></label>
 <label>Behaviour notes<textarea id="petBehaviour" rows="2" placeholder="Temperament, triggers, habits, handling notes…"></textarea></label>
 <label>Medical procedures / history<textarea id="petMedical" rows="2" placeholder="Operations or procedures that may matter for training"></textarea></label>
 <label>General notes<textarea id="petNotes" rows="2" placeholder="Anything else Amy should know"></textarea></label>
 <div class="form-grid"><label>Dog photo<input id="petPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label><label>Vaccination pages<input id="petVaccinations" type="file" accept="image/jpeg,image/png,image/webp" multiple></label></div>
 <p class="small">Photo and vaccination pages are optional now; you can add or replace them later.</p><div class="actions"><button class="secondary" onclick="closeAddDogModal()">Cancel</button><button id="saveDogBtn" class="primary" onclick="addPet()">Save dog</button></div></div></div>`}
function editDogModal(){const p=state.editPet;if(!p)return "";return `<div class="pet-add-overlay" role="dialog" aria-modal="true" aria-labelledby="editDogTitle"><div class="pet-add-card"><div class="pet-add-head"><div><div class="eyebrow">Dog profile</div><h3 id="editDogTitle">Edit ${esc(p.name)}</h3></div><button class="close-btn close-light" aria-label="Close edit dog form" onclick="state.editPet=null;render()">×</button></div>
 <div class="form-grid"><label>Name<input id="editPetName" value="${esc(p.name||"")}"></label><label>Breed<input id="editPetBreed" value="${esc(p.breed||"")}"></label></div>
 <div class="form-grid dog-demographic-row"><fieldset class="dog-radio-field"><legend>Gender</legend><label class="inline-radio"><input type="radio" name="editPetGender" value="male" ${p.gender==="male"?"checked":""}> Male</label><label class="inline-radio"><input type="radio" name="editPetGender" value="female" ${p.gender==="female"?"checked":""}> Female</label></fieldset><label class="dog-check-field"><span>Neutered / spayed</span><span class="check-row"><input id="editPetNeutered" type="checkbox" ${p.neutered_spayed?"checked":""}> Yes</span></label></div>
 <label>Date of birth<input id="editPetDob" type="date" value="${esc(p.date_of_birth||"")}"></label>
 <label>Behaviour notes<textarea id="editPetBehaviour" rows="3">${esc(p.behavior_notes||"")}</textarea></label>
 <label>Medical procedures / history<textarea id="editPetMedical" rows="3">${esc(p.medical_procedures||"")}</textarea></label>
 <label>General notes<textarea id="editPetNotes" rows="3">${esc(p.notes||"")}</textarea></label>
 <p class="small">Changing the date of birth also changes age checks for future age-restricted classes.</p><div class="actions"><button class="secondary" onclick="state.editPet=null;render()">Cancel</button><button class="primary" onclick="saveDogEdit(${p.id})">Save changes</button></div></div></div>`}
function resourceList(rows){
 return `<div class="list">${rows.map(r=>`<div class="resource"><div class="thumb">${r.type.toUpperCase()}</div><div><h3>${esc(r.title)}</h3><p class="small">${esc((r.description||"").replace(/^__FILE__[^ ]+\s?/,""))}</p>${r.access_note?`<div class="notice"><b>Note from Amy:</b> ${esc(r.access_note)}</div>`:""}</div><button class="secondary" onclick="openResource('${esc(r.url)}','${esc(r.type)}')">Open</button></div>`).join("")||`<div class="center"><p>Amy hasn't assigned any training resources yet.</p></div>`}</div>`;
}
function openResource(url,type){
 if(type==="link"||url.startsWith("http"))window.open(url,"_blank","noopener");
 else window.open(url,"_blank","noopener");
}
async function addPet(){
 if(state.addPetSaving)return;
 state.addPetSaving=true;
 const saveBtn=document.getElementById("saveDogBtn");if(saveBtn){saveBtn.disabled=true;saveBtn.textContent="Saving…"}
 const createToken=state.addPetCreateToken||(state.addPetCreateToken=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`));
 const name=document.getElementById("petName")?.value.trim()||"",breed=document.getElementById("petBreed")?.value.trim()||"",dob=document.getElementById("petDob")?.value||"",notes=document.getElementById("petNotes")?.value||"",gender=document.querySelector('input[name="petGender"]:checked')?.value||"",neuteredSpayed=!!document.getElementById("petNeutered")?.checked,behaviorNotes=document.getElementById("petBehaviour")?.value||"",medicalProcedures=document.getElementById("petMedical")?.value||"";
 if(!name){state.addPetSaving=false;if(saveBtn){saveBtn.disabled=false;saveBtn.textContent="Save dog"}return alert("Please add the dog's name.")}
 const fd=new FormData();fd.append("name",name);fd.append("breed",breed);fd.append("dateOfBirth",dob);fd.append("notes",notes);fd.append("gender",gender);fd.append("neuteredSpayed",neuteredSpayed?"1":"");fd.append("behaviorNotes",behaviorNotes);fd.append("medicalProcedures",medicalProcedures);fd.append("createToken",createToken);
 const photo=document.getElementById("petPhoto")?.files?.[0];if(photo)fd.append("dogPhoto",photo);
 [...(document.getElementById("petVaccinations")?.files||[])].forEach(f=>fd.append("vaccinationPages",f));
 try{
  const p=await api("/api/my/pets",{method:"POST",body:fd});
  const existingIndex=state.profile.pets.findIndex(x=>Number(x.id)===Number(p.id));
  if(existingIndex>=0)state.profile.pets[existingIndex]=p;else state.profile.pets.push(p);
  state.selectedPet=Number(p.id);state.showAddPet=false;state.addPetCreateToken=null;state.addPetSaving=false;
  render();
 }catch(e){state.addPetSaving=false;if(saveBtn){saveBtn.disabled=false;saveBtn.textContent="Save dog"}alert(e.message)}
}
function editDog(id){const p=(state.profile?.pets||[]).find(x=>x.id===Number(id));if(!p)return;state.editPet={...p};render()}
async function saveDogEdit(id){
 const body={name:document.getElementById("editPetName").value.trim(),breed:document.getElementById("editPetBreed").value.trim(),dateOfBirth:document.getElementById("editPetDob").value,notes:document.getElementById("editPetNotes").value,gender:document.querySelector('input[name="editPetGender"]:checked')?.value||"",neuteredSpayed:!!document.getElementById("editPetNeutered")?.checked,behaviorNotes:document.getElementById("editPetBehaviour").value,medicalProcedures:document.getElementById("editPetMedical").value};
 try{const p=await api(`/api/my/pets/${id}`,{method:"PUT",body:JSON.stringify(body)});const i=state.profile.pets.findIndex(x=>x.id===Number(id));if(i>=0)state.profile.pets[i]=p;state.editPet=null;render()}catch(e){alert(e.message)}
}
async function archiveDog(id){const p=(state.profile?.pets||[]).find(x=>x.id===Number(id));if(!p)return;if(!confirm(`Archive ${p.name}? Existing bookings, classes and history will be kept, but ${p.name} will not be available for new bookings.`))return;try{await api(`/api/my/pets/${id}/archive`,{method:"POST",body:JSON.stringify({})});state.profile=await api("/api/my/profile");if(state.selectedPet===Number(id))state.selectedPet=null;render()}catch(e){alert(e.message)}}
async function restoreDog(id){try{await api(`/api/my/pets/${id}/restore`,{method:"POST",body:JSON.stringify({})});state.profile=await api("/api/my/profile");render()}catch(e){alert(e.message)}}
async function uploadDogPhoto(id,input){
 if(!input.files[0])return;
 const fd=new FormData();fd.append("dogPhoto",input.files[0]);
 try{
  const p=await api(`/api/my/pets/${id}/files`,{method:"POST",body:fd});
  const i=state.profile.pets.findIndex(x=>x.id===id);if(i>=0)state.profile.pets[i]=p;render();
 }catch(e){alert(e.message)}
}
function viewDogPhoto(id){window.open(`/api/pets/${id}/photo`,`_blank`,`noopener`)}
async function removeDogPhoto(id){if(!confirm("Remove this dog photo?"))return;try{await api(`/api/my/pets/${id}/photo`,{method:"DELETE"});state.profile=await api("/api/my/profile");render()}catch(e){alert(e.message)}}

async function uploadVaccinations(id,input){
 if(!input.files.length)return;
 const fd=new FormData();for(const f of input.files)fd.append("vaccinationPages",f);
 try{
  const p=await api(`/api/my/pets/${id}/files`,{method:"POST",body:fd});
  const i=state.profile.pets.findIndex(x=>x.id===id);if(i>=0)state.profile.pets[i]=p;render();
 }catch(e){alert(e.message)}
}
async function removeVaccinations(id){
 if(!confirm("Remove the current vaccination record from this dog’s profile?"))return;
 try{
  await api(`/api/my/pets/${id}/vaccinations`,{method:"DELETE"});
  state.profile=await api("/api/my/profile");render();
 }catch(e){alert(e.message)}
}
async function viewVaccinations(id){
 try{
  const rows=await api(`/api/my/pets/${id}/vaccinations`);
  if(!rows.length)return alert("No vaccination pages have been uploaded for this dog yet.");
  rows.forEach(r=>window.open(r.url,"_blank","noopener"));
  if(rows.length>1) alert(`${rows.length} vaccination pages opened in new tabs.`);
 }catch(e){alert(e.message)}
}
async function submitReview(){
 try{
  const fd=new FormData();fd.append("rating",String(Number(reviewRating.value)));fd.append("text",reviewText.value);const photo=document.getElementById("reviewPhoto")?.files?.[0];if(photo)fd.append("photo",photo);fd.append("photoConsent",document.getElementById("reviewPhotoConsent")?.checked?"true":"false");
  await api("/api/reviews",{method:"POST",body:fd});
  alert("Thank you. Amy will review your feedback before it is published.");reviewText.value="";if(document.getElementById("reviewPhoto"))reviewPhoto.value="";if(document.getElementById("reviewPhotoConsent"))reviewPhotoConsent.checked=false;
 }catch(e){alert(e.message||"The review could not be submitted.")}
}
function contactAmy(){
 const n=state.config?.whatsapp;
 if(!n)return alert("WhatsApp number has not been configured yet.");
 window.open(`https://wa.me/${n}`,"_blank","noopener");
}
async function logout(){
  try{await api("/api/auth/logout",{method:"POST"});}finally{
    state.user=null;state.profile=null;state.bookings=null;state.resources=[];state.trainingNotes=[];state.trainer=null;state.trainerCalendar=null;state.menu=false;state.view="home";
    clearBookingDraft();state.completedBooking=null;state.authReturnToBooking=false;
    try{state.reviews=await api("/api/reviews");}catch(_e){}
    render();
  }
}
async function trainer(){
 if(!state.user)return auth("Please sign in as Amy to open the trainer dashboard.");
 if(state.user.role!=="trainer")return alert("Trainer access only.");
 state.trainer=await api("/api/trainer/summary");
 await loadTrainerCalendar(new Date());
 go("trainer");
}
function parseDateKey(value){
 const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!m)return null;
 const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0);
 if(d.getFullYear()!==Number(m[1])||d.getMonth()!==Number(m[2])-1||d.getDate()!==Number(m[3]))return null;
 return d;
}
function safeDateKey(value){const d=value instanceof Date?value:parseDateKey(value);return d&&!Number.isNaN(d.getTime())?dateKey(d):null}
function dateOnly(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function nairobiDateKeyClient(offsetDays=0){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const map=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 const base=new Date(Date.UTC(Number(map.year),Number(map.month)-1,Number(map.day)+Number(offsetDays||0)));
 return base.toISOString().slice(0,10);
}
function earliestPrivateDate(){return nairobiDateKeyClient(1)}
function friendlyDateRange(startAt,endAt){
 const s=String(startAt||"").slice(0,10);if(!s)return "";
 if(!endAt)return `From ${displayDate(s,{day:"numeric",month:"short",year:"numeric"})} · until further notice`;
 const raw=String(endAt),eRaw=raw.slice(0,10),e=raw.slice(11,16)==="00:00"?dateKey(addDays(parseDateKey(eRaw),-1)):eRaw;
 return s===e?displayDate(s,{day:"numeric",month:"short",year:"numeric"}):`${displayDate(s,{day:"numeric",month:"short"})}–${displayDate(e,{day:"numeric",month:"short",year:"numeric"})}`;
}
function wallClockMsClient(value){const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);return m?Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0)):Date.parse(value)}
function serviceBlockCoversDateClient(b,key){const s=String(b?.start_at||"0000").slice(0,10);if(key<s)return false;if(!b?.end_at)return true;const raw=String(b.end_at),e=raw.slice(0,10);return raw.slice(11,16)==="00:00"?key<e:key<=e}
function dogAgeLabel(p){
 if(!p?.date_of_birth)return "Age not recorded";const months=ageMonthsOnClient(p.date_of_birth,nairobiDateKeyClient(0));if(months==null)return "Age unavailable";
 if(months<24)return `${months} month${months===1?"":"s"}`;const years=Math.floor(months/12),rem=months%12;return `${years} year${years===1?"":"s"}${rem?` ${rem} mo`:""}`;
}

function mondayOf(d){const x=dateOnly(d);const day=x.getDay();const diff=day===0?-6:1-day;x.setDate(x.getDate()+diff);return x}
function addDays(d,n){const x=dateOnly(d);x.setDate(x.getDate()+n);return x}
function displayDate(value,options={weekday:"long",day:"numeric",month:"long"}){const d=value instanceof Date?value:parseDateKey(value);return d&&!Number.isNaN(d.getTime())?d.toLocaleDateString("en-KE",options):"Date unavailable"}
function trainerWeekLabel(d){const base=d instanceof Date?d:parseDateKey(d);const a=mondayOf(base||new Date()),b=addDays(a,6);return `${displayDate(a,{day:"numeric",month:"short"})} – ${displayDate(b,{day:"numeric",month:"short",year:"numeric"})}`}
async function loadTrainerCalendar(date){
 const requested=date instanceof Date?date:(parseDateKey(date)||new Date());
 const week=mondayOf(requested); const start=dateKey(week),end=dateKey(addDays(week,6));
 state.trainerWeekStart=start;
 const requestedKey=dateKey(requested);
 if(!state.trainerSelectedDate || !parseDateKey(state.trainerSelectedDate) || state.trainerSelectedDate<start || state.trainerSelectedDate>end){
   state.trainerSelectedDate=requestedKey;
 }
 state.trainerCalendar=await api(`/api/trainer/calendar?start=${start}&end=${end}`);
}
async function loadTrainerDayMeta(date){const key=typeof date==="string"?date:dateKey(date);state.trainerDayMeta=await api(`/api/trainer/day-meta?date=${encodeURIComponent(key)}`);return state.trainerDayMeta}
function locationAllowedInMeta(type,start,end){const rows=state.trainerDayMeta?.locationPlan||[];if(!rows.length)return true;const f=type==="arena"?"arena_enabled":"home_enabled";return rows.some(r=>r[f]&&start>=r.start_time&&end<=r.end_time)}
function temporaryLocationAvailable(type){return state.trainerDayMeta?.restrictions?.[type]?.available!==false}
function openLocationPlan(){const d=state.trainerSelectedDate||dateKey(new Date()),w=state.trainerDayMeta?.working||{enabled:true,start_time:"08:00",end_time:"17:00"},existing=state.trainerDayMeta?.locationPlan||[];state.locationPlanModal={date:d,periods:existing.length?existing.map(x=>({start_time:x.start_time,end_time:x.end_time,arena_enabled:!!x.arena_enabled,home_enabled:!!x.home_enabled})):[{start_time:w.start_time||"08:00",end_time:w.end_time||"17:00",arena_enabled:true,home_enabled:true}]};render()}
function addLocationPlanRow(){const rows=state.locationPlanModal?.periods||[];const last=rows[rows.length-1];rows.push({start_time:last?.end_time||"13:00",end_time:"17:00",arena_enabled:true,home_enabled:true});render()}
function removeLocationPlanRow(i){state.locationPlanModal.periods.splice(i,1);render()}
function setLocationPlanField(i,key,value){state.locationPlanModal.periods[i][key]=value;render()}
async function saveLocationPlan(){const m=state.locationPlanModal;if(!m)return;try{await api("/api/trainer/location-plan",{method:"POST",body:JSON.stringify({date:m.date,periods:m.periods})});state.locationPlanModal=null;await loadTrainerDayMeta(m.date);render()}catch(e){alert(e.message)}}
async function clearLocationPlan(){const m=state.locationPlanModal;if(!m)return;if(!confirm("Clear the location plan for this day? Both arena and home appointments will again be allowed wherever the normal availability rules permit."))return;try{await api(`/api/trainer/location-plan?date=${encodeURIComponent(m.date)}`,{method:"DELETE"});state.locationPlanModal=null;await loadTrainerDayMeta(m.date);render()}catch(e){alert(e.message)}}
function locationPlanModalView(){const m=state.locationPlanModal;if(!m)return "";return `<div class="modal-overlay"><div class="trainer-modal location-plan-modal"><button class="close-btn modal-close" onclick="state.locationPlanModal=null;render()">×</button><div class="eyebrow">Day schedule</div><h2>Set locations for ${displayDate(m.date,{weekday:"long",day:"numeric",month:"long"})}</h2><p>Choose where Amy is willing to train during each part of the day. If no plan is saved, both locations stay possible subject to the normal booking rules.</p><div class="location-plan-rows">${m.periods.map((p,i)=>`<div class="location-plan-row"><div class="location-plan-times"><select onchange="setLocationPlanField(${i},'start_time',this.value)">${halfHourOptions(p.start_time)}</select><span>to</span><select onchange="setLocationPlanField(${i},'end_time',this.value)">${halfHourOptions(p.end_time)}</select></div><label class="check-row"><input type="checkbox" ${p.arena_enabled?"checked":""} onchange="setLocationPlanField(${i},'arena_enabled',this.checked)"> Arena</label><label class="check-row"><input type="checkbox" ${p.home_enabled?"checked":""} onchange="setLocationPlanField(${i},'home_enabled',this.checked)"> Home</label><button class="secondary compact-button" onclick="removeLocationPlanRow(${i})">Remove</button></div>`).join("")}</div><div class="actions"><button class="secondary" onclick="addLocationPlanRow()">＋ Add period</button><button class="secondary" onclick="clearLocationPlan()">Clear day plan</button><button class="primary" onclick="saveLocationPlan()">Save locations</button></div></div></div>`}

async function moveTrainerWeek(delta){
 const base=parseDateKey(state.trainerWeekStart)||mondayOf(new Date());
 const currentSelected=parseDateKey(state.trainerSelectedDate)||base;
 const weekdayOffset=Math.max(0,Math.min(6,currentSelected.getDay()===0?6:currentSelected.getDay()-1));
 const nextWeek=addDays(base,delta*7);
 const nextSelected=addDays(nextWeek,weekdayOffset);
 state.trainerSelectedDate=dateKey(nextSelected);
 await loadTrainerCalendar(nextSelected);
 render();
}
async function selectTrainerDate(key){state.trainerSelectedDate=key;render()}
function trainerEventForDay(key){
 const c=state.trainerCalendar||{bookings:[],classSessions:[],blocks:[]};
 const bookings=c.bookings.filter(x=>x.start_at.slice(0,10)===key);
 const classes=c.classSessions.filter(x=>x.session_date===key);
 const blocks=c.blocks.filter(x=>x.start_at.slice(0,10)<=key && x.end_at.slice(0,10)>=key);
 return {bookings,classes,blocks};
}
function trainerDayCard(key,i){
 const d=parseDateKey(key)||new Date(), ev=trainerEventForDay(key), today=dateKey(new Date())===key;
 const count=ev.bookings.length+ev.classes.length+ev.blocks.length;
 return `<button type="button" class="trainer-day ${state.trainerSelectedDate===key?"selected":""} ${today?"today":""}" onclick="selectTrainerDate('${key}')" aria-label="${d.toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long"})}, ${count} scheduled items">
   <span class="trainer-day-name">${d.toLocaleDateString("en-KE",{weekday:"short"})}</span><b>${d.getDate()}</b><span class="calendar-dots">${ev.bookings.length?`<i class="dot booking-dot"></i>`:""}${ev.classes.length?`<i class="dot class-dot"></i>`:""}${ev.blocks.length?`<i class="dot block-dot"></i>`:""}</span><small>${count?`${count} item${count===1?"":"s"}`:"Free"}</small>
 </button>`;
}
function trainerAgenda(){
 const key=safeDateKey(state.trainerSelectedDate)||dateKey(new Date()),ev=trainerEventForDay(key),meta=state.trainerDayMeta||{},w=meta.working||{enabled:true,start_time:"08:00",end_time:"17:00"};
 const notices=[];for(const type of ["arena","home"]){const r=meta.restrictions?.[type];if(r?.available===false)notices.push(`<div class="day-restriction ${type}"><span>${type==="arena"?"Arena unavailable":"Home visits unavailable"}</span><p>${esc(r.public_message||"")}</p>${r.private_note?`<small>Private note: ${esc(r.private_note)}</small>`:""}</div>`)}
 if(!w.enabled||!w.start_time||!w.end_time)return `<div class="trainer-agenda">${notices.join("")}<div class="empty-agenda"><span>Amy is not working on this date.</span></div></div>`;
 const datePrefix=`${key}T`,bounds=new Set([w.start_time,w.end_time]);
 const addBound=t=>{if(t&&t>=w.start_time&&t<=w.end_time)bounds.add(t)};
 ev.bookings.forEach(x=>{addBound(String(x.start_at).slice(11,16));addBound(String(x.end_at).slice(11,16));addBound(String(x.buffer_end_at).slice(11,16))});
 ev.classes.forEach(x=>{addBound(x.start_time);addBound(x.end_time)});ev.blocks.forEach(x=>{addBound(String(x.start_at).slice(11,16));addBound(String(x.end_at).slice(11,16))});
 (meta.recurringBlocks||[]).forEach(r=>{if(recurringBlockAppliesOnDateClient(r,key)){addBound(r.start_time);addBound(r.end_time)}});(meta.scheduleBlocks||[]).forEach(r=>{if(r.all_day){addBound(w.start_time);addBound(w.end_time)}else{addBound(r.start_time);addBound(r.end_time)}});
 for(let ms=wallClockMsClient(`${key}T${w.start_time}:00`);ms<wallClockMsClient(`${key}T${w.end_time}:00`);ms+=30*60000)addBound(new Date(ms).toISOString().slice(11,16));
 const times=[...bounds].sort(),rows=[];
 for(let i=0;i<times.length-1;i++){
  const st=times[i],en=times[i+1];if(st>=en)continue;const startAt=`${datePrefix}${st}:00`,endAt=`${datePrefix}${en}:00`;
  const booking=ev.bookings.find(x=>startAt>=x.start_at&&startAt<x.end_at),buffer=ev.bookings.find(x=>startAt>=x.end_at&&startAt<x.buffer_end_at),cls=ev.classes.find(x=>st>=x.start_time&&st<x.end_time),block=ev.blocks.find(x=>startAt>=x.start_at&&startAt<x.end_at);
  const rec=(meta.recurringBlocks||[]).find(r=>recurringBlockAppliesOnDateClient(r,key)&&st>=r.start_time&&st<r.end_time);const sblock=(meta.scheduleBlocks||[]).find(r=>{const rs=r.all_day?w.start_time:r.start_time,re=r.all_day?w.end_time:r.end_time;return st>=rs&&st<re});
  let kind="available",title="Available",detail="",id=null;
  if(booking){kind="booking";title=`${booking.client} · ${booking.pet_name||"Dog"}`;detail=booking.location_type==="home"?(booking.address||"Address not recorded"):"Amy's arena";id=booking.id}
  else if(buffer){kind="buffer";title=buffer.location_type==="home"?"Travel / buffer":"Buffer";detail=buffer.location_type==="home"&&buffer.address?buffer.address:""}
  else if(cls){kind="class";title=cls.title;detail=`Class · ${cls.enrolled}/${cls.capacity} places · ${cls.location_type==="alternate"?(cls.location_name||"Alternate venue"):"Amy's arena"}`}
  else if(block){kind="block";title=block.reason||"Blocked"}
  else if(sblock&&sblock.target==="amy"){kind="block";title=sblock.reason||"Amy unavailable"}
  else if(rec){kind="block";title=rec.reason||"Recurring block"}
  const arenaScheduleBlocked=!!(meta.scheduleBlocks||[]).find(r=>["amy","arena"].includes(r.target)&&st>=(r.all_day?w.start_time:r.start_time)&&st<(r.all_day?w.end_time:r.end_time));const homeScheduleBlocked=!!(meta.scheduleBlocks||[]).find(r=>["amy","home"].includes(r.target)&&st>=(r.all_day?w.start_time:r.start_time)&&st<(r.all_day?w.end_time:r.end_time));
  const arenaAllowed=temporaryLocationAvailable("arena")&&!arenaScheduleBlocked,homeAllowed=temporaryLocationAvailable("home")&&!homeScheduleBlocked;
  if(kind==="available"&&!arenaAllowed&&!homeAllowed){kind="location-closed";title="No client bookings available"}
  rows.push({st,en,kind,title,detail,id,arenaAllowed,homeAllowed});
 }
 // Merge adjacent available/location-closed/buffer/block rows when all visible properties match.
 const merged=[];for(const r of rows){const prev=merged[merged.length-1];if(prev&&["available","location-closed","buffer","block"].includes(r.kind)&&prev.kind===r.kind&&prev.title===r.title&&prev.detail===r.detail&&prev.arenaAllowed===r.arenaAllowed&&prev.homeAllowed===r.homeAllowed&&prev.en===r.st)prev.en=r.en;else merged.push({...r})}
 return `<div class="trainer-agenda">${notices.join("")}<div class="agenda-date"><div><div class="eyebrow">Daily agenda</div><h3>${displayDate(key,{weekday:"long",day:"numeric",month:"long"})}</h3></div><span class="agenda-working-hours">${w.start_time}–${w.end_time}</span></div><div class="agenda-timeline">${merged.map(r=>{const bars=`<span class="agenda-location-bars"><i class="agenda-bar arena ${r.arenaAllowed?"open":"closed"}" title="${r.arenaAllowed?"Arena available":"Arena unavailable"}"></i><i class="agenda-bar home ${r.homeAllowed?"open":"closed"}" title="${r.homeAllowed?"Home visits available":"Home visits unavailable"}"></i></span>`;const markers=`<span class="agenda-location-text">${!r.arenaAllowed?"Arena unavailable":""}${!r.arenaAllowed&&!r.homeAllowed?" · ":""}${!r.homeAllowed?"Home visits unavailable":""}</span>`;const body=`<div class="agenda-time">${r.st}–${r.en}</div><div class="agenda-copy"><span class="agenda-title">${esc(r.title)}</span>${r.detail?`<p>${esc(r.detail)}</p>`:""}${markers}</div>`;return r.kind==="booking"?`<button class="agenda-item ${r.kind} clickable-agenda" onclick="openTrainerBooking(${r.id})">${bars}${body}</button>`:`<div class="agenda-item ${r.kind}">${bars}${body}</div>`}).join("")}</div></div>`;
}

function monthStart(d){const x=new Date(d);return new Date(x.getFullYear(),x.getMonth(),1,12)}
function monthEnd(d){const x=new Date(d);return new Date(x.getFullYear(),x.getMonth()+1,0,12)}
function monthCalendarView(){
 const selected=parseDateKey(state.trainerMonthDate)||new Date(),first=monthStart(selected),last=monthEnd(selected),cal=state.trainerMonthCalendar||{bookings:[],classSessions:[],blocks:[],serviceBlocks:[],scheduleBlocks:[]};
 const lead=(first.getDay()+6)%7,days=last.getDate(),cells=[];for(let i=0;i<lead;i++)cells.push(`<span class="month-empty"></span>`);
 for(let day=1;day<=days;day++){
  const d=new Date(first.getFullYear(),first.getMonth(),day,12),key=dateKey(d),bookingCount=cal.bookings.filter(x=>String(x.start_at).slice(0,10)===key).length,hasClass=cal.classSessions.some(x=>x.session_date===key),hasBlock=cal.blocks.some(x=>key>=String(x.start_at).slice(0,10)&&key<=String(x.end_at).slice(0,10));
  const restricted=(type)=>cal.serviceBlocks?.some(b=>b.location_type===type&&serviceBlockCoversDateClient(b,key));
  const unified=(target)=>cal.scheduleBlocks?.some(b=>key>=b.start_date&&key<=b.end_date&&(b.target===target||b.target==="amy"));const arenaRestricted=restricted("arena")||unified("arena"),homeRestricted=restricted("home")||unified("home"),amyBlocked=unified("amy");
  cells.push(`<button class="month-day ${key===state.trainerSelectedDate?"selected":""}" onclick="selectMonthDate('${key}')"><span>${day}</span>${bookingCount?`<small class="month-count">${bookingCount}</small>`:""}<span class="month-dots">${bookingCount?'<i class="dot booking-dot" title="Booking"></i>':""}${hasClass?'<i class="dot class-dot" title="Class"></i>':""}${hasBlock||amyBlocked?'<i class="dot blocked-dot" title="Amy blocked"></i>':""}</span>${arenaRestricted||homeRestricted?`<span class="month-location-marks">${arenaRestricted?'<i class="location-mark arena" title="Arena unavailable">A</i>':""}${homeRestricted?'<i class="location-mark home" title="Home visits unavailable">H</i>':""}</span>`:""}</button>`)
 }
 return `<div class="month-calendar"><div class="calendar-head"><button class="secondary compact-button" onclick="moveTrainerMonth(-1)">←</button><span>${first.toLocaleDateString("en-KE",{month:"long",year:"numeric"})}</span><button class="secondary compact-button" onclick="moveTrainerMonth(1)">→</button></div><div class="month-weekdays">${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=>`<span>${x}</span>`).join("")}</div><div class="month-grid">${cells.join("")}</div></div>`;
}
async function loadTrainerMonth(date){
 const d=monthStart(date||new Date()), start=dateKey(new Date(d.getFullYear(),d.getMonth(),1,12)), end=dateKey(new Date(d.getFullYear(),d.getMonth()+1,0,12));
 state.trainerMonthDate=start;
 state.trainerMonthCalendar=await api(`/api/trainer/calendar?start=${start}&end=${end}`);
}
async function moveTrainerMonth(delta){
 const d=parseDateKey(state.trainerMonthDate)||new Date();d.setMonth(d.getMonth()+delta);
 await loadTrainerMonth(d);render();
}
async function moveTrainerDay(delta){const current=parseDateKey(state.trainerSelectedDate)||new Date(),next=addDays(current,delta);state.trainerSelectedDate=dateKey(next);await loadTrainerCalendar(next);await loadTrainerDayMeta(state.trainerSelectedDate);state.view="trainerDay";render();}
async function selectMonthDate(key){const previousView=state.view,previousDate=state.trainerSelectedDate;try{const d=parseDateKey(key);if(!d)throw new Error("That date could not be opened.");await loadTrainerCalendar(d);await loadTrainerDayMeta(key);state.trainerSelectedDate=key;state.view="trainerDay";render()}catch(e){console.error("Could not open day schedule",e);state.view=previousView||"trainer";state.trainerSelectedDate=previousDate;render();alert(e.message||"Could not open that day.")}}
function quickOneOffChange(){const d=state.trainerSelectedDate||nairobiDateKeyClient(0);state.scheduleModal={mode:"block",target:"amy",startDate:d,endDate:d,allDay:true,startTime:"08:00",endTime:"17:00",reason:"Bookings closed for this day",publicMessage:"",quickClose:true};render()}
function trainerView(){
 const t=state.trainer||{todayBookings:[],pendingReviews:[],classes:[],blocks:[],resources:[]};
 const cal=state.trainerCalendar||{bookings:[],classSessions:[],blocks:[]};
 const week=mondayOf(parseDateKey(state.trainerWeekStart)||new Date());
 const pendingCount=Array.isArray(t.pendingReviews)?t.pendingReviews.length:0;
 const attentionCount=(Array.isArray(t.vaccinationAttention)?t.vaccinationAttention.length:0)+(Array.isArray(t.cancellationAttention)?t.cancellationAttention.length:0)+(Array.isArray(t.classRefundAttention)?t.classRefundAttention.length:0);
 const clientCount=Number(t.clientCount||0);
 return `<section class="screen trainer-screen">
  <div class="trainer-top"><div><div class="eyebrow">Amy's workspace</div><h2>Dashboard</h2><p class="small">Month overview first; open one task at a time when you need it.</p></div>
  <div class="actions trainer-actions"><button class="secondary compact-button" onclick="quickOneOffChange()">＋ One-off change</button><button class="secondary compact-button" onclick="addClass()">＋ New course</button><button class="secondary compact-button" onclick="openTrainerAdmin('clients')">＋ Book for client</button><button class="secondary compact-button" onclick="openResourceLibrary()">Training resources</button></div></div>

  <div class="dashboard-taskbar">
    <button class="task-button task-attention" onclick="openTrainerAdmin('attention')"><span>Needs attention</span><b>${attentionCount}</b></button>
    <button class="task-button task-review" onclick="openTrainerAdmin('reviews')"><span>Reviews pending</span><b>${pendingCount}</b></button>
    <button class="task-button task-clients" onclick="openTrainerAdmin('clients')"><span>Clients</span><b>${clientCount||'→'}</b></button>
    <button class="task-button task-classes" onclick="openTrainerAdmin('classes')"><span>Classes</span><span>${Array.isArray(t.classes)?t.classes.length:0}</span></button><button class="task-button task-hours" onclick="openScheduling()"><span>Scheduling</span><span>→</span></button><button class="task-button task-history" onclick="openTrainerAdmin('activity')"><span>Activity history</span><span>→</span></button>
  </div>

  <div class="trainer-dashboard-grid">
    <div class="panel dashboard-month"><div class="panel-title-row"><h3>Month overview</h3><span class="small">Click a date to open the day schedule</span></div>${monthCalendarView()}</div>
    <div class="panel dashboard-week"><div class="calendar-head"><div><h3>Selected week</h3><b>${trainerWeekLabel(week)}</b></div><div class="calendar-nav"><button class="secondary compact-button" onclick="moveTrainerWeek(-1)">←</button><button class="secondary compact-button" onclick="loadTrainerCalendar(new Date()).then(()=>{state.trainerSelectedDate=dateKey(new Date());render()})">Today</button><button class="secondary compact-button" onclick="moveTrainerWeek(1)">→</button></div></div><div class="trainer-week-grid">${Array.from({length:7},(_,i)=>trainerDayCard(dateKey(addDays(week,i)),i)).join("")}</div>${trainerAgenda()}</div>
  </div>
  ${clientDirectoryModal()}${clientRecordModal()}${trainerClientBookingModal()}${workingExceptionModalView()}
 </section>`;
}
function trainerDayView(){
 const d=state.trainerSelectedDate||dateKey(new Date());
 return `<section class="screen trainer-day-page"><button class="back-dashboard" onclick="state.view='trainer';render()">← Back to Month</button><div class="calendar-head"><div><div class="eyebrow">Day schedule</div><h2>${displayDate(d,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h2></div><div class="calendar-nav"><button class="secondary compact-button" onclick="moveTrainerDay(-1)">← Previous day</button><button class="secondary compact-button" onclick="loadTrainerCalendar(new Date()).then(()=>{state.trainerSelectedDate=dateKey(new Date());return loadTrainerDayMeta(state.trainerSelectedDate)}).then(render)">Today</button><button class="secondary compact-button" onclick="moveTrainerDay(1)">Next day →</button></div></div><div class="actions"><button class="secondary" onclick="blockTime()">＋ Block time</button><button class="secondary" onclick="addClass()">＋ New course</button><button class="secondary" onclick="openTrainerAdmin('clients')">＋ Book for client</button></div><div class="panel day-agenda-panel">${trainerAgenda()}</div>${clientDirectoryModal()}${clientRecordModal()}${trainerClientBookingModal()}${scheduleModalView()}</section>`;
}
function serviceAvailabilityView(){
 const d=state.serviceAvailability||{blocks:[]};
 const rows=(d.blocks||[]).map(b=>`<div class="service-block-row future-restriction ${b.location_type}"><div><span class="restriction-title">${b.location_type==="arena"?"Arena":"Home visits"} unavailable</span><small>${esc(friendlyDateRange(b.start_at,b.end_at))}</small><p>${esc(b.public_message||b.reason||"Temporarily unavailable")}</p>${b.private_note?`<small>Private note: ${esc(b.private_note)}</small>`:""}</div><button class="secondary compact-button" onclick="restoreServiceAvailability(${b.id})">Revoke restriction</button></div>`).join("");
 return `<div class="service-status-list">${rows||`<p class="small">No older location restrictions are active.</p>`}</div>`;
}
function openServiceAvailability(locationType){state.serviceAvailabilityModal={locationType,startDate:nairobiDateKeyClient(0),endDate:nairobiDateKeyClient(0),publicMessage:"",privateNote:"",untilFurtherNotice:false};render();}
async function saveServiceAvailability(){
 const m=state.serviceAvailabilityModal;if(!m)return;
 const publicMessage=document.getElementById("servicePublicMessage")?.value.trim()||m.publicMessage?.trim()||"";
 const privateNote=document.getElementById("servicePrivateNote")?.value.trim()||m.privateNote?.trim()||"";
 if(!m.startDate)return alert("Choose the first unavailable date.");
 if(!m.untilFurtherNotice&&!m.endDate)return alert("Choose the last unavailable date.");
 try{await api("/api/trainer/service-availability",{method:"POST",body:JSON.stringify({locationType:m.locationType,startDate:m.startDate,endDate:m.endDate,untilFurtherNotice:!!m.untilFurtherNotice,publicMessage,privateNote})});state.serviceAvailability=await api("/api/trainer/service-availability");state.serviceAvailabilityModal=null;await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render()}catch(e){alert(e.message)}
}
async function restoreServiceAvailability(id){try{await api(`/api/trainer/service-availability/${id}`,{method:"DELETE"});state.serviceAvailability=await api("/api/trainer/service-availability");await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render()}catch(e){alert(e.message)}}
function serviceRestrictionPreviewText(){
 const m=state.serviceAvailabilityModal;if(!m)return "";
 const label=m.locationType==="arena"?"arena training":"home appointments";
 const dateText=m.startDate?(m.untilFurtherNotice?`from ${displayDate(m.startDate,{day:"numeric",month:"long",year:"numeric"})}`:(m.endDate&&m.endDate!==m.startDate?`${displayDate(m.startDate,{day:"numeric",month:"short"})}–${displayDate(m.endDate,{day:"numeric",month:"short",year:"numeric"})}`:displayDate(m.startDate,{day:"numeric",month:"long",year:"numeric"}))):"the selected date";
 return `Sorry, Amy can’t offer ${label} on ${dateText}. ${m.publicMessage||"Your message will appear here."}`;
}
function updateServiceRestrictionPreview(){const p=document.getElementById("serviceClientPreviewText");if(p)p.textContent=serviceRestrictionPreviewText()}
function updateServiceRestrictionMessage(el){const m=state.serviceAvailabilityModal;if(!m)return;m.publicMessage=el.value;updateServiceRestrictionPreview()}
function pickServiceRestrictionDate(btn,field){
 const m=state.serviceAvailabilityModal;if(!m)return;const inp=document.createElement("input");inp.type="date";inp.value=m[field]||"";inp.style.position="fixed";inp.style.opacity="0";document.body.appendChild(inp);
 inp.addEventListener("change",()=>{m[field]=inp.value;btn.textContent=inp.value?`📅 ${displayDate(inp.value,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}`:"📅 Select date";inp.remove();updateServiceRestrictionPreview()},{once:true});
 inp.addEventListener("blur",()=>setTimeout(()=>inp.remove(),80),{once:true});inp.showPicker?inp.showPicker():inp.click();
}
function toggleServiceUntilFurther(el){const m=state.serviceAvailabilityModal;if(!m)return;m.untilFurtherNotice=el.checked;const wrap=document.getElementById("serviceEndWrap");if(wrap)wrap.hidden=el.checked;updateServiceRestrictionPreview()}
function serviceAvailabilityModal(){
 const m=state.serviceAvailabilityModal;if(!m)return "";const msg=m.publicMessage||"";
 return `<div class="modal-overlay"><div class="trainer-modal service-restriction-modal"><button class="close-btn modal-close" onclick="state.serviceAvailabilityModal=null;render()">×</button><div class="eyebrow">Temporary location restriction</div><h2>${m.locationType==="arena"?"Arena unavailable":"Home visits unavailable"}</h2><p>Existing bookings and arena classes are protected. This restriction controls which locations clients can book.</p>
 <div class="form-grid"><label>First unavailable date<button type="button" class="picker-button" onclick="pickServiceRestrictionDate(this,'startDate')">${m.startDate?`📅 ${displayDate(m.startDate,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}`:"📅 Select date"}</button></label><label id="serviceEndWrap" ${m.untilFurtherNotice?"hidden":""}>Last unavailable date<button type="button" class="picker-button" onclick="pickServiceRestrictionDate(this,'endDate')">${m.endDate?`📅 ${displayDate(m.endDate,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}`:"📅 Select date"}</button></label></div>
 <label class="check-row"><input id="serviceUntilFurther" type="checkbox" ${m.untilFurtherNotice?"checked":""} onchange="toggleServiceUntilFurther(this)"> Until further notice</label>
 <label>Message clients will see<textarea id="servicePublicMessage" rows="3" placeholder="${m.locationType==="arena"?"The arena is closed while the ground dries after flooding.":"Her car is in the garage for repairs."}" oninput="updateServiceRestrictionMessage(this)">${esc(msg)}</textarea></label><p class="form-help">Write one short, friendly, complete sentence. Clients see it exactly as part of the preview below.</p>
 <div class="notice client-message-preview"><span>Client preview</span><p id="serviceClientPreviewText">${esc(serviceRestrictionPreviewText())}</p></div>
 <label>Private note for Amy<input id="servicePrivateNote" value="${esc(m.privateNote||"")}" oninput="state.serviceAvailabilityModal.privateNote=this.value" placeholder="Optional — clients will not see this"></label>
 <div class="actions"><button class="secondary" onclick="state.serviceAvailabilityModal=null;render()">Cancel</button><button class="primary" onclick="saveServiceAvailability()">Save restriction</button></div></div></div>`;
}

function focusReviews(){document.getElementById("reviewPanel")?.focus();}
async function viewClients(){state.trainerClients=await api("/api/trainer/clients");state.clientDirectoryOpen=true;state.clientSearch="";render()}
function closeClientDirectory(){state.clientDirectoryOpen=false;render()}
function filterClientDirectory(){state.clientSearch=document.getElementById("clientSearch")?.value||"";render()}
function clientDirectoryModal(){if(!state.clientDirectoryOpen)return "";const q=(state.clientSearch||"").toLowerCase();const rows=(state.trainerClients||[]).filter(x=>!q||[x.name,x.email,x.phone].some(v=>String(v||"").toLowerCase().includes(q))).slice(0,50);return `<div class="modal-overlay"><div class="trainer-modal client-directory"><button class="close-btn modal-close" onclick="closeClientDirectory()">×</button><div class="eyebrow">Amy's workspace</div><h2>Clients</h2><label>Search clients<input id="clientSearch" value="${esc(state.clientSearch||"")}" oninput="state.clientSearch=this.value;document.querySelectorAll('.client-directory-row').forEach(row=>row.hidden=!row.dataset.search.includes(this.value.toLowerCase()))" placeholder="Name, email or phone"></label><p class="small">Showing up to 50 matches. Search narrows the list instantly.</p><div class="client-directory-list">${rows.map(x=>`<button class="client-directory-row" data-search="${esc(`${x.name} ${x.email} ${x.phone||''}`.toLowerCase())}" onclick="openClientRecord(${x.id})"><b>${esc(x.name)}</b><span>${esc(x.email)}</span><small>${esc(x.phone||'No phone added')}</small></button>`).join("")||'<p>No matching clients.</p>'}</div></div></div>`}
async function openClientRecord(id){state.clientRecord=await api(`/api/trainer/client/${id}`);render()}
function closeClientRecord(){state.clientRecord=null;render()}
function clientRecordModal(){const c=state.clientRecord;if(!c)return "";return `<div class="modal-overlay"><div class="trainer-modal client-record-modal"><button class="close-btn modal-close" onclick="closeClientRecord()">×</button><div class="eyebrow">Client record</div><div class="client-record-title"><div><h2>${esc(c.user.name)}</h2><p>${esc(c.user.email)}${c.user.phone?` · ${esc(c.user.phone)}`:""}</p></div><label class="client-status-mini">Client status<select onchange="setClientStatusFromRecord(${c.user.id},this.value)">${["current","dormant","archived"].map(v=>`<option value="${v}" ${v===(c.user.client_status||"current")?"selected":""}>${v}</option>`).join("")}</select></label></div>
 <h3>Dogs</h3><div class="trainer-dog-records">${(c.pets||[]).map(p=>`<article class="trainer-dog-record ${p.archived?"dog-record-archived":""}"><div class="trainer-dog-title"><div><h4>${esc(p.name)}${p.archived?" · Archived":""}</h4><p>${esc(p.breed||"Dog")}${p.gender?` · ${p.gender==="male"?"Male":"Female"}`:""}${p.date_of_birth?` · DOB ${displayDate(p.date_of_birth,{day:"numeric",month:"short",year:"numeric"})}`:" · DOB not set"}${p.neutered_spayed?" · Neutered/spayed":""}</p></div><button class="secondary compact-button" onclick="openVaccinationReview(${p.id})">${p.vaccination_status==="verified"?"Vaccination verified ✓":"Review vaccination"}</button></div>
 ${p.behavior_notes?`<div class="dog-detail-line"><span>Behaviour</span><p>${esc(p.behavior_notes)}</p></div>`:""}
 ${p.medical_procedures?`<div class="dog-detail-line"><span>Medical procedures / history</span><p>${esc(p.medical_procedures)}</p></div>`:""}
 ${p.notes?`<div class="dog-detail-line"><span>Client notes</span><p>${esc(p.notes)}</p></div>`:""}
 <label class="trainer-private-note">Amy's private notes<textarea id="trainerNotes-${p.id}" rows="3" placeholder="Training observations, follow-up notes, handling reminders…">${esc(p.trainer_notes||"")}</textarea><small>Only Amy can see these notes.</small></label>
 <div class="actions trainer-dog-record-actions"><button class="secondary compact-button" onclick="saveTrainerDogNotes(${p.id})">Save Amy's notes</button></div></article>`).join("")||"<p>No dogs recorded.</p>"}</div>
 <h3>Bookings</h3><p>${(c.bookings||[]).length} private booking(s) on file · ${(c.classes||[]).length} class enrolment(s).</p>
 <div class="actions"><button class="primary" onclick="startTrainerClientBooking(${c.user.id})">＋ Book for this client</button><button class="secondary" onclick="closeClientRecord()">Done</button></div></div></div>`}
function startTrainerClientBooking(userId){
 const c=state.clientRecord;if(!c||Number(c.user.id)!==Number(userId))return;
 state.trainerClientBooking={userId:Number(userId),petId:c.pets?.find(p=>!p.archived)?.id||null,service:"standard",locationType:"arena",address:"",date:"",selectedSlot:null,availabilityMessage:""};state.trainerClientBookingSlots=[];render();
}
function invalidateTrainerClientSlots(message=""){if(!state.trainerClientBooking)return;state.trainerClientBookingSlots=[];state.trainerClientBooking.selectedSlot=null;state.trainerClientBooking.availabilityMessage=message}
async function trainerClientBookingDateChanged(value){const m=state.trainerClientBooking;if(!m)return;m.date=value;invalidateTrainerClientSlots("Checking availability…");render();if(value)await trainerClientBookingCheckTimes()}
async function trainerClientBookingOptionChanged(field,value){const m=state.trainerClientBooking;if(!m)return;m[field]=value;invalidateTrainerClientSlots("");render();if(m.date&&field!=="address")await trainerClientBookingCheckTimes()}
async function trainerClientBookingCheckTimes(){
 const m=state.trainerClientBooking;if(!m?.date)return alert("Choose a date.");
 invalidateTrainerClientSlots("Checking availability…");render();
 const qs=new URLSearchParams({date:m.date,locationType:m.locationType,address:m.address||"",service:m.service});
 try{
  const slots=await api(`/api/availability?${qs.toString()}`);state.trainerClientBookingSlots=slots;state.trainerClientBooking.selectedSlot=null;
  if(slots.length){m.availabilityMessage="";render();return}
  let msg="No availability on this date.";
  try{
   const meta=await api(`/api/trainer/day-meta?date=${encodeURIComponent(m.date)}`);
   if(!meta.working?.enabled)msg="Amy is not working on this date.";
   else if(meta.restrictions?.[m.locationType]?.available===false){const r=meta.restrictions[m.locationType];msg=`${m.locationType==="arena"?"Arena":"Home visits"} unavailable on this date.${r.public_message?` ${r.public_message}`:""}`}
   else if(Array.isArray(meta.locationPlan)&&meta.locationPlan.length&&!meta.locationPlan.some(p=>p[m.locationType==="arena"?"arena_enabled":"home_enabled"]))msg=m.locationType==="arena"?"No arena availability in the Daily Location Plan for this date.":"No home-visit availability in the Daily Location Plan for this date.";
  }catch(_e){}
  m.availabilityMessage=msg;render();
 }catch(e){invalidateTrainerClientSlots(e.message||"Could not check availability.");render()}
}
function trainerClientBookingModal(){
 const m=state.trainerClientBooking,c=state.clientRecord;if(!m||!c)return "";
 return `<div class="modal-overlay"><div class="trainer-modal"><button class="close-btn modal-close" onclick="state.trainerClientBooking=null;render()">×</button><div class="eyebrow">Book for a client</div><h2>${esc(c.user.name)}</h2><p>Create a provisional appointment. The client will see it in their portal and can Confirm & Pay with M-Pesa.</p>
 <label>Dog<select onchange="state.trainerClientBooking.petId=Number(this.value)">${(c.pets||[]).filter(p=>!p.archived).map(p=>`<option value="${p.id}" ${Number(m.petId)===Number(p.id)?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label>
 <div class="form-grid"><label>Training<select onchange="trainerClientBookingOptionChanged('service',this.value)"><option value="consultation" ${m.service==="consultation"?"selected":""}>Initial consultation · 90 min</option><option value="standard" ${m.service==="standard"?"selected":""}>Training · 60 min</option><option value="extra" ${m.service==="extra"?"selected":""}>Training + extra time · 90 min</option></select></label><label>Location<select onchange="trainerClientBookingOptionChanged('locationType',this.value)"><option value="arena" ${m.locationType==="arena"?"selected":""}>Amy's arena</option><option value="home" ${m.locationType==="home"?"selected":""}>Home visit</option></select></label></div>
 ${m.locationType==="home"?`<label>Address<input value="${esc(m.address||"")}" oninput="state.trainerClientBooking.address=this.value" onchange="trainerClientBookingOptionChanged('address',this.value)" placeholder="Client home address"></label>`:""}
 <div class="form-grid"><label>Date<input type="date" min="${earliestPrivateDate()}" inputmode="none" onkeydown="event.preventDefault()" onbeforeinput="event.preventDefault()" onclick="this.showPicker&&this.showPicker()" value="${esc(m.date||"")}" onchange="trainerClientBookingDateChanged(this.value)"></label><div class="actions align-end"><button class="secondary" onclick="trainerClientBookingCheckTimes()">Check available times</button></div></div>
 ${m.availabilityMessage?`<div class="notice trainer-client-availability-message">${esc(m.availabilityMessage)}</div>`:""}
 <div class="time-grid compact-times">${(state.trainerClientBookingSlots||[]).map(slot=>`<button class="time ${m.selectedSlot?.start===slot.start?"selected":""}" onclick='state.trainerClientBooking.selectedSlot=${JSON.stringify(slot)};state.trainerClientBooking.availabilityMessage="";render()'>${String(slot.start).slice(11,16)}</button>`).join("")}</div>
 <div class="actions"><button class="secondary" onclick="state.trainerClientBooking=null;render()">Cancel</button><button class="primary" ${!m.petId||!m.selectedSlot?"disabled":""} onclick="createTrainerProvisionalBooking()">Create provisional booking</button></div></div></div>`;
}
async function createTrainerProvisionalBooking(){
 const m=state.trainerClientBooking;if(!m?.selectedSlot)return;
 try{
  await api(`/api/trainer/clients/${m.userId}/provisional-booking`,{method:'POST',body:JSON.stringify({petId:m.petId,service:m.service,locationType:m.locationType,address:m.address,startAt:m.selectedSlot.start,requestedDate:m.date})});
  state.trainerClientBooking=null;state.clientRecord=await api(`/api/trainer/client/${m.userId}`);state.trainer=await api('/api/trainer/summary');await loadTrainerCalendar(new Date());await loadTrainerMonth(new Date());render();alert('Provisional booking created. The client can now confirm and pay from their portal.');
 }catch(e){alert(e.message)}
}

async function reviewStatus(id,status){await api(`/api/trainer/reviews/${id}/status`,{method:"POST",body:JSON.stringify({status})});state.trainer=await api("/api/trainer/summary");render()}
async function setVaccinationStatus(petId,status){
 let note="";if(status==="rejected"){note=prompt("What should the client know about the replacement needed?","Please upload a clearer or updated vaccination record.");if(note===null)return;}
 try{await api(`/api/trainer/pets/${petId}/vaccination-status`,{method:"POST",body:JSON.stringify({status,note})});state.trainer=await api("/api/trainer/summary");if(state.trainerClient?.pets)state.trainerClient=await api(`/api/trainer/client/${state.trainerClient.user.id}`);if(state.clientRecord?.user?.id)state.clientRecord=await api(`/api/trainer/client/${state.clientRecord.user.id}`);if(status==="rejected")state.vaccinationReview=null;else state.vaccinationReview=await api(`/api/trainer/pets/${petId}/vaccinations`);render()}catch(e){alert(e.message)}
}
async function openVaccinationReview(petId){
  try{state.vaccinationReview=await api(`/api/trainer/pets/${petId}/vaccinations`);render()}catch(e){alert(e.message)}
}
function closeVaccinationReview(){state.vaccinationReview=null;render()}
function vaccinationReviewModal(){const d=state.vaccinationReview;if(!d)return '';const files=d.files||[];return `<div class="modal-overlay"><div class="trainer-modal vaccination-review-modal"><button class="close-btn modal-close" aria-label="Close vaccination record" onclick="closeVaccinationReview()">×</button><div class="eyebrow">Vaccination record</div><h2>${esc(d.name||'Dog')}</h2>${files.length?`<p class="small">Look through the uploaded passport page(s) before choosing Verify.</p><div class="vaccination-pages">${files.map((f,i)=>`<figure><img src="${esc(f.url)}" alt="Vaccination passport page ${i+1}"><figcaption>Page ${i+1} · ${esc(f.original_name||'uploaded image')}</figcaption></figure>`).join('')}</div>`:`<div class="notice">No image has been uploaded. Only use Verify if you have physically seen the vaccination record.</div>`}<div class="actions">${d.vaccination_status==='verified'?`<button class="secondary" onclick="setVaccinationStatus(${d.id},'pending')">Undo verification</button>`:`<button class="primary" onclick="setVaccinationStatus(${d.id},'verified')">Verify record</button><button class="danger" onclick="setVaccinationStatus(${d.id},'rejected')">Reject / request replacement</button>`}<button class="secondary" onclick="closeVaccinationReview()">Close</button></div></div></div>`}
async function viewVaccinationFiles(petId){return openVaccinationReview(petId)}
function blockTime(){const d=state.trainerSelectedDate||nairobiDateKeyClient(0);state.scheduleModal={mode:"block",target:"amy",startDate:d,endDate:d,allDay:false,startTime:"09:00",endTime:"10:00",reason:"Unavailable",publicMessage:""};render()}
async function submitScheduleModal(){
 const m=state.scheduleModal;if(!m)return;
 if(m.mode==='block'){
   if(!m.startDate||!m.endDate)return alert('Choose the first and last date.');
   if(m.endDate<m.startDate)return alert('Last date cannot be before first date.');
   if(!m.allDay&&(!m.startTime||!m.endTime||m.startTime>=m.endTime))return alert('Choose valid start and end times.');
   try{
     const payload={target:m.target,startDate:m.startDate,endDate:m.endDate,allDay:!!m.allDay,startTime:m.startTime,endTime:m.endTime,reason:m.reason||'Unavailable',publicMessage:m.publicMessage||m.reason||'Unavailable',allowExisting:!!m.quickClose};
     await api('/api/trainer/schedule-blocks',{method:'POST',body:JSON.stringify(payload)});
     state.scheduleBlocks=await api('/api/trainer/schedule-blocks');state.scheduleModal=null;state.trainer=await api('/api/trainer/summary');
     await loadTrainerCalendar(parseDateKey(state.trainerSelectedDate)||new Date());await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render();
   }catch(e){alert(e.message)}
   return;
 }
 const start=document.getElementById('scheduleStart')?.value||m.start;if(!start)return alert('Please choose a new start date/time.');
 try{
   const id=m.bookingId;await api(`${m.mode==='client-reschedule'?'/api/my/bookings/':'/api/trainer/bookings/'}${id}/reschedule`,{method:'POST',body:JSON.stringify({startAt:start})});
   state.scheduleModal=null;if(m.mode==='client-reschedule'){await portal();alert('Your booking has been rescheduled.')}else{await loadTrainerCalendar(parseDateKey(state.trainerSelectedDate)||new Date());closeTrainerBooking();alert('Booking rescheduled.')}
 }catch(e){alert(e.message)}
}
function closeScheduleModal(){state.scheduleModal=null;render()}
function halfHourOptions(selected){const rows=[];for(let h=0;h<24;h++)for(const m of [0,30]){const v=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;rows.push(`<option value="${v}" ${v===selected?"selected":""}>${v}</option>`)}return rows.join("")}
function scheduleModalView(){
 const m=state.scheduleModal;if(!m)return "";const isBlock=m.mode==="block";
 if(!isBlock)return `<div class="modal-overlay"><div class="trainer-modal schedule-modal"><button class="close-btn modal-close" aria-label="Close" onclick="closeScheduleModal()">×</button><div class="eyebrow">Reschedule booking</div><h2>Choose the new appointment time</h2><label>New start date & time<input id="scheduleStart" type="datetime-local" value="${esc(m.start||"")}" step="1800"></label><p>Duration stays the same.</p><div class="actions"><button class="secondary" onclick="closeScheduleModal()">Cancel</button><button class="primary" onclick="submitScheduleModal()">Confirm new time</button></div></div></div>`;
 return `<div class="modal-overlay"><div class="trainer-modal schedule-modal unified-block-modal"><button class="close-btn modal-close" aria-label="Close" onclick="closeScheduleModal()">×</button><div class="eyebrow">Scheduling</div><h2>${m.quickClose?"One-off change":"Block time"}</h2><p>${m.quickClose?"Close this date to new bookings without disturbing appointments or classes already booked.":"Choose what is unavailable. The same block can cover one day or several days."}</p>
 ${m.quickClose?"":`<div class="block-target-grid"><button class="choice ${m.target==="amy"?"selected":""}" onclick="state.scheduleModal.target='amy';render()"><span>Amy</span><small>No training at all</small></button><button class="choice ${m.target==="arena"?"selected":""}" onclick="state.scheduleModal.target='arena';render()"><span>Arena</span><small>Amy can still do home visits</small></button><button class="choice ${m.target==="home"?"selected":""}" onclick="state.scheduleModal.target='home';render()"><span>Home visits</span><small>Amy can still train in the arena</small></button></div>`}
 <div class="form-grid"><label>${m.quickClose?"Date":"First date"}<input type="date" value="${esc(m.startDate)}" onchange="state.scheduleModal.startDate=this.value;if(state.scheduleModal.quickClose)state.scheduleModal.endDate=this.value;else if(state.scheduleModal.endDate<this.value)state.scheduleModal.endDate=this.value"></label>${m.quickClose?"":`<label>Last date<input type="date" value="${esc(m.endDate)}" onchange="state.scheduleModal.endDate=this.value"></label>`}</div>
 ${m.quickClose?"":`<label class="check-row"><input type="checkbox" ${m.allDay?"checked":""} onchange="state.scheduleModal.allDay=this.checked;render()"> Whole day</label>`}
 ${!m.allDay?`<div class="form-grid"><label>From<select onchange="state.scheduleModal.startTime=this.value">${halfHourOptions(m.startTime)}</select></label><label>To<select onchange="state.scheduleModal.endTime=this.value">${halfHourOptions(m.endTime)}</select></label></div><p class="small">For a multi-day block, these hours are blocked on every day in the selected date range.</p>`:"<p class=\"small\">All client booking time is blocked for the selected target on every selected date.</p>"}
 <label>Reason<input value="${esc(m.reason||"")}" oninput="state.scheduleModal.reason=this.value" placeholder="Booked up / arena maintenance / car unavailable"></label>
 ${m.target!=="amy"?`<label>Message clients will see<textarea rows="2" oninput="state.scheduleModal.publicMessage=this.value" placeholder="Write a short, friendly explanation.">${esc(m.publicMessage||"")}</textarea></label>`:""}
 <div class="actions"><button class="secondary" onclick="closeScheduleModal()">Cancel</button><button class="primary" onclick="submitScheduleModal()">Save block</button></div></div></div>`;
}

async function addResource(){state.resourceLibrary=await api('/api/trainer/resources');state.trainerClients=await api('/api/trainer/clients');state.resourceUploadOpen=true;state.view='resource-library';render()}
async function openResourceLibrary(){state.resourceLibrary=await api('/api/trainer/resources');state.trainerClients=await api('/api/trainer/clients');state.resourceUploadOpen=false;go('resource-library')}

function dashboardBack(){state.trainerAdminPage=null;state.view="trainer";render()}
async function openScheduling(){
 state.trainerAdminPage="scheduling";state.workingHours=await api("/api/trainer/working-hours");state.serviceAvailability=await api("/api/trainer/service-availability");state.scheduleBlocks=await api("/api/trainer/schedule-blocks");state.schedulingDate=state.trainerSelectedDate||nairobiDateKeyClient(0);state.view="trainerAdmin";render();
}
function scheduleBlockLabel(b){return b.target==="amy"?"Amy unavailable":b.target==="arena"?"Arena unavailable":"Home visits unavailable"}
function scheduleBlockDateLabel(b){const dates=b.start_date===b.end_date?displayDate(b.start_date,{weekday:"short",day:"numeric",month:"short",year:"numeric"}):`${displayDate(b.start_date,{day:"numeric",month:"short"})}–${displayDate(b.end_date,{day:"numeric",month:"short",year:"numeric"})}`;return `${dates} · ${b.all_day?"whole day":`${b.start_time}–${b.end_time} each day`}`}
async function revokeScheduleBlock(id){try{await api(`/api/trainer/schedule-blocks/${id}`,{method:"DELETE"});state.scheduleBlocks=await api("/api/trainer/schedule-blocks");await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render()}catch(e){alert(e.message)}}

async function openTrainerAdmin(page){
 state.trainerAdminPage=page;
 if(page==="reviews"){state.reviewAdmin=await api("/api/trainer/reviews")}
 if(page==="clients"){state.clientAdmin=await api("/api/trainer/clients")}
 if(page==="hours"){state.workingHours=await api("/api/trainer/working-hours")}
 if(page==="classes"){state.classAdmin=await api("/api/trainer/classes-detail")}
 if(page==="activity"){state.activityAdmin=await api("/api/trainer/activity")}
 state.view="trainerAdmin";render();
}
function trainerAdminView(){
 if(state.trainerAdminPage==="reviews")return reviewAdminView();
 if(state.trainerAdminPage==="clients")return clientAdminView();
 if(state.trainerAdminPage==="hours"||state.trainerAdminPage==="scheduling")return workingHoursView();
 if(state.trainerAdminPage==="classes")return classesAdminView();
 if(state.trainerAdminPage==="activity")return activityAdminView();
 return attentionAdminView();
}
function activityAdminView(){const rows=state.activityAdmin||[];return `<section class="screen admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Activity history</h2><p>Recent preserved booking and client, dog and class actions, newest first.</p></div></div><div class="activity-list">${rows.map(x=>`<div class="activity-row"><div><span class="activity-action">${esc(String(x.action||"").replaceAll("_"," "))}</span><small>${esc(x.client_name||"")}${x.pet_name?` · ${esc(x.pet_name)}`:""}${x.class_title?` · ${esc(x.class_title)}`:""}</small><p>${esc(x.details||"")}</p></div><time>${esc(String(x.created_at||"").replace("T"," ").slice(0,16))}</time></div>`).join("")||"<p>No activity has been recorded yet.</p>"}</div></section>`}
function reviewAdminView(){
 const rows=state.reviewAdmin||[];
 const active=rows.find(r=>r.id===state.selectedReviewAdmin)||rows[0];
 return `<section class="screen admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Reviews</h2></div></div><div class="review-admin-layout"><div class="admin-list">${rows.map(r=>`<button class="admin-list-row" onclick="state.selectedReviewAdmin=${r.id};render()"><span>${r.starred?'★ ':''}${esc(r.name)}</span><small>${r.status}${r.retired?' · retired':''} · ${r.rating}/5</small></button>`).join('')||'<div class="center"><p>No reviews.</p></div>'}</div><div class="admin-detail">${reviewAdminDetail(active)}</div></div></section>`;
}
function reviewAdminDetail(r){
 if(!r)return '';
 return `<div class="card"><div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</div><h3>${esc(r.name)}</h3><p>${esc(r.text)}</p>${r.photo_filename?`<img class="review-admin-photo" src="/api/trainer/reviews/${r.id}/photo" alt="Review photo">`:''}<div class="icon-actions"><button class="approve-icon" title="Approve" onclick="adminReviewStatus(${r.id},'approved')">✓</button><button class="reject-icon" title="Reject" onclick="adminReviewStatus(${r.id},'rejected')">×</button><button class="secondary compact-button" onclick="manageReview(${r.id},'star')">${r.starred?'★ Starred':'☆ Star'}</button><button class="secondary compact-button" onclick="manageReview(${r.id},'${r.retired?'restore':'retire'}')">${r.retired?'Restore':'Retire'}</button></div></div>`;
}
async function adminReviewStatus(id,status){await api(`/api/trainer/reviews/${id}/status`,{method:"POST",body:JSON.stringify({status})});state.reviewAdmin=await api("/api/trainer/reviews");state.trainer=await api("/api/trainer/summary");render()}
async function manageReview(id,action){await api(`/api/trainer/reviews/${id}/manage`,{method:"POST",body:JSON.stringify({action})});state.reviewAdmin=await api("/api/trainer/reviews");render()}
function clientAdminView(){
 const rows=state.clientAdmin||[],groups=["current","dormant","archived"];
 return `<section class="screen admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Clients</h2></div><input class="admin-search" placeholder="Search client or dog" oninput="filterClientAdmin(this.value)"></div>
 <div class="client-groups">${groups.map(g=>`<div class="client-group"><h3>${g[0].toUpperCase()+g.slice(1)} · ${rows.filter(x=>(x.client_status||"current")===g).length}</h3>${rows.filter(x=>(x.client_status||"current")===g).map(x=>`<button class="client-overview-card" data-search="${esc(([x.name,x.email,x.phone,...(x.pets||[]).map(p=>p.name)].join(" ")).toLowerCase())}" onclick="openClientRecord(${x.id})"><span class="client-overview-head"><span><span class="client-overview-name">${esc(x.name)}</span><small>${esc(x.email)}${x.phone?` · ${esc(x.phone)}`:""}</small></span><span class="client-open-arrow">→</span></span><span class="client-dog-table">${(x.pets||[]).filter(p=>!p.archived).length?`<span class="client-dog-table-head"><span>Dog</span><span>Classes</span><span>Private appts</span></span>${(x.pets||[]).filter(p=>!p.archived).map(p=>`<span class="client-dog-table-row"><span><span>${esc(p.name)}</span><small>${p.gender?(p.gender==="male"?"Male":"Female"):"Gender not set"} · ${p.date_of_birth?displayDate(p.date_of_birth,{day:"numeric",month:"short",year:"numeric"}):"DOB not set"}</small></span><span>${Number(p.class_count||0)}</span><span>${Number(p.private_count||0)}</span></span>`).join("")}`:`<span class="small">No active dogs.</span>`}</span></button>`).join("")||'<p class="small">None</p>'}</div>`).join("")}</div>${clientRecordModal()}${trainerClientBookingModal()}</section>`;
}
async function setClientStatusFromRecord(id,status){
 try{await api(`/api/trainer/clients/${id}/status`,{method:"POST",body:JSON.stringify({status})});state.clientAdmin=await api("/api/trainer/clients");state.clientRecord=await api(`/api/trainer/client/${id}`);render()}catch(e){alert(e.message)}
}
async function saveTrainerDogNotes(id){
 const trainerNotes=document.getElementById(`trainerNotes-${id}`)?.value||"";
 try{await api(`/api/trainer/pets/${id}/private-notes`,{method:"PUT",body:JSON.stringify({trainerNotes})});if(state.clientRecord?.user?.id)state.clientRecord=await api(`/api/trainer/client/${state.clientRecord.user.id}`);render()}catch(e){alert(e.message)}
}
function filterClientAdmin(q){q=String(q||'').toLowerCase();document.querySelectorAll('.client-overview-card').forEach(el=>el.hidden=!el.dataset.search.includes(q))}
async function setClientStatus(id,status){await api(`/api/trainer/clients/${id}/status`,{method:"POST",body:JSON.stringify({status})});state.clientAdmin=await api("/api/trainer/clients");render()}
function classesAdminView(){
 const rows=state.classAdmin||[],active=rows.find(x=>x.id===state.selectedClassAdmin)||rows[0];
 return `<section class="screen admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Classes</h2><p>Courses, age ranges, dates, places and dogs enrolled.</p></div><button class="secondary" onclick="addClass()">＋ New course</button></div><div class="class-admin-layout"><div class="admin-list class-admin-list">${rows.map(x=>{const n=(x.enrolments||[]).filter(e=>e.enrolment_status==="active").length;return `<button class="admin-list-row class-course-row ${Number(active?.id)===Number(x.id)?"selected":""}" onclick="state.selectedClassAdmin=${x.id};render()"><span class="class-list-main"><span class="class-list-title">${esc(x.title)}</span><small>${displayDate(x.start_date,{day:"numeric",month:"short",year:"numeric"})}</small></span><span class="class-list-enrolled"><span>${n}/${x.capacity}</span><small>enrolled</small></span></button>`}).join('')||'<p>No classes created yet.</p>'}</div><div class="admin-detail">${classAdminDetail(active)}</div></div></section>`;
}
function classAdminDetail(c){
 if(!c)return "";const active=(c.enrolments||[]).filter(e=>e.enrolment_status==="active"),cancelled=(c.enrolments||[]).filter(e=>["rejected","cancelled_by_client"].includes(e.enrolment_status));
 return `<div class="card class-admin-card"><div class="class-detail-head"><div><h3>${esc(c.title)}</h3><p>${esc(classAgeLabel(c))} · ${active.length}/${c.capacity} places taken · ${c.location_type==="alternate"?esc(c.location_name||"Alternate venue"):"Amy's arena"}</p></div><div class="actions class-edit-actions"><button class="secondary compact-button" onclick="editClassCourse(${c.id})">Edit course</button><button class="danger compact-button" onclick="deleteClassCourse(${c.id})">Delete course</button></div></div><h4>Sessions</h4><div class="compact-list">${(c.sessions||[]).map(s=>`<div>${displayDate(s.session_date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})} · ${esc(s.start_time)}–${esc(s.end_time)}</div>`).join("")}</div><h4>Dogs taking part</h4>${active.length?`<div class="class-participant-list">${active.map(e=>{const months=ageMonthsOnClient(e.date_of_birth,c.start_date);return `<div class="class-enrollee"><div><span class="class-dog-name">${esc(e.pet_name||"Dog")} · ${esc(e.client_name)}</span><small>${esc(e.breed||"Breed not recorded")} · ${e.date_of_birth?`DOB ${displayDate(e.date_of_birth,{day:"numeric",month:"short",year:"numeric"})}${months!=null?` · ${months} months at start`:""}`:"DOB not recorded"}</small><small>${esc(e.email||"")}${e.phone?` · ${esc(e.phone)}`:""}</small>${e.vaccination_status==="verified"?`<small class="vaccination-verified">Vaccination verified ✓</small>`:""}</div><button class="secondary compact-button" onclick="rejectClassDog(${e.id})">Cancel enrolment</button></div>`}).join("")}</div>`:"<p>No active enrolments yet.</p>"}${cancelled.length?`<h4>Cancelled enrolments / history</h4><div class="compact-list">${cancelled.map(e=>`<div class="class-enrollee rejected-enrollee"><div><span>${esc(e.pet_name||"Dog")} · ${esc(e.client_name)}</span><small>${e.enrolment_status==="cancelled_by_client"?`Cancelled by client${e.rejected_reason&&e.rejected_reason!=="Cancelled by client"?` · Client note: ${esc(e.rejected_reason)}`:""}`:esc(e.rejected_reason||"No reason recorded")} · ${esc(e.payment_status||"")}</small></div>${e.payment_status==="refund_pending"?`<div class="actions"><button class="secondary compact-button" onclick="decideClassRefund(${e.id},'full',${Number(c.price||0)})">Full refund</button><button class="secondary compact-button" onclick="decideClassRefund(${e.id},'partial',${Number(c.price||0)})">Partial</button><button class="secondary compact-button" onclick="decideClassRefund(${e.id},'none',${Number(c.price||0)})">No refund</button></div>`:""}</div>`).join("")}</div>`:""}</div>`;
}
async function rejectClassDog(id){const reason=prompt("Why is this enrolment being cancelled? The client will see this note.","");if(reason===null)return;if(!reason.trim())return alert("Please record a short note for the client.");if(!confirm("Cancel this class enrolment? The place will become available again."))return;try{const d=await api(`/api/trainer/class-enrolments/${id}/reject`,{method:"POST",body:JSON.stringify({reason:reason.trim()})});state.classAdmin=await api("/api/trainer/classes-detail");state.classes=await api("/api/classes");state.trainer=await api("/api/trainer/summary");render();if(d.refundPending)alert("Enrolment cancelled. This paid place now needs a refund decision.")}catch(e){alert(e.message)}}
async function decideClassRefund(id,decision,fullAmount){if(decision==="none"){if(!confirm("Record that no refund will be made for this cancelled class enrolment?"))return;try{await api(`/api/trainer/class-enrolments/${id}/refund`,{method:"POST",body:JSON.stringify({decision:"none"})});state.classAdmin=await api("/api/trainer/classes-detail");render()}catch(e){alert(e.message)}return}const amountText=prompt(`${decision==="full"?"Full":"Partial"} refund amount in KES:`,decision==="full"?String(fullAmount||0):"");if(amountText===null)return;const code=prompt("M-Pesa refund / transaction confirmation code:","");if(code===null)return;try{await api(`/api/trainer/class-enrolments/${id}/refund`,{method:"POST",body:JSON.stringify({decision,amount:Number(amountText),code:code.trim()})});state.classAdmin=await api("/api/trainer/classes-detail");render()}catch(e){alert(e.message)}}
async function setSchedulingDate(value){
 if(!value)return;state.schedulingDate=value;state.trainerSelectedDate=value;
 try{await loadTrainerDayMeta(value)}catch(_e){}render();
}
async function organiseSchedulingDay(){
 const value=document.getElementById("schedulingDayDate")?.value||state.schedulingDate||state.trainerSelectedDate||nairobiDateKeyClient(0);
 state.schedulingDate=value;state.trainerSelectedDate=value;await loadTrainerDayMeta(value);openLocationPlan();
}
function blockTimeFromScheduling(){
 const d=document.getElementById("schedulingDayDate")?.value||state.schedulingDate||state.trainerSelectedDate||nairobiDateKeyClient(0);
 state.trainerSelectedDate=d;blockTime();
}
function workingHoursView(){
 const d=state.workingHours||{weekly:[],exceptions:[],recurringBlocks:[],dateBlocks:[]},names=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],blocks=state.scheduleBlocks||[];
 return `<section class="screen admin-screen scheduling-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Scheduling</h2><p>Block time and locations first; normal weekly working hours are kept at the bottom for occasional changes.</p></div></div><div class="scheduling-sections">
 <section class="panel scheduling-section"><div class="scheduling-section-head"><div><span class="schedule-number">1</span><h3>Block time</h3><p>Block Amy completely, the arena only, or home visits only. A block can cover hours on one day, the same hours over several days, or whole days.</p></div><button class="primary compact-button" onclick="blockTime()">＋ Block time</button></div>
 <div class="schedule-block-list">${blocks.map(b=>`<div class="service-block-row future-restriction ${b.target}"><div><span class="restriction-title">${esc(scheduleBlockLabel(b))}</span><small>${esc(scheduleBlockDateLabel(b))}</small><p>${esc(b.reason||"Unavailable")}</p>${b.target!=="amy"&&b.public_message&&b.public_message!==b.reason?`<small>Clients see: ${esc(b.public_message)}</small>`:""}</div><button class="secondary compact-button" onclick="revokeScheduleBlock(${b.id})">Revoke block</button></div>`).join("")||'<p class="small">No new-style blocks are active.</p>'}</div>
 ${(state.serviceAvailability?.blocks||[]).length?`<div class="compact-schedule-list"><h4>Earlier location restrictions</h4>${serviceAvailabilityView()}</div>`:""}
 ${(d.dateBlocks||[]).length?`<div class="compact-schedule-list"><h4>Earlier one-off Amy blocks</h4>${d.dateBlocks.map(x=>`<div class="card compact-card"><span>${displayDate(String(x.start_at).slice(0,10),{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span> · ${String(x.start_at).slice(11,16)}–${String(x.end_at).slice(11,16)} ${x.reason?`· ${esc(x.reason)}`:""}<button class="secondary compact-button" onclick="deleteOneOffBlock(${x.id})">Remove</button></div>`).join("")}</div>`:""}
 ${(d.recurringBlocks||[]).length?`<div class="compact-schedule-list"><h4>Earlier recurring Amy blocks</h4>${d.recurringBlocks.map(x=>`<div class="card compact-card recurring-block-card"><span>${esc(x.start_time)}–${esc(x.end_time)} · ${esc(x.reason||"Blocked")}</span><small>${formatRecurringWeekdays(x.weekdays)} · ${x.start_date?displayDate(x.start_date,{day:"numeric",month:"short",year:"numeric"}):"Any start date"}${x.end_date?` to ${displayDate(x.end_date,{day:"numeric",month:"short",year:"numeric"})}`:" onward"}</small><button class="secondary compact-button" onclick="revokeRecurringBlock(${x.id})">Revoke</button></div>`).join("")}</div>`:""}</section>
 <section class="panel scheduling-section"><div class="scheduling-section-head"><div><span class="schedule-number">2</span><h3>Working hours</h3><p>Amy's normal weekly pattern. This is the least frequently changed part of Scheduling.</p></div><button class="secondary compact-button" onclick="addWorkingException()">＋ One-off change</button></div>
 <div class="hours-list hours-list-v2176">${d.weekly.map(w=>`<div class="hours-row hours-row-v2176"><label class="check-row hours-day"><input type="checkbox" data-day="${w.weekday}" class="wh-enabled" ${w.enabled?"checked":""}> <span>${names[w.weekday]}</span></label><div class="hours-time-pair"><input type="time" class="wh-start" data-day="${w.weekday}" value="${w.start_time||"08:00"}"><span class="hours-to">to</span><input type="time" class="wh-end" data-day="${w.weekday}" value="${w.end_time||"17:00"}"></div></div>`).join("")}</div><div class="actions"><button class="primary" onclick="saveWorkingHours()">Save weekly hours</button></div>
 <div class="exception-list compact-schedule-list"><h4>One-off working-hour changes</h4>${(d.exceptions||[]).map(x=>`<div class="card compact-card"><span>${displayDate(x.exception_date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span> · ${x.enabled?`${esc(x.start_time)}–${esc(x.end_time)} · extra / changed working hours`:"Unavailable all day"} ${x.note?`· ${esc(x.note)}`:""}<button class="secondary compact-button" onclick="deleteWorkingException(${x.id})">Remove</button></div>`).join("")||'<p class="small">No one-off working-hour changes.</p>'}</div></section>
 </div>${workingExceptionModalView()}${scheduleModalView()}</section>`;
}
function pickDateButton(btn){
 const inp=document.createElement('input');inp.type='date';inp.value=btn.dataset.value||'';inp.style.position='fixed';inp.style.opacity='0';document.body.appendChild(inp);
 inp.addEventListener('change',()=>{btn.dataset.value=inp.value;state.scheduleModal.startDate=inp.value;btn.textContent='📅 '+new Date(`${inp.value}T12:00:00`).toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short',year:'numeric'});inp.remove()},{once:true});
 inp.addEventListener('blur',()=>setTimeout(()=>inp.remove(),50),{once:true});
 inp.showPicker?inp.showPicker():inp.click();
}

function pickTimeButton(btn){
 const inp=document.createElement('input');inp.type='time';inp.value=btn.dataset.value||'';inp.style.position='fixed';inp.style.opacity='0';document.body.appendChild(inp);
 inp.addEventListener('change',()=>{btn.dataset.value=inp.value;btn.textContent=inp.value;inp.remove()},{once:true});
 inp.addEventListener('blur',()=>setTimeout(()=>inp.remove(),50),{once:true});
 inp.showPicker?inp.showPicker():inp.click();
}
async function saveWorkingHours(){
 const weekly=[...document.querySelectorAll('.hours-row')].map(row=>{const en=row.querySelector('.wh-enabled');return{weekday:Number(en.dataset.day),enabled:en.checked,start_time:row.querySelector('.wh-start').value,end_time:row.querySelector('.wh-end').value}});
 try{await api('/api/trainer/working-hours',{method:'POST',body:JSON.stringify({weekly})});state.workingHours=await api('/api/trainer/working-hours');alert('Working hours saved.');render()}catch(e){alert(e.message)}
}
function addWorkingException(){state.workingExceptionModal={date:"",mode:"available",unavailableScope:"all",start_time:"08:00",end_time:"17:00",note:""};render();}
function pickWorkingExceptionDate(btn){const inp=document.createElement("input");inp.type="date";inp.value=btn.dataset.value||"";inp.style.position="fixed";inp.style.opacity="0";document.body.appendChild(inp);inp.addEventListener("change",()=>{if(state.workingExceptionModal)state.workingExceptionModal.date=inp.value;inp.remove();render()},{once:true});inp.addEventListener("blur",()=>setTimeout(()=>inp.remove(),50),{once:true});inp.showPicker?inp.showPicker():inp.click()}
function workingExceptionModalView(){
 const m=state.workingExceptionModal;if(!m)return "";
 const summary=m.date?(m.mode==="available"?`On ${displayDate(m.date,{weekday:"long",day:"numeric",month:"long"})}, Amy will be available from ${m.start_time} to ${m.end_time}, even if the usual weekly schedule says otherwise.`:m.unavailableScope==="all"?`On ${displayDate(m.date,{weekday:"long",day:"numeric",month:"long"})}, Amy will be unavailable all day, even if she would normally work.`:`On ${displayDate(m.date,{weekday:"long",day:"numeric",month:"long"})}, Amy will be unavailable from ${m.start_time} to ${m.end_time}.`):"Choose a date to see the change summarised here.";
 return `<div class="modal-overlay"><div class="trainer-modal schedule-modal"><button class="close-btn modal-close" onclick="state.workingExceptionModal=null;render()">×</button><div class="eyebrow">Working hours</div><h2>One-off change</h2><p>What is different on this date?</p>
 <label>Date<button type="button" class="picker-button" data-value="${esc(m.date||"")}" onclick="pickWorkingExceptionDate(this)">${m.date?`📅 ${displayDate(m.date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}`:"📅 Select date"}</button></label>
 <div class="exception-choice-grid"><button type="button" class="choice ${m.mode==="available"?"selected":""}" onclick="state.workingExceptionModal.mode='available';render()"><span>Amy is available</span><small>despite the usual weekly schedule</small></button><button type="button" class="choice ${m.mode==="unavailable"?"selected":""}" onclick="state.workingExceptionModal.mode='unavailable';render()"><span>Amy is not available</span><small>despite the usual weekly schedule</small></button></div>
 ${m.mode==="unavailable"?`<div class="exception-scope"><label class="check-row"><input type="radio" name="exceptionScope" ${m.unavailableScope==="all"?"checked":""} onchange="state.workingExceptionModal.unavailableScope='all';render()"> All day</label><label class="check-row"><input type="radio" name="exceptionScope" ${m.unavailableScope==="part"?"checked":""} onchange="state.workingExceptionModal.unavailableScope='part';render()"> Part of the day</label></div>`:""}
 ${m.mode==="available"||m.unavailableScope==="part"?`<div class="form-grid"><label>${m.mode==="available"?"Available from":"Unavailable from"}<input type="time" value="${esc(m.start_time)}" onchange="state.workingExceptionModal.start_time=this.value;render()"></label><label>to<input type="time" value="${esc(m.end_time)}" onchange="state.workingExceptionModal.end_time=this.value;render()"></label></div>`:""}
 <label>Private note<input value="${esc(m.note||"")}" oninput="state.workingExceptionModal.note=this.value" placeholder="Optional note for Amy"></label><div class="notice exception-summary">${esc(summary)}</div>
 <div class="actions"><button class="secondary" onclick="state.workingExceptionModal=null;render()">Cancel</button><button class="primary" onclick="saveWorkingException()">Save change</button></div></div></div>`;
}
async function saveWorkingException(){
 const m=state.workingExceptionModal;if(!m?.date)return alert("Choose the date.");
 if((m.mode==="available"||m.unavailableScope==="part")&&(!m.start_time||!m.end_time||m.start_time>=m.end_time))return alert("Choose valid start and end times.");
 try{
  if(m.mode==="available")await api("/api/trainer/working-hours/exception",{method:"POST",body:JSON.stringify({date:m.date,enabled:true,start_time:m.start_time,end_time:m.end_time,note:m.note||""})});
  else if(m.unavailableScope==="all")await api("/api/trainer/working-hours/exception",{method:"POST",body:JSON.stringify({date:m.date,enabled:false,start_time:null,end_time:null,note:m.note||"Unavailable"})});
  else await api("/api/trainer/blocks",{method:"POST",body:JSON.stringify({startAt:`${m.date}T${m.start_time}:00`,endAt:`${m.date}T${m.end_time}:00`,reason:m.note||"Unavailable"})});
  state.workingExceptionModal=null;state.workingHours=await api("/api/trainer/working-hours");state.trainer=await api("/api/trainer/summary");await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());render();
 }catch(e){alert(e.message)}
}
function formatRecurringWeekdays(value){
 const names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],days=String(value||"").split(",").filter(Boolean).map(Number);
 if(days.length===7)return "Every day";if(days.length===5&&[1,2,3,4,5].every(x=>days.includes(x)))return "Weekdays";return days.map(x=>names[x]).join(", ");
}
function recurringBlockAppliesOnDateClient(r,date){if(r.start_date&&date<r.start_date)return false;if(r.end_date&&date>r.end_date)return false;const d=parseDateKey(date);return !!d&&String(r.weekdays||"").split(",").map(Number).includes(d.getDay())}
function addRecurringBlock(){state.recurringBlockModal={weekdays:[1,2,3,4,5],start_time:"12:00",end_time:"13:00",reason:"Lunch",start_date:state.trainerSelectedDate||earliestPrivateDate(),end_date:"",untilFurtherNotice:true};render()}
function recurringBlockModalView(){
 const m=state.recurringBlockModal;if(!m)return "";const names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
 return `<div class="modal-overlay"><div class="trainer-modal recurring-block-modal"><button class="close-btn modal-close" onclick="state.recurringBlockModal=null;render()">×</button><div class="eyebrow">Working hours</div><h2>Recurring blocked time</h2><p>Choose the weekdays, half-hour period and dates Amy wants kept unavailable.</p>
 <div class="weekday-picker">${names.map((n,i)=>`<label class="weekday-chip"><input type="checkbox" ${m.weekdays.includes(i)?"checked":""} onchange="setRecurringWeekday(${i},this.checked)"> ${n}</label>`).join("")}</div>
 <div class="form-grid"><label>From<select onchange="state.recurringBlockModal.start_time=this.value">${halfHourOptions(m.start_time)}</select></label><label>To<select onchange="state.recurringBlockModal.end_time=this.value">${halfHourOptions(m.end_time)}</select></label></div>
 <div class="form-grid"><label>First date<button type="button" class="picker-button" onclick="pickRecurringBlockDate(this,'start_date')">${m.start_date?`📅 ${displayDate(m.start_date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}`:"📅 Select date"}</button></label><label id="recurringEndWrap" ${m.untilFurtherNotice?"hidden":""}>Last date<button type="button" class="picker-button" onclick="pickRecurringBlockDate(this,'end_date')">${m.end_date?`📅 ${displayDate(m.end_date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}`:"📅 Select date"}</button></label></div>
 <label class="check-row"><input type="checkbox" ${m.untilFurtherNotice?"checked":""} onchange="toggleRecurringUntilFurther(this)"> Until further notice</label>
 <label>Reason<input value="${esc(m.reason||"")}" oninput="state.recurringBlockModal.reason=this.value" placeholder="Lunch"></label>
 <div class="actions"><button class="secondary" onclick="state.recurringBlockModal=null;render()">Cancel</button><button class="primary" onclick="saveRecurringBlock()">Save recurring block</button></div></div></div>`;
}
function setRecurringWeekday(day,checked){const m=state.recurringBlockModal;if(!m)return;m.weekdays=checked?[...new Set([...m.weekdays,day])]:m.weekdays.filter(x=>x!==day)}
function pickRecurringBlockDate(btn,field){const m=state.recurringBlockModal;if(!m)return;const inp=document.createElement("input");inp.type="date";inp.value=m[field]||"";inp.style.position="fixed";inp.style.opacity="0";document.body.appendChild(inp);inp.addEventListener("change",()=>{m[field]=inp.value;btn.textContent=inp.value?`📅 ${displayDate(inp.value,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}`:"📅 Select date";inp.remove()},{once:true});inp.addEventListener("blur",()=>setTimeout(()=>inp.remove(),80),{once:true});inp.showPicker?inp.showPicker():inp.click()}
function toggleRecurringUntilFurther(el){const m=state.recurringBlockModal;if(!m)return;m.untilFurtherNotice=el.checked;const wrap=document.getElementById("recurringEndWrap");if(wrap)wrap.hidden=el.checked}
async function saveRecurringBlock(){const m=state.recurringBlockModal;if(!m)return;if(!m.weekdays.length)return alert("Choose at least one weekday.");if(!m.start_date)return alert("Choose the first date.");if(!m.untilFurtherNotice&&!m.end_date)return alert("Choose the last date.");if(m.start_time>=m.end_time)return alert("End time must be after start time.");try{await api("/api/trainer/recurring-blocks",{method:"POST",body:JSON.stringify({weekdays:m.weekdays,start_time:m.start_time,end_time:m.end_time,reason:m.reason||"Blocked",start_date:m.start_date,end_date:m.untilFurtherNotice?"":m.end_date})});state.recurringBlockModal=null;state.workingHours=await api("/api/trainer/working-hours");if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render()}catch(e){alert(e.message)}}
async function revokeRecurringBlock(id){await api(`/api/trainer/recurring-blocks/${id}`,{method:"DELETE"});state.workingHours=await api("/api/trainer/working-hours");render()}
async function deleteWorkingException(id){await api(`/api/trainer/working-hours/exception/${id}`,{method:'DELETE'});state.workingHours=await api('/api/trainer/working-hours');render()}
function attentionAdminView(){
 const t=state.trainer||{};
 return `<section class="screen admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Needs attention</h2></div></div><div class="admin-list-large">${(t.vaccinationAttention||[]).map(x=>`<div class="card"><span>Vaccination · ${esc(x.pet_name)}</span><p>${esc(x.client_name)} · ${Number(x.vaccination_count||0)===0?'No vaccination record uploaded':x.vaccination_status==='rejected'?'Replacement requested':'Record waiting for review'}</p><button class="secondary" onclick="openVaccinationReview(${x.pet_id})">${x.vaccination_status==='not_provided'?'Open / mark as seen':'Review record'}</button></div>`).join('')}${(t.cancellationAttention||[]).map(x=>`<div class="card"><b>Cancellation · ${esc(x.booking_ref)}</b><p>${esc(x.client_name)} · ${esc(x.pet_name||'')}</p><button class="secondary" onclick="openTrainerBooking(${x.id})">Handle refund</button></div>`).join('')}${(t.classRefundAttention||[]).map(x=>`<div class="card"><span>Class cancellation / refund · ${esc(x.title)}</span><p>${esc(x.client_name)} · ${esc(x.pet_name||'')}</p><button class="secondary" onclick="state.selectedClassAdmin=${x.class_id};openTrainerAdmin('classes')">Open class</button></div>`).join('')}${!(t.vaccinationAttention||[]).length&&!(t.cancellationAttention||[]).length&&!(t.classRefundAttention||[]).length?'<p class="small">Nothing needs attention.</p>':''}</div></section>`;
}
async function deleteOneOffBlock(id){try{await api(`/api/trainer/blocks/${id}`,{method:"DELETE"});state.workingHours=await api("/api/trainer/working-hours");state.trainer=await api("/api/trainer/summary");await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());render()}catch(e){alert(e.message)}}

function resourceLibraryView(){
 const rows=state.resourceLibrary||[];
 return `<section class="screen resource-library-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="library-head"><div><div class="eyebrow">Amy's workspace</div><h2>Training Resources</h2><p class="small">A reusable file library. Assign a resource directly to a client and add an optional note.</p></div><button class="primary" onclick="addResource()">＋ Add resource</button></div>
 <div class="resource-file-list" role="table"><div class="resource-file-row resource-file-head" role="row"><span>Title</span><span>Type</span><span>Category</span><span>Actions</span></div>${rows.map(r=>`<div class="resource-file-row" role="row"><div><b>${esc(r.title)}</b><small>${esc((r.description||'').replace(/^__FILE__[^ ]+\s?/,''))}</small></div><span class="badge">${esc(r.type.toUpperCase())}</span><span>${esc(r.category||'General')}</span><div class="resource-file-actions"><button class="secondary compact-button" onclick="assignResource(${r.id})">Assign</button><button class="secondary compact-button" onclick="manageResourceAccess(${r.id})">Manage</button><button class="secondary compact-button" onclick="openResource('${esc(r.url)}','${esc(r.type)}')">Open</button><button class="danger compact-button" onclick="archiveResource(${r.id})">Remove</button></div></div>`).join('')||'<div class="empty-pets"><div><h3>Your resource library is empty</h3><p class="small">Add your first training resource.</p></div></div>'}</div>${state.resourceUploadOpen?resourceUploadModal():''}</section>`;
}
function resourceUploadModal(){return `<div class="modal-overlay"><div class="trainer-modal"><button class="close-btn modal-close" aria-label="Close" onclick="state.resourceUploadOpen=false;render()">×</button><div class="eyebrow">Training Resources</div><h2>Add a resource</h2><form onsubmit="submitResourceUpload(event)"><label>Title<input id="resourceTitle" required></label><div class="form-grid"><label>Category<input id="resourceCategory" value="General"></label><label>Type<select id="resourceType"><option value="auto">Detect automatically</option><option value="video">Video</option><option value="pdf">PDF</option><option value="image">Photo/image</option><option value="audio">Audio</option><option value="link">External link</option></select></label></div><label style="margin-top:8px">Description<textarea id="resourceDescription" rows="3"></textarea></label><label style="margin-top:8px">File<input id="resourceFile" type="file" accept="video/*,image/*,application/pdf,audio/*,.doc,.docx,.txt"></label><label style="margin-top:8px">External link <span class="small">(only needed for a link resource)</span><input id="resourceUrl" type="url" placeholder="https://..."></label><p class="small">Upload videos, PDFs, photos, audio or documents up to 50 MB, or add a link.</p><div class="actions"><button type="button" class="secondary" onclick="state.resourceUploadOpen=false;render()">Cancel</button><button type="submit" class="primary">Save resource</button></div></form></div></div>`}
async function submitResourceUpload(ev){ev.preventDefault();const fd=new FormData();const title=document.getElementById('resourceTitle').value.trim(),category=document.getElementById('resourceCategory').value.trim()||'General',description=document.getElementById('resourceDescription').value.trim(),type=document.getElementById('resourceType').value,file=document.getElementById('resourceFile').files[0],url=document.getElementById('resourceUrl').value.trim();if(!file&&!url)return alert('Please choose a file or enter an external link.');fd.append('title',title);fd.append('category',category);fd.append('description',description);if(type!=='auto')fd.append('type',type);if(url)fd.append('url',url);if(file)fd.append('file',file);try{await api('/api/trainer/resources',{method:'POST',body:fd});state.resourceUploadOpen=false;state.resourceLibrary=await api('/api/trainer/resources');render();alert('Resource saved to the library.')}catch(e){alert(e.message)}}

async function assignResource(id){
 const clients=state.trainerClients||await api('/api/trainer/clients');state.trainerClients=clients;if(!clients.length)return alert('No clients yet.');
 const query=(prompt('Search client by name, email or phone:')||'').trim().toLowerCase();if(!query)return;const matches=clients.filter(c=>[c.name,c.email,c.phone].some(v=>String(v||'').toLowerCase().includes(query)));if(!matches.length)return alert('No matching client found.');
 const n=matches.length===1?1:Number(prompt(matches.slice(0,20).map((c,i)=>`${i+1}. ${c.name} — ${c.email}${c.phone?' — '+c.phone:''}`).join('\n')+'\n\nChoose client number:'));if(!n||!matches[n-1])return;const client=matches[n-1];const note=prompt(`Optional note for ${client.name}:`,'')||'';await api(`/api/trainer/resources/${id}/access`,{method:'POST',body:JSON.stringify({userId:client.id,note})});alert(`Resource shared with ${client.name}.`);
}
async function manageResourceAccess(id){
 const rows=await api('/api/trainer/resources/'+id+'/access');
 if(!rows.length)return alert('This resource is not assigned yet.');
 const text=rows.map((r,i)=>(`${i+1}. ${r.user_name||''}${r.pet_name?' · Dog: '+r.pet_name:''}${r.class_title?' · Class: '+r.class_title:''}`)).join('\n');
 const n=Number(prompt(text+'\n\nEnter number to unassign:'));
 if(!n||!rows[n-1])return;
 await api('/api/trainer/resources/access/'+rows[n-1].id,{method:'DELETE'});
 alert('Resource unassigned.');
}
async function archiveResource(id){if(!confirm('Remove this resource from the active library?'))return;await api(`/api/trainer/resources/${id}`,{method:'DELETE'});state.resourceLibrary=await api('/api/trainer/resources');render()}

function editClassCourse(id){
 const c=(state.classAdmin||[]).find(x=>Number(x.id)===Number(id));if(!c)return;
 const sessions=c.sessions||[];
 state.scheduleModal={mode:"class",editId:Number(c.id),title:c.title||"",count:sessions.length||1,startDate:sessions[0]?.session_date||c.start_date||"",startTime:c.start_time||sessions[0]?.start_time||"09:00",endTime:c.end_time||sessions[0]?.end_time||"10:00",price:String(c.price||0),capacity:String(c.capacity||12),recurrence:"custom",customDates:sessions.map(x=>x.session_date),minAgeMonths:c.min_age_months==null?"":String(c.min_age_months),maxAgeMonths:c.max_age_months==null?"":String(c.max_age_months),locationType:c.location_type||"arena",locationName:c.location_name||"",activeEnrolments:(c.enrolments||[]).filter(e=>e.enrolment_status==="active").length};
 render();
}
async function deleteClassCourse(id){
 const c=(state.classAdmin||[]).find(x=>Number(x.id)===Number(id));if(!c)return;
 const total=(c.enrolments||[]).length;
 if(total)return alert("This course has enrolment history, so it cannot be deleted. Cancel or handle the enrolments instead.");
 if(!confirm(`Delete "${c.title}" and all of its session dates? This cannot be undone.`))return;
 try{
  await api(`/api/trainer/classes/${id}`,{method:"DELETE"});
  const refreshed=await Promise.all([api("/api/classes"),api("/api/trainer/summary"),api("/api/trainer/classes-detail")]);
  state.classes=refreshed[0];state.trainer=refreshed[1];state.classAdmin=refreshed[2];state.selectedClassAdmin=state.classAdmin[0]?.id||null;
  await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());render();
 }catch(e){alert(e.message)}
}
async function addClass(){state.scheduleModal={mode:'class',title:'',count:5,startDate:'',startTime:'09:00',endTime:'10:00',price:'7500',capacity:'12',recurrence:'weekly',customDates:[],minAgeMonths:'',maxAgeMonths:''};render()}
async function submitClassModal(){
 const title=document.getElementById('classTitle').value.trim();
 const count=Math.max(1,Math.min(20,Number(document.getElementById('classCount').value||5)));
 const startDate=document.getElementById('classStartDateBtn').dataset.value;
 const startTime=document.getElementById('classStartTimeBtn').dataset.value;
 const endTime=document.getElementById('classEndTimeBtn').dataset.value;
 const price=document.getElementById('classPrice').value;
 const capacity=document.getElementById('classCapacity').value;
 const recurrence=document.getElementById('classRecurrence').value;
 let customDates=[];
 if(recurrence==='custom'){
   customDates=[...document.querySelectorAll('.custom-class-date')].map(x=>x.value).filter(Boolean);
   if(customDates.length!==count)return alert(`Please choose exactly ${count} custom class dates.`);
 }
 if(!title||!startDate)return alert('Please complete the course name and first date.');
 try{
   const editId=state.scheduleModal?.editId;const activeEnrolments=Number(state.scheduleModal?.activeEnrolments||0);if(editId&&activeEnrolments&&!confirm(`This course has ${activeEnrolments} active enrolment(s). Changing dates or times will change what clients see in the app. Continue?`))return;const created=await api(editId?`/api/trainer/classes/${editId}`:'/api/trainer/classes',{method:editId?'PUT':'POST',body:JSON.stringify({title,startDate:startDate||customDates[0],startTime,endTime,price,capacity,count,recurrence,customDates,locationType:document.getElementById('classLocationType').value,locationName:document.getElementById('classLocationName').value,minAgeMonths:document.getElementById('classMinAge').value,maxAgeMonths:document.getElementById('classMaxAge').value})});
   state.scheduleModal=null;
   const refreshed=await Promise.all([api('/api/classes'),api('/api/trainer/summary'),api('/api/trainer/classes-detail')]);
   state.classes=refreshed[0];state.trainer=refreshed[1];state.classAdmin=refreshed[2];state.selectedClassAdmin=Number(created.id||editId);
   await loadTrainerCalendar(new Date(`${state.trainerWeekStart||startDate}T12:00:00`));await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());render();
 }catch(e){alert(e.message)}
}
function classModalView(){
 const m=state.scheduleModal;if(!m||m.mode!=='class')return '';
 const n=Math.max(1,Math.min(20,Number(m.count||5))), recurrence=m.recurrence||'weekly', custom=recurrence==='custom';
 const weekdayLabel=m.startDate?new Date(`${m.startDate}T12:00:00`).toLocaleDateString('en-KE',{weekday:'long'}):'Choose a first date';
 return `<div class="modal-overlay"><div class="trainer-modal schedule-modal">
 <button class="close-btn modal-close" aria-label="Close" onclick="state.scheduleModal=null;render()">×</button>
 <div class="eyebrow">Course planner</div><h2>${m.editId?"Edit class course":"Create a class course"}</h2>
 <p class="small">${m.editId?"Change the course details or individual session dates below.":"Choose the first date; weekly or fortnightly courses follow that weekday automatically. Saturdays are not assumed."}</p>
 <div class="form-grid"><label>Course name<input id="classTitle" value="${esc(m.title||'')}" oninput="state.scheduleModal.title=this.value" required></label><label>Number of classes<input id="classCount" type="number" min="1" max="20" value="${n}" onchange="state.scheduleModal.count=Number(this.value);render()"></label></div>
 ${m.editId?`<input type="hidden" id="classStartDateBtn" data-value="${esc(m.startDate||'')}"><input type="hidden" id="classRecurrence" value="custom">`:`<div class="form-grid class-date-row"><label class="class-date-field">First date<button type="button" id="classStartDateBtn" class="picker-button" data-value="${esc(m.startDate||'')}" onclick="pickDateButton(this)">${m.startDate?`📅 ${new Date(`${m.startDate}T12:00:00`).toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}`:'📅 Select date'}</button></label><label>Repeats<select id="classRecurrence" onchange="state.scheduleModal.recurrence=this.value;render()"><option value="weekly" ${recurrence==='weekly'?'selected':''}>Every week</option><option value="biweekly" ${recurrence==='biweekly'?'selected':''}>Every 2 weeks</option><option value="custom" ${custom?'selected':''}>Custom dates</option></select></label></div>`}
 ${!custom?`<div class="notice"><b>Weekday:</b> ${esc(weekdayLabel)}. The first date determines the weekday automatically.</div>`:`<div class="custom-date-list"><h3>Class dates</h3>${Array.from({length:n},(_,i)=>`<label>Class ${i+1}<input class="custom-class-date" type="date" inputmode="none" onkeydown="event.preventDefault()" onbeforeinput="event.preventDefault()" onclick="this.showPicker&&this.showPicker()" value="${esc(m.customDates?.[i]||'')}" onchange="state.scheduleModal.customDates[${i}]=this.value"></label>`).join('')}</div>`}
 <div class="form-grid"><label>Start time<button type="button" id="classStartTimeBtn" class="picker-button" data-value="${esc(m.startTime||'09:00')}" onclick="pickTimeButton(this)">${esc(m.startTime||'09:00')}</button></label><label>End time<button type="button" id="classEndTimeBtn" class="picker-button" data-value="${esc(m.endTime||'10:00')}" onclick="pickTimeButton(this)">${esc(m.endTime||'10:00')}</button></label></div>
 <div class="form-grid"><label>Price (KES)<input id="classPrice" type="number" min="0" value="${esc(m.price||'7500')}" onchange="state.scheduleModal.price=this.value"></label><label>Places<input id="classCapacity" type="number" min="1" max="100" value="${esc(m.capacity||'12')}" onchange="state.scheduleModal.capacity=this.value"></label></div>
 <div class="form-grid"><label>Minimum age (months)<input id="classMinAge" type="number" min="0" step="1" placeholder="3" value="${esc(m.minAgeMonths||'')}" oninput="state.scheduleModal.minAgeMonths=this.value"></label><label>Maximum age (months)<input id="classMaxAge" type="number" min="0" step="1" placeholder="12" value="${esc(m.maxAgeMonths||'')}" oninput="state.scheduleModal.maxAgeMonths=this.value"></label></div><p class="small">Age is checked from each dog’s date of birth on the course start date.</p><div class="form-grid"><label>Class location<select id="classLocationType" onchange="document.getElementById('alternateClassLocation').hidden=this.value!=='alternate'"><option value="arena" ${m.locationType!=="alternate"?"selected":""}>Amy's arena</option><option value="alternate" ${m.locationType==="alternate"?"selected":""}>Alternate location</option></select></label><label id="alternateClassLocation" ${m.locationType==="alternate"?"":"hidden"}>Alternate location<input id="classLocationName" placeholder="Venue / address" value="${esc(m.locationName||"")}"></label></div><div class="notice">If any proposed class conflicts with an existing booking, class or blocked time, the course will not be created until the conflict is resolved.</div>
 <div class="actions"><button class="secondary" onclick="state.scheduleModal=null;render()">Cancel</button><button class="primary" onclick="submitClassModal()">${m.editId?"Save course changes":"Create course"}</button></div>
 </div></div>`
}

async function openTrainerBooking(id){const b=state.trainerCalendar.bookings.find(x=>x.id===id);if(!b)return;state.trainerBooking=b;state.trainerClient=await api(`/api/trainer/client/${b.user_id}`);render()}
function closeTrainerBooking(){state.trainerBooking=null;state.trainerClient=null;render()}
function trainerBookingModal(){const b=state.trainerBooking,c=state.trainerClient;if(!b)return '';const dog=c?.pets?.find(p=>p.id===b.pet_id);return `<div class="modal-overlay"><div class="trainer-modal"><button class="close-btn modal-close" aria-label="Close appointment" onclick="closeTrainerBooking()">×</button><div class="eyebrow">Appointment</div><h2>${esc(dog?.name||b.pet_name||'Dog')}</h2><p><strong>${esc(b.client)}</strong> · ${esc(b.client_phone||'')}</p><p>${fmt(b.start_at)} · <b class="home-label">${b.location_type==='home'?'HOME VISIT':'AMY’S ARENA'}</b></p>${b.location_type==='home'?`<p class="home-address">${esc(b.address||'Address not recorded')}</p>`:''}<div class="modal-grid"><div><h3>Dog profile</h3>${dog?`<div class="profile-mini">${dog.photo_url?`<img src="${dog.photo_url}" alt="">`:''}<div><b>${esc(dog.name)}</b><span>${esc(dog.breed||'Dog')} · ${esc(dog.age||'Age not added')}</span><span>Vaccination: ${dog.vaccination_status==='verified'?'Verified ✓':`${dog.vaccination_count||0} page(s) · ${dog.vaccination_status||'not provided'}`}</span></div></div><div class="actions"><button class="secondary compact-button" onclick="openVaccinationReview(${dog.id})">${dog.vaccination_status==='verified'?'View / undo verification':'Review vaccination'}</button></div>`:'<p>No dog linked.</p>'}<h3>Client</h3><p>${esc(c?.user?.email||b.client_email||'')}</p></div><div><h3>Training plan / note</h3><textarea id="trainerNote" rows="5" placeholder="Plan for training, observations, next steps..."></textarea><label class="note-visible"><input id="trainerNoteVisible" type="checkbox"> Share this note with the client</label><button class="primary" onclick="saveTrainerNote(${b.user_id},${b.pet_id||'null'},${b.id})">Save note</button><button class="secondary" onclick="openResourceLibrary()">Assign training resources</button></div></div><div class="actions"><button class="secondary" onclick="rescheduleBooking(${b.id})">Reschedule</button><button class="danger" onclick="cancelBooking(${b.id})">Cancel booking</button>${b.payment_status==='refund_pending'?`<button class="secondary" onclick="decideRefund(${b.id},'full')">Full refund</button><button class="secondary" onclick="decideRefund(${b.id},'partial')">Partial refund</button><button class="secondary" onclick="decideRefund(${b.id},'none')">No refund</button>`:''}<button class="primary" onclick="closeTrainerBooking()">Done / Close</button></div></div></div>`}
async function saveTrainerNote(userId,petId,bookingId){const note=document.getElementById('trainerNote')?.value.trim();if(!note)return alert('Please enter a note.');const clientVisible=!!document.getElementById('trainerNoteVisible')?.checked;await api('/api/trainer/notes',{method:'POST',body:JSON.stringify({userId,petId,bookingId,note,clientVisible})});document.getElementById('trainerNote').value='';document.getElementById('trainerNoteVisible').checked=false;alert(clientVisible?'Note saved and shared with the client.':'Private trainer note saved.');}
async function rescheduleBooking(id){const b=state.trainerBooking;if(!b)return;state.scheduleModal={mode:'trainer-reschedule',bookingId:id,start:toDateTimeLocal(b.start_at)};render()}

async function decideRefund(id,decision){
  if(decision==="none"){
    if(!confirm("Record that no refund will be made for this cancelled booking?"))return;
    try{await api(`/api/trainer/bookings/${id}/refund`,{method:"POST",body:JSON.stringify({decision:"none"})});state.trainer=await api("/api/trainer/summary");render();alert("No-refund decision recorded.");}catch(e){alert(e.message)}
    return;
  }
  const candidates=[...(state.trainerCalendar?.bookings||[]),...(state.trainer?.cancellationAttention||[])];
  const b=candidates.find(x=>Number(x.id)===Number(id))||state.trainerBooking||{};
  const fullAmount=Number(b.price||0);
  const amountText=prompt(`${decision==="full"?"Full":"Partial"} refund amount in KES:`,String(decision==="full"?fullAmount:""));
  if(amountText===null)return;
  const amount=Number(amountText);
  const confirmationCode=prompt("Enter the M-Pesa refund/transaction confirmation code:");
  if(confirmationCode===null)return;
  try{
    await api(`/api/trainer/bookings/${id}/refund`,{method:"POST",body:JSON.stringify({decision,amount,confirmationCode})});
    state.trainer=await api("/api/trainer/summary");
    if(state.trainerCalendar)await loadTrainerCalendar(new Date(`${state.trainerWeekStart}T12:00:00`));
    render();
    alert(`${decision==="full"?"Full":"Partial"} refund recorded: KES ${amount.toLocaleString()} · M-Pesa ${confirmationCode}`);
  }catch(e){alert(e.message)}
}
async function cancelBooking(id){if(!confirm('Cancel this booking? A paid booking will become refund pending for Amy to decide.'))return;await api(`/api/trainer/bookings/${id}/cancel`,{method:'POST',body:JSON.stringify({reason:'Cancelled by Amy'})});await loadTrainerCalendar(new Date(`${state.trainerWeekStart}T12:00:00`));closeTrainerBooking()}

function selectClass(id){state.selectedClass=state.classes.find(c=>c.id===id);state.selectedPet=null;render()}
function joinPortal(){portal()}
function accountView(){return `<section class="screen"><div class="center"><div class="panel" style="width:min(620px,100%)"><button class="back" onclick="state.accountOpen=false;go(state.user?.role==='trainer'?'trainer':'portal')">← Back</button><div class="eyebrow">Account & security</div><h2>Change password</h2><p class="small">Your bookings, dogs, vaccination records and training resources are not affected.</p><label>Current password<input id="currentPassword" type="password" autocomplete="current-password"></label><label style="margin-top:8px">New password<input id="newPassword" type="password" autocomplete="new-password"></label><label style="margin-top:8px">Confirm new password<input id="confirmPassword" type="password" autocomplete="new-password"></label><div class="actions"><button class="primary" onclick="changePassword()">Change password</button></div></div></div></section>`}
async function changePassword(){const a=document.getElementById('currentPassword').value,b=document.getElementById('newPassword').value,c=document.getElementById('confirmPassword').value;if(b!==c)return alert('The new passwords do not match.');try{await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:a,newPassword:b})});alert('Password changed successfully.');state.accountOpen=false;go(state.user?.role==='trainer'?'trainer':'portal')}catch(e){alert(e.message)}}
function render(){
 if(state.starting){
   app.innerHTML=`<div class="app-shell"><header class="topbar"><div class="brand"><div class="brand-mark">C</div><div class="brand-name">The Custom Made Canine</div></div></header><main><section class="screen"><div class="center"><div class="panel"><div class="eyebrow">Loading</div><h2>Preparing your workspace…</h2><p class="small">Checking your sign-in and loading the correct portal.</p></div></div></section></main></div>`;
   return;
 }
 let content;
 if(state.view==="home")content=home();
 else if(state.view==="about")content=about();
 else if(state.view==="classes")content=classes();
 else if(state.view==="private")content=privateView();
 else if(state.view==="auth")content=state.authMode==="forgot"?forgotPasswordView():state.authMode==="reset"?resetPasswordView():authView();
 else if(state.view==="payment")content=paymentView();
 else if(state.view==="confirmation")content=confirmationView();
 else if(state.view==="portal")content=portalView();
 else if(state.view==="portalSection")content=portalSectionView();
 else if(state.view==="clientBookings")content=clientBookingsView();
 else if(state.view==="trainer")content=trainerView();
 else if(state.view==="trainerAdmin")content=trainerAdminView();
 else if(state.view==="trainerDay")content=trainerDayView();
 else if(state.view==="resource-library")content=resourceLibraryView();
 else if(state.view==="account")content=accountView();
 if(state.rescheduleDraft)content+=clientRescheduleModal();
 if(state.trainerBooking)content+=trainerBookingModal();
 if(state.vaccinationReview)content+=vaccinationReviewModal();
 if(state.scheduleModal?.mode==="class")content+=classModalView();
 else if(state.scheduleModal)content+=scheduleModalView();
 app.innerHTML=shell(content);
}
state.authMode="login";
window.editClassCourse=editClassCourse;window.deleteClassCourse=deleteClassCourse;window.deleteOneOffBlock=deleteOneOffBlock;window.viewDogPhoto=viewDogPhoto;window.removeDogPhoto=removeDogPhoto;window.openLocationPlan=openLocationPlan;window.addLocationPlanRow=addLocationPlanRow;window.removeLocationPlanRow=removeLocationPlanRow;window.setLocationPlanField=setLocationPlanField;window.saveLocationPlan=saveLocationPlan;window.clearLocationPlan=clearLocationPlan;window.editDog=editDog;window.saveDogEdit=saveDogEdit;window.archiveDog=archiveDog;window.restoreDog=restoreDog;window.rejectClassDog=rejectClassDog;window.decideClassRefund=decideClassRefund;window.pickWorkingExceptionDate=pickWorkingExceptionDate;window.saveWorkingException=saveWorkingException;window.updateServiceRestrictionMessage=updateServiceRestrictionMessage;window.pickServiceRestrictionDate=pickServiceRestrictionDate;window.toggleServiceUntilFurther=toggleServiceUntilFurther;window.setRecurringWeekday=setRecurringWeekday;window.pickRecurringBlockDate=pickRecurringBlockDate;window.toggleRecurringUntilFurther=toggleRecurringUntilFurther;window.saveRecurringBlock=saveRecurringBlock;window.trainerClientBookingDateChanged=trainerClientBookingDateChanged;window.trainerClientBookingOptionChanged=trainerClientBookingOptionChanged;window.openScheduling=openScheduling;window.startAddDogFromBooking=startAddDogFromBooking;window.closeAddDogModal=closeAddDogModal;window.setSchedulingDate=setSchedulingDate;window.organiseSchedulingDay=organiseSchedulingDay;window.blockTimeFromScheduling=blockTimeFromScheduling;window.quickOneOffChange=quickOneOffChange;window.revokeScheduleBlock=revokeScheduleBlock;window.updatePrivateContinueState=updatePrivateContinueState;window.clientCancelClass=clientCancelClass;window.dashboardBack=dashboardBack;window.openTrainerAdmin=openTrainerAdmin;window.adminReviewStatus=adminReviewStatus;window.manageReview=manageReview;window.filterClientAdmin=filterClientAdmin;window.setClientStatus=setClientStatus;window.pickTimeButton=pickTimeButton;window.pickDateButton=pickDateButton;window.saveWorkingHours=saveWorkingHours;window.addWorkingException=addWorkingException;window.deleteWorkingException=deleteWorkingException;window.trainerDayView=trainerDayView;window.addRecurringBlock=addRecurringBlock;window.revokeRecurringBlock=revokeRecurringBlock;window.removeVaccinations=removeVaccinations;window.acceptProvisional=acceptProvisional;window.declineProvisional=declineProvisional;window.moveTrainerMonth=moveTrainerMonth;window.selectMonthDate=selectMonthDate;window.moveTrainerDay=moveTrainerDay;window.openServiceAvailability=openServiceAvailability;window.saveServiceAvailability=saveServiceAvailability;window.restoreServiceAvailability=restoreServiceAvailability;window.startTrainerClientBooking=startTrainerClientBooking;window.trainerClientBookingCheckTimes=trainerClientBookingCheckTimes;window.createTrainerProvisionalBooking=createTrainerProvisionalBooking;window.closeClientDirectory=closeClientDirectory;window.closeClientRecord=closeClientRecord;window.openVaccinationReview=openVaccinationReview;window.closeVaccinationReview=closeVaccinationReview;window.openClientRecord=openClientRecord;window.toggleMenu=toggleMenu;window.submitScheduleModal=submitScheduleModal;window.closeScheduleModal=closeScheduleModal;window.submitClassModal=submitClassModal;window.submitResourceUpload=submitResourceUpload;window.changePassword=changePassword;window.decideRefund=decideRefund;window.openTrainerBooking=openTrainerBooking;window.closeTrainerBooking=closeTrainerBooking;window.rescheduleBooking=rescheduleBooking;window.cancelBooking=cancelBooking;window.openResourceLibrary=openResourceLibrary;window.assignResource=assignResource;window.archiveResource=archiveResource;window.manageResourceAccess=manageResourceAccess;window.changePrivateService=changePrivateService;window.openPortalClasses=openPortalClasses;window.loadRescheduleSlots=loadRescheduleSlots;window.chooseRescheduleSlot=chooseRescheduleSlot;window.confirmClientReschedule=confirmClientReschedule;window.closeClientReschedule=closeClientReschedule;window.clientReschedule=clientReschedule;window.clientCancel=clientCancel;window.go=go;window.startPrivate=startPrivate;window.contactAmy=contactAmy;window.portal=portal;window.logout=logout;window.pickLocation=pickLocation;window.selectSlot=selectSlot;window.submitAuth=submitAuth;window.showForgotPassword=showForgotPassword;window.requestReset=requestReset;window.completeReset=completeReset;window.confirmPrivate=confirmPrivate;window.demoPay=demoPay;window.selectClass=selectClass;window.selectPetForBooking=selectPetForBooking;window.joinClass=joinClass;window.addPet=addPet;window.submitReview=submitReview;window.openResource=openResource;window.reviewStatus=reviewStatus;window.setVaccinationStatus=setVaccinationStatus;window.viewVaccinationFiles=viewVaccinationFiles;window.blockTime=blockTime;window.uploadDogPhoto=uploadDogPhoto;window.uploadVaccinations=uploadVaccinations;window.viewVaccinations=viewVaccinations;window.addResource=addResource;window.addClass=addClass;window.addPrivateCalendarFromConfirmation=addPrivateCalendarFromConfirmation;window.addClassCalendarFromConfirmation=addClassCalendarFromConfirmation;window.addPrivateCalendarByRef=addPrivateCalendarByRef;window.addClassCalendarByRef=addClassCalendarByRef;
init();

// CMC V21.3 password/accessibility enhancements
(function () {
  function enhance(input) {
    if (!input || input.dataset.cmcEnhanced === "1") return;
    input.dataset.cmcEnhanced = "1";
    const wrap = document.createElement("span");
    wrap.className = "password-field-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-visibility";
    toggle.setAttribute("aria-label", "Show password");
    toggle.title = "Show password";
    toggle.textContent = "◉";
    wrap.appendChild(toggle);
    const warning = document.createElement("div");
    warning.className = "caps-lock-warning";
    warning.textContent = "Caps Lock is on";
    wrap.parentNode.insertBefore(warning, wrap.nextSibling);
    const update = e => warning.classList.toggle("visible",
      !!e.getModifierState && e.getModifierState("CapsLock"));
    input.addEventListener("keydown", update);
    input.addEventListener("keyup", update);
    input.addEventListener("blur", () => warning.classList.remove("visible"));
    toggle.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      toggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      toggle.title = showing ? "Show password" : "Hide password";
      toggle.textContent = showing ? "◉" : "●";
      input.focus();
    });
  }
  function scan(){ document.querySelectorAll('input[type="password"]').forEach(enhance); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();
