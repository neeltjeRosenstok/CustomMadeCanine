const app=document.getElementById("app");
const state={user:null,menu:false,view:"home",classes:[],reviews:[],homepageItems:[],homepageAdmin:[],homepageEdit:null,homepagePosterFile:null,applicationStep:1,applicationDraft:null,applicationDogPhoto:null,applicationVaccinationFiles:[],applicationVaccinationAccepted:false,applicationCompletedName:"",parklandsReferralOpen:false,config:null,selectedService:null,selectedLocation:null,selectedDate:null,address:"",slots:[],selectedSlot:null,selectedClass:null,selectedPet:null,showAddPet:false,trainerCalendar:null,trainerWeekStart:null,trainerSelectedDate:null,scheduleModal:null,resourceUploadOpen:false,accountOpen:false,pendingBlock:null,authEmailRemembered:"",vaccinationReview:null,trainerMonthDate:null,trainerMonthCalendar:null,serviceAvailability:null,serviceAvailabilityModal:null,trainerClientBooking:null,trainerClientBookingSlots:[],trainerAdminPage:null,workingHours:null,reviewAdmin:null,clientAdmin:null,selectedReviewAdmin:null,rescheduleDraft:null,classAdmin:null,selectedClassAdmin:null,editPet:null,workingExceptionModal:null,activityAdmin:null,selectedDayStatus:null,trainerDayMeta:null,locationPlanModal:null,recurringBlockModal:null,addPetBookingContext:null,schedulingDate:null,scheduleBlocks:[],bookingTermsOpen:false,reports:null,reportType:"daily",reportFrom:"",reportTo:"",archivedClientsOpen:false,clientStatusFilter:"all",applicationDraftId:null,appDialog:null};

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money=n=>`KES ${Number(n||0).toLocaleString()}`;
const fmt=d=>new Date(d).toLocaleString("en-KE",{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
const toDateTimeLocal=d=>{const x=new Date(d);const pad=n=>String(n).padStart(2,"0");return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`};

function appDialogView(){
 const d=state.appDialog;if(!d)return "";
 const isPrompt=d.type==="prompt",isConfirm=d.type==="confirm";
 return `<div class="app-dialog-overlay" role="presentation"><div class="app-dialog-card" role="dialog" aria-modal="true" aria-labelledby="appDialogTitle">
   <h3 id="appDialogTitle">${esc(d.title||(isPrompt?"Please enter details":isConfirm?"Please confirm":"Message"))}</h3>
   <p>${esc(d.message||"")}</p>
   ${isPrompt?`<label>${esc(d.inputLabel||"")}<input id="appDialogInput" value="${esc(d.defaultValue||"")}" autocomplete="off"></label>`:""}
   <div class="actions app-dialog-actions">
     ${d.type!=="alert"?`<button class="secondary" onclick="finishAppDialog(false)">Cancel</button>`:""}
     <button class="${d.danger?"danger":"primary"}" onclick="finishAppDialog(true)">${esc(d.okLabel||(d.type==="alert"?"OK":"Continue"))}</button>
   </div>
 </div></div>`;
}
function finishAppDialog(ok){
 const d=state.appDialog;if(!d)return;
 let value=ok;
 if(d.type==="prompt")value=ok?(document.getElementById("appDialogInput")?.value??""):null;
 if(d.type==="confirm")value=!!ok;
 if(d.type==="alert")value=true;
 state.appDialog=null;render();
 try{d.resolve(value)}catch(_e){}
}
function openAppDialog(opts){
 return new Promise(resolve=>{state.appDialog={...opts,resolve};render();setTimeout(()=>document.getElementById("appDialogInput")?.focus(),0)});
}
function appAlert(message,title=""){return openAppDialog({type:"alert",message:String(message??""),title,okLabel:"OK"})}
function appConfirm(message,title="Please confirm"){return openAppDialog({type:"confirm",message:String(message??""),title,okLabel:"Continue"})}
function appPrompt(message,defaultValue="",title="Please enter details"){return openAppDialog({type:"prompt",message:String(message??""),defaultValue:String(defaultValue??""),title,okLabel:"Continue"})}

async function api(url,opt={}) {
  const headers={...(opt.headers||{})};
  if(opt.body && !(opt.body instanceof FormData) && !headers["Content-Type"]) headers["Content-Type"]="application/json";
  const method=String(opt.method||"GET").toUpperCase();
  const fetchOpt={headers,...opt};
  if(method==="GET") fetchOpt.cache="no-store";
  const r=await fetch(url,fetchOpt);
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
      // Show Amy's workspace immediately after the session is recognised.
      // Dashboard data then loads independently so one slow request cannot trap the page on "Loading".
      state.starting=false; render();
      void (async()=>{
        const jobs=await Promise.allSettled([
          api("/api/trainer/summary").then(v=>{state.trainer=v}),
          loadTrainerCalendar(new Date()),
          loadTrainerMonth(new Date()),
          api("/api/trainer/service-availability").then(v=>{state.serviceAvailability=v})
        ]);
        const failed=jobs.find(x=>x.status==="rejected");
        if(failed)state.startupError=failed.reason?.message||"One part of Amy's dashboard could not be loaded.";
        render();
      })();
    } else if(state.user?.role==="client"){
      state.view="portal"; state.menu=false;
      try{
        state.profile=await api("/api/my/profile");
        state.bookings=await api("/api/my/bookings");
        state.resources=await api("/api/my/resources");
        state.trainingNotes=await api("/api/my/training-notes");
      }catch(e){ state.startupError=e.message||"Could not load your client portal."; }
    } else state.view="home";
    const results=await Promise.allSettled([api("/api/classes"),api("/api/reviews"),api("/api/homepage-items"),api("/api/config")]);
    const [classes,reviews,homepageItems,config]=results;
    if(classes.status==="fulfilled"&&Array.isArray(classes.value)) state.classes=classes.value;
    if(reviews.status==="fulfilled"&&Array.isArray(reviews.value)) state.reviews=reviews.value;
    if(homepageItems.status==="fulfilled"&&Array.isArray(homepageItems.value)) state.homepageItems=homepageItems.value;
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
    ${appDialogView()}
    ${state.menu?`<nav class="menu" aria-label="Main menu">
      <button onclick="go('about')">Meet Amy</button>
      <button onclick="portal()">Client Portal</button>
      <button onclick="contactAmy()">Contact Amy</button>
      ${state.user?.role==="trainer"?`<button onclick="go('trainer')">Trainer Dashboard</button>`:""}
      ${state.user?`<button onclick="go('account')">Account & security</button><button onclick="logout()">Sign out</button>`:""}
    </nav>`:""}
  </div>`;
}
function toggleMenu(){state.menu=!state.menu;render()}
function go(v){state.view=v;state.menu=false;render();if(v==='payment'){requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));}}
function homepageAction(item){
 const type=String(item?.action_type||"signup");
 if(type==="whatsapp")return "contactAmy()";
 if(type==="classes")return "go('classes')";
 if(type==="none")return "";
 return "startHomepageSignup()";
}
function startHomepageSignup(){
 state.applicationStep=1;
 state.applicationDraftId=null;
 state.applicationDraft=state.applicationDraft||{name:"",email:"",whatsappPhone:"",mpesaPhone:"",newsletterOptIn:false,location:"",introNote:"",dogName:"",dogBreed:"",dogGender:"",dogDob:"",householdDogs:"",householdAdults:"",children0to8:"",children9to13:"",children14plus:"",householdChanges:"",householdNote:"",password:"",confirmPassword:""};
 go("application");
}
function homepageOfferCard(item){
 const action=homepageAction(item);
 const label=item.action_label||({whatsapp:"WhatsApp Amy",classes:"See classes",none:"",signup:"Sign up"}[item.action_type]||"Sign up");
 return `<article class="home-offer-card ${item.featured?"featured":""} ${item.poster_url?"poster-card":""}">${item.poster_url?`<img class="home-offer-poster" src="${item.poster_url}" alt="${esc(item.title)} poster">`:""}<div class="home-offer-body"><div class="home-offer-meta"><span>${esc(String(item.item_type||"Update").replace(/^./,x=>x.toUpperCase()))}</span>${item.featured?`<b>Featured</b>`:""}</div><h3>${esc(item.title)}</h3>${item.description?`<p>${esc(item.description)}</p>`:""}${item.date_text||item.price_text?`<div class="home-offer-details">${item.date_text?`<span>${esc(item.date_text)}</span>`:""}${item.price_text?`<strong>${esc(item.price_text)}</strong>`:""}</div>`:""}${action&&label?`<button class="secondary compact-button" onclick="${action}">${esc(label)}</button>`:""}</div></article>`;
}
function home(){
 const reviews=state.reviews||[],offers=state.homepageItems||[];
 return `<section class="screen home-screen new-landing">
  <section class="landing-amy" aria-labelledby="whoIsAmy">
    <div class="landing-amy-photo"><img src="/amy-ollie.jpg" alt="Amy with a dog"></div>
    <div class="landing-amy-copy">
      <div class="eyebrow">Meet Amy</div>
      <h1 id="whoIsAmy">Who is Amy?</h1>
      <p class="lead">Amy is a qualified companion dog trainer who has been helping dogs and their people in Kenya since 2006. Her approach is practical, humane and focused on teaching owners how to communicate clearly with their dogs.</p>
      <button class="text-button landing-read-more" onclick="go('about')">Read more about Amy →</button>
      <div class="landing-primary-actions">
        <button class="secondary" onclick="contactAmy()">WhatsApp Amy</button>
        <button class="primary" onclick="startHomepageSignup()">Sign up</button>
      </div>
    </div>
  </section>

  <section class="landing-reviews" aria-labelledby="landingReviewsTitle">
    <div class="landing-section-head"><div class="eyebrow">Client stories</div><h2 id="landingReviewsTitle">What clients say</h2></div>
    <div class="landing-review-grid">${reviews.length?reviews.map(r=>`<article class="home-review">${r.photo_url?`<img class="review-photo" src="${r.photo_url}" alt="Photo shared with ${esc(r.name)}’s review">`:""}<div><div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</div><b>${esc(r.name)}</b><p>${esc(r.text)}</p></div></article>`).join(""):`<div class="review-empty">Client reviews appear here.</div>`}</div>
  </section>

  <section class="landing-offers" aria-labelledby="offersTitle">
    <div class="landing-section-head"><div class="eyebrow">Classes, events & private training</div><h2 id="offersTitle">Training with Amy</h2><p>Upcoming news, class posters and short notes about ways Amy can work with you and your dog.</p></div>
    <div class="home-offer-grid">${offers.length?offers.map(homepageOfferCard).join(""):`<article class="home-offer-card"><div class="home-offer-meta"><span>Private training</span></div><h3>One-on-One training</h3><p>Training tailored to you and your dog, with Amy.</p><button class="secondary compact-button" onclick="startHomepageSignup()">Sign up</button></article><article class="home-offer-card"><div class="home-offer-meta"><span>Classes</span></div><h3>Upcoming group classes</h3><p>New classes and events will appear here when Amy publishes them.</p><button class="secondary compact-button" onclick="go('classes')">See classes</button></article>`}</div>
    <div class="landing-bottom-actions"><button class="secondary" onclick="contactAmy()">WhatsApp Amy</button><button class="primary" onclick="startHomepageSignup()">Sign up</button></div>
  </section>
  ${floatingWhatsapp()}
 </section>`;
}

function about(){
 return `<section class="screen meet-amy-screen"><button class="back" onclick="go('home')">← Home</button><div class="center"><div class="meet-amy-content">
  <div class="eyebrow">Meet Amy</div><h1>Set your dog up for life!</h1>
  <div class="amy-photo-real"><img src="/amy-ollie.jpg" alt="Amy with a dog"></div>
  <div class="amy-bio">
   <p>Amy is a qualified companion dog trainer specializing in Force Free Behaviour Modification and Socialization. She is an experienced, resourceful, and professional trainer who has been dedicated to improving the lives of dogs and their owners in Kenya since 2006.</p>
   <p>Amy’s lifelong bond with dogs began, growing up with working Australian Shepherds on a game farm in Indiana, eventually evolving into a career of passion. Before dedicating herself to canine behaviour, she spent 15 years in hospitality management—a background that shines through in her professional approach when training groups, teaching individual lessons, running dog welfare campaigns and engaging directly with families within their home environment.</p>
   <p>In the US, Amy rehabilitated foster dogs with complex behavioural issues and raised detection puppies for US Customs and Border Patrol. In Kenya, she built on this experience by establishing her own dog training school (The Custom-Made Canine), setting up a mobile clinic, and starting a Trap-Neuter-Return (TNR) program now integrated into the KSPCA.</p>
   <p>Additionally, Amy has worked with the Kenya Police Dog Unit, the East Africa Kennel Club, the Labrador League, and the German Shepherd Dog League. She also collaborates continuously with the KSPCA on behavioural assessments, training dog handlers and preparing rescue dogs for successful adoption.</p>
   <p>Amy’s philosophy focuses on positive, humane methods. Instead of just training the dog, she teaches owners how to communicate clearly with their pets to ensure lasting good behaviour.</p>
  </div>
  <div class="actions meet-amy-actions"><button class="primary" onclick="startHomepageSignup()">Sign up</button><button class="secondary" onclick="contactAmy()">WhatsApp Amy</button></div>
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
/* cleanup: overridden classDetails declaration removed */
function startPrivate(origin){state.bookingOrigin=origin||"home";state.selectedService=null;state.selectedLocation=null;state.selectedDate=null;state.slots=[];state.selectedSlot=null;state.selectedPet=null;state.selectedDayStatus=null;go("private")}
function dogPicker(context){
 const pets=(state.profile?.pets||[]).filter(p=>!p.archived);
 return `<div class="booking-dog-picker"><div class="eyebrow">For which dog?</div><h3>Select the dog being trained</h3>
 ${pets.length?`<div class="booking-dog-grid">${pets.map(p=>{const eligibility=context==="class"?dogClassEligibility(p,state.selectedClass):{ok:true,label:""};return `<button type="button" class="booking-dog ${state.selectedPet===p.id?"selected":""} ${!eligibility.ok?"dog-ineligible":""}" ${!eligibility.ok?"disabled":""} aria-pressed="${state.selectedPet===p.id}" onclick="selectPetForBooking(${p.id})"><span class="booking-dog-photo">${p.photo_url?`<img src="${p.photo_url}" alt="">`:`🐕`}</span><span><span class="dog-picker-name">${esc(p.name)}</span><small>${esc(p.breed||p.species||"Dog")}${context==="class"?` · ${esc(eligibility.label)}`:""}</small></span><span>${state.selectedPet===p.id?"✓":""}</span></button>`}).join("")}</div>`:`<div class="notice">No active dog profiles yet. Add your dog here to continue.</div>`}
 <div class="actions booking-add-dog-row"><button type="button" class="secondary compact-button" onclick="startAddDogFromBooking('${context}')">＋ Add new dog</button></div>
 ${context==="class"&&state.selectedClass&&(state.selectedClass.min_age_months!=null||state.selectedClass.max_age_months!=null)?`<p class="class-age-help">Only dogs matching the course age range can be selected. If a date of birth is missing, add or edit it before joining the course.</p>`:""}
 ${state.showAddPet&&state.addPetBookingContext===context?addDogModal():""}
 </div>`;
}
/* cleanup: overridden selectPetForBooking declaration removed */
function startAddDogFromBooking(context){state.addPetBookingContext=context;state.showAddPet=true;state.editPet=null;render()}
function closeAddDogModal(){state.showAddPet=false;state.addPetBookingContext=null;render()}
/* cleanup: overridden selectPetForBooking declaration removed */
/* cleanup: overridden privateView declaration removed */
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
 if(!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)){appAlert("Please enter or select a complete date first.");return;}
 state.selectedDate=value;
 if(value<earliestPrivateDate()){state.slots=[];state.selectedSlot=null;state.selectedDayStatus=null;render();return appAlert("Private appointments can be booked from tomorrow onwards.");}
 if(!state.selectedService || !state.selectedLocation){appAlert("Please choose a training type and location first.");render();return;}
 const address=document.getElementById("address")?.value||state.address||"";state.address=address;
 try{
  const status=await api(`/api/day-status?date=${encodeURIComponent(value)}`);
  const r=status.restrictions?.[state.selectedLocation];
  state.selectedDayStatus={...status,restrictionMessage:status.amyBlock?`Sorry, Amy has no training availability on ${displayDate(value,{day:"numeric",month:"long",year:"numeric"})}. ${status.amyBlock.reason||""}`:!r?.available?`Sorry, Amy can’t offer ${state.selectedLocation==="arena"?"arena training":"home appointments"} on ${displayDate(value,{day:"numeric",month:"long",year:"numeric"})}. ${r.reason||"This location is unavailable."}`:""};
  state.slots=await api(`/api/availability?date=${encodeURIComponent(value)}&locationType=${state.selectedLocation}&address=${encodeURIComponent(address)}&service=${state.selectedService}`);
  state.selectedSlot=null;render();
 }catch(e){state.slots=[];state.selectedSlot=null;render();appAlert(e.message)}
}
function selectSlot(s){state.selectedSlot=s;render()}
function auth(message=""){
 state.authMessage=message;
 state.authReturnToBooking=/time is selected|place is selected/i.test(String(message||""));
 state.authShowPassword=false;
 state.authMode="choice";
 go("auth");
}
function bookingSavedSummary(){
 const parts=[];
 if(state.selectedService){parts.push(state.selectedService==="consultation"?"Initial consultation":state.selectedService==="extra"?"Training + extra time":"Training session")}
 if(state.selectedLocation)parts.push(state.selectedLocation==="home"?"At my home":"Amy's Arena in Ridgeways")
 if(state.selectedDate)parts.push(new Date(state.selectedDate+"T12:00:00").toLocaleDateString("en-KE",{weekday:"short",day:"numeric",month:"short",year:"numeric"}))
 if(state.selectedSlot)parts.push(new Date(state.selectedSlot.start).toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit"}))
 if(state.address && state.selectedLocation==="home")parts.push(state.address);
 return parts;
}
/* cleanup: overridden authView declaration removed */
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
 }catch(e){appAlert(e.message)}
}
function resetPasswordView(){
 return `<section class="screen narrow"><div class="panel"><div class="eyebrow">Account recovery</div><h2>Choose a new password</h2>
 <div class="notice good"><b>Your trial reset code</b><br><code class="reset-code">${esc(state.resetCode||"")}</code><br>It expires in 30 minutes and can only be used once.</div>
 <label>Email<input id="resetEmail2" type="email" value="${esc(state.resetEmail||"")}" autocomplete="email"></label>
 <label>Reset code<input id="resetCode" value="${esc(state.resetCode||"")}" autocomplete="one-time-code"></label>
 <label>New password<input id="resetNewPassword" type="password" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="new-password"></label>
 <p class="password-rule"><b>Please use 8 characters, including at least one letter and one number. Symbols and spaces are permitted.</b></p>
 <label>Confirm new password<input id="resetConfirmPassword" type="password" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="new-password"></label>
 <label class="check-row show-password-row"><input type="checkbox" onchange="toggleResetPasswords(this.checked)"> Show password</label>
 <div class="actions"><button class="primary" onclick="completeReset()">Set new password</button></div>
 </div></section>`;
}

function toggleResetPasswords(show){for(const id of ["resetNewPassword","resetConfirmPassword"]){const el=document.getElementById(id);if(el)el.type=show?"text":"password"}}
async function completeReset(){
 const email=document.getElementById("resetEmail2").value.trim(), code=document.getElementById("resetCode").value.trim();
 const a=document.getElementById("resetNewPassword").value,b=document.getElementById("resetConfirmPassword").value;
 if(a!==b)return appAlert("The new passwords do not match.");
 if(!(a.length>=8&&/[A-Za-z]/.test(a)&&/\d/.test(a)))return appAlert("Please use 8 characters, including at least one letter and one number. Symbols and spaces are permitted.");
 try{await api("/api/auth/reset-password",{method:"POST",body:JSON.stringify({email,resetCode:code,newPassword:a})});
 localStorage.setItem("cmc_last_email",email); state.authMode="login"; state.authMessage="Your password has been reset. You can now sign in."; render();
 }catch(e){appAlert(e.message)}
}
/* cleanup: overridden submitAuth declaration removed */
function clearBookingDraft(){
 state.selectedService=null;state.selectedLocation=null;state.selectedDate=null;state.slots=[];state.selectedSlot=null;state.selectedClass=null;state.selectedPet=null;state.address="";state.confirm=null;
}
function privateAddressReady(){return state.selectedLocation!=="home"||!!String(state.address||"").trim()}
/* cleanup: overridden updatePrivateContinueState declaration removed */
/* cleanup: overridden confirmPrivate declaration removed */
/* cleanup: overridden joinClass declaration removed */
/* cleanup: overridden paymentView declaration removed */
/* cleanup: overridden demoPay declaration removed */
/* cleanup: overridden confirmationView declaration removed */
function privateServiceLabel(id){return id==="consultation"?"Initial consultation":id==="extra"?"Training + extra time":"Training session"}
function icsEscape(value){return String(value||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n")}
function icsDate(value){const d=new Date(value);return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")}
async function downloadIcs(filename,events){
 const now=icsDate(new Date());
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//The Custom Made Canine//Nairobi//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
 events.forEach((e,i)=>{lines.push("BEGIN:VEVENT",`UID:${icsEscape(e.uid||`cmc-${Date.now()}-${i}@custommadecanine`)}`,`DTSTAMP:${now}`,`DTSTART:${icsDate(e.start)}`,`DTEND:${icsDate(e.end)}`,`SUMMARY:${icsEscape(e.title)}`,`LOCATION:${icsEscape(e.location)}`,`DESCRIPTION:${icsEscape(e.description||"")}`,"END:VEVENT")});
 lines.push("END:VCALENDAR");
 const text=lines.join("\r\n")+"\r\n";
 try{
   const file=new File([text],filename,{type:"text/calendar"});
   if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
     await navigator.share({files:[file],title:"Add to calendar"});
     return;
   }
 }catch(err){
   if(err?.name==="AbortError")return;
 }
 const blob=new Blob([text],{type:"text/calendar;charset=utf-8"});
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download=filename;link.rel="noopener";document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}

function addPrivateCalendarFromConfirmation(){
 const c=state.confirm||{};
 const location=c.locationType==="home"?(c.address||"Client home, Nairobi"):("Amy's Arena, Ridgeways, Nairobi, Kenya");
 downloadIcs(`custom-made-canine-${c.bookingRef||"booking"}.ics`,[{uid:`${c.bookingRef||Date.now()}@custommadecanine`,start:c.startAt,end:c.endAt,title:`${privateServiceLabel(c.service)} — The Custom Made Canine`,location,description:`Booking reference: ${c.bookingRef||""}`}]);
}
function addClassCalendarFromConfirmation(){
 const c=state.selectedClass;
 if(!c||!c.sessions)return appAlert("The class schedule could not be loaded. Please open My Bookings and try again.");
 const events=c.sessions.map((s,i)=>{const start=`${s.session_date}T${s.start_time}:00+03:00`;const end=`${s.session_date}T${s.end_time}:00+03:00`;return {uid:`${c.id}-${i}-${state.confirm?.bookingRef||"class"}@custommadecanine`,start,end,title:`${c.title} — Class ${i+1}`,location:"Amy's Arena, Ridgeways, Nairobi, Kenya",description:`Five-class course\nBooking reference: ${state.confirm?.bookingRef||""}`}});
 downloadIcs(`custom-made-canine-${c.title.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()}.ics`,events);
}
async function openPortalTab(tab){
 state.portalTab=tab;
 await portal();
}
async function openClientAccount(){
 if(state.user?.role==="client"){
   try{state.profile=await api("/api/my/profile");state.bookings=await api("/api/my/bookings")}catch(_e){}
 }
 go("account");
}
let clientFocusRefreshAt=0;
async function refreshClientOnFocus(){
 if(state.user?.role!=="client"||!["portal","account"].includes(state.view))return;
 const now=Date.now();if(now-clientFocusRefreshAt<20000)return;clientFocusRefreshAt=now;
 try{
   state.profile=await api("/api/my/profile");
   state.bookings=await api("/api/my/bookings");
   if(state.view==="portal"){
     if(state.portalTab==="media")state.resources=await api("/api/my/resources");
     state.trainingNotes=await api("/api/my/training-notes");
   }
   render();
 }catch(_e){}
}
if(!window.__cmcClientFocusRefresh){window.__cmcClientFocusRefresh=true;window.addEventListener("focus",refreshClientOnFocus);window.addEventListener("pageshow",refreshClientOnFocus);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshClientOnFocus()});}

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
 const applicant=String(state.user?.client_status||"current")!=="current";
 return `<section class="screen client-dashboard"><div class="eyebrow">Client Portal</div><h2>Welcome, ${esc(state.user.name.split(" ")[0])}</h2>
 ${applicant?`<div class="notice application-status-banner"><b>New Client Application</b><br>Your account is open for profile and dog information. Booking is locked until Amy approves your application.</div>`:""}
 <div class="portal-menu portal-menu-primary"><button class="${tab==="dogs"?"active":""}" onclick="openPortalTab('dogs')"><span>Dogs</span><small>Profiles & vaccination</small></button><button class="${tab==="bookings"?"active":""}" onclick="openPortalTab('bookings')"><span>Bookings</span><small>Bookings & new training</small></button><button class="${tab==="media"?"active":""}" onclick="openPortalTab('media')"><span>Resources</span><small>Training material</small></button></div>
 <div class="panel client-dashboard-main">${body}</div>
 <div class="portal-menu portal-menu-secondary"><button onclick="openPortalTab('review')"><span>Review</span></button><button onclick="openClientAccount()"><span>Account</span></button></div>
 ${tab==="review"?`<div class="panel client-secondary-panel">${reviewPage()}</div>`:""}${floatingWhatsapp()}</section>`;
}
function clientFinancialSummary(b){
 const rows=Array.isArray(b?.accountUpdates)?b.accountUpdates:[];
 if(!rows.length)return "";
 const textFor=x=>{
   if(x.source==="class"){
     const item=`class ${esc(x.title||"course")}`;
     if(x.action==="full_refund")return `Refund ${money(x.amount||0)} for cancelled ${item}${x.reference?` · M-Pesa ${esc(x.reference)}`:""}`;
     if(x.action==="partial_refund")return `Partial refund ${money(x.amount||0)} for cancelled ${item}${x.reference?` · M-Pesa ${esc(x.reference)}`:""}`;
     if(x.action==="full_credit")return `Credit ${money(x.amount||0)} for cancelled ${item}`;
     if(x.action==="partial_credit")return `Partial credit ${money(x.amount||0)} for cancelled ${item}`;
     if(x.action==="no_refund_or_credit")return `No refund was applied for ${item} cancelled${x.details?` — ${esc(x.details)}`:""}`;
   }
   const d=displayDate(String(x.start_at||"").slice(0,10),{day:"numeric",month:"long",year:"numeric"}),details=String(x.details||"");
   return `${esc(details)}${d?` · Cancelled training ${d}`:""}`;
 };
 return `<div class="notice account-update"><b>Recent account updates</b>${rows.slice(0,3).map(x=>`<div class="account-update-line">${textFor(x)}</div>`).join("")}</div>`;
}



function bookingsHub(b){
 const credit=Math.max(0,Number(state.profile?.creditBalance||0));
 return `<div class="bookings-panel"><h3>My bookings</h3>${credit>0?`<div class="client-credit-banner"><span>Credit available</span><strong>${money(credit)}</strong><small>This will be offered when you next pay for training.</small></div>`:""}${clientFinancialSummary(b)}${String(state.user?.client_status||"current")==="current"?`<div class="actions client-booking-actions"><button class="secondary" onclick="startPrivate('portal')">Book private training</button><button class="secondary" onclick="openPortalClasses()">View classes</button></div>`:`<div class="notice"><b>Booking not yet available</b><br>Amy needs to approve your application before you can book training or classes.${(!state.profile?.applicationDeposit||state.profile.applicationDeposit.manual_payment_status==='rejected')?`<div class="actions"><button class="secondary compact-button" onclick="resumeApplicationDeposit()">Complete application payment</button></div>`:""}</div>`}${bookingsView(b)}</div>`;
}

function reviewPage(){return `<h3>Leave a review</h3><label>Rating<select id="reviewRating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label><label>Review<textarea id="reviewText" rows="4"></textarea></label><label>Photo (optional)<input id="reviewPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="review-consent"><input id="reviewPhotoConsent" type="checkbox"> I give The Custom Made Canine permission to publish this photo with my review.</label><p class="review-helper">Amy would love to read your review and see your photo. Even if you do not want the photo published, feel free to keep it private, but if you don't mind, she'll love being able to show it off even more.</p><button class="primary" onclick="submitReview()">Submit for approval</button>`}
function accountInline(){return `<p>Use the Account button above to manage your account.</p>`}
function floatingWhatsapp(){return `<button class="floating-whatsapp" onclick="contactAmy()">WhatsApp Amy</button>`}

/* cleanup: overridden bookingsView declaration removed */
async function clientCancelClass(id){
 const enrolment=(state.bookings?.classBookings||[]).find(x=>Number(x.id)===Number(id));
 const course=String(enrolment?.title||"this course");
 if(!await appConfirm(`Are you sure you want to cancel your enrollment in ${course}? Your place in all remaining sessions of this course will be cancelled. The course itself will continue for the other clients.`))return;
 const note=await appPrompt("Anything you would like to add about the cancellation? (optional)","");if(note===null)return;
 try{const d=await api(`/api/my/class-enrolments/${id}/cancel`,{method:"POST",body:JSON.stringify({note:note.trim()})});state.bookings=await api("/api/my/bookings");render();appAlert(d.refundPending?"Your course enrollment has been cancelled. A refund decision is now pending.":"Your course enrollment has been cancelled.")}catch(e){appAlert(e.message)}
}

async function acceptProvisional(id){
 try{
  const d=await api(`/api/my/bookings/${id}/accept-provisional`,{method:"POST",body:JSON.stringify({})});
  state.confirm={...d,type:d.type||"private"};go("payment");
 }catch(e){appAlert(e.message)}
}

async function declineProvisional(id){
 if(!await appConfirm("Do not accept this proposed booking/package? The held time(s) will be released."))return;
 try{await api(`/api/my/bookings/${id}/decline-provisional`,{method:"POST",body:JSON.stringify({})});await portal();}catch(e){appAlert(e.message)}
}
/* cleanup: overridden clientReschedule declaration removed */
async function loadRescheduleSlots(){
 const r=state.rescheduleDraft;if(!r)return;
 const date=document.getElementById("rescheduleDate")?.value||r.date;
 if(!date)return appAlert("Choose a date.");
 r.date=date;r.availabilityMessage="Checking availability…";r.selected=null;render();
 try{
   r.slots=await api(`/api/availability?date=${encodeURIComponent(date)}&locationType=${encodeURIComponent(r.booking.location_type)}&address=${encodeURIComponent(r.booking.address||"")}&service=${encodeURIComponent(r.booking.service)}`);
   r.selected=null;
   r.availabilityMessage=r.slots.length?"":"Amy has no available times on this date. Please choose another date.";
   render();
 }catch(e){
   r.slots=[];r.selected=null;r.availabilityMessage=e.message||"Availability could not be checked. Please choose another date or try again.";render();
 }
}

function chooseRescheduleSlot(slot){state.rescheduleDraft.selected=slot;render()}
/* cleanup: overridden confirmClientReschedule declaration removed */
function closeClientReschedule(){state.rescheduleDraft=null;render()}
function clientRescheduleModal(){
 const r=state.rescheduleDraft;if(!r)return "";const b=r.booking;
 return `<div class="modal-overlay"><div class="trainer-modal schedule-modal"><button class="close-btn modal-close" onclick="closeClientReschedule()">×</button><div class="eyebrow">Reschedule</div><h2>Choose a new appointment slot</h2><p>${esc(privateServiceLabel(b.service))} · ${b.location_type==="home"?"Home visit":"Amy's Arena in Ridgeways"}. The duration stays the same.</p><label>Date<input id="rescheduleDate" type="date" min="${earliestPrivateDate()}" value="${esc(r.date||"")}" onchange="state.rescheduleDraft.date=this.value;state.rescheduleDraft.availabilityMessage='';state.rescheduleDraft.slots=[];state.rescheduleDraft.selected=null"></label><div class="actions"><button class="secondary" onclick="loadRescheduleSlots()">Check available times</button></div>${r.availabilityMessage?`<div class="notice reschedule-availability-message">${esc(r.availabilityMessage)}</div>`:""}<div class="time-grid">${(r.slots||[]).map(slot=>`<button class="time ${r.selected?.start===slot.start?"selected":""}" onclick='chooseRescheduleSlot(${JSON.stringify(slot)})'>${String(slot.start).slice(11,16)}</button>`).join("")}</div><div class="actions"><button class="secondary" onclick="closeClientReschedule()">Cancel</button><button class="primary" ${!r.selected?"disabled":""} onclick="confirmClientReschedule()">Confirm new slot</button></div></div></div>`;
}

async function clientCancel(id){
 if(!await appConfirm("Cancel this confirmed booking? The appointment will be cancelled immediately and the time will be released. Amy will then decide the refund or client-credit outcome."))return;
 try{
  const d=await api(`/api/my/bookings/${id}/cancel`,{method:"POST",body:JSON.stringify({reason:"Cancelled by client"})});
  await portal();
  await appAlert(d.refundPending?"Booking cancelled. The appointment time has been released and Amy will decide the refund or client-credit outcome.":"Booking cancelled. The appointment time has been released.");
 }catch(e){appAlert(e.message)}
}

async function addPrivateCalendarByRef(ref){
 const x=state.bookings?.privateBookings?.find(b=>b.booking_ref===ref);if(!x)return appAlert("Booking details could not be found.");
 if(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream){window.location.href=`/api/my/calendar/private/${encodeURIComponent(ref)}.ics`;return}
 const title=privateServiceLabel(x.service),location=x.location_type==="home"?(x.address||"Client home, Nairobi"):("Amy's Arena, Ridgeways, Nairobi, Kenya");
 await downloadIcs(`custom-made-canine-${ref}.ics`,[{uid:`${ref}@custommadecanine`,start:x.start_at,end:x.end_at,title:`${title} — The Custom Made Canine`,location,description:`Booking reference: ${ref}`}]);
}

async function addClassCalendarByRef(ref){
 const x=state.bookings?.classBookings?.find(b=>b.booking_ref===ref);if(!x)return appAlert("Class booking details could not be found.");
 if(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream){window.location.href=`/api/my/calendar/class/${encodeURIComponent(ref)}.ics`;return}
 const c=state.classes.find(c=>c.id===x.class_id);if(!c)return appAlert("The class schedule could not be found. Please refresh the Client Portal.");
 const events=c.sessions.map((s,i)=>({uid:`${c.id}-${i}-${ref}@custommadecanine`,start:`${s.session_date}T${s.start_time}:00+03:00`,end:`${s.session_date}T${s.end_time}:00+03:00`,title:`${c.title} — Class ${i+1}`,location:"Amy's Arena, Ridgeways, Nairobi, Kenya",description:`Course booking reference: ${ref}`}));
 await downloadIcs(`custom-made-canine-${ref}.ics`,events);
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
    <section class="dog-file-panel vaccination-profile-panel"><div class="vaccination-profile-heading"><h4>Vaccination record</h4><button type="button" class="vaccination-info-button" aria-label="Vaccination record requirements" title="Vaccination record requirements" onclick="state.vaccinationInfoOpen=true;render()">ⓘ</button></div><p>${esc(vaccination)}</p><div class="dog-file-actions">${p.vaccination_count?`<button class="secondary compact-button" onclick="viewVaccinations(${p.id})">View</button>`:""}<label class="file-button">${p.vaccination_count?"Replace":"Upload"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onchange="uploadVaccinations(${p.id},this)"></label>${p.vaccination_count?`<button class="secondary compact-button" onclick="removeVaccinations(${p.id})">Remove</button>`:""}</div></section>
   </div>
   <div class="dog-card-footer"><button class="quiet-action" onclick="archiveDog(${p.id})">Archive dog</button></div>`}
 </article>`;
}
function petsView(pets){
 const active=(pets||[]).filter(p=>!p.archived),archived=(pets||[]).filter(p=>p.archived);
 return `<div class="pets-layout"><div class="pets-head"><div><h3>My dogs</h3><p class="small">Edit details if something was entered incorrectly. Archive a dog when no new training is needed.</p></div><button class="primary compact-button" onclick="state.addPetBookingContext=null;state.showAddPet=true;state.editPet=null;render()">+ Add a dog</button></div>${active.length?`<div class="pet-grid">${active.map(p=>petCard(p,false)).join("")}</div>`:`<div class="empty-pets"><div class="pet-photo"><span aria-hidden="true">🐕</span></div><div><h3>No active dogs</h3><p class="small">Add a dog or restore one from Archived dogs.</p></div></div>`}${archived.length?`<details class="archived-dogs"><summary>Archived dogs · ${archived.length}</summary><div class="pet-grid">${archived.map(p=>petCard(p,true)).join("")}</div></details>`:""}${state.showAddPet?addDogModal():""}${state.editPet?editDogModal():""}</div>`;
}
/* cleanup: overridden addDogModal declaration removed */
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
 if(!name){state.addPetSaving=false;if(saveBtn){saveBtn.disabled=false;saveBtn.textContent="Save dog"}return appAlert("Please add the dog's name.")}
 const fd=new FormData();fd.append("name",name);fd.append("breed",breed);fd.append("dateOfBirth",dob);fd.append("notes",notes);fd.append("gender",gender);fd.append("neuteredSpayed",neuteredSpayed?"1":"");fd.append("behaviorNotes",behaviorNotes);fd.append("medicalProcedures",medicalProcedures);fd.append("createToken",createToken);
 const photo=document.getElementById("petPhoto")?.files?.[0];if(photo)fd.append("dogPhoto",photo);
 [...(document.getElementById("petVaccinations")?.files||[])].forEach(f=>fd.append("vaccinationPages",f));
 try{
  const p=await api("/api/my/pets",{method:"POST",body:fd});
  const existingIndex=state.profile.pets.findIndex(x=>Number(x.id)===Number(p.id));
  if(existingIndex>=0)state.profile.pets[existingIndex]=p;else state.profile.pets.push(p);
  state.selectedPet=Number(p.id);state.showAddPet=false;state.addPetCreateToken=null;state.addPetSaving=false;
  render();
 }catch(e){state.addPetSaving=false;if(saveBtn){saveBtn.disabled=false;saveBtn.textContent="Save dog"}appAlert(e.message)}
}
function editDog(id){const p=(state.profile?.pets||[]).find(x=>x.id===Number(id));if(!p)return;state.editPet={...p};render()}
async function saveDogEdit(id){
 const body={name:document.getElementById("editPetName").value.trim(),breed:document.getElementById("editPetBreed").value.trim(),dateOfBirth:document.getElementById("editPetDob").value,notes:document.getElementById("editPetNotes").value,gender:document.querySelector('input[name="editPetGender"]:checked')?.value||"",neuteredSpayed:!!document.getElementById("editPetNeutered")?.checked,behaviorNotes:document.getElementById("editPetBehaviour").value,medicalProcedures:document.getElementById("editPetMedical").value};
 try{const p=await api(`/api/my/pets/${id}`,{method:"PUT",body:JSON.stringify(body)});const i=state.profile.pets.findIndex(x=>x.id===Number(id));if(i>=0)state.profile.pets[i]=p;state.editPet=null;render()}catch(e){appAlert(e.message)}
}
async function archiveDog(id){const p=(state.profile?.pets||[]).find(x=>x.id===Number(id));if(!p)return;if(!await appConfirm(`Archive ${p.name}? Existing bookings, classes and history will be kept, but ${p.name} will not be available for new bookings.`))return;try{await api(`/api/my/pets/${id}/archive`,{method:"POST",body:JSON.stringify({})});state.profile=await api("/api/my/profile");if(state.selectedPet===Number(id))state.selectedPet=null;render()}catch(e){appAlert(e.message)}}
async function restoreDog(id){try{await api(`/api/my/pets/${id}/restore`,{method:"POST",body:JSON.stringify({})});state.profile=await api("/api/my/profile");render()}catch(e){appAlert(e.message)}}
async function uploadDogPhoto(id,input){
 if(!input.files[0])return;
 const fd=new FormData();fd.append("dogPhoto",input.files[0]);
 try{
  const p=await api(`/api/my/pets/${id}/files`,{method:"POST",body:fd});
  const i=state.profile.pets.findIndex(x=>x.id===id);if(i>=0)state.profile.pets[i]=p;render();
 }catch(e){appAlert(e.message)}
}
function viewDogPhoto(id){window.open(`/api/pets/${id}/photo`,`_blank`,`noopener`)}
async function removeDogPhoto(id){if(!await appConfirm("Remove this dog photo?"))return;try{await api(`/api/my/pets/${id}/photo`,{method:"DELETE"});state.profile=await api("/api/my/profile");render()}catch(e){appAlert(e.message)}}

async function uploadVaccinations(id,input){
 if(!input.files.length)return;
 const fd=new FormData();for(const f of input.files)fd.append("vaccinationPages",f);
 try{
  const p=await api(`/api/my/pets/${id}/files`,{method:"POST",body:fd});
  const i=state.profile.pets.findIndex(x=>x.id===id);if(i>=0)state.profile.pets[i]=p;render();
 }catch(e){appAlert(e.message)}
}
async function removeVaccinations(id){
 if(!await appConfirm("Remove the current vaccination record from this dog’s profile?"))return;
 try{
  await api(`/api/my/pets/${id}/vaccinations`,{method:"DELETE"});
  state.profile=await api("/api/my/profile");render();
 }catch(e){appAlert(e.message)}
}
async function viewVaccinations(id){
 try{
  const rows=await api(`/api/my/pets/${id}/vaccinations`);
  if(!rows.length)return appAlert("No vaccination pages have been uploaded for this dog yet.");
  rows.forEach(r=>window.open(r.url,"_blank","noopener"));
  if(rows.length>1) appAlert(`${rows.length} vaccination pages opened in new tabs.`);
 }catch(e){appAlert(e.message)}
}
async function submitReview(){
 try{
  const fd=new FormData();fd.append("rating",String(Number(reviewRating.value)));fd.append("text",reviewText.value);const photo=document.getElementById("reviewPhoto")?.files?.[0];if(photo)fd.append("photo",photo);fd.append("photoConsent",document.getElementById("reviewPhotoConsent")?.checked?"true":"false");
  await api("/api/reviews",{method:"POST",body:fd});
  appAlert("Thank you. Amy will review your feedback before it is published.");reviewText.value="";if(document.getElementById("reviewPhoto"))reviewPhoto.value="";if(document.getElementById("reviewPhotoConsent"))reviewPhotoConsent.checked=false;
 }catch(e){appAlert(e.message||"The review could not be submitted.")}
}
function contactAmy(){
 const n=state.config?.whatsapp;
 if(!n)return appAlert("WhatsApp number has not been configured yet.");
 window.open(`https://wa.me/${n}`,"_blank","noopener");
}
async function logout(){
  try{await api("/api/auth/logout",{method:"POST"});}finally{
    state.user=null;state.profile=null;state.bookings=null;state.resources=[];state.trainingNotes=[];state.trainer=null;state.trainerCalendar=null;state.menu=false;state.view="home";
    clearBookingDraft();state.completedBooking=null;state.authReturnToBooking=false;state.authShowPassword=false;
    try{state.reviews=await api("/api/reviews");}catch(_e){}
    render();
  }
}
async function trainer(){
 if(!state.user)return auth("Please sign in as Amy to open the trainer dashboard.");
 if(state.user.role!=="trainer")return appAlert("Trainer access only.");
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
async function saveLocationPlan(){const m=state.locationPlanModal;if(!m)return;try{await api("/api/trainer/location-plan",{method:"POST",body:JSON.stringify({date:m.date,periods:m.periods})});state.locationPlanModal=null;await loadTrainerDayMeta(m.date);render()}catch(e){appAlert(e.message)}}
async function clearLocationPlan(){const m=state.locationPlanModal;if(!m)return;if(!await appConfirm("Clear the location plan for this day? Both arena and home appointments will again be allowed wherever the normal availability rules permit."))return;try{await api(`/api/trainer/location-plan?date=${encodeURIComponent(m.date)}`,{method:"DELETE"});state.locationPlanModal=null;await loadTrainerDayMeta(m.date);render()}catch(e){appAlert(e.message)}}
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
 const key=safeDateKey(state.trainerSelectedDate)||dateKey(new Date()),ev=trainerEventForDay(key),meta=state.trainerDayMeta||{},rawWorking=meta.working||{};
 const eventStarts=[
   ...ev.bookings.map(x=>String(x.start_at).slice(11,16)),
   ...ev.classes.map(x=>String(x.start_time||"")),
   ...ev.blocks.map(x=>String(x.start_at).slice(11,16))
 ].filter(Boolean);
 const eventEnds=[
   ...ev.bookings.map(x=>String(x.buffer_end_at||x.end_at).slice(11,16)),
   ...ev.classes.map(x=>String(x.end_time||"")),
   ...ev.blocks.map(x=>String(x.end_at).slice(11,16))
 ].filter(Boolean);
 let start=rawWorking.enabled!==false&&rawWorking.start_time?rawWorking.start_time:"08:00";
 let end=rawWorking.enabled!==false&&rawWorking.end_time?rawWorking.end_time:"17:00";
 if(eventStarts.length&&eventStarts.sort()[0]<start)start=eventStarts.sort()[0];
 if(eventEnds.length&&eventEnds.sort().slice(-1)[0]>end)end=eventEnds.sort().slice(-1)[0];
 if(start>=end){start=eventStarts.sort()[0]||"08:00";end=eventEnds.sort().slice(-1)[0]||"17:00"}
 const w={enabled:rawWorking.enabled!==false,start_time:start,end_time:end};
 if(!ev.bookings.length&&!ev.classes.length&&!ev.blocks.length&&rawWorking.enabled===false)return `<div class="trainer-agenda"><div class="empty-agenda"><span>Unavailable</span></div></div>`;
 const datePrefix=`${key}T`,bounds=new Set([w.start_time,w.end_time]);
 const addBound=t=>{if(t&&t>=w.start_time&&t<=w.end_time)bounds.add(t)};
 ev.bookings.forEach(x=>{addBound(String(x.start_at).slice(11,16));addBound(String(x.end_at).slice(11,16));addBound(String(x.buffer_end_at||x.end_at).slice(11,16))});
 ev.classes.forEach(x=>{addBound(x.start_time);addBound(x.end_time)});ev.blocks.forEach(x=>{addBound(String(x.start_at).slice(11,16));addBound(String(x.end_at).slice(11,16))});
 (meta.recurringBlocks||[]).forEach(r=>{if(recurringBlockAppliesOnDateClient(r,key)){addBound(r.start_time);addBound(r.end_time)}});
 (meta.scheduleBlocks||[]).filter(r=>r.target==='amy').forEach(r=>{if(r.all_day){addBound(w.start_time);addBound(w.end_time)}else{addBound(r.start_time);addBound(r.end_time)}});
 for(let ms=wallClockMsClient(`${key}T${w.start_time}:00`);ms<wallClockMsClient(`${key}T${w.end_time}:00`);ms+=30*60000)addBound(new Date(ms).toISOString().slice(11,16));
 const times=[...bounds].sort(),rows=[];
 for(let i=0;i<times.length-1;i++){
  const st=times[i],en=times[i+1];if(st>=en)continue;const startAt=`${datePrefix}${st}:00`;
  const booking=ev.bookings.find(x=>startAt>=x.start_at&&startAt<x.end_at),buffer=ev.bookings.find(x=>startAt>=x.end_at&&startAt<(x.buffer_end_at||x.end_at)),cls=ev.classes.find(x=>st>=x.start_time&&st<x.end_time),block=ev.blocks.find(x=>startAt>=x.start_at&&startAt<x.end_at);
  const rec=(meta.recurringBlocks||[]).find(r=>recurringBlockAppliesOnDateClient(r,key)&&st>=r.start_time&&st<r.end_time);
  const sblock=(meta.scheduleBlocks||[]).find(r=>r.target==='amy'&&st>=(r.all_day?w.start_time:r.start_time)&&st<(r.all_day?w.end_time:r.end_time));
  let kind="available",title="Available",detail="",id=null,locationType="";
  if(booking){kind="booking";title=`${booking.client} · ${booking.pet_name||"Dog"}`;detail=booking.location_type==="home"?(booking.address||"Address not recorded"):"Amy's Arena in Ridgeways";id=booking.id;locationType=booking.location_type||""}
  else if(buffer){kind="buffer";title=buffer.location_type==="home"?"Travel / buffer":"Buffer";detail=buffer.location_type==="home"&&buffer.address?buffer.address:""}
  else if(cls){kind="class";title=cls.title;detail=`Class · ${cls.enrolled}/${cls.capacity} places · ${cls.location_type==="alternate"?(cls.location_name||"Alternate venue"):"Amy's Arena in Ridgeways"}`;id=cls.class_id||cls.id||null}
  else if(sblock){kind="block";title=/\blunch\b/i.test(String(sblock.reason||''))?"LUNCH":(sblock.reason||"Unavailable")}
  else if(block){kind="block";title=/\blunch\b/i.test(String(block.reason||''))?"LUNCH":(block.reason||"Unavailable")}
  else if(rec){kind="block";title=/\blunch\b/i.test(String(rec.reason||''))?"LUNCH":(rec.reason||"Recurring block")}
  else if(rawWorking.enabled===false){kind="block";title="Unavailable"}
  const lunch=title==="LUNCH";rows.push({st,en,kind,title,detail,id,locationType,lunch});
 }
 const merged=[];for(const r of rows){const prev=merged[merged.length-1];if(prev&&prev.kind===r.kind&&prev.title===r.title&&prev.detail===r.detail&&prev.id===r.id&&prev.locationType===r.locationType&&prev.lunch===r.lunch&&prev.en===r.st&&["available","buffer","block","booking","class"].includes(r.kind))prev.en=r.en;else merged.push({...r})}
 const hoursLabel=rawWorking.enabled===false?"Unavailable day — existing commitments shown":`${w.start_time}–${w.end_time}`;
 return `<div class="trainer-agenda"><div class="agenda-date"><div><div class="eyebrow">Daily agenda</div><h3>${displayDate(key,{weekday:"long",day:"numeric",month:"long"})}</h3></div><span class="agenda-working-hours">${hoursLabel}</span></div><div class="agenda-timeline">${merged.map(r=>{const body=`<div class="agenda-time">${r.st}–${r.en}</div><div class="agenda-copy"><span class="agenda-title">${esc(r.title)}</span>${r.detail?`<p>${esc(r.detail)}</p>`:""}</div>`;const cls=`agenda-item ${r.kind}${r.kind==="booking"&&r.locationType?` booking-${r.locationType}`:""}${r.lunch?" lunch-item":""}`;return r.kind==="booking"?`<button class="${cls} clickable-agenda" onclick="openTrainerBooking(${r.id})">${body}</button>`:r.kind==="class"?`<button class="${cls} clickable-agenda class-agenda-link" onclick="openClassFromAgenda(${Number(r.id)||0})">${body}</button>`:`<div class="${cls}">${body}</div>`}).join("")}</div></div>`;
}





function overlapsClient(aStart,aEnd,bStart,bEnd){
 const toMs=(value)=>{
   const text=String(value||"");
   const m=text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
   if(m)return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0));
   return Date.parse(text);
 };
 const as=toMs(aStart),ae=toMs(aEnd),bs=toMs(bStart),be=toMs(bEnd);
 return Number.isFinite(as)&&Number.isFinite(ae)&&Number.isFinite(bs)&&Number.isFinite(be)&&as<be&&ae>bs;
}

function monthStart(d){const x=new Date(d);return new Date(x.getFullYear(),x.getMonth(),1,12)}
function monthEnd(d){const x=new Date(d);return new Date(x.getFullYear(),x.getMonth()+1,0,12)}
function monthCalendarView(){
 const selected=parseDateKey(state.trainerMonthDate)||new Date(),first=monthStart(selected),last=monthEnd(selected),cal=state.trainerMonthCalendar||{bookings:[],classSessions:[],blocks:[],serviceBlocks:[],scheduleBlocks:[]};
 const lead=(first.getDay()+6)%7,days=last.getDate(),cells=[];for(let i=0;i<lead;i++){const col=i%7;cells.push(`<span class="month-empty ${col>=5?"weekend-column":""}"></span>`)}
 const halfState=(key,half)=>{
   const hs=half==='am'?`${key}T00:00:00`:`${key}T12:00:00`,he=half==='am'?`${key}T12:00:00`:`${key}T23:59:59`;
   const scheduled=(cal.scheduleBlocks||[]).some(b=>b.target==='amy'&&!b.silent_calendar&&key>=b.start_date&&key<=b.end_date&&overlapsClient(hs,he,`${key}T${b.all_day?'00:00':(b.start_time||'00:00')}:00`,`${key}T${b.all_day?'23:59':(b.end_time||'23:59')}:59`));
   const legacy=(cal.blocks||[]).some(b=>!/\blunch\b/i.test(String(b.reason||''))&&overlapsClient(hs,he,b.start_at,b.end_at));
   return scheduled||legacy?'amy':'open';
 };
 for(let day=1;day<=days;day++){
  const d=new Date(first.getFullYear(),first.getMonth(),day,12),key=dateKey(d),dayBookings=(cal.bookings||[]).filter(x=>String(x.start_at).slice(0,10)===key),arenaCount=dayBookings.filter(x=>x.location_type==='arena').length,homeCount=dayBookings.filter(x=>x.location_type==='home').length,classCount=(cal.classSessions||[]).filter(x=>x.session_date===key).length,am=halfState(key,'am'),pm=halfState(key,'pm');
  const gridCol=(lead+day-1)%7;cells.push(`<button class="month-day ${gridCol>=5?"weekend-column ":""}${key===state.trainerSelectedDate?"selected":""}" onclick="selectMonthDate('${key}')"><span class="month-availability-half am ${am}"></span><span class="month-availability-half pm ${pm}"></span><span class="month-day-content"><span class="month-day-number">${day}</span><span class="month-booking-markers">${arenaCount?`<i class="month-booking-marker arena" title="${arenaCount} arena booking${arenaCount===1?'':'s'}">${arenaCount>1?arenaCount:''}</i>`:""}${homeCount?`<i class="month-booking-marker home" title="${homeCount} home visit${homeCount===1?'':'s'}">${homeCount>1?homeCount:''}</i>`:""}${classCount?`<i class="month-booking-marker class" title="${classCount} class session${classCount===1?'':'s'}">${classCount>1?classCount:''}</i>`:""}</span></span></button>`)
 }
 return `<div class="month-calendar"><div class="calendar-head"><button class="secondary compact-button" onclick="moveTrainerMonth(-1)">←</button><span>${first.toLocaleDateString("en-KE",{month:"long",year:"numeric"})}</span><button class="secondary compact-button" onclick="moveTrainerMonth(1)">→</button></div><div class="month-calendar-legend"><span><i class="legend-swatch amy"></i>Unavailable</span><span><i class="month-booking-marker arena"></i>Arena</span><span><i class="month-booking-marker home"></i>Home</span><span><i class="month-booking-marker class"></i>Class</span></div><div class="month-weekdays">${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((x,i)=>`<span class="${i>=5?"weekend-heading":""}">${x}</span>`).join("")}</div><div class="month-grid">${cells.join("")}</div></div>`;
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
async function selectMonthDate(key){const previousView=state.view,previousDate=state.trainerSelectedDate;try{const d=parseDateKey(key);if(!d)throw new Error("That date could not be opened.");await loadTrainerCalendar(d);await loadTrainerDayMeta(key);state.trainerSelectedDate=key;state.view="trainerDay";render()}catch(e){console.error("Could not open day schedule",e);state.view=previousView||"trainer";state.trainerSelectedDate=previousDate;render();appAlert(e.message||"Could not open that day.")}}
function quickOneOffChange(){const d=state.trainerSelectedDate||nairobiDateKeyClient(0);state.scheduleModal={mode:"block",target:"amy",startDate:d,endDate:d,allDay:true,startTime:"08:00",endTime:"17:00",reason:"Bookings closed for this day",publicMessage:"",quickClose:true};render()}
function trainerView(){
 const t=state.trainer||{todayBookings:[],pendingReviews:[],classes:[],blocks:[],resources:[]};
 const cal=state.trainerCalendar||{bookings:[],classSessions:[],blocks:[]};
 const week=mondayOf(parseDateKey(state.trainerWeekStart)||new Date());
 const pendingCount=Array.isArray(t.pendingReviews)?t.pendingReviews.length:0;
 const attentionCount=(Array.isArray(t.vaccinationAttention)?t.vaccinationAttention.length:0)+(Array.isArray(t.cancellationAttention)?t.cancellationAttention.length:0)+(Array.isArray(t.classRefundAttention)?t.classRefundAttention.length:0);
 const clientCount=Number(t.clientCount||0);
 return `<section class="screen trainer-screen">
  <div class="trainer-top"><div><div class="eyebrow">Amy's workspace</div><h2>Dashboard</h2></div></div>

  <div class="dashboard-taskbar dashboard-six">
    <button class="task-button task-book" onclick="openBookForClientPicker()"><span>Book for client</span><span>＋</span></button>
    <button class="task-button task-resources" onclick="openResourceLibrary()"><span>Training resources</span><span>→</span></button>
    <button class="task-button task-attention" onclick="openTrainerAdmin('attention')"><span>Needs attention</span><b>${attentionCount}</b></button>
    <button class="task-button task-hours" onclick="openScheduling()"><span>Scheduling</span><span>→</span></button>
    <button class="task-button task-clients" onclick="openTrainerAdmin('clients')"><span>Clients</span><b>${clientCount||'→'}</b></button>
    <button class="task-button task-history" onclick="openTrainerAdmin('activity')"><span>Activity history</span><span>→</span></button>
    <button class="task-button task-homepage" onclick="openTrainerAdmin('homepage')"><span>Homepage content</span><span>→</span></button>
  </div>

  <div class="trainer-dashboard-grid">
    <div class="panel dashboard-month">${monthCalendarView()}</div>
    <div class="panel dashboard-week"><div class="calendar-head"><div><h3>Selected week</h3><b>${trainerWeekLabel(week)}</b></div><div class="calendar-nav"><button class="secondary compact-button" onclick="moveTrainerWeek(-1)">←</button><button class="secondary compact-button" onclick="loadTrainerCalendar(new Date()).then(()=>{state.trainerSelectedDate=dateKey(new Date());render()})">Today</button><button class="secondary compact-button" onclick="moveTrainerWeek(1)">→</button></div></div><div class="trainer-week-grid">${Array.from({length:7},(_,i)=>trainerDayCard(dateKey(addDays(week,i)),i)).join("")}</div>${trainerAgenda()}</div>
  </div>
  ${clientDirectoryModal()}${clientRecordModal()}${trainerClientBookingModal()}${workingExceptionModalView()}
 </section>`;
}
function trainerDayView(){
 const d=state.trainerSelectedDate||dateKey(new Date());
 return `<section class="screen trainer-day-page"><button class="back-dashboard" onclick="state.view='trainer';render()">← Back to Month</button><div class="calendar-head"><div><div class="eyebrow">Day schedule</div><h2>${displayDate(d,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h2></div><div class="calendar-nav"><button class="secondary compact-button" onclick="moveTrainerDay(-1)">← Previous day</button><button class="secondary compact-button" onclick="loadTrainerCalendar(new Date()).then(()=>{state.trainerSelectedDate=dateKey(new Date());return loadTrainerDayMeta(state.trainerSelectedDate)}).then(render)">Today</button><button class="secondary compact-button" onclick="moveTrainerDay(1)">Next day →</button></div></div><div class="actions"><button class="secondary" onclick="blockTime()">＋ Block time</button><button class="secondary" onclick="addClass()">＋ New course</button><button class="secondary" onclick="openBookForClientPicker()">＋ Book for client</button></div><div class="panel day-agenda-panel">${trainerAgenda()}</div>${clientDirectoryModal()}${clientRecordModal()}${trainerClientBookingModal()}${scheduleModalView()}</section>`;
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
 if(!m.startDate)return appAlert("Choose the first unavailable date.");
 if(!m.untilFurtherNotice&&!m.endDate)return appAlert("Choose the last unavailable date.");
 try{await api("/api/trainer/service-availability",{method:"POST",body:JSON.stringify({locationType:m.locationType,startDate:m.startDate,endDate:m.endDate,untilFurtherNotice:!!m.untilFurtherNotice,publicMessage,privateNote})});state.serviceAvailability=await api("/api/trainer/service-availability");state.serviceAvailabilityModal=null;await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render()}catch(e){appAlert(e.message)}
}
async function restoreServiceAvailability(id){try{await api(`/api/trainer/service-availability/${id}`,{method:"DELETE"});state.serviceAvailability=await api("/api/trainer/service-availability");await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render()}catch(e){appAlert(e.message)}}
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
/* cleanup: overridden clientRecordModal declaration removed */
/* cleanup: overridden startTrainerClientBooking declaration removed */
function invalidateTrainerClientSlots(message=""){if(!state.trainerClientBooking)return;state.trainerClientBookingSlots=[];state.trainerClientBooking.selectedSlot=null;state.trainerClientBooking.availabilityMessage=message}
async function trainerClientBookingDateChanged(value){const m=state.trainerClientBooking;if(!m)return;m.date=value;invalidateTrainerClientSlots("Checking availability…");render();if(value)await trainerClientBookingCheckTimes()}
async function trainerClientBookingOptionChanged(field,value){const m=state.trainerClientBooking;if(!m)return;m[field]=value;invalidateTrainerClientSlots("");render();if(m.date&&field!=="address")await trainerClientBookingCheckTimes()}
async function trainerClientBookingCheckTimes(){
 const m=state.trainerClientBooking;if(!m?.date)return appAlert("Choose a date.");
 invalidateTrainerClientSlots("Checking availability…");render();
 const qs=new URLSearchParams({date:m.date,locationType:m.locationType,address:m.address||"",service:m.service,overrideLocation:m.overrideLocation?'1':'0'});
 try{const slots=await api(`/api/trainer/availability?${qs.toString()}`);state.trainerClientBookingSlots=slots;state.trainerClientBooking.selectedSlot=null;if(slots.length){m.availabilityMessage=m.overrideLocation?'Override slots shown. Existing bookings, classes, Amy-unavailable time and travel time are still protected.':'';render();return}let msg=m.overrideLocation?'No safe override slots on this date.':'No availability on this date.';try{const meta=await api(`/api/trainer/day-meta?date=${encodeURIComponent(m.date)}`);if(!meta.working?.enabled)msg="Amy is not working on this date.";else if(!m.overrideLocation&&meta.restrictions?.[m.locationType]?.available===false){const r=meta.restrictions[m.locationType];msg=`${m.locationType==="arena"?"Arena":"Home visits"} unavailable on this date.${r.public_message?` ${r.public_message}`:""}`}}catch(_e){}m.availabilityMessage=msg;render()}catch(e){invalidateTrainerClientSlots(e.message||"Could not check availability.");render()}
}

/* cleanup: overridden trainerClientBookingModal declaration removed */
/* cleanup: overridden createTrainerProvisionalBooking declaration removed */

async function reviewStatus(id,status){await api(`/api/trainer/reviews/${id}/status`,{method:"POST",body:JSON.stringify({status})});state.trainer=await api("/api/trainer/summary");render()}
async function setVaccinationStatus(petId,status){
 let note="";if(status==="rejected"){note=await appPrompt("What should the client know about the replacement needed?","Please upload a clearer or updated vaccination record.");if(note===null)return;}
 try{await api(`/api/trainer/pets/${petId}/vaccination-status`,{method:"POST",body:JSON.stringify({status,note})});state.trainer=await api("/api/trainer/summary");if(state.trainerClient?.pets)state.trainerClient=await api(`/api/trainer/client/${state.trainerClient.user.id}`);if(state.clientRecord?.user?.id)state.clientRecord=await api(`/api/trainer/client/${state.clientRecord.user.id}`);if(status==="rejected")state.vaccinationReview=null;else state.vaccinationReview=await api(`/api/trainer/pets/${petId}/vaccinations`);render()}catch(e){appAlert(e.message)}
}
async function openVaccinationReview(petId){
  try{state.vaccinationReview=await api(`/api/trainer/pets/${petId}/vaccinations`);render()}catch(e){appAlert(e.message)}
}
function closeVaccinationReview(){state.vaccinationReview=null;render()}
function vaccinationReviewModal(){const d=state.vaccinationReview;if(!d)return '';const files=d.files||[];return `<div class="modal-overlay"><div class="trainer-modal vaccination-review-modal"><button class="close-btn modal-close" aria-label="Close vaccination record" onclick="closeVaccinationReview()">×</button><div class="eyebrow">Vaccination record</div><h2>${esc(d.name||'Dog')}</h2>${files.length?`<p class="small">Look through the uploaded passport page(s) before choosing Verify.</p><div class="vaccination-pages">${files.map((f,i)=>`<figure><img src="${esc(f.url)}" alt="Vaccination passport page ${i+1}"><figcaption>Page ${i+1} · ${esc(f.original_name||'uploaded image')}</figcaption></figure>`).join('')}</div>`:`<div class="notice">No image has been uploaded. Only use Verify if you have physically seen the vaccination record.</div>`}<div class="actions">${d.vaccination_status==='verified'?`<button class="secondary" onclick="setVaccinationStatus(${d.id},'pending')">Undo verification</button>`:`<button class="primary" onclick="setVaccinationStatus(${d.id},'verified')">Verify record</button><button class="danger" onclick="setVaccinationStatus(${d.id},'rejected')">Reject / request replacement</button>`}<button class="secondary" onclick="closeVaccinationReview()">Close</button></div></div></div>`}
async function viewVaccinationFiles(petId){return openVaccinationReview(petId)}
function blockTime(){const d=state.trainerSelectedDate||nairobiDateKeyClient(0);state.scheduleModal={mode:"block",target:"amy",startDate:d,endDate:d,allDay:false,startTime:"09:00",endTime:"10:00",reason:"Unavailable",publicMessage:""};render()}
/* cleanup: overridden submitScheduleModal declaration removed */
function closeScheduleModal(){state.scheduleModal=null;render()}
function halfHourOptions(selected){const rows=[];for(let h=0;h<24;h++)for(const m of [0,30]){const v=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;rows.push(`<option value="${v}" ${v===selected?"selected":""}>${v}</option>`)}return rows.join("")}
async function loadTrainerRescheduleSlots(){
 const m=state.scheduleModal;if(!m||m.mode!=="trainer-reschedule")return;
 const date=document.getElementById("trainerRescheduleDate")?.value||m.date;
 if(!date)return;
 m.date=date;m.selected=null;m.slots=[];m.availabilityMessage="Checking availability…";render();
 try{
   const d=await api(`/api/trainer/bookings/${m.bookingId}/reschedule-availability?date=${encodeURIComponent(date)}`);
   m.slots=Array.isArray(d.slots)?d.slots:[];
   m.availabilityMessage=m.slots.length?"":(d.message||"No available times on this date. Please choose another date.");
   render();
 }catch(e){
   m.slots=[];m.selected=null;m.availabilityMessage=e.message||"Availability could not be checked.";render();
 }
}
function chooseTrainerRescheduleSlot(slot){
 const m=state.scheduleModal;if(!m)return;m.selected=slot;render();
}

function scheduleModalView(){
 const m=state.scheduleModal;if(!m)return "";const isBlock=m.mode==="block";
 if(m.mode==="trainer-reschedule"){
   const b=m.booking||state.trainerBooking||{};
   return `<div class="modal-overlay"><div class="trainer-modal schedule-modal"><button class="close-btn modal-close" aria-label="Close" onclick="closeScheduleModal()">×</button><div class="eyebrow">Reschedule booking</div><h2>Choose a new appointment time</h2><p>${esc(privateServiceLabel(b.service))} · ${b.location_type==="home"?"Home visit":"Amy's Arena in Ridgeways"}. Duration stays the same.</p><label>Date<input id="trainerRescheduleDate" type="date" min="${earliestPrivateDate()}" value="${esc(m.date||"")}" onchange="state.scheduleModal.date=this.value;state.scheduleModal.selected=null;loadTrainerRescheduleSlots()"></label>${m.availabilityMessage?`<div class="notice trainer-reschedule-message">${esc(m.availabilityMessage)}</div>`:""}<div class="time-grid trainer-reschedule-times">${(m.slots||[]).map(slot=>`<button class="time ${m.selected?.start===slot.start?"selected":""}" onclick='chooseTrainerRescheduleSlot(${JSON.stringify(slot)})'>${String(slot.start).slice(11,16)}</button>`).join("")}</div><div class="actions"><button class="secondary" onclick="closeScheduleModal()">Cancel</button><button class="primary" ${!m.selected?"disabled":""} onclick="submitScheduleModal()">Confirm new time</button></div></div></div>`;
 }
 if(!isBlock)return "";
 return `<div class="modal-overlay"><div class="trainer-modal schedule-modal unified-block-modal"><button class="close-btn modal-close" aria-label="Close" onclick="closeScheduleModal()">×</button><div class="eyebrow">Scheduling</div><h2>${m.quickClose?"One-off change":m.editing?"Change block":"Block time"}</h2><p>${m.quickClose?"Close this date to new bookings without disturbing appointments or classes already booked.":"Choose what is unavailable. The same block can cover one day or several days."}</p>
 ${m.quickClose?"":`<div class="block-target-grid"><button class="choice ${m.target==="amy"?"selected":""}" onclick="state.scheduleModal.target='amy';render()"><span>Amy</span><small>No training at all</small></button><button class="choice ${m.target==="arena"?"selected":""}" onclick="state.scheduleModal.target='arena';render()"><span>Arena</span><small>Amy can still do home visits</small></button><button class="choice ${m.target==="home"?"selected":""}" onclick="state.scheduleModal.target='home';render()"><span>Home visits</span><small>Amy can still train in the arena</small></button></div>`}
 <div class="form-grid"><label>${m.quickClose?"Date":"First date"}<input type="date" value="${esc(m.startDate)}" onchange="state.scheduleModal.startDate=this.value;if(state.scheduleModal.quickClose)state.scheduleModal.endDate=this.value;else if(state.scheduleModal.endDate<this.value)state.scheduleModal.endDate=this.value"></label>${m.quickClose?"":`<label>Last date<input type="date" value="${esc(m.endDate)}" onchange="state.scheduleModal.endDate=this.value"></label>`}</div>
 ${m.quickClose?"":`<label class="check-row"><input type="checkbox" ${m.allDay?"checked":""} onchange="state.scheduleModal.allDay=this.checked;render()"> Whole day</label>`}
 ${!m.allDay?`<div class="form-grid"><label>From<select onchange="state.scheduleModal.startTime=this.value">${halfHourOptions(m.startTime)}</select></label><label>To<select onchange="state.scheduleModal.endTime=this.value">${halfHourOptions(m.endTime)}</select></label></div><p class="small">For a multi-day block, these hours are blocked on every day in the selected date range.</p>`:"<p class=\"small\">All client booking time is blocked for the selected target on every selected date.</p>"}
 <label>Reason<input value="${esc(m.reason||"")}" oninput="state.scheduleModal.reason=this.value" placeholder="Booked up / arena maintenance / car unavailable"></label>
 ${m.target!=="amy"?`<label>Message clients will see<textarea rows="2" oninput="state.scheduleModal.publicMessage=this.value" placeholder="Write a short, friendly explanation.">${esc(m.publicMessage||"")}</textarea></label>`:""}
 <div class="actions">${m.editing?`<button class="danger" onclick="cancelScheduleBlockFromModal()">Cancel block</button>`:""}<button class="secondary" onclick="closeScheduleModal()">Close</button><button class="primary" onclick="submitScheduleModal()">${m.editing?"Save changes":"Save block"}</button></div></div></div>`;
}

async function addResource(){state.resourceLibrary=await api('/api/trainer/resources');state.trainerClients=await api('/api/trainer/clients');state.resourceUploadOpen=true;state.view='resource-library';render()}
async function assignResourceFromAppointment(){
 const b=state.trainerBooking;if(!b?.user_id)return appAlert('Open a client appointment first.');
 try{
   const rows=await api('/api/trainer/resources');
   if(!rows.length)return appAlert('There are no training resources in the library yet.');
   state.quickResourcePicker={rows,userId:b.user_id,client:b.client||'the client',selectedId:null,search:"",note:""};
   render();
 }catch(e){appAlert(e.message)}
}
function resourceQuickPickerModal(){
 const m=state.quickResourcePicker;if(!m)return "";
 return `<div class="modal-overlay"><div class="trainer-modal resource-picker-modal"><button class="close-btn modal-close" onclick="state.quickResourcePicker=null;render()">×</button><div class="eyebrow">Training resources</div><h2>Choose a resource</h2><p>Share with ${esc(m.client)}.</p><label>Search<input id="quickResourceSearch" value="${esc(m.search||"")}" placeholder="Search title, type or category" oninput="filterQuickResources(this.value)"></label><div class="quick-resource-list">${(m.rows||[]).map(r=>`<label class="quick-resource-row" data-search="${esc(`${r.title} ${r.type||''} ${r.category||''}`.toLowerCase())}"><input type="radio" name="quickResourceChoice" value="${r.id}" ${Number(m.selectedId)===Number(r.id)?"checked":""} onchange="state.quickResourcePicker.selectedId=Number(this.value)"><span><b>${esc(r.title)}</b><small>${esc(String(r.type||"").toUpperCase())}${r.category?` · ${esc(r.category)}`:""}</small></span></label>`).join("")}</div><label>Optional note to client<textarea id="quickResourceNote" rows="3" oninput="state.quickResourcePicker.note=this.value">${esc(m.note||"")}</textarea></label><div class="actions"><button class="secondary" onclick="state.quickResourcePicker=null;render()">Cancel</button><button class="primary" onclick="shareQuickResource()">Share resource</button></div></div></div>`;
}
function filterQuickResources(value){
 const q=String(value||"").trim().toLowerCase();if(state.quickResourcePicker)state.quickResourcePicker.search=q;
 document.querySelectorAll(".quick-resource-row").forEach(el=>{el.hidden=!!q&&!String(el.dataset.search||"").toLowerCase().includes(q)});
}

async function shareQuickResource(){
 const m=state.quickResourcePicker;if(!m?.selectedId)return appAlert("Choose a resource first.");
 try{
   const note=document.getElementById("quickResourceNote")?.value||m.note||"";
   const r=(m.rows||[]).find(x=>Number(x.id)===Number(m.selectedId));
   await api(`/api/trainer/resources/${m.selectedId}/access`,{method:"POST",body:JSON.stringify({userId:m.userId,note})});
   state.quickResourcePicker=null;render();await appAlert(`${r?.title||"Resource"} has been shared with ${m.client}.`);
 }catch(e){appAlert(e.message)}
}


async function openResourceLibrary(){state.resourceLibrary=await api('/api/trainer/resources');state.trainerClients=await api('/api/trainer/clients');state.resourceUploadOpen=false;go('resource-library')}

function dashboardBack(){state.trainerAdminPage=null;state.bookForClientMode=false;state.clientRecord=null;state.trainerClientBooking=null;state.trainerClientBookingSlots=[];state.view="trainer";render()}
async function openScheduling(){
 state.trainerAdminPage="scheduling";state.workingHours=await api("/api/trainer/working-hours");state.serviceAvailability=await api("/api/trainer/service-availability");state.scheduleBlocks=await api("/api/trainer/schedule-blocks");state.schedulingDate=state.trainerSelectedDate||nairobiDateKeyClient(0);state.view="trainerAdmin";render();
}
function scheduleBlockLabel(b){return b.target==="amy"?"Amy unavailable":b.target==="arena"?"Arena unavailable":"Home visits unavailable"}
function scheduleBlockDateLabel(b){const dates=b.start_date===b.end_date?displayDate(b.start_date,{weekday:"short",day:"numeric",month:"short",year:"numeric"}):`${displayDate(b.start_date,{day:"numeric",month:"short"})}–${displayDate(b.end_date,{day:"numeric",month:"short",year:"numeric"})}`;return `${dates} · ${b.all_day?"whole day":`${b.start_time}–${b.end_time} each day`}`}
async function revokeScheduleBlock(id){try{await api(`/api/trainer/schedule-blocks/${id}`,{method:"DELETE"});state.scheduleBlocks=await api("/api/trainer/schedule-blocks");await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render()}catch(e){appAlert(e.message)}}
function changeScheduleBlock(id){
 const b=(state.scheduleBlocks||[]).find(x=>Number(x.id)===Number(id));if(!b)return appAlert("That block could not be found.");
 state.scheduleModal={mode:"block",blockId:b.id,target:b.target,startDate:b.start_date,endDate:b.end_date,allDay:!!b.all_day,startTime:b.start_time||"09:00",endTime:b.end_time||"10:00",reason:b.reason||"Unavailable",publicMessage:b.public_message||b.reason||"",silentCalendar:!!b.silent_calendar,editing:true};render();
}
async function cancelScheduleBlockFromModal(){
 const id=state.scheduleModal?.blockId;if(!id)return;
 if(!await appConfirm("Cancel this block?"))return;
 try{await api(`/api/trainer/schedule-blocks/${id}`,{method:"DELETE"});state.scheduleBlocks=await api("/api/trainer/schedule-blocks");state.scheduleModal=null;await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render()}catch(e){appAlert(e.message)}
}

/* cleanup: overridden openTrainerAdmin declaration removed */
/* cleanup: overridden trainerAdminView declaration removed */
function formatNairobiActivityTime(value){
 const raw=String(value||"").trim();if(!raw)return "";
 const d=new Date(raw.includes("T")?(raw.endsWith("Z")?raw:raw+"Z"):raw.replace(" ","T")+"Z");
 if(Number.isNaN(d.getTime()))return raw.replace("T"," ").slice(0,16);
 return new Intl.DateTimeFormat("en-KE",{timeZone:"Africa/Nairobi",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(d);
}
function activityAdminView(){const rows=state.activityAdmin||[];return `<section class="screen admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Activity history</h2><div class="actions"><button class="secondary compact-button" onclick="openTrainerAdmin('reports')">Reports</button></div><p>Recent preserved booking and client, dog and class actions, newest first. Times shown in Nairobi.</p></div></div><div class="activity-list">${rows.map(x=>`<div class="activity-row"><div><span class="activity-action">${esc(String(x.action||"").replaceAll("_"," "))}</span><small>${esc(x.client_name||"")}${x.pet_name?` · ${esc(x.pet_name)}`:""}${x.class_title?` · ${esc(x.class_title)}`:""}</small><p>${esc(x.details||"")}</p></div><time>${esc(formatNairobiActivityTime(x.created_at))}</time></div>`).join("")||"<p>No activity has been recorded yet.</p>"}</div></section>`}
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
/* cleanup: overridden clientAdminView declaration removed */
async function setClientStatusFromRecord(id,status){
 try{await api(`/api/trainer/clients/${id}/status`,{method:"POST",body:JSON.stringify({status})});state.clientAdmin=await api("/api/trainer/clients");state.clientRecord=await api(`/api/trainer/client/${id}`);render()}catch(e){appAlert(e.message)}
}
async function saveTrainerDogNotes(id){
 const trainerNotes=document.getElementById(`trainerNotes-${id}`)?.value||"";
 try{await api(`/api/trainer/pets/${id}/private-notes`,{method:"PUT",body:JSON.stringify({trainerNotes})});if(state.clientRecord?.user?.id)state.clientRecord=await api(`/api/trainer/client/${state.clientRecord.user.id}`);state.editingTrainerNotePetId=null;render()}catch(e){appAlert(e.message)}
}
function filterClientAdmin(q){q=String(q||"").trim().toLowerCase();state.clientSearch=q;document.querySelectorAll(".client-overview-card").forEach(el=>{el.style.display=!q||String(el.dataset.search||"").includes(q)?"":"none"})}
async function setClientStatus(id,status){await api(`/api/trainer/clients/${id}/status`,{method:"POST",body:JSON.stringify({status})});state.clientAdmin=await api("/api/trainer/clients");render()}
function classesAdminView(){
 const rows=state.classAdmin||[],active=rows.find(x=>x.id===state.selectedClassAdmin)||rows[0];
 return `<section class="screen admin-screen class-admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Classes</h2><p>Courses, age ranges, dates, places and dogs enrolled.</p></div><button class="secondary" onclick="addClass()">＋ New course</button></div><div class="class-admin-layout"><div class="admin-list class-admin-list">${rows.map(x=>{const n=new Set((x.enrolments||[]).filter(e=>e.enrolment_status==="active").map(e=>e.pet_id||`enrol-${e.id}`)).size;return `<button class="admin-list-row class-course-row ${Number(active?.id)===Number(x.id)?"selected":""}" onclick="state.selectedClassAdmin=${x.id};render()"><span class="class-list-main"><span class="class-list-title">${esc(x.title)}</span><small>${displayDate(x.start_date,{day:"numeric",month:"short",year:"numeric"})}</small></span><span class="class-list-enrolled"><span>${n}/${x.capacity}</span><small>enrolled</small></span></button>`}).join('')||'<p>No classes created yet.</p>'}</div><div class="admin-detail">${classAdminDetail(active)}</div></div></section>`;
}
function classAdminDetail(c){
 if(!c)return "";
 const rows=Array.isArray(c.enrolments)?c.enrolments:[];
 const byPet=new Map();
 for(const e of rows){const key=e.pet_id!=null?`pet-${e.pet_id}`:`enrol-${e.id}`;if(!byPet.has(key))byPet.set(key,[]);byPet.get(key).push(e)}
 const cards=[...byPet.values()].map(group=>{group.sort((x,y)=>String(y.activity_at||y.created_at||"").localeCompare(String(x.activity_at||x.created_at||"")));const active=group.find(e=>e.enrolment_status==="active");const current=active||group[0];const prior=group.filter(e=>e.id!==current.id);const events=[...(current.events||[]),...prior.flatMap(e=>e.events||[])].filter(h=>h.event_type!=="reactivated").sort((x,y)=>String(y.created_at||"").localeCompare(String(x.created_at||"")));return {...current,_events:events,_active:!!active,_sortAt:String(current.activity_at||current.created_at||"")}}).sort((x,y)=>String(y._sortAt).localeCompare(String(x._sortAt)));
 const activeCards=cards.filter(x=>x._active),inactiveCards=cards.filter(x=>!x._active);
 const historyLabel=(h)=>({re_enrolled:"Re-enrolled in course",enrolled:"Enrolled in course",cancelled_by_trainer:"Cancelled by Amy",cancelled_by_client:"Cancelled by client",full_refund:"Full refund recorded",partial_refund:"Partial refund recorded",full_credit:"Full client credit recorded",partial_credit:"Partial client credit recorded",no_refund_or_credit:"No refund or credit"}[h.event_type]||String(h.event_type||"").replaceAll("_"," "));
 const cardHtml=(e)=>{const months=ageMonthsOnClient(e.date_of_birth,c.start_date);const stateLabel=e.enrolment_status==="active"?"Active":e.enrolment_status==="cancelled_by_client"?"Cancelled by client":e.enrolment_status==="cancelled_by_trainer"?"Cancelled by Amy":e.enrolment_status==="rejected"?"Cancelled":"Inactive";const financial=e.payment_status==="refund_pending"?"Refund / credit decision required":e.payment_status==="refunded"?`Refunded ${money(e.refund_amount||0)}`:e.payment_status==="refund_partial"?`Partial refund ${money(e.refund_amount||0)}`:e.payment_status==="credited"?"Full client credit":e.payment_status==="credit_partial"?"Partial client credit":e.payment_status==="no_refund"?"No refund or credit":e.payment_status==="demo_paid"?"Paid":e.payment_status==="paid"?"Paid":e.payment_status==="credit_paid"?"Paid with credit":e.payment_status==="pending"?"Awaiting payment":esc(e.payment_status||"");const history=(e._events||[]).slice(0,12);return `<article class="class-dog-card ${e._active?"active-dog":"inactive-dog"} ${e.payment_status==="refund_pending"?"needs-financial":""}" data-class-enrolment-id="${e.id}"><div class="class-dog-card-head"><div><h4>${esc(e.pet_name||"Dog")}</h4><p>${esc(e.client_name||"")}</p></div><span class="class-dog-state ${e._active?"active":"inactive"}">${esc(stateLabel)}</span></div><div class="class-dog-info"><p>${esc(e.breed||"Breed not recorded")}${e.date_of_birth?` · DOB ${displayDate(e.date_of_birth,{day:"numeric",month:"short",year:"numeric"})}${months!=null?` · ${months} months at start`:""}`:" · DOB not recorded"}</p><p>${esc(e.email||"")}${e.phone?` · ${esc(e.phone)}`:""}</p><p>Vaccination: ${e.vaccination_status==="verified"?"Verified ✓":esc(e.vaccination_status||"Not provided")}</p></div><div class="class-dog-status-line"><span>${esc(financial)}</span>${e.rejected_reason?`<span>${esc(e.rejected_reason)}</span>`:""}</div>${e._active?`<div class="class-dog-actions"><button class="secondary compact-button" onclick="rejectClassDog(${e.id})">Cancel enrolment</button></div>`:""}${e.payment_status==="refund_pending"?`<div class="class-refund-actions"><button class="secondary compact-button" onclick="decideClassRefund(${e.id},'full',${Number(c.price||0)})">Full refund</button><button class="secondary compact-button" onclick="decideClassRefund(${e.id},'partial',${Number(c.price||0)})">Partial refund</button><button class="secondary compact-button" onclick="decideClassRefund(${e.id},'credit_full',${Number(c.price||0)})">Full credit</button><button class="secondary compact-button" onclick="decideClassRefund(${e.id},'credit_partial',${Number(c.price||0)})">Partial credit</button><button class="secondary compact-button" onclick="decideClassRefund(${e.id},'none',${Number(c.price||0)})">No refund or credit</button></div>`:""}${history.length?`<details class="class-dog-history"><summary>History · ${history.length}</summary><div>${history.map(h=>`<p><time>${esc(formatNairobiActivityTime(h.created_at))}</time> · ${esc(historyLabel(h))}${h.amount!=null?` · ${money(h.amount)}`:""}${h.reference?` · ${esc(h.reference)}`:""}${h.note&&h.event_type!=="re_enrolled"?` · ${esc(h.note)}`:""}</p>`).join("")}</div></details>`:""}</article>`};
 const sessions=(c.sessions||[]);
 return `<div class="card class-admin-card"><div class="class-detail-head"><div><h3>${esc(c.title)}</h3><p>${esc(classAgeLabel(c))} · ${activeCards.length}/${c.capacity} places taken · ${c.location_type==="alternate"?esc(c.location_name||"Alternate venue"):"Amy's Arena in Ridgeways"}</p></div><div class="actions class-edit-actions"><button class="secondary compact-button" onclick="editClassCourse(${c.id})">Edit course</button><button class="danger compact-button" onclick="deleteClassCourse(${c.id})">Delete course</button></div></div><div class="class-resource-action"><button class="primary" onclick="shareResourceToClass(${c.id})">Share training resource with this class</button><span class="small">Makes the resource available to all active paid participants.</span></div><h4>Sessions</h4><div class="class-session-table" role="table"><div class="class-session-row class-session-head" role="row"><span>Session</span><span>Date</span><span>Time</span></div>${sessions.map((s,i)=>`<div class="class-session-row" role="row"><span>${i+1}</span><span>${displayDate(s.session_date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span><span>${esc(s.start_time)}–${esc(s.end_time)}</span></div>`).join("")}</div><section class="class-card-group active-group"><div class="class-card-group-head"><h4>Active dogs</h4><span>${activeCards.length}</span></div>${activeCards.length?`<div class="class-dog-card-list">${activeCards.map(cardHtml).join("")}</div>`:"<p class=\"small\">No active enrolments.</p>"}</section><section class="class-card-group inactive-group"><div class="class-card-group-head"><h4>Inactive / history</h4><span>${inactiveCards.length}</span></div>${inactiveCards.length?`<div class="class-dog-card-list">${inactiveCards.map(cardHtml).join("")}</div>`:"<p class=\"small\">No inactive enrolments.</p>"}</section></div>`;
}

async function rejectClassDog(id){const reason=await appPrompt("Why is this enrolment being cancelled? The client will see this note.","");if(reason===null)return;if(!reason.trim())return appAlert("Please record a short note for the client.");if(!await appConfirm("Cancel this class enrolment? The place will become available again."))return;try{const d=await api(`/api/trainer/class-enrolments/${id}/reject`,{method:"POST",body:JSON.stringify({reason:reason.trim()})});state.classAdmin=await api("/api/trainer/classes-detail");state.classes=await api("/api/classes");state.trainer=await api("/api/trainer/summary");render();if(d.refundPending)appAlert("Enrolment cancelled. This paid place now needs a refund decision.")}catch(e){appAlert(e.message)}}
async function decideClassRefund(id,decision,fullAmount){
 const isCredit=decision==="credit_full"||decision==="credit_partial";
 const isFull=decision==="full"||decision==="credit_full";
 if(decision==="none"){
   const note=await appPrompt("Short note to the client explaining why no refund or credit is being given:","");
   if(note===null)return;
   if(!String(note).trim())return appAlert("Please add a short note for the client.");
   if(!await appConfirm("Record no refund or client credit and send this note to the client?"))return;
   try{await api(`/api/trainer/class-enrolments/${id}/refund`,{method:"POST",body:JSON.stringify({decision:"none",note:String(note).trim()})});state.classAdmin=await api("/api/trainer/classes-detail");state.trainer=await api("/api/trainer/summary");render()}catch(e){appAlert(e.message)}
   return;
 }
 if(!isCredit){
   state.classRefundEntry={id,decision,fullAmount:Number(fullAmount||0),amount:isFull?Number(fullAmount||0):"",code:""};render();return;
 }
 let amount=isFull?Number(fullAmount||0):null;
 if(!isFull){const entered=await appPrompt("Client credit amount in KES:","");if(entered===null)return;amount=Number(entered)}
 if(!Number.isFinite(amount)||amount<=0)return appAlert("Enter a valid amount.");
 if(!await appConfirm(`${isFull?"Full":"Partial"} client credit of ${money(amount)} will be added to the client's account. No M-Pesa payment will be made.`,"Add client credit"))return;
 try{await api(`/api/trainer/class-enrolments/${id}/refund`,{method:"POST",body:JSON.stringify({decision,amount})});state.classAdmin=await api("/api/trainer/classes-detail");state.trainer=await api("/api/trainer/summary");render();await appAlert(`${isFull?"Full":"Partial"} client credit recorded: ${money(amount)}.`)}catch(e){appAlert(e.message)}
}
async function shareResourceToClass(classId){
 try{
   const rows=await api("/api/trainer/resources");
   const course=(state.classAdmin||[]).find(c=>Number(c.id)===Number(classId));
   if(!rows.length)return appAlert("There are no training resources in the library yet.");
   state.classResourcePicker={classId:Number(classId),courseTitle:course?.title||"this class",rows,selectedId:null,search:"",note:""};render();
 }catch(e){appAlert(e.message)}
}
function classResourcePickerModal(){
 const m=state.classResourcePicker;if(!m)return "";
 return `<div class="modal-overlay"><div class="trainer-modal resource-picker-modal"><button class="close-btn modal-close" onclick="state.classResourcePicker=null;render()">×</button><div class="eyebrow">Class resources</div><h2>Share with ${esc(m.courseTitle)}</h2><p class="small">The resource becomes available to all active paid participants in this course.</p><label>Search<input value="${esc(m.search||"")}" placeholder="Search title, type or category" oninput="filterClassResources(this.value)"></label><div class="quick-resource-list">${(m.rows||[]).map(r=>`<label class="quick-resource-row class-resource-row" data-search="${esc(`${r.title} ${r.type||""} ${r.category||""}`.toLowerCase())}"><input type="radio" name="classResourceChoice" value="${r.id}" onchange="state.classResourcePicker.selectedId=Number(this.value)"><span><b>${esc(r.title)}</b><small>${esc(r.category||"General")} · ${esc(String(r.type||"").toUpperCase())}</small></span></label>`).join("")}</div><label>Optional note to class<textarea id="classResourceNote" rows="3" oninput="state.classResourcePicker.note=this.value">${esc(m.note||"")}</textarea></label><div class="actions"><button class="secondary" onclick="state.classResourcePicker=null;render()">Cancel</button><button class="primary" onclick="confirmShareResourceToClass()">Share with class</button></div></div></div>`;
}
function filterClassResources(value){
 const q=String(value||"").trim().toLowerCase();if(state.classResourcePicker)state.classResourcePicker.search=q;
 document.querySelectorAll(".class-resource-row").forEach(el=>{el.hidden=!!q&&!String(el.dataset.search||"").includes(q)});
}
async function confirmShareResourceToClass(){
 const m=state.classResourcePicker;if(!m?.selectedId)return appAlert("Choose a resource first.");
 try{
   const note=document.getElementById("classResourceNote")?.value||"";
   const r=(m.rows||[]).find(x=>Number(x.id)===Number(m.selectedId));
   const d=await api(`/api/trainer/resources/${m.selectedId}/class-access`,{method:"POST",body:JSON.stringify({classId:m.classId,note})});
   state.classResourcePicker=null;render();await appAlert(`${r?.title||"Resource"} shared with ${m.courseTitle}${Number(d.participants)===1?" (1 participant)":` (${Number(d.participants)||0} participants)`}.`);
 }catch(e){appAlert(e.message)}
}
function classRefundEntryModal(){
 const m=state.classRefundEntry;if(!m)return "";
 const partial=m.decision==="partial";
 return `<div class="modal-overlay"><div class="trainer-modal class-refund-entry"><button class="close-btn modal-close" onclick="state.classRefundEntry=null;render()">×</button><div class="eyebrow">Class refund</div><h2>${partial?"Partial":"Full"} M-Pesa refund</h2>${partial?`<label>Refund amount (KES)<input id="classRefundAmount" type="number" min="1" max="${m.fullAmount}" value="${esc(m.amount||"")}"></label>`:`<p>Refund amount: <b>${money(m.fullAmount)}</b></p>`}<label>M-Pesa refund reference<input id="classRefundCode" maxlength="10" inputmode="text" autocapitalize="characters" value="${esc(m.code||"")}" oninput="this.value=this.value.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,10);state.classRefundEntry.code=this.value" placeholder="10 characters"></label><p class="small">10-character alphanumeric M-Pesa reference. Letters are stored in capitals.</p><div class="actions"><button class="secondary" onclick="state.classRefundEntry=null;render()">Cancel</button><button class="primary" onclick="submitClassRefundEntry()">Save refund</button></div></div></div>`;
}
async function submitClassRefundEntry(){
 const m=state.classRefundEntry;if(!m)return;const code=String(document.getElementById("classRefundCode")?.value||"").replace(/\s+/g,"").toUpperCase();
 if(!/^[A-Z0-9]{10}$/.test(code))return appAlert("Enter the full 10-character M-Pesa refund confirmation reference.");
 const amount=m.decision==="full"?Number(m.fullAmount):Number(document.getElementById("classRefundAmount")?.value);
 if(!Number.isFinite(amount)||amount<=0||amount>Number(m.fullAmount))return appAlert(`Enter a refund amount between KES 1 and ${money(m.fullAmount).replace("KES ","")}.`);
 try{await api(`/api/trainer/class-enrolments/${m.id}/refund`,{method:"POST",body:JSON.stringify({decision:m.decision,amount,code})});state.classRefundEntry=null;state.classAdmin=await api("/api/trainer/classes-detail");state.trainer=await api("/api/trainer/summary");render();await appAlert(`${m.decision==="full"?"Full":"Partial"} class refund recorded: ${money(amount)} · M-Pesa ${code}`)}catch(e){appAlert(e.message)}
}


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
/* cleanup: overridden workingHoursView declaration removed */
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
 try{await api('/api/trainer/working-hours',{method:'POST',body:JSON.stringify({weekly})});state.workingHours=await api('/api/trainer/working-hours');appAlert('Working hours saved.');render()}catch(e){appAlert(e.message)}
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
 const m=state.workingExceptionModal;if(!m?.date)return appAlert("Choose the date.");
 if((m.mode==="available"||m.unavailableScope==="part")&&(!m.start_time||!m.end_time||m.start_time>=m.end_time))return appAlert("Choose valid start and end times.");
 try{
  if(m.mode==="available")await api("/api/trainer/working-hours/exception",{method:"POST",body:JSON.stringify({date:m.date,enabled:true,start_time:m.start_time,end_time:m.end_time,note:m.note||""})});
  else if(m.unavailableScope==="all")await api("/api/trainer/working-hours/exception",{method:"POST",body:JSON.stringify({date:m.date,enabled:false,start_time:null,end_time:null,note:m.note||"Unavailable"})});
  else await api("/api/trainer/blocks",{method:"POST",body:JSON.stringify({startAt:`${m.date}T${m.start_time}:00`,endAt:`${m.date}T${m.end_time}:00`,reason:m.note||"Unavailable"})});
  state.workingExceptionModal=null;state.workingHours=await api("/api/trainer/working-hours");state.trainer=await api("/api/trainer/summary");await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());render();
 }catch(e){appAlert(e.message)}
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
async function saveRecurringBlock(){const m=state.recurringBlockModal;if(!m)return;if(!m.weekdays.length)return appAlert("Choose at least one weekday.");if(!m.start_date)return appAlert("Choose the first date.");if(!m.untilFurtherNotice&&!m.end_date)return appAlert("Choose the last date.");if(m.start_time>=m.end_time)return appAlert("End time must be after start time.");try{await api("/api/trainer/recurring-blocks",{method:"POST",body:JSON.stringify({weekdays:m.weekdays,start_time:m.start_time,end_time:m.end_time,reason:m.reason||"Blocked",start_date:m.start_date,end_date:m.untilFurtherNotice?"":m.end_date})});state.recurringBlockModal=null;state.workingHours=await api("/api/trainer/working-hours");if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render()}catch(e){appAlert(e.message)}}
async function revokeRecurringBlock(id){await api(`/api/trainer/recurring-blocks/${id}`,{method:"DELETE"});state.workingHours=await api("/api/trainer/working-hours");render()}
async function deleteWorkingException(id){await api(`/api/trainer/working-hours/exception/${id}`,{method:'DELETE'});state.workingHours=await api('/api/trainer/working-hours');render()}
/* cleanup: overridden attentionAdminView declaration removed */
async function deleteOneOffBlock(id){try{await api(`/api/trainer/blocks/${id}`,{method:"DELETE"});state.workingHours=await api("/api/trainer/working-hours");state.trainer=await api("/api/trainer/summary");await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());render()}catch(e){appAlert(e.message)}}

function resourceLibraryView(){
 const rows=[...(state.resourceLibrary||[])].sort((x,y)=>String(x.category||"General").localeCompare(String(y.category||"General"))||String(x.type||"").localeCompare(String(y.type||""))||String(x.title||"").localeCompare(String(y.title||"")));
 return `<section class="screen resource-library-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="library-head"><div><div class="eyebrow">Amy's workspace</div><h2>Training Resources</h2><p class="small">A reusable file library. Resources are ordered by category, then file type and title.</p></div><button class="primary" onclick="addResource()">＋ Add resource</button></div>
 <label class="resource-library-search">Search resources<input id="resourceLibrarySearch" value="${esc(state.resourceLibrarySearch||"")}" placeholder="Search title, type or category" oninput="filterResourceLibrary(this.value)"></label>
 <div class="resource-file-list" role="table"><div class="resource-file-row resource-file-head" role="row"><span>Title</span><span>Type</span><span>Category</span><span>Actions</span></div>${rows.map(r=>`<div class="resource-file-row resource-library-item" role="row" data-search="${esc(`${r.title} ${r.type||""} ${r.category||""} ${(r.description||"").replace(/^__FILE__[^ ]+\s?/,"")}`.toLowerCase())}"><div class="resource-title-cell"><strong>${esc(r.title)}</strong><small>${esc((r.description||'').replace(/^__FILE__[^ ]+\s?/,''))}</small></div><span class="badge">${esc(String(r.type||"").toUpperCase())}</span><span>${esc(r.category||'General')}</span><div class="resource-file-actions"><button class="secondary compact-button" onclick="editResource(${r.id})">Edit</button><button class="secondary compact-button" onclick="assignResource(${r.id})">Assign</button><button class="secondary compact-button" onclick="manageResourceAccess(${r.id})">Manage</button><button class="secondary compact-button" onclick="openResource('${esc(r.url)}','${esc(r.type)}')">Open</button><button class="danger compact-button" onclick="archiveResource(${r.id})">Remove</button></div></div>`).join('')||'<div class="empty-pets"><div><h3>Your resource library is empty</h3><p class="small">Add your first training resource.</p></div></div>'}</div>${state.resourceUploadOpen?resourceUploadModal():''}</section>`;
}

function editResource(id){
 const r=(state.resourceLibrary||[]).find(x=>Number(x.id)===Number(id));if(!r)return;
 state.resourceEdit={id:Number(id),title:r.title||"",category:r.category||"General",description:(r.description||"").replace(/^__FILE__[^ ]+\s?/,"")};render();
}
function resourceEditModal(){
 const m=state.resourceEdit;if(!m)return "";
 return `<div class="modal-overlay"><div class="trainer-modal resource-editor-modal"><button class="close-btn modal-close" aria-label="Close" onclick="state.resourceEdit=null;render()">×</button><div class="eyebrow">Training Resources</div><h2>Edit resource</h2><p class="small">The original file or link stays unchanged.</p><label>Title<input id="editResourceTitle" value="${esc(m.title)}"></label><label>Category<input id="editResourceCategory" value="${esc(m.category)}" placeholder="e.g. Level 1 Foundation"></label><label>Description<textarea id="editResourceDescription" rows="3">${esc(m.description)}</textarea></label><div class="actions"><button class="secondary" onclick="state.resourceEdit=null;render()">Cancel</button><button class="primary" onclick="saveResourceEdit()">Save changes</button></div></div></div>`;
}
async function saveResourceEdit(){
 const m=state.resourceEdit;if(!m)return;
 const title=document.getElementById("editResourceTitle").value.trim(),category=document.getElementById("editResourceCategory").value.trim()||"General",description=document.getElementById("editResourceDescription").value.trim();
 if(!title)return appAlert("Please add a title.");
 try{await api(`/api/trainer/resources/${m.id}`,{method:"PUT",body:JSON.stringify({title,category,description})});state.resourceEdit=null;state.resourceLibrary=await api("/api/trainer/resources");render();appAlert("Resource updated.")}catch(e){appAlert(e.message)}
}
function filterResourceLibrary(value){
 const q=String(value||"").trim().toLowerCase();state.resourceLibrarySearch=q;
 document.querySelectorAll(".resource-library-item").forEach(el=>{el.hidden=!!q&&!String(el.dataset.search||"").includes(q)});
}

function resourceUploadModal(){
 return `<div class="modal-overlay"><div class="trainer-modal resource-editor-modal"><button class="close-btn modal-close" aria-label="Close" onclick="state.resourceUploadOpen=false;render()">×</button><div class="eyebrow">Training Resources</div><h2>Add a resource</h2><form onsubmit="submitResourceUpload(event)">
 <div class="resource-source-box"><label>Choose file<input id="resourceFile" type="file" accept="video/*,image/*,application/pdf,audio/*,.doc,.docx,.txt" onchange="resourceFileChosen(this)"></label><div class="resource-source-or">or</div><label>External link<input id="resourceUrl" type="url" placeholder="https://..." oninput="resourceLinkEntered(this.value)"></label></div>
 <p class="small">Choose either a file or an external link. The resource type is detected automatically.</p>
 <label>Title<input id="resourceTitle" required placeholder="Resource title"></label>
 <label>Category<input id="resourceCategory" value="General" placeholder="e.g. Level 1 Foundation"></label>
 <label>Description<textarea id="resourceDescription" rows="3" placeholder="Optional notes about this resource"></textarea></label>
 <div class="actions"><button type="button" class="secondary" onclick="state.resourceUploadOpen=false;render()">Cancel</button><button type="submit" class="primary">Save resource</button></div></form></div></div>`;
}
function resourceFileChosen(input){
 const file=input?.files?.[0];if(!file)return;
 const title=document.getElementById("resourceTitle");
 if(title&&!title.value.trim())title.value=file.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim();
 const url=document.getElementById("resourceUrl");if(url)url.value="";
}
function resourceLinkEntered(value){
 if(!String(value||"").trim())return;
 const file=document.getElementById("resourceFile");if(file)file.value="";
 const title=document.getElementById("resourceTitle");
 if(title&&!title.value.trim()){try{const u=new URL(value);title.value=(u.pathname.split("/").filter(Boolean).pop()||u.hostname).replace(/\.[^.]+$/,"").replace(/[-_]+/g," ")}catch{}}
}

async function submitResourceUpload(ev){
 ev.preventDefault();
 const fd=new FormData(),title=document.getElementById('resourceTitle').value.trim(),category=document.getElementById('resourceCategory').value.trim()||'General',description=document.getElementById('resourceDescription').value.trim(),file=document.getElementById('resourceFile').files[0],url=document.getElementById('resourceUrl').value.trim();
 if(!file&&!url)return appAlert('Please choose a file or enter an external link.');
 if(!title)return appAlert('Please add a title.');
 fd.append('title',title);fd.append('category',category);fd.append('description',description);
 if(url)fd.append('url',url);if(file)fd.append('file',file);
 try{await api('/api/trainer/resources',{method:'POST',body:fd});state.resourceUploadOpen=false;state.resourceLibrary=await api('/api/trainer/resources');render();appAlert('Resource saved to the library.')}catch(e){appAlert(e.message)}
}


async function assignResource(id){
 const clients=state.trainerClients||await api('/api/trainer/clients');state.trainerClients=clients;if(!clients.length)return appAlert('No clients yet.');
 const query=(await appPrompt('Search client by name, email or phone:')||'').trim().toLowerCase();if(!query)return;const matches=clients.filter(c=>[c.name,c.email,c.phone].some(v=>String(v||'').toLowerCase().includes(query)));if(!matches.length)return appAlert('No matching client found.');
 const n=matches.length===1?1:Number(await appPrompt(matches.slice(0,20).map((c,i)=>`${i+1}. ${c.name} — ${c.email}${c.phone?' — '+c.phone:''}`).join('\n')+'\n\nChoose client number:'));if(!n||!matches[n-1])return;const client=matches[n-1];const note=await appPrompt(`Optional note for ${client.name}:`,'')||'';await api(`/api/trainer/resources/${id}/access`,{method:'POST',body:JSON.stringify({userId:client.id,note})});appAlert(`Resource shared with ${client.name}.`);
}
async function manageResourceAccess(id){
 try{
   const rows=await api('/api/trainer/resources/'+id+'/access');
   const resource=(state.resourceLibrary||[]).find(r=>Number(r.id)===Number(id));
   state.resourceAccessModal={resourceId:Number(id),title:resource?.title||"Training resource",rows};
   render();
 }catch(e){appAlert(e.message)}
}
function resourceAccessModalView(){
 const m=state.resourceAccessModal;if(!m)return "";
 return `<div class="modal-overlay"><div class="trainer-modal resource-access-modal"><button class="close-btn modal-close" onclick="state.resourceAccessModal=null;render()">×</button><div class="eyebrow">Resource access</div><h2>${esc(m.title)}</h2><p class="small">${m.rows.length?`Shared with ${m.rows.length} ${m.rows.length===1?"client":"clients"}. Remove access individually below.`:"This resource is not currently assigned to anyone."}</p><div class="resource-access-list">${m.rows.map(r=>`<div class="resource-access-row"><div><strong>${esc(r.user_name||"Client")}</strong>${r.pet_name?`<small>Dog: ${esc(r.pet_name)}</small>`:""}${r.class_title?`<small>Class: ${esc(r.class_title)}</small>`:""}${r.note?`<small>Note: ${esc(r.note)}</small>`:""}</div><button class="danger compact-button" onclick="removeResourceAccess(${r.id})">Remove access</button></div>`).join("")||'<div class="notice">No client access to manage.</div>'}</div><div class="actions"><button class="primary" onclick="state.resourceAccessModal=null;render()">Done</button></div></div></div>`;
}
async function removeResourceAccess(accessId){
 const m=state.resourceAccessModal;if(!m)return;
 const row=(m.rows||[]).find(r=>Number(r.id)===Number(accessId));
 if(!await appConfirm(`Remove ${m.title} from ${row?.user_name||"this client"}?`,"Remove access"))return;
 try{
   await api('/api/trainer/resources/access/'+accessId,{method:'DELETE'});
   m.rows=(m.rows||[]).filter(r=>Number(r.id)!==Number(accessId));render();
 }catch(e){appAlert(e.message)}
}

async function archiveResource(id){
 const r=(state.resourceLibrary||[]).find(x=>Number(x.id)===Number(id));if(!r)return;
 try{
   const access=await api(`/api/trainer/resources/${id}/access`);
   const names=[...new Set(access.map(x=>x.user_name).filter(Boolean))];
   const affected=names.length?`\n\nCurrently shared with ${names.length} ${names.length===1?"client":"clients"}: ${names.slice(0,8).join(", ")}${names.length>8?` and ${names.length-8} more`:""}. Removing the resource will make it unavailable to them.`:"\n\nIt is not currently assigned to any client.";
   if(!await appConfirm(`Remove “${r.title}” from the Training Resources library?${affected}`,"Remove resource"))return;
   await api('/api/trainer/resources/'+id,{method:'DELETE'});
   state.resourceLibrary=await api('/api/trainer/resources');render();
 }catch(e){appAlert(e.message)}
}


function editClassCourse(id){
 const c=(state.classAdmin||[]).find(x=>Number(x.id)===Number(id));if(!c)return;
 const sessions=c.sessions||[],today=nairobiDateKeyClient(0),hasPast=sessions.some(x=>x.session_date<today);
 const start=c.start_time||sessions[0]?.start_time||"09:00",end=c.end_time||sessions[0]?.end_time||"10:00";
 const duration=Math.max(30,Math.round((wallClockMsClient(`2000-01-01T${end}:00`)-wallClockMsClient(`2000-01-01T${start}:00`))/60000));
 state.scheduleModal={mode:"class",editId:Number(c.id),title:c.title||"",count:sessions.length||1,startDate:sessions[0]?.session_date||c.start_date||"",startTime:start,endTime:end,durationMinutes:duration===90?90:60,price:String(c.price||0),capacity:String(c.capacity||12),recurrence:"custom",customDates:sessions.map(x=>x.session_date),originalSessions:sessions.map(x=>({...x})),hasPastSessions:hasPast,minAgeMonths:c.min_age_months==null?"":String(c.min_age_months),maxAgeMonths:c.max_age_months==null?"":String(c.max_age_months),locationType:c.location_type||"arena",locationName:c.location_name||"",activeEnrolments:(c.enrolments||[]).filter(e=>e.enrolment_status==="active").length,classAvailability:null,classAvailabilityMessage:""};
 if(!hasPast)loadClassAvailability();render();
}



async function deleteClassCourse(id){
 const c=(state.classAdmin||[]).find(x=>Number(x.id)===Number(id));if(!c)return;
 const total=(c.enrolments||[]).length;
 if(total)return appAlert("This course has enrolment history, so it cannot be deleted. Cancel or handle the enrolments instead.");
 if(!await appConfirm(`Delete "${c.title}" and all of its session dates? This cannot be undone.`))return;
 try{
  await api(`/api/trainer/classes/${id}`,{method:"DELETE"});
  const refreshed=await Promise.all([api("/api/classes"),api("/api/trainer/summary"),api("/api/trainer/classes-detail")]);
  state.classes=refreshed[0];state.trainer=refreshed[1];state.classAdmin=refreshed[2];state.selectedClassAdmin=state.classAdmin[0]?.id||null;
  await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());render();
 }catch(e){appAlert(e.message)}
}
async function addClass(){
 state.scheduleModal={mode:'class',title:'',count:5,startDate:'',startTime:'',endTime:'',durationMinutes:60,price:'7500',capacity:'12',recurrence:'weekly',customDates:[],minAgeMonths:'',maxAgeMonths:'',locationType:'arena',locationName:'',classAvailability:null,classAvailabilityMessage:'Choose the first date to see available times.'};render();
}


async function submitClassModal(){
 const title=document.getElementById('classTitle').value.trim();
 const count=Math.max(1,Math.min(20,Number(document.getElementById('classCount').value||5)));
 const startDate=document.getElementById('classStartDateBtn').value||document.getElementById('classStartDateBtn').dataset.value||'';
 const startTime=state.scheduleModal?.startTime||document.getElementById('classStartTimeBtn')?.dataset.value||'';
 const durationMinutes=Number(state.scheduleModal?.durationMinutes||60);
 const endTime=state.scheduleModal?.hasPastSessions?(state.scheduleModal?.endTime||document.getElementById('classEndTimeBtn')?.dataset.value||''):classEndFromDuration(startTime,durationMinutes);
 const price=document.getElementById('classPrice').value;
 const capacity=document.getElementById('classCapacity').value;
 const recurrence=document.getElementById('classRecurrence').value;
 let customDates=[];
 if(recurrence==='custom'){
   customDates=[...document.querySelectorAll('.custom-class-date')].map(x=>x.value).filter(Boolean);
   if(customDates.length!==count)return appAlert(`Please choose exactly ${count} custom class dates.`);
 }
 if(!title||!startDate)return appAlert('Please complete the course name and first date.');if(!startTime||!endTime)return appAlert('Choose the class start and end time from the available blocks.');
 try{
   const editId=state.scheduleModal?.editId;const activeEnrolments=Number(state.scheduleModal?.activeEnrolments||0);if(editId&&activeEnrolments&&!await appConfirm(`This course has ${activeEnrolments} active enrolment(s). Changing dates or times will change what clients see in the app. Continue?`))return;const created=await api(editId?`/api/trainer/classes/${editId}`:'/api/trainer/classes',{method:editId?'PUT':'POST',body:JSON.stringify({title,startDate:startDate||customDates[0],startTime,endTime,price,capacity,count,recurrence,customDates,locationType:document.getElementById('classLocationType').value,locationName:document.getElementById('classLocationName').value,minAgeMonths:document.getElementById('classMinAge').value,maxAgeMonths:document.getElementById('classMaxAge').value})});
   state.scheduleModal=null;
   const refreshed=await Promise.all([api('/api/classes'),api('/api/trainer/summary'),api('/api/trainer/classes-detail')]);
   state.classes=refreshed[0];state.trainer=refreshed[1];state.classAdmin=refreshed[2];state.selectedClassAdmin=Number(created.id||editId);
   await loadTrainerCalendar(new Date(`${state.trainerWeekStart||startDate}T12:00:00`));await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());render();
 }catch(e){appAlert(e.message)}
}
async function loadClassAvailability(){
 const m=state.scheduleModal;if(!m||m.mode!=="class"||m.hasPastSessions)return;
 const date=m.startDate||m.customDates?.find(Boolean)||"";
 if(!date){m.classAvailability=null;m.classAvailabilityMessage="Choose the first date to see available times.";render();return}
 try{
   m.classAvailabilityMessage="Checking availability…";
   const q=`?date=${encodeURIComponent(date)}&locationType=${encodeURIComponent(m.locationType||"arena")}${m.editId?`&excludeClassId=${Number(m.editId)}`:""}`;
   const d=await api(`/api/trainer/class-availability${q}`);
   m.classAvailability=d.blocks||[];m.classAvailabilityMessage=d.message||"";
   if(m.startTime&&!classStartFitsDuration(m.startTime,m.durationMinutes||60,m.classAvailability))m.startTime="";
   render();
 }catch(e){m.classAvailability=[];m.classAvailabilityMessage=e.message||"Could not load availability.";render()}
}

function classTimeFitsAvailableBlock(start,end,blocks){
 return (blocks||[]).some(b=>start>=b.start&&end<=b.end&&start<end);
}
function classStartOptions(){
 const m=state.scheduleModal;if(!m)return [];
 const duration=Number(m.durationMinutes||60),out=[];
 for(const b of m.classAvailability||[]){
   for(let ms=wallClockMsClient(`2000-01-01T${b.start}:00`);ms<wallClockMsClient(`2000-01-01T${b.end}:00`);ms+=30*60000){
     const t=new Date(ms).toISOString().slice(11,16);
     if(classStartFitsDuration(t,duration,m.classAvailability))out.push(t);
   }
 }
 return [...new Set(out)];
}

function classEndOptions(){return []}

function chooseClassStart(time){
 const m=state.scheduleModal;if(!m)return;m.startTime=time;
 const btn=document.querySelector(`.time-choice[data-class-start="${time}"]`);
 if(btn){document.querySelectorAll(".time-choice[data-class-start]").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected")}
 const summary=document.getElementById("classTimeSummary");if(summary)summary.textContent=`${time}–${classEndFromDuration(time,m.durationMinutes||60)}`;
}

function chooseClassEnd(){return}

function classDateChanged(value){
 const m=state.scheduleModal;if(!m)return;m.startDate=value;if(m.recurrence==="custom"&&m.customDates?.length)m.customDates[0]=value;m.startTime="";
 clearTimeout(state.classDateLoadTimer);
 state.classDateLoadTimer=setTimeout(()=>loadClassAvailability(),250);
}

function classLocationChanged(value){
 const m=state.scheduleModal;if(!m)return;m.locationType=value;m.startTime="";loadClassAvailability();
}

function classEndFromDuration(start,duration){
 if(!start)return "";
 const ms=wallClockMsClient(`2000-01-01T${start}:00`)+Number(duration||60)*60000;
 return new Date(ms).toISOString().slice(11,16);
}
function classStartFitsDuration(start,duration,blocks){
 const end=classEndFromDuration(start,duration);
 return (blocks||[]).some(b=>start>=b.start&&end<=b.end&&start<end);
}
function chooseClassDuration(minutes){
 const m=state.scheduleModal;if(!m)return;m.durationMinutes=Number(minutes);
 if(m.startTime&&!classStartFitsDuration(m.startTime,m.durationMinutes,m.classAvailability))m.startTime="";
 render();
}
function classModalView(){
 const m=state.scheduleModal;if(!m||m.mode!=='class')return '';
 const n=Math.max(1,Math.min(20,Number(m.count||5))),recurrence=m.recurrence||'weekly',custom=recurrence==='custom',today=nairobiDateKeyClient(0),weekdayLabel=m.startDate?new Date(`${m.startDate}T12:00:00`).toLocaleDateString('en-KE',{weekday:'long'}):'Choose a first date';
 const duration=Number(m.durationMinutes||60),starts=classStartOptions(),endTime=m.startTime?classEndFromDuration(m.startTime,duration):"";
 return `<div class="modal-overlay"><div class="trainer-modal schedule-modal"><button class="close-btn modal-close" aria-label="Close" onclick="state.scheduleModal=null;render()">×</button><div class="eyebrow">Course planner</div><h2>${m.editId?"Edit class course":"Create a class course"}</h2><p class="small">${m.editId?"Future session dates can be changed. Sessions that have already taken place remain part of the course history and cannot be moved.":"Choose the first date, course duration and a start time from genuinely available half-hour blocks."}</p>
 <div class="form-grid"><label>Course name<input id="classTitle" value="${esc(m.title||'')}" oninput="state.scheduleModal.title=this.value" required></label><label>Number of classes<input id="classCount" type="number" min="1" max="20" value="${n}" ${m.hasPastSessions?'disabled':''} onchange="state.scheduleModal.count=Number(this.value);render()"></label></div>
 ${m.editId?`<input type="hidden" id="classStartDateBtn" value="${esc(m.startDate||'')}"><input type="hidden" id="classRecurrence" value="custom">`:`<div class="form-grid class-date-row"><label class="class-date-field">First date<input type="date" id="classStartDateBtn" min="${today}" value="${esc(m.startDate||'')}" oninput="state.scheduleModal.startDate=this.value" onchange="classDateChanged(this.value)"></label><label>Repeats<select id="classRecurrence" onchange="state.scheduleModal.recurrence=this.value;render()"><option value="weekly" ${recurrence==='weekly'?'selected':''}>Every week</option><option value="biweekly" ${recurrence==='biweekly'?'selected':''}>Every 2 weeks</option><option value="custom" ${custom?'selected':''}>Custom dates</option></select></label></div>`}
 ${!custom?`<div class="notice"><b>Weekday:</b> ${esc(weekdayLabel)}. The first date determines the weekday automatically.</div>`:`<div class="custom-date-list"><h3>Class dates</h3>${Array.from({length:n},(_,i)=>{const value=m.customDates?.[i]||'',past=!!m.editId&&value<today;return `<label>Class ${i+1}${past?' · completed':''}<input class="custom-class-date" type="date" ${past?'disabled':''} value="${esc(value)}" oninput="state.scheduleModal.customDates[${i}]=this.value" onchange="${i===0?'classDateChanged(this.value)':''}"></label>`}).join('')}</div>`}
 <div class="form-grid"><label>Class location<select id="classLocationType" onchange="document.getElementById('alternateClassLocation').hidden=this.value!=='alternate';classLocationChanged(this.value)"><option value="arena" ${m.locationType!=="alternate"?"selected":""}>Amy's arena</option><option value="alternate" ${m.locationType==="alternate"?"selected":""}>Alternate location</option></select></label><label id="alternateClassLocation" ${m.locationType==="alternate"?"":"hidden"}>Alternate location<input id="classLocationName" placeholder="Venue / address" value="${esc(m.locationName||"")}"></label></div>
 ${m.hasPastSessions?`<div class="notice">Completed session dates and the course time are locked so the historical record cannot be rewritten.</div><div class="class-time-summary"><strong>${esc(m.startTime)}–${esc(m.endTime)}</strong></div>`:`<section class="class-availability-picker"><h3>Class time</h3><div class="class-duration-choice"><span class="choice-label">Duration</span><div class="time-blocks"><button type="button" class="time-choice ${duration===60?"selected":""}" onclick="chooseClassDuration(60)">60 min</button><button type="button" class="time-choice ${duration===90?"selected":""}" onclick="chooseClassDuration(90)">90 min</button></div></div>${m.classAvailabilityMessage?`<p class="small">${esc(m.classAvailabilityMessage)}</p>`:""}${m.classAvailability===null?`<p class="small">Choose the first date above.</p>`:(m.classAvailability||[]).length?`<div class="availability-window-list">${m.classAvailability.map(b=>`<span>${esc(b.start)}–${esc(b.end)}</span>`).join("")}</div><div><span class="choice-label">Start time</span><div class="time-blocks">${starts.map(t=>`<button type="button" data-class-start="${t}" class="time-choice ${m.startTime===t?"selected":""}" onclick="chooseClassStart('${t}')">${t}</button>`).join("")||'<span class="small">No start time can fit the selected duration.</span>'}</div></div><p class="class-selected-time">Selected: <strong id="classTimeSummary">${m.startTime?`${esc(m.startTime)}–${esc(endTime)}`:"Choose a start time"}</strong></p>`:`<div class="notice">No available class time on this date.</div>`}</section>`}
 <input type="hidden" id="classStartTimeBtn" data-value="${esc(m.startTime||'')}"><input type="hidden" id="classEndTimeBtn" data-value="${esc(endTime||m.endTime||'')}">
 <div class="form-grid"><label>Price (KES)<input id="classPrice" type="number" min="0" value="${esc(m.price||'7500')}" onchange="state.scheduleModal.price=this.value"></label><label>Places<input id="classCapacity" type="number" min="1" max="100" value="${esc(m.capacity||'12')}" onchange="state.scheduleModal.capacity=this.value"></label></div>
 <div class="form-grid"><label>Minimum age (months)<input id="classMinAge" type="number" min="0" step="1" placeholder="3" value="${esc(m.minAgeMonths||'')}" oninput="state.scheduleModal.minAgeMonths=this.value"></label><label>Maximum age (months)<input id="classMaxAge" type="number" min="0" step="1" placeholder="12" value="${esc(m.maxAgeMonths||'')}" oninput="state.scheduleModal.maxAgeMonths=this.value"></label></div><p class="small">Age is checked from each dog’s date of birth on the course start date.</p>
 <div class="notice">The first date only shows start times that can fit the selected duration. Every future course date is checked again when you save.</div>
 <div class="actions"><button class="secondary" onclick="state.scheduleModal=null;render()">Cancel</button><button class="primary" onclick="submitClassModal()">${m.editId?"Save course changes":"Create course"}</button></div></div></div>`;
}



async function openTrainerBooking(id){
 const fromCalendar=(state.trainerCalendar?.bookings||[]).find(x=>Number(x.id)===Number(id));
 const fromAttention=(state.trainer?.cancellationAttention||[]).find(x=>Number(x.id)===Number(id));
 const raw=fromAttention||fromCalendar;if(!raw)return appAlert("This appointment could not be opened.");
 const b=fromAttention?{...fromCalendar,...raw,client:raw.client_name||fromCalendar?.client}:raw;
 state.trainerBooking=b;
 state.trainerClient=b.user_id?await api(`/api/trainer/client/${b.user_id}`):null;
 render();
}

async function openClassFromAgenda(classId){await openTrainerAdmin("classes");if(classId)state.selectedClassAdmin=Number(classId);render()}
function closeTrainerBooking(){state.trainerBooking=null;state.trainerClient=null;render()}
function trainerBookingModal(){const b=state.trainerBooking,c=state.trainerClient;if(!b)return '';const dog=c?.pets?.find(p=>p.id===b.pet_id);return `<div class="modal-overlay"><div class="trainer-modal trainer-booking-detail-modal"><button class="close-btn modal-close" aria-label="Close appointment" onclick="closeTrainerBooking()">×</button><div class="eyebrow">Appointment</div><h2>${esc(dog?.name||b.pet_name||'Dog')}</h2><p><strong>${esc(b.client)}</strong> · ${esc(b.client_phone||'')}</p><p>${fmt(b.start_at)} · <b class="home-label">${b.location_type==='home'?'HOME VISIT':'AMY’S ARENA'}</b></p>${b.location_type==='home'?`<p class="home-address">${esc(b.address||'Address not recorded')}</p>`:''}<div class="modal-grid trainer-booking-detail-grid"><div><h3>Dog profile</h3>${dog?`<div class="profile-mini">${dog.photo_url?`<img src="${dog.photo_url}" alt="">`:''}<div><b>${esc(dog.name)}</b><span>${esc(dog.breed||'Dog')} · ${esc(dog.age||'Age not added')}</span><span>Vaccination: ${dog.vaccination_status==='verified'?'Verified ✓':`${dog.vaccination_count||0} page(s) · ${dog.vaccination_status||'not provided'}`}</span></div></div><div class="actions"><button class="secondary compact-button" onclick="openVaccinationReview(${dog.id})">${dog.vaccination_status==='verified'?'View / undo verification':'Review vaccination'}</button></div>`:''}<h3>Client</h3><p>${esc(c?.user?.email||b.client_email||'')}</p></div><div><h3>Training plan / note to client</h3><textarea id="trainerNote" rows="5" placeholder="Training plan, exercises, observations or next steps for the client..."></textarea><p class="small">This note is shared with the client in their portal.</p><button class="primary" onclick="saveTrainerNote(${b.user_id},${b.pet_id||'null'},${b.id})">Save note to client</button><button class="secondary" onclick="assignResourceFromAppointment()">Assign training resource</button></div></div><div class="actions trainer-booking-footer">${b.payment_status==='refund_pending'?`<span class="refund-value">Refundable value: ${money(b.refundable_amount??b.price??0)}</span><button class="secondary" onclick="decideRefund(${b.id},'full')">Full refund</button><button class="secondary" onclick="decideRefund(${b.id},'partial')">Partial refund</button><button class="secondary" onclick="decideRefund(${b.id},'credit_full')">Full credit</button><button class="secondary" onclick="decideRefund(${b.id},'credit_partial')">Partial credit</button><button class="secondary" onclick="decideRefund(${b.id},'none')">No refund / credit</button>`:(b.status!=='cancelled'?`<button class="secondary" onclick="rescheduleBooking(${b.id})">Reschedule</button><button class="danger" onclick="cancelBooking(${b.id})">Cancel booking</button>`:"")}<button class="primary" onclick="closeTrainerBooking()">Close</button></div></div></div>`}

async function saveTrainerNote(userId,petId,bookingId){
 const note=document.getElementById('trainerNote')?.value.trim();if(!note)return appAlert('Please enter a note.');
 await api('/api/trainer/notes',{method:'POST',body:JSON.stringify({userId,petId,bookingId,note,clientVisible:true})});
 document.getElementById('trainerNote').value='';
 appAlert('Training plan / note saved and shared with the client.');
}

async function rescheduleBooking(id){
 const b=state.trainerBooking;if(!b)return;
 state.scheduleModal={
   mode:"trainer-reschedule",
   bookingId:id,
   booking:b,
   date:String(b.start_at||"").slice(0,10),
   slots:[],
   selected:null,
   availabilityMessage:""
 };
 render();
 await loadTrainerRescheduleSlots();
}

async function decideRefund(id,decision){
 const candidates=[...(state.trainerCalendar?.bookings||[]),...(state.trainer?.cancellationAttention||[])],b=candidates.find(x=>Number(x.id)===Number(id))||state.trainerBooking||{},fullAmount=Math.max(0,Number(b.refundable_amount??b.price??0));
 if(decision==="none"){if(!await appConfirm("Record no refund and no client credit for this cancelled booking?","No refund / credit"))return;try{await api(`/api/trainer/bookings/${id}/refund`,{method:"POST",body:JSON.stringify({decision:"none"})});state.trainer=await api("/api/trainer/summary");state.trainerBooking=null;render();await appAlert("No-refund / no-credit decision recorded.")}catch(e){appAlert(e.message)}return}
 const credit=decision.startsWith("credit_"),full=decision==="full"||decision==="credit_full";let amount=fullAmount;
 if(!full){const entered=await appPrompt(`${credit?"Client credit":"Refund"} amount in KES:`,String(fullAmount),credit?"Partial client credit":"Partial refund");if(entered===null)return;amount=Number(entered)}
 if(!Number.isFinite(amount)||amount<=0)return appAlert("Enter a valid amount.");
 if(credit){if(!await appConfirm(`${full?"Full":"Partial"} client credit of ${money(amount)} will be added to the client's account. No refund payment will be made.`,"Add client credit"))return;try{const d=await api(`/api/trainer/bookings/${id}/refund`,{method:"POST",body:JSON.stringify({decision,amount,note:b.client_visible_note||b.notes||""})});state.trainer=await api("/api/trainer/summary");state.trainerBooking=null;render();await appAlert(`${full?"Full":"Partial"} client credit recorded: ${money(d.amount||amount)}.`)}catch(e){appAlert(e.message)}return}
 state.privateRefundEntry={id,decision,fullAmount,amount:full?fullAmount:amount,code:""};render();
}
function privateRefundEntryModal(){
 const m=state.privateRefundEntry;if(!m)return "";
 const partial=m.decision==="partial";
 return `<div class="modal-overlay"><div class="trainer-modal class-refund-entry"><button class="close-btn modal-close" onclick="state.privateRefundEntry=null;render()">×</button><div class="eyebrow">Private training refund</div><h2>${partial?"Partial":"Full"} M-Pesa refund</h2>${partial?`<label>Refund amount (KES)<input id="privateRefundAmount" type="number" min="1" max="${m.fullAmount}" value="${esc(m.amount||"")}"></label>`:`<p>Refund amount: <b>${money(m.fullAmount)}</b></p>`}<label>M-Pesa refund reference<input id="privateRefundCode" maxlength="10" inputmode="text" autocapitalize="characters" value="${esc(m.code||"")}" oninput="this.value=this.value.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,10);state.privateRefundEntry.code=this.value" placeholder="10 characters"></label><p class="small">10-character alphanumeric M-Pesa reference. Letters are shown in capitals.</p><div class="actions"><button class="secondary" onclick="state.privateRefundEntry=null;render()">Cancel</button><button class="primary" onclick="submitPrivateRefundEntry()">Save refund</button></div></div></div>`;
}
async function submitPrivateRefundEntry(){
 const m=state.privateRefundEntry;if(!m)return;const code=String(document.getElementById("privateRefundCode")?.value||"").replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,10);
 if(!/^[A-Z0-9]{10}$/.test(code))return appAlert("Enter the full 10-character M-Pesa refund confirmation reference.");
 const amount=m.decision==="full"?Number(m.fullAmount):Number(document.getElementById("privateRefundAmount")?.value);
 if(!Number.isFinite(amount)||amount<=0||amount>Number(m.fullAmount))return appAlert("Enter a valid refund amount.");
 try{await api(`/api/trainer/bookings/${m.id}/refund`,{method:"POST",body:JSON.stringify({decision:m.decision,amount,confirmationCode:code})});state.privateRefundEntry=null;state.trainer=await api("/api/trainer/summary");state.trainerBooking=null;render();await appAlert(`${m.decision==="full"?"Full":"Partial"} refund recorded: ${money(amount)} · M-Pesa ${code}`)}catch(e){appAlert(e.message)}
}


async function cancelBooking(id){if(!await appConfirm('Cancel this booking? A paid booking will become refund pending for Amy to decide.'))return;await api(`/api/trainer/bookings/${id}/cancel`,{method:'POST',body:JSON.stringify({reason:'Cancelled by Amy'})});await loadTrainerCalendar(new Date(`${state.trainerWeekStart}T12:00:00`));closeTrainerBooking()}

function selectClass(id){state.selectedClass=state.classes.find(c=>c.id===id);state.selectedPet=null;render()}
function joinPortal(){portal()}
/* cleanup: overridden accountView declaration removed */
async function changePassword(){const a=document.getElementById('currentPassword').value,b=document.getElementById('newPassword').value,c=document.getElementById('confirmPassword').value;if(b!==c)return appAlert('The new passwords do not match.');try{await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:a,newPassword:b})});appAlert('Password changed successfully.');state.accountOpen=false;go(state.user?.role==='trainer'?'trainer':'portal')}catch(e){appAlert(e.message)}}

// ===== v21.8.0 booking, payments, reporting and client communication =====
function arenaClientLabel(){return "Amy's Arena in Ridgeways"}
function bookingPolicyText(){
 return `<div class="policy-copy terms-copy"><p>If your plans change, please give Amy as much notice as possible.</p><ol class="policy-list policy-list-spaced"><li><b>Cancellations</b><p>Cancellations made less than 36 hours before an appointment may be charged in full. Amy is no monster, real emergencies will be handled with due consideration.</p></li><li><b>Rescheduling</b><p>Rescheduling requests are subject to Amy's approval and can be made no less than 26 hours prior to a booked session.</p><p>A maximum of three approved client-requested reschedules is allowed per booking or package. After this, any further changes are handled manually and at Amy's discretion.</p></li><li><b>Trainer-created bookings</b><p>Appointments and Packages created by Amy are held for 24 hours pending client confirmation and payment.</p></li></ol><p>By confirming a booking, you agree to The Custom Made Canine's Booking Terms & Cancellation Policy.</p></div>`;
}

function bookingTermsModal(){if(!state.bookingTermsOpen)return "";return `<div class="modal-overlay"><div class="trainer-modal policy-modal"><button class="close-btn modal-close" onclick="state.bookingTermsOpen=false;render()">×</button><div class="eyebrow">Before you confirm</div><h2>Booking Terms & Cancellation Policy</h2>${bookingPolicyText()}<div class="actions"><button class="primary" onclick="state.bookingTermsOpen=false;render()">Close</button></div></div></div>`}
function privateBookingSentence(){
 if(!state.selectedService||!state.selectedLocation||!state.selectedDate||!state.selectedSlot)return "";
 const svc=privateServiceLabel(state.selectedService),place=state.selectedLocation==="arena"?arenaClientLabel():"your home",date=displayDate(state.selectedDate,{weekday:"long",day:"numeric",month:"long",year:"numeric"}),time=String(state.selectedSlot.start).slice(11,16);
 return `Thank you for starting your booking. You have selected One-on-One training — <b>${esc(svc)}</b> at <b>${esc(place)}</b> on <b>${esc(date)}</b> at <b>${esc(time)}</b>. In the next step, you'll be asked to create an account for you and your dog if you haven't already.`;
}

function finalPrivateSummary(){if(!state.user||!state.selectedPet||!state.selectedSlot)return "";const dog=state.profile?.pets?.find(p=>Number(p.id)===Number(state.selectedPet))?.name||'your dog';const svc=privateServiceLabel(state.selectedService),place=state.selectedLocation==='arena'?arenaClientLabel():'your home',date=displayDate(state.selectedDate,{weekday:'long',day:'numeric',month:'long',year:'numeric'}),time=String(state.selectedSlot.start).slice(11,16);return `<div class="booking-final-summary"><p>You have selected <b>${esc(dog)}</b> for <b>${esc(svc)}</b> at <b>${esc(place)}</b> on <b>${esc(date)}</b> at <b>${esc(time)}</b>. Please click <b>CONFIRM & PAY</b> to complete your booking.</p><p class="small">If you need to cancel or request a different appointment, please do so as early as possible. Cancellations less than 36 hours ahead of your appointment may be charged in full. Rescheduling is handled at Amy's discretion.</p><label class="terms-check"><input id="bookingTermsAccepted" type="checkbox" ${state.privateTermsAccepted?"checked":""} onchange="state.privateTermsAccepted=this.checked;updatePrivateContinueState()"> I have read and agree to <button type="button" class="text-button inline-policy" onclick="state.bookingTermsOpen=true;render()">The Custom Made Canine's Booking Terms & Cancellation Policy</button>.</label></div>`}
function privateView(){return `<section class="screen"><button class="back" onclick="go(bookingBackView())">← Back</button><div class="two-col"><div><h2>Private Training</h2><p class="page-subtitle">One-on-One training at home or at Amy’s arena</p><div class="card-grid">${serviceCard('consultation','Initial consultation','90 minutes · KES 5,000')}${serviceCard('standard','Training session','60 minutes · KES 4,000')}${serviceCard('extra','Training + extra time','90 minutes · KES 6,000')}</div><h3 style="margin-top:14px">Where?</h3><div class="actions" style="margin-top:5px"><button class="${state.selectedLocation==='arena'?'primary':'secondary'}" onclick="pickLocation('arena')">Amy's Arena</button><button class="${state.selectedLocation==='home'?'primary':'secondary'}" onclick="pickLocation('home')">At my home</button></div>${state.selectedLocation==='home'?`<label style="margin-top:12px">Home address<input id="address" value="${esc(state.address||'')}" placeholder="Estate, road, Nairobi" oninput="state.address=this.value;updatePrivateContinueState()"></label>`:''}<label style="margin-top:12px">Date<input type="date" id="privateDate" value="${state.selectedDate||''}" min="${earliestPrivateDate()}" aria-describedby="dateHelp"></label><div class="actions" style="margin-top:8px"><button type="button" class="secondary" onclick="checkAvailability()">Check available times</button></div><p id="dateHelp" class="small">The earliest appointment is tomorrow. Choose a date, then select Check available times. You can check availability before signing in.</p></div><div class="panel"><h2>Choose a time</h2>${state.selectedDayStatus?.restrictionMessage?`<div class="notice service-client-message">${esc(state.selectedDayStatus.restrictionMessage)}</div>`:''}${state.slots.length?`<div class="time-grid">${state.slots.map(s=>`<button class="time ${state.selectedSlot?.start===s.start?'selected':''}" onclick='selectSlot(${JSON.stringify(s)})'>${String(s.start).slice(11,16)}${s.travelMinutes?`<small><br>${s.travelMinutes} min travel</small>`:''}</button>`).join('')}</div>`:`<div class="center"><p>${state.selectedService&&state.selectedLocation&&state.selectedDate?'No suitable times are available on this date.':'Choose a service, location and date.'}</p></div>`}${state.selectedSlot?(state.user?dogPicker('private'):`<div class="notice booking-start-summary">${privateBookingSentence()}</div>`):''}${state.selectedSlot&&state.user?`${state.selectedLocation==='home'?`<p id="privateAddressNeeded" class="notice" ${privateAddressReady()?'hidden':''}>Add the home address above to continue.</p>`:''}${state.selectedPet?finalPrivateSummary():''}<div class="actions confirm-pay-actions"><button id="privateContinueBtn" class="primary" ${!state.selectedPet||!privateAddressReady()?'disabled':''} onclick="confirmPrivate()">CONFIRM & PAY</button></div>`:state.selectedSlot&&!state.user?`<div class="actions"><button class="primary" onclick="confirmPrivate()">Continue to account</button></div>`:''}</div></div>${bookingTermsModal()}</section>`}
function updatePrivateContinueState(){const v=document.getElementById('address')?.value||state.address||'';state.address=v;const btn=document.getElementById('privateContinueBtn'),note=document.getElementById('privateAddressNeeded');const terms=!!state.privateTermsAccepted||!!document.getElementById('bookingTermsAccepted')?.checked;if(btn)btn.disabled=!!state.user&&(!state.selectedPet||!privateAddressReady()||!terms);if(note)note.hidden=privateAddressReady()}
async function confirmPrivate(){if(!state.user)return auth('Your time is selected. Please sign in or create an account to continue to payment.');if(!state.selectedPet)return appAlert('Please select which dog this training is for.');if(!(state.privateTermsAccepted||document.getElementById('bookingTermsAccepted')?.checked))return appAlert('Please read and agree to the Booking Terms & Cancellation Policy.');const address=document.getElementById('address')?.value||state.address||'';state.address=address;if(state.selectedLocation==='home'&&!address.trim())return appAlert('Please add the home address before continuing.');try{const d=await api('/api/bookings/private',{method:'POST',body:JSON.stringify({service:state.selectedService,locationType:state.selectedLocation,address,startAt:state.selectedSlot.start,petId:state.selectedPet,termsAccepted:true})});state.confirm={...d,type:'private',service:state.selectedService,locationType:state.selectedLocation,address,startAt:state.selectedSlot.start,endAt:state.selectedSlot.end,petId:state.selectedPet};go('payment')}catch(e){if(e.paymentPending){state.confirm={...e,type:'private',service:state.selectedService,locationType:state.selectedLocation,address,startAt:state.selectedSlot.start,endAt:state.selectedSlot.end,petId:state.selectedPet,mpesaDemo:false,mpesaMessage:e.message};go('payment')}else appAlert(e.message)}}
function classDetails(){const c=state.selectedClass;const dog=state.profile?.pets?.find(p=>Number(p.id)===Number(state.selectedPet));const final=state.user&&dog?`<div class="booking-final-summary"><p>You have selected <b>${esc(dog.name)}</b> for <b>${esc(c.title)}</b>, starting on <b>${displayDate(c.start_date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</b> at <b>${esc(c.start_time)}</b>. Please click <b>CONFIRM & PAY</b> to reserve the complete course.</p><label class="terms-check"><input id="classTermsAccepted" type="checkbox" onchange="state.classTermsAccepted=this.checked;render()" ${state.classTermsAccepted?'checked':''}> I have read and agree to <button type="button" class="text-button inline-policy" onclick="state.bookingTermsOpen=true;render()">The Custom Made Canine's Booking Terms & Cancellation Policy</button>.</label></div>`:'';return `<div><div class="eyebrow">${c.sessions.length}-session course</div><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p><div class="notice">All ${c.sessions.length} sessions are included. Individual class dates cannot be changed and new clients cannot join after the course starts.</div><div class="class-age-rule">Age range at course start: ${esc(classAgeLabel(c))}</div><div class="list">${c.sessions.map((s,i)=>`<div class="kpi"><span>Class ${i+1}</span><span>${new Date(s.session_date+'T12:00:00').toLocaleDateString('en-KE',{weekday:'short',day:'numeric',month:'short'})} · ${s.start_time}–${s.end_time}</span></div>`).join('')}</div>${state.user?dogPicker('class'):`<div class="notice booking-start-summary">Thank you for starting this booking. You have selected <b>${esc(c.title)}</b>, starting on <b>${displayDate(c.start_date,{day:'numeric',month:'long',year:'numeric'})}</b> at <b>${esc(c.start_time)}</b>. In the next step you will create or sign into your account and select your dog.</div>`}${final}<div class="actions confirm-pay-actions"><button class="primary" ${state.user&&(!state.selectedPet||!state.classTermsAccepted)?'disabled':''} onclick="joinClass()">${state.user?'CONFIRM & PAY':'Continue to account'} · ${money(c.price)}</button></div>${bookingTermsModal()}</div>`}
function selectPetForBooking(id){state.selectedPet=Number(id);render()}
async function joinClass(){if(!state.user)return auth('Your place is selected. Please sign in or create an account to continue to payment.');if(!state.selectedPet)return appAlert('Please select which dog this class is for.');const box=document.getElementById('classTermsAccepted');state.classTermsAccepted=!!box?.checked;if(!state.classTermsAccepted)return appAlert('Please read and agree to the Booking Terms & Cancellation Policy.');const pet=(state.profile?.pets||[]).find(p=>p.id===state.selectedPet);if(!pet||pet.archived)return appAlert('Please select an active dog.');const eligibility=dogClassEligibility(pet,state.selectedClass);if(!eligibility.ok)return appAlert(eligibility.code==='dob'?`Please add ${pet.name}'s date of birth before joining this course.`:`${pet.name} does not meet this course's age range.`);try{const d=await api(`/api/classes/${state.selectedClass.id}/enrol`,{method:'POST',body:JSON.stringify({petId:state.selectedPet,termsAccepted:true})});state.confirm={...d,type:'class',classId:state.selectedClass.id,petId:state.selectedPet};go('payment')}catch(e){appAlert(e.message)}}


function applicationDepositCopy(){
 return `<div class="application-deposit-copy"><h3>You are starting a New Client Application</h3><p>Amy asks that you pay <b>KES 1,000</b> to start a client account as this initial phase takes a lot of her time. Of this <b>KES 1,000</b>, only <b>KES 300</b> will be non-refundable (administration fee).</p><p>The remaining <b>KES 700</b> is held pending Amy’s decision:</p><ul><li>if your application is approved, <b>KES 700</b> is added to your account as a credit which can be spent on her services</li><li>if your application is not approved, <b>KES 700</b> is refunded</li></ul><p>Paying the application deposit does not guarantee approval or a booking.</p></div>`;
}
function applicationWhatsappInput(input){
 const raw=String(input?.value||"");
 const cleaned=raw.replace(/[^0-9+ ]/g,"").replace(/(?!^)\+/g,"");
 if(input&&input.value!==cleaned)input.value=cleaned;
 const warning=document.getElementById("appWhatsappWarning");
 const digits=cleaned.replace(/\D/g,"");
 const ok=!cleaned||(/^\+?[0-9 ]+$/.test(cleaned)&&digits.length>=6&&digits.length<=18);
 const kenyan=ok?formatKenyanMpesa(cleaned):"";if(kenyan&&input)input.value=kenyan;
 if(warning){warning.textContent=ok?"":"Use numbers, spaces and a leading + only.";warning.hidden=ok}
 return ok;
}
function formatKenyanMpesa(value){
 const compact=String(value||"").replace(/\s+/g,"");
 let m=compact.match(/^0([17]\d{2})(\d{6})$/);
 if(m)return `0${m[1]} ${m[2]}`;
 m=compact.match(/^\+254([17]\d{2})(\d{6})$/);
 if(m)return `+254 ${m[1]} ${m[2]}`;
 return "";
}
function applicationMpesaInput(input){
 const raw=String(input?.value||"");
 const cleaned=raw.replace(/[^0-9+ ]/g,"").replace(/(?!^)\+/g,"");
 if(input&&input.value!==cleaned)input.value=cleaned;
 const warning=document.getElementById("appMpesaWarning");
 if(!cleaned.trim()){if(warning){warning.textContent="";warning.hidden=true}return true}
 const formatted=formatKenyanMpesa(cleaned),compact=cleaned.replace(/\s+/g,"");
 const plausible=/^(?:0[17]\d{0,8}|\+254[17]\d{0,8})$/.test(compact);
 const msg=plausible&&!formatted?"Complete the Kenyan M-Pesa number, e.g. 0722 123456 or +254 700 123456.":!formatted?"Use a Kenyan M-Pesa number beginning 07, 01, +254 7 or +254 1.":"";
 if(formatted&&input)input.value=formatted;
 if(warning){warning.textContent=msg;warning.hidden=!msg}
 return !!formatted;
}
function applicationSaveCurrentStep(){
 const step=state.applicationStep||1;
 if(step===1)applicationSaveFields({name:"appName",email:"appEmail",whatsappPhone:"appWhatsapp",mpesaPhone:"appMpesa",newsletterOptIn:"appNewsletter",location:"appLocation",introNote:"appIntro"});
 if(step===2)applicationSaveFields({dogName:"appDogName",dogBreed:"appDogBreed",dogGender:"appDogGender",dogDob:"appDogDob"});
 if(step===3)applicationSaveFields({householdDogs:"appHouseDogs",householdAdults:"appHouseAdults",children0to8:"appChild08",children9to13:"appChild913",children14plus:"appChild14",householdChanges:"appHouseChanges",householdNote:"appHouseNote"});
 if(step===4)applicationSaveFields({password:"appPassword",confirmPassword:"appConfirmPassword"});
}
function applicationSaveFields(ids){
 const d=state.applicationDraft||{};
 for(const [key,id] of Object.entries(ids)){const el=document.getElementById(id);if(el)d[key]=el.type==="checkbox"?el.checked:el.value}
 state.applicationDraft=d;
}
async function saveApplicationDraft(lastStep){
 const d=state.applicationDraft||{};
 const result=await api("/api/application-drafts/save",{method:"POST",body:JSON.stringify({...d,lastStep})});
 if(result?.draft){state.applicationDraft={...d,...result.draft,password:d.password||"",confirmPassword:d.confirmPassword||""};state.applicationDraftId=result.draft.id||null}
 return result;
}
function applicationGo(step){state.applicationStep=Math.max(1,Math.min(6,Number(step)||1));render()}
function applicationBack(){applicationSaveCurrentStep();if(state.applicationStep<=1)return go("home");if(state.applicationStep===5)return applicationGo(4);if(state.applicationStep===6)return;applicationGo(state.applicationStep-1)}
async function applicationStepOneContinue(){
 applicationSaveFields({name:"appName",email:"appEmail",whatsappPhone:"appWhatsapp",mpesaPhone:"appMpesa",newsletterOptIn:"appNewsletter",location:"appLocation",introNote:"appIntro"});
 const d=state.applicationDraft;
 if(!d.name.trim()||!d.email.trim()||!d.whatsappPhone.trim()||!d.location.trim())return appAlert("Please complete your name, email, WhatsApp number and location.");
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim()))return appAlert("Please enter a valid email address.");
 const whatsappInput=document.getElementById("appWhatsapp");if(!applicationWhatsappInput(whatsappInput))return appAlert("WhatsApp number may contain numbers, spaces and a leading + only.");d.whatsappPhone=String(whatsappInput?.value||d.whatsappPhone||"").trim();
 const mpesaInput=document.getElementById("appMpesa");if(String(mpesaInput?.value||d.mpesaPhone||"").trim()){if(!applicationMpesaInput(mpesaInput))return appAlert("Please enter a valid Kenyan M-Pesa number.");d.mpesaPhone=String(mpesaInput.value).trim()}else d.mpesaPhone="";
 if(/park\s*lands/i.test(String(d.location||""))){state.parklandsReferralOpen=true;return render()}
 try{
  const result=await saveApplicationDraft(1);
  if(result?.resumed&&Number(result.draft?.lastStep||1)>1){await appAlert("We found your unfinished application. Your saved details have been restored so you can continue where you left off.")}
  applicationGo(Math.max(2,Math.min(4,Number(result?.draft?.lastStep||1)+1)));
 }catch(e){appAlert(e.message)}
}
async function applicationDogContinue(){
 applicationSaveFields({dogName:"appDogName",dogBreed:"appDogBreed",dogGender:"appDogGender",dogDob:"appDogDob"});
 if(!state.applicationDraft.dogName.trim())return appAlert("Please add your dog's name.");
 const ack=document.getElementById("appVaccinationAck");state.applicationVaccinationAccepted=!!ack?.checked;
 if(!state.applicationVaccinationAccepted)return appAlert("Please acknowledge the Vaccination record requirements before continuing.");
 try{await saveApplicationDraft(2);applicationGo(3)}catch(e){appAlert(e.message)}
}
async function applicationHouseholdContinue(){
 applicationSaveFields({householdDogs:"appHouseDogs",householdAdults:"appHouseAdults",children0to8:"appChild08",children9to13:"appChild913",children14plus:"appChild14",householdChanges:"appHouseChanges",householdNote:"appHouseNote"});
 try{await saveApplicationDraft(3);applicationGo(4)}catch(e){appAlert(e.message)}
}
async function applicationSkipHousehold(){try{await saveApplicationDraft(3);applicationGo(4)}catch(e){appAlert(e.message)}}
function applicationFileChosen(kind,input){
 if(kind==="photo")state.applicationDogPhoto=input.files?.[0]||null;
 else state.applicationVaccinationFiles=Array.from(input.files||[]);
 const target=document.getElementById(kind==="photo"?"appDogPhotoName":"appVaccinationName");
 if(target){
   if(kind==="photo")target.textContent=state.applicationDogPhoto?.name||"No photo selected";
   else target.textContent=(state.applicationVaccinationFiles||[]).length?(state.applicationVaccinationFiles||[]).map(f=>f.name).join(", "):"No file selected";
 }
}
function parklandsReferralModal(){
 return `<div class="modal-overlay"><div class="trainer-modal parklands-modal"><button class="close-btn modal-close" onclick="state.parklandsReferralOpen=false;render()">×</button><div class="eyebrow">LOCATION</div><h2>Parklands</h2><p>Sorry, Amy does not work in this area. Please contact <b>Shels Sharma</b> on WhatsApp <b>+254 733 800495</b></p><div class="actions"><button class="secondary" onclick="state.parklandsReferralOpen=false;render()">Close</button><button class="primary" onclick="window.open('https://wa.me/254733800495','_blank')">WhatsApp Shels</button></div></div></div>`;
}
function vaccinationRequirements(){
 return `<div class="modal-overlay"><div class="trainer-modal"><button class="close-btn modal-close" onclick="state.vaccinationInfoOpen=false;render()">×</button><div class="eyebrow">Dog profile</div><h2>Vaccination record requirements</h2><p>Please upload clear photographs of your dog's vaccination record or passport pages.</p><p>These must show a valid and complete record of Parvo, DHLP and Rabies vaccination showing the vaccine sticker/batch label, date, validity/expiry, as well as your vet's stamp clearly reflecting their KVB number and signature.</p><p>Amy to be able to read the dog's details, vaccine details and dates.</p><p>You can add or replace vaccination information later from the dog's profile.</p><div class="actions"><button class="primary" onclick="state.vaccinationInfoOpen=false;render()">Close</button></div></div></div>`;
}
async function submitNewClientApplication(){
 applicationSaveFields({password:"appPassword",confirmPassword:"appConfirmPassword"});
 const d=state.applicationDraft||{};
 if(d.password!==d.confirmPassword)return appAlert("The passwords do not match.");
 if(!(String(d.password||"").length>=8&&/[A-Za-z]/.test(d.password)&&/\d/.test(d.password)))return appAlert("Please use 8 characters, including at least one letter and one number. Symbols and spaces are permitted.");
 const btn=document.getElementById("applicationCreateBtn");if(btn){btn.disabled=true;btn.textContent="Creating account…"}
 try{
  const body={name:d.name,email:d.email,whatsappPhone:d.whatsappPhone,mpesaPhone:d.mpesaPhone,password:d.password,newsletterOptIn:!!d.newsletterOptIn,applicationSignup:true,location:d.location,introNote:d.introNote,householdDogs:d.householdDogs,householdAdults:d.householdAdults,children0to8:d.children0to8,children9to13:d.children9to13,children14plus:d.children14plus,householdChanges:d.householdChanges,householdNote:d.householdNote};
  const result=await api("/api/auth/register",{method:"POST",body:JSON.stringify(body)});
  state.user=result.user;
  const fd=new FormData();fd.append("name",d.dogName);fd.append("species","Dog");fd.append("breed",d.dogBreed||"");if(d.dogGender)fd.append("gender",d.dogGender);if(d.dogDob)fd.append("dateOfBirth",d.dogDob);fd.append("createToken","application-"+Date.now());if(state.applicationDogPhoto)fd.append("dogPhoto",state.applicationDogPhoto);for(const f of state.applicationVaccinationFiles||[])fd.append("vaccinationPages",f);
  const petRes=await fetch("/api/my/pets",{method:"POST",body:fd});if(!petRes.ok){const x=await petRes.json().catch(()=>({}));throw new Error(x.error||"Your account was created, but the dog details could not be saved. Please add them from your profile.");}
  state.profile=await api("/api/my/profile");state.bookings=await api("/api/my/bookings");state.resources=await api("/api/my/resources");state.trainingNotes=await api("/api/my/training-notes");
  state.applicationCompletedName=d.name;state.applicationPayment={amount:1000};state.applicationStep=5;state.view="application";state.manualMpesaDraft="";render();
 }catch(e){appAlert(e.message);if(btn){btn.disabled=false;btn.textContent="Submit & Pay"}}
}
function applicationDepositPayment(){
 const amount=1000;
 return `<div class="application-payment"><div class="eyebrow">New Client Application</div><h2>Application deposit</h2><div class="notice"><b>Amount to pay:</b> ${money(amount)}<br><b>KES 300</b> is the non-refundable administration fee. <b>KES 700</b> is held pending Amy's decision.</div><div class="manual-payment-box paybill-payment-box"><h3>Pay with M-Pesa PayBill</h3><p>Pay manually, then enter the 10-character M-Pesa confirmation code below.</p><div class="paybill-quick-grid"><div class="paybill-qr"><img src="/mpesa-paybill-qr.jpg" alt="M-Pesa PayBill QR code for The Custom Made Canine"><small>Scan this QR code from the paybill window in the M-Pesa App on another device to autofill the details</small></div><div class="paybill-details"><div><span>PayBill</span><strong class="paybill-value">542542</strong></div><div><span>Account</span><strong class="paybill-value">727777</strong></div><div><span>Business</span><span class="business-stack"><strong>The Custom Made Canine</strong><small>Amy L Rapp</small></span></div><div><span>Amount due</span><strong class="paybill-value">${money(amount)}</strong></div></div></div><details class="paybill-instructions" open><summary>Step-by-step M-Pesa PayBill instructions</summary><ol class="manual-payment-steps paybill-step-list payment-main-steps"><li>Open the <b>M-Pesa App</b> and choose <b>Lipa na M-PESA</b></li><li>Choose <b>Pay Bill</b></li><li>Autofill the details with the QR Code provided</li></ol><div class="paybill-or">OR</div><ol class="manual-payment-steps paybill-step-list payment-manual-steps" start="3"><li>Enter PayBill number <b>542542</b><br>Account number <b>727777</b></li><li>Enter <b>${money(amount)}</b></li><li>The Account should confirm as: Amy Lynn Rapp T/A <b>Custom Made Canine Supply</b></li><li>Confirm the amount and enter your M-Pesa PIN</li><li>Wait for the success screen or M-Pesa confirmation SMS</li><li>Copy the <b>10-character M-Pesa transaction code</b> and enter it below</li><li>Click <b>Submit payment confirmation</b></li></ol></details><label>M-Pesa confirmation code<input id="applicationMpesaCode" maxlength="10" value="${esc(state.manualMpesaDraft||'')}" autocomplete="off" autocapitalize="characters" placeholder="e.g. ABC123DEFG" oninput="this.value=this.value.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,10);state.manualMpesaDraft=this.value"></label><p class="mpesa-pin-warning"><em>Never share your M-Pesa PIN details with anyone.</em></p><button id="applicationPaymentBtn" class="primary manual-submit-button" onclick="submitApplicationDeposit()">Submit payment confirmation</button></div></div>`;
}
async function submitApplicationDeposit(){
 const input=document.getElementById("applicationMpesaCode"),code=String(input?.value||state.manualMpesaDraft||"").replace(/\s+/g,"").toUpperCase();
 state.manualMpesaDraft=code;if(input)input.value=code;
 if(!/^[A-Z0-9]{10}$/.test(code))return appAlert("Enter the full 10-character M-Pesa confirmation reference.");
 const btn=document.getElementById("applicationPaymentBtn");if(btn){btn.disabled=true;btn.textContent="Submitting…"}
 try{
  await api("/api/my/application-deposit/manual-payment",{method:"POST",body:JSON.stringify({confirmationCode:code,amount:1000})});
  state.profile=await api("/api/my/profile");state.manualMpesaDraft="";state.applicationDraft=null;state.applicationDogPhoto=null;state.applicationVaccinationFiles=[];state.applicationVaccinationAccepted=false;state.applicationPayment=null;state.applicationStep=6;render();
 }catch(e){appAlert(e.message);if(btn){btn.disabled=false;btn.textContent="Submit payment confirmation"}}
}
function resumeApplicationDeposit(){
 state.applicationCompletedName=state.user?.name||state.profile?.user?.name||"";state.applicationStep=5;state.view="application";state.manualMpesaDraft="";render();
}

function applicationView(){
 const d=state.applicationDraft||{},step=state.applicationStep||1;
 const progress=`<div class="application-progress" aria-label="Application progress"><span class="${step>=1?"active":""}">1 Your details</span><span class="${step>=2?"active":""}">2 Dog details</span><span class="${step>=3?"active":""}">3 Household</span><span class="${step>=4?"active":""}">4 Confirm</span><span class="${step>=5?"active":""}">5 Pay</span></div>`;
 let body="";
 if(step===1)body=`${applicationDepositCopy()}<div class="application-form aligned-form"><div class="form-row"><label for="appName">Name</label><input id="appName" value="${esc(d.name||"")}" autocomplete="name"></div><div class="form-row"><label for="appEmail">Email</label><input id="appEmail" type="email" value="${esc(d.email||"")}" autocomplete="email"></div><div class="form-row"><label>Phone numbers</label><div class="paired-fields application-phone-fields"><div><input id="appWhatsapp" value="${esc(d.whatsappPhone||"")}" placeholder="WhatsApp Number" autocomplete="tel" inputmode="tel" oninput="applicationWhatsappInput(this)"><small id="appWhatsappWarning" class="field-warning" hidden></small></div><div><input id="appMpesa" value="${esc(d.mpesaPhone||"")}" placeholder="M-Pesa number (if different)" autocomplete="tel" inputmode="tel" oninput="applicationMpesaInput(this)" onblur="applicationMpesaInput(this)"><small id="appMpesaWarning" class="field-warning" hidden></small><small class="field-example">Examples: 0722 123456 or +254 700 123456</small></div></div></div><div class="form-row"><label for="appLocation">Location</label><input id="appLocation" value="${esc(d.location||"")}" placeholder="Area / neighbourhood"></div><div class="form-row checkbox-form-row"><label for="appNewsletter">Newsletter</label><label class="check-row"><input id="appNewsletter" type="checkbox" ${d.newsletterOptIn?"checked":""}> Yes, keep me updated</label></div><div class="form-row textarea-row"><label for="appIntro">Note for Amy</label><div><textarea id="appIntro" rows="4" placeholder="Please introduce yourself, and briefly describe your training needs ie potty training, basic obedience, advanced training">${esc(d.introNote||"")}</textarea></div></div></div><p class="application-save-note">By continuing, your contact details may be saved so Amy can assist with your application if needed.</p><div class="application-nav safe-nav"><button class="back-dashboard application-nav-back" tabindex="-1" onclick="applicationBack()">← Back</button><button id="applicationStepOneContinue" class="primary" onclick="applicationStepOneContinue()">Continue to dog details</button></div>`;
 if(step===2)body=`<div class="application-dog-card"><div class="application-card-head"><div><div class="eyebrow">Dog details</div><h2>Your dog</h2><p>You will be able to add more dogs to your profile later.</p></div></div><div class="application-form aligned-form"><div class="form-row"><label for="appDogName">Dog name</label><input id="appDogName" value="${esc(d.dogName||"")}"></div><div class="form-row"><label for="appDogBreed">Breed</label><input id="appDogBreed" value="${esc(d.dogBreed||"")}"></div><div class="form-row"><label for="appDogGender">Sex</label><select id="appDogGender"><option value="">Choose</option><option value="male" ${d.dogGender==="male"?"selected":""}>Male</option><option value="female" ${d.dogGender==="female"?"selected":""}>Female</option></select></div><div class="form-row"><label for="appDogDob">Date of birth</label><input id="appDogDob" type="date" value="${esc(d.dogDob||"")}"></div><div class="form-row"><label>Dog photo</label><div class="application-file-field"><label class="secondary compact-button file-picker-button" for="appDogPhoto">Choose photo</label><input class="visually-hidden-file" id="appDogPhoto" type="file" accept="image/jpeg,image/png,image/webp" onchange="applicationFileChosen('photo',this)"><span id="appDogPhotoName" class="selected-file-name">${state.applicationDogPhoto?esc(state.applicationDogPhoto.name):"No photo selected"}</span></div></div><div class="form-row vaccination-signup-row"><label>Vaccination record</label><div class="vaccination-signup-content"><h3>Vaccination record requirements</h3><p>Please upload clear photographs of your dog's vaccination record or passport pages.</p><p>These must show a valid and complete record of Parvo, DHLP and Rabies vaccination showing the vaccine sticker/batch label, date, validity/expiry, as well as your vet's stamp clearly reflecting their KVB number and signature.</p><p>Amy to be able to read the dog's details, vaccine details and dates.</p><p>You can add or replace vaccination information later from the dog's profile.</p><label class="check-row vaccination-ack"><input id="appVaccinationAck" type="checkbox" ${state.applicationVaccinationAccepted?"checked":""}> I have read and understand the Vaccination record requirements</label><div class="application-file-field"><label class="secondary compact-button file-picker-button" for="appVaccination">Choose photo or file</label><input class="visually-hidden-file" id="appVaccination" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onchange="applicationFileChosen('vaccination',this)"><span id="appVaccinationName" class="selected-file-name">${(state.applicationVaccinationFiles||[]).length?esc((state.applicationVaccinationFiles||[]).map(f=>f.name).join(", ")):"No file selected"}</span></div></div></div></div></div><div class="application-nav safe-nav"><button class="back-dashboard application-nav-back" tabindex="-1" onclick="applicationBack()">← Back</button><button class="primary" onclick="applicationDogContinue()">Finish dog details</button></div>`;
 if(step===3)body=`<div class="application-household"><div class="eyebrow">Optional</div><h2>Household details</h2><p>These questions are optional. Leave any field blank if it does not apply.</p><div class="application-form aligned-form"><div class="form-row"><label for="appHouseDogs">Number of dogs in household</label><input id="appHouseDogs" type="number" min="0" value="${esc(d.householdDogs||"")}"></div><div class="form-row"><label for="appHouseAdults">Number of adults in household</label><input id="appHouseAdults" type="text" value="${esc(d.householdAdults||"")}" placeholder="e.g. 2 + 2 staff"></div><div class="form-row household-children"><label>Children</label><div class="child-counter-row"><label><span>0–8</span><input id="appChild08" class="small-counter" type="number" min="0" inputmode="numeric" value="${esc(d.children0to8||"")}"></label><label><span>9–13</span><input id="appChild913" class="small-counter" type="number" min="0" inputmode="numeric" value="${esc(d.children9to13||"")}"></label><label><span>14+</span><input id="appChild14" class="small-counter" type="number" min="0" inputmode="numeric" value="${esc(d.children14plus||"")}"></label></div></div><div class="form-row textarea-row"><label for="appHouseChanges">Any major changes to household recently or planned?</label><textarea id="appHouseChanges" rows="3">${esc(d.householdChanges||"")}</textarea></div><div class="form-row textarea-row"><label for="appHouseNote">Additional note for Amy</label><textarea id="appHouseNote" rows="3">${esc(d.householdNote||"")}</textarea></div></div></div><div class="application-nav safe-nav"><button class="back-dashboard application-nav-back" tabindex="-1" onclick="applicationBack()">← Back</button><button class="primary" onclick="applicationHouseholdContinue()">Continue</button></div>`;
 if(step===4)body=`<div class="application-confirm"><div class="eyebrow">Confirm & Secure</div><h2>Set your password</h2><div class="application-summary prominent-summary"><div><span>Name</span><strong>${esc(d.name||"")}</strong></div><div><span>Email</span><strong>${esc(d.email||"")}</strong></div></div><div class="application-form aligned-form confirm-password-form"><div class="form-row"><label for="appPassword">Password</label><input id="appPassword" type="${state.authShowPassword?"text":"password"}" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" data-gramm="false" data-gramm_editor="false" value="${esc(d.password||"")}"></div><div class="form-row"><label for="appConfirmPassword">Confirm password</label><input id="appConfirmPassword" type="${state.authShowPassword?"text":"password"}" autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false" data-gramm="false" data-gramm_editor="false" value="${esc(d.confirmPassword||"")}"></div><div class="form-row checkbox-form-row show-password-tight"><label>Show password</label><label class="check-row"><input type="checkbox" ${state.authShowPassword?"checked":""} onchange="state.authShowPassword=this.checked;const p=document.getElementById('appPassword'),c=document.getElementById('appConfirmPassword');if(p)p.type=this.checked?'text':'password';if(c)c.type=this.checked?'text':'password'"> Show password</label></div></div><p class="password-rule"><b>Please use 8 characters, including at least one letter and one number. Symbols and spaces are permitted.</b></p><div class="application-final-note"><b>Before you submit</b><p>Your account will remain under review until Amy confirms it. You can continue to add information and dogs after submitting, but booking will remain unavailable until approval.</p></div></div><div class="application-nav safe-nav"><button class="back-dashboard application-nav-back" tabindex="-1" onclick="applicationBack()">← Back</button><button id="applicationCreateBtn" class="primary" onclick="submitNewClientApplication()">Submit & Pay</button></div>`;
 if(step===5)body=applicationDepositPayment();
 if(step===6)body=`<div class="application-success"><div class="success-mark">✓</div><h2>Account set up</h2><p>Thank you <b>${esc(state.applicationCompletedName||"")}</b> for setting up an account. Amy will review your details as soon as she can and let you know when it is confirmed. Feel free to send Amy a WhatsApp message to let her know you have finished this step in the process.</p><p>If you would like to add anything to the information you have provided, feel free to do so at any point after submitting. When Amy approves your account more features, including the booking system, will become available on the system.</p><div class="actions application-success-actions"><button class="secondary" onclick="contactAmy()">WhatsApp Amy</button><button class="primary" onclick="state.portalTab='dogs';portal()">Continue to Client Portal</button></div></div>`;
 return `<section class="screen application-screen">${step<5?`<button class="back" tabindex="-1" onclick="applicationBack()">← ${step===1?"Home":"Back"}</button>`:""}<div class="center"><div class="application-shell">${progress}${body}</div></div>${state.vaccinationInfoOpen?vaccinationRequirements():""}${state.parklandsReferralOpen?parklandsReferralModal():""}</section>`;
}

function authView(){
 const hasBooking=!!(state.selectedService||state.selectedClass),register=state.authMode==='register',draft=state.authDraft||{};
 return `<section class="screen"><button class="back" onclick="go(state.selectedService?'private':'classes')">← Back to booking</button><div class="center"><div class="panel auth-panel">
 <div class="eyebrow">PLEASE LOG IN</div><h2>Client Portal</h2>
 ${hasBooking?`<div class="notice good saved-notice"><b>✓ Your booking choices are saved.</b><br>They will stay here while you log in or sign up.</div>`:''}
 <p class="auth-message">${esc(state.authMessage||'Please log in or sign up to access your Client Portal')}</p>
 ${state.authMode==='choice'?`<div class="auth-choice-grid">
   <button class="auth-choice" onclick="state.authShowPassword=false;state.authMode='login';render()"><strong>Log in</strong><span>I already have an account</span></button>
   <button class="auth-choice" onclick="state.authMode='register';render()"><strong>Sign up</strong><span>I'm new here</span></button>
 </div>`:`<button class="back auth-back" onclick="state.authMode='choice';render()">← Choose another option</button>
 ${register?`<label>Name<input id="authName" autocomplete="name" value="${esc(draft.name||'')}"></label><label>WhatsApp number<input id="authWhatsapp" placeholder="07… or 2547…" autocomplete="tel" value="${esc(draft.whatsappPhone||'')}"></label><label>M-Pesa number <span class="small">(if different)</span><input id="authMpesa" placeholder="Leave blank if same as WhatsApp" autocomplete="tel" value="${esc(draft.mpesaPhone||'')}"></label>`:''}
 <label>Email<input id="authEmail" type="email" autocomplete="${register?'off':'email'}" value="${esc(register?(draft.email||''):(localStorage.getItem('cmc_last_email')||''))}"></label>
 <label>Password<input id="authPassword" type="${state.authShowPassword?'text':'password'}" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="${register?'new-password':'current-password'}"></label><label class="check-row show-password-row"><input type="checkbox" ${state.authShowPassword?'checked':''} onchange="state.authShowPassword=this.checked;const p=document.getElementById('authPassword');if(p)p.type=this.checked?'text':'password'"> Show password</label>
 ${register?`<p class="password-rule"><b>Please use 8 characters, including at least one letter and one number. Symbols and spaces are permitted.</b></p><label class="newsletter-optin"><input id="authNewsletter" type="checkbox" ${draft.newsletterOptIn?'checked':''}> Please tick here if you would like to receive my newsletter, <em>The Canine Grapevine</em>, which I try to send out at least every 2 months, to keep you informed about upcoming classes, events and other news.</label>`:''}
 <div class="actions"><button id="authSubmitBtn" class="primary" onclick="submitAuth()">${register?'Create my account':'Sign in and continue'}</button></div>
 ${state.authMode==='login'?`<button class="text-button" onclick="showForgotPassword()">Forgot your password?</button>`:''}`}</div></div></section>`;
}

async function submitAuth(){
 const btn=document.getElementById('authSubmitBtn');if(btn?.disabled)return;if(btn){btn.disabled=true;btn.dataset.originalText=btn.textContent;btn.textContent=(state.authMode||'login')==='register'?'Creating account…':'Signing in…'}
 try{const body={email:document.getElementById('authEmail').value.trim(),password:document.getElementById('authPassword').value};if((state.authMode||'login')==='register'){body.name=document.getElementById('authName').value;body.whatsappPhone=document.getElementById('authWhatsapp').value;body.mpesaPhone=document.getElementById('authMpesa').value;body.newsletterOptIn=!!document.getElementById('authNewsletter').checked;state.authDraft={name:body.name,whatsappPhone:body.whatsappPhone,mpesaPhone:body.mpesaPhone,email:body.email,newsletterOptIn:body.newsletterOptIn};if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email))throw new Error("Please enter a valid email address.");if(!(body.password.length>=8&&/[A-Za-z]/.test(body.password)&&/\d/.test(body.password)))throw new Error("Please use 8 characters, including at least one letter and one number. Symbols and spaces are permitted.");}localStorage.setItem('cmc_last_email',body.email);const d=await api(`/api/auth/${(state.authMode||'login')==='register'?'register':'login'}`,{method:'POST',body:JSON.stringify(body)});state.user=d.user;if((state.authMode||'login')==='register'){state.authDraft=null;}if(state.user.role==='trainer'){
    state.authReturnToBooking=false;state.menu=false;
    // Once authentication succeeds, enter Amy's workspace even if one dashboard data request fails.
    state.view='trainer';history.replaceState({},'', '#trainer');render();
    try{state.trainer=await api('/api/trainer/summary')}catch(err){console.error('Trainer summary load failed:',err);state.trainer=state.trainer||{}}
    try{await loadTrainerCalendar(new Date())}catch(err){console.error('Trainer week calendar load failed:',err)}
    try{await loadTrainerMonth(new Date())}catch(err){console.error('Trainer month calendar load failed:',err)}
    try{state.serviceAvailability=await api('/api/trainer/service-availability')}catch(err){console.error('Trainer service availability load failed:',err)}
    render();
  }else{state.profile=await api('/api/my/profile');if(state.authReturnToBooking){state.authReturnToBooking=false;if(state.selectedClass)go('classes');else if(state.selectedService)go('private');else await portal()}else{clearBookingDraft();await portal()}}}catch(e){appAlert(e.message)}finally{const current=document.getElementById('authSubmitBtn');if(current){current.disabled=false;current.textContent=current.dataset.originalText||((state.authMode||'login')==='register'?'Create my account':'Sign in and continue')}}
}

function vaccinationHelp(){return `<div class="vaccination-explanation"><b>Vaccination record</b><p>For everyone's safety it is imperative that no unvaccinated dogs travel outside their homes. Please upload clear proof of vaccination by a licensed veterinarian showing valid <b>Parvo, DHLP and Rabies</b> vaccinations. The record should include the <b>vaccine sticker or batch label</b>, the <b>date given and validity/expiry date</b>, and be <b>signed and stamped</b> by the veterinarian with their <b>KVB number clearly visible</b>.</p><p class="small">You can upload this now or add it later from your dog's profile.</p></div>`}
function addDogModal(){const fromBooking=!!state.addPetBookingContext;return `<div class="pet-add-overlay" role="dialog" aria-modal="true"><div class="pet-add-card"><div class="pet-add-head"><div><div class="eyebrow">${fromBooking?'Booking':'Client profile'}</div><h3>${fromBooking?'Add a dog to this booking':'Add a dog'}</h3></div><button class="close-btn close-light" onclick="closeAddDogModal()">×</button></div>${fromBooking?`<p class="small booking-dog-helper">Your booking choices stay exactly as they are. After saving, this dog will be selected automatically.</p>`:''}<div class="form-grid"><label>Name<input id="petName"></label><label>Breed<input id="petBreed"></label></div><div class="form-grid dog-demographic-row"><fieldset class="dog-radio-field"><legend>Gender</legend><label class="inline-radio"><input type="radio" name="petGender" value="male"> Male</label><label class="inline-radio"><input type="radio" name="petGender" value="female"> Female</label></fieldset><label class="dog-check-field"><span>Neutered / spayed</span><span class="check-row"><input id="petNeutered" type="checkbox"> Yes</span></label></div><label>Date of birth<input id="petDob" type="date"></label><label>Behaviour notes<textarea id="petBehaviour" rows="2"></textarea></label><label>Medical procedures / history<textarea id="petMedical" rows="2"></textarea></label><label>General notes<textarea id="petNotes" rows="2"></textarea></label><label>Dog photo<input id="petPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label>${vaccinationHelp()}<label>Upload vaccination record<input id="petVaccinations" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div class="actions"><button class="secondary" onclick="closeAddDogModal()">Cancel</button><button id="saveDogBtn" class="primary" onclick="addPet()">Save dog</button></div></div></div>`}

function paymentView(){
 const p=state.profile||{},c=state.confirm||{},credit=Math.max(0,Number(c.creditAvailable??p.creditBalance??0)),amount=Math.max(0,Number(c.amount||0)),expiry=c.holdExpiresAt?`<p class="small"><b>Held until:</b> ${fmt(c.holdExpiresAt)}</p>`:'';
 const creditBox=credit>0&&amount>0?`<div class="credit-payment-option"><div><span>Credit available</span><strong>${money(credit)}</strong><small>${credit>=amount?`This can cover the full ${money(amount)} charge.`:`Apply it first; ${money(Math.max(0,amount-credit))} would remain to pay.`}</small></div><button class="primary" onclick="applyClientCredit()">Apply credit</button></div>`:"";
 const paybill=`<div class="manual-payment-box paybill-payment-box"><h3>Pay with M-Pesa PayBill</h3><p>Pay manually, then enter the 10-character M-Pesa confirmation code below. Amy will confirm the payment.</p><div class="paybill-quick-grid"><div class="paybill-qr"><img src="/mpesa-paybill-qr.jpg" alt="M-Pesa PayBill QR code for The Custom Made Canine"><small>Scan this QR code from the paybill window in the M-Pesa App on another device to autofill the details</small></div><div class="paybill-details"><div><span>PayBill</span><strong class="paybill-value">542542</strong></div><div><span>Account</span><strong class="paybill-value">727777</strong></div><div><span>Business</span><span class="business-stack"><strong>The Custom Made Canine</strong><small>Amy L Rapp</small></span></div><div><span>Amount due</span><strong class="paybill-value">${money(amount)}</strong></div></div></div><details class="paybill-instructions" open><summary>Step-by-step M-Pesa PayBill instructions</summary><ol class="manual-payment-steps paybill-step-list payment-main-steps"><li>Open the <b>Safaricom</b> <b>M-Pesa</b> app and choose <b>Lipa na M-PESA</b></li><li>Choose <b>Pay Bill</b></li><li>Autofill the details with the QR Code provided</li></ol><div class="paybill-or">OR</div><ol class="manual-payment-steps paybill-step-list payment-manual-steps" start="3"><li>Enter PayBill number <b>542542</b><br>Account number <b>727777</b></li><li>Enter <b>${money(amount)}</b></li><li>The Account should confirm as: Amy Lynn Rapp T/A <b>Custom Made Canine Supply</b></li><li>Confirm the amount and enter your M-Pesa PIN</li><li>Wait for the success screen or M-Pesa confirmation SMS</li><li>Copy the <b>10-character M-Pesa transaction code</b> and enter it below</li><li><b>Click</b> the Submit payment Confirmation</li></ol><p class="paybill-awaiting-note">The booking will show <b>Awaiting confirmation</b> until Amy confirms the details</p></details><label>M-Pesa confirmation code<input id="manualMpesaCode" maxlength="10" value="${esc(state.manualMpesaDraft||'')}" autocomplete="off" autocapitalize="characters" placeholder="e.g. ABC123DEFG" oninput="this.value=this.value.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,10);state.manualMpesaDraft=this.value"></label><p class="mpesa-pin-warning"><em>Never share your M-Pesa PIN details with anyone.</em></p><button class="primary manual-submit-button" onclick="submitManualPaymentFromPayment()">Submit payment confirmation</button></div>`;
 return `<section class="screen payment-screen"><div class="center"><div class="panel payment-panel" style="width:min(720px,100%)"><div class="eyebrow">Payment</div><h1 class="mpesa-title">M-Pesa</h1><p class="lead">${esc(c.mpesaMessage||'Pay by M-Pesa PayBill and submit your confirmation code.')}</p><div class="notice"><b>Reference:</b> ${esc(c.bookingRef)}<br><b>Amount to pay:</b> ${money(amount)}${Number(c.creditApplied||0)>0?`<br><b>Credit already applied:</b> ${money(c.creditApplied)}`:""}${expiry}</div>${creditBox}${paybill}<div class="actions payment-exit-actions"><button class="secondary" onclick="state.portalTab='bookings';portal()">Return to Client Portal</button></div></div></div></section>`;
}


async function startPaymentFromPayment(){
 const c=state.confirm;
 if(c?.type==="class"){
   if(!c.bookingRef)return appAlert("Open the pending class from your Client Portal to continue payment.");
   try{
     const d=await api(`/api/my/classes/${encodeURIComponent(c.bookingRef)}/resume-payment`,{method:"POST",body:"{}"});
     if(d.settled){state.completedBooking={...c,...d,type:"class"};state.profile=await api("/api/my/profile");return go("confirmation")}
     state.confirm={...c,...d,type:"class",paymentStartRequired:false};render();
   }catch(e){appAlert(e.message)}
   return;
 }
 if(!c?.id)return appAlert("Open the pending booking from your Client Portal to continue payment.");
 try{
  const d=await api(`/api/my/bookings/${c.id}/resume-payment`,{method:"POST",body:"{}"});
  if(d.settled){state.completedBooking={...c,...d};state.profile=await api("/api/my/profile");return go("confirmation")}
  state.confirm={...c,...d,paymentStartRequired:false};render();
 }catch(e){
  if(e.paymentPending){state.confirm={...c,...e,paymentStartRequired:false};render()}
  else appAlert(e.message);
 }
}
async function applyClientCredit(){
 const c=state.confirm;if(!c)return;
 try{
  const d=await api("/api/my/payments/apply-credit",{method:"POST",body:JSON.stringify({type:c.type||"private",id:c.id,packageId:c.packageId,bookingRef:c.bookingRef})});
  state.profile=await api("/api/my/profile");
  state.confirm={...c,creditAvailable:d.creditBalance,creditApplied:Number(c.creditApplied||0)+Number(d.applied||0),amount:d.remaining};
  if(d.settled){
   state.completedBooking={...state.confirm,amount:0,paymentMethod:"credit"};
   return go("confirmation");
  }
  render();
  await appAlert(`${money(d.applied)} credit applied. ${money(d.remaining)} remains to pay.`);
  await startPaymentFromPayment();
 }catch(e){appAlert(e.message)}
}

async function submitManualPaymentFromPayment(){
 const c=state.confirm;if(!c?.bookingRef)return appAlert('Open this pending payment from your Client Portal to submit manual payment.');
 const input=document.getElementById('manualMpesaCode'),code=(input?.value||state.manualMpesaDraft||'').replace(/\s+/g,'').toUpperCase();state.manualMpesaDraft=code;if(input)input.value=code;const amount=Math.max(0,Number(c.amount||0));
 if(!/^[A-Z0-9]{10}$/.test(code))return appAlert('Enter the full 10-character M-Pesa confirmation reference.');if(!Number.isFinite(amount)||amount<=0)return appAlert('There is no payment amount due.');
 try{const url=c.type==='class'?`/api/my/classes/${encodeURIComponent(c.bookingRef)}/manual-payment`:`/api/my/bookings/${c.id}/manual-payment`;await api(url,{method:'POST',body:JSON.stringify({confirmationCode:code,amount})});state.manualMpesaDraft="";await appAlert('Thank you. Your M-Pesa reference has been submitted. Your booking has been recorded and is awaiting confirmation by Amy.');state.portalTab='bookings';await portal()}catch(e){if(input)input.value=state.manualMpesaDraft||code;appAlert(e.message)}
}

async function demoPay(){
 const c=state.confirm;
 if(c.type==='package'&&c.packageId)await api(`/api/bookings/package/${c.packageId}/demo-pay`,{method:'POST'});
 else await api(`/api/${c.type==='private'?'bookings':'classes'}/${c.bookingRef}/demo-pay`,{method:'POST'});
 state.completedBooking={...c,firstAppointment:c.firstAppointment===true};
 state.selectedService=null;state.selectedLocation=null;state.selectedDate=null;state.slots=[];state.selectedSlot=null;state.selectedClass=null;state.address='';state.privateTermsAccepted=false;state.classTermsAccepted=false;
 state.profile=await api('/api/my/profile');
 go('confirmation');
}

function confirmationView(){
 const c=state.completedBooking||state.confirm||{},isClass=c.type==='class',title=isClass?(state.selectedClass?.title||'Class course'):c.type==='package'?'Private training package':privateServiceLabel(c.service),dog=state.profile?.pets?.find(p=>p.id===(c.petId||state.selectedPet))?.name;
 return `<section class="screen"><div class="center"><div style="max-width:700px"><div class="eyebrow">Booking confirmed</div><h1>You're booked.</h1><p class="lead">${esc(title)}${dog?` · ${esc(dog)}`:''}</p><div class="notice good"><b>Payment complete.</b><br>${c.paymentMethod==="credit"?"Your account credit was applied.":c.creditApplied?`${money(c.creditApplied)} account credit was applied; the remaining payment is complete.`:"Payment received."}<br>Keep your booking reference <b>${esc(c.bookingRef)}</b>.</div>${c.firstAppointment!==false?`<div class="notice vaccination-reminder"><b>Please bring your original vaccination record with you to your first appointment.</b></div>`:""}<div class="actions confirmation-actions"><button class="primary" onclick="state.portalTab='bookings';portal()">Back home</button></div></div></div></section>`;
}

function pendingBookingActions(x){
 if(x.payment_status!=='pending'||['cancelled','expired'].includes(x.status))return '';
 if(x.manual_payment_status==='submitted')return `<div class="notice">Awaiting confirmation by Amy. Your booking has been recorded.</div>`;
 if(x.status==='provisional')return `<div class="notice">Amy has proposed this ${x.package_id?'training package':'appointment'}. The ${x.package_id?'package':'time'} is held until ${x.hold_expires_at?fmt(x.hold_expires_at):'the hold expires'}.</div><div class="actions"><button class="primary compact-button" onclick="acceptProvisional(${x.id})">Accept ${x.package_id?'package':'booking'} and pay</button><button class="secondary compact-button" onclick="declineProvisional(${x.id})">Do not accept ${x.package_id?'package':'booking'}</button></div>`;
 return `<div class="notice">Awaiting payment${x.hold_expires_at?` — slot held until ${fmt(x.hold_expires_at)}`:''}.</div><div class="actions"><button class="primary compact-button" onclick="resumePendingPayment(${x.id})">Resume payment</button><button class="danger compact-button" onclick="cancelPendingBooking(${x.id})">Cancel booking</button></div>`;
}

function bookingRescheduleNote(b,bookingId){
 const list=Array.isArray(b?.rescheduleRequests)?b.rescheduleRequests.filter(r=>Number(r.booking_id)===Number(bookingId)):[];
 if(!list.length)return "";const r=list[0],status=r.status==="pending"?"Awaiting Amy's decision":r.status==="approved"?"Approved":r.status==="declined"?"Declined":esc(r.status||"");
 return `<div class="notice reschedule-note"><b>Reschedule: ${status}</b>${r.client_note?`<br>Your note: ${esc(r.client_note)}`:""}${r.trainer_note?`<br>Amy's note: ${esc(r.trainer_note)}`:""}</div>`;
}
function bookingIsInactive(x,type){const today=nairobiDateKeyClient(0);if(type==="class")return x.enrolment_status!=="active"||String(x.end_date||"")<today;return ["cancelled","expired"].includes(x.status)||String(x.start_at||"").slice(0,10)<today}
function bookingNeedsAttention(x,type){if(type==="class")return x.payment_status==="pending"||x.payment_status==="refund_pending"||x.manual_payment_status==="submitted";return ["provisional","pending_payment"].includes(x.status)||x.payment_status==="pending"||x.payment_status==="refund_pending"||x.manual_payment_status==="submitted"}
function bookingsView(b){
 const privateRows=Array.isArray(b?.privateBookings)?b.privateBookings:[],classRows=Array.isArray(b?.classBookings)?b.classBookings:[],packages=Array.isArray(b?.packages)?b.packages:[];if(!state.bookingHistoryMode)state.bookingHistoryMode="upcoming";const showAll=state.bookingHistoryMode==="all",grouped=new Set(),cards=[];
 for(const p of packages){const sessions=privateRows.filter(x=>Number(x.package_id)===Number(p.id)).sort((x,y)=>String(x.start_at).localeCompare(String(y.start_at)));if(!sessions.length)continue;grouped.add(Number(p.id));const inactive=sessions.every(x=>bookingIsInactive(x,"private"))||["cancelled","expired"].includes(p.status),provisional=p.status==="provisional"&&p.payment_status==="pending",awaiting=provisional||sessions.some(x=>bookingNeedsAttention(x,"private")),declined=p.status==="cancelled"&&sessions.every(x=>x.status==="cancelled");if(inactive&&!showAll&&!awaiting)continue;const first=sessions[0];const packageActions=provisional?`<div class="notice">This training package was proposed for you and is being held for 24 hours.</div><div class="actions"><button class="primary compact-button" onclick="acceptProvisional(${first.id})">Confirm & Pay</button><button class="secondary compact-button" onclick="declineProvisional(${first.id})">Refuse booking</button></div>`:declined?`<div class="notice">Package refused. All held appointment times were released.</div>`:pendingBookingActions(first);cards.push({priority:awaiting?0:inactive?2:1,date:first?.start_at||p.created_at||"",html:`<div class="card ${inactive?"inactive-booking":""} ${awaiting?"provisional-card":""}"><h3>${awaiting?"Action required · ":""}${esc(p.name||"Private training package")} · ${esc(p.pet_name||first?.pet_name||"Dog")}</h3><p>${sessions.length} appointments · ${money(p.package_price||0)} total</p><details><summary>Show session dates</summary><div class="compact-list">${sessions.map(y=>`<div class="package-session-row"><span>${fmt(y.start_at)} · ${y.location_type==="home"?"Home visit":arenaClientLabel()}</span>${!bookingIsInactive(y,"private")&&['paid','demo_paid','credit_paid'].includes(y.payment_status)?`<span class="package-session-actions"><button class="secondary compact-button" onclick="clientReschedule(${y.id})">Reschedule</button><button class="danger compact-button" onclick="clientCancel(${y.id})">Cancel session</button></span>`:""}</div>`).join("")}</div></details>${packageActions}</div>`})}
 for(const x of privateRows){if(x.package_id&&grouped.has(Number(x.package_id)))continue;const inactive=bookingIsInactive(x,"private"),awaiting=bookingNeedsAttention(x,"private");if(inactive&&!showAll&&!awaiting)continue;cards.push({priority:awaiting?0:inactive?2:1,date:x.start_at||"",html:`<div class="card ${inactive?"inactive-booking":""} ${['provisional','pending_payment'].includes(x.status)?'provisional-card':''}"><h3>${awaiting?"Action required · ":""}${x.package_name?`${esc(x.package_name)} · `:""}Private training · ${esc(x.pet_name||'Dog')}</h3><p>${fmt(x.start_at)} · ${x.location_type==='home'?'Home visit':arenaClientLabel()}</p><p>${esc(x.booking_ref)} · ${x.status==='expired'?'Expired':x.manual_payment_status==='submitted'?'Awaiting confirmation':x.payment_status==='pending'?'Awaiting payment':esc(x.payment_status)}${x.status==='cancelled'?' · Cancelled':''}</p>${pendingBookingActions(x)}${["refund_partial","refunded"].includes(x.payment_status)?`<div class="notice good">${x.payment_status==="refund_partial"?"Partial refund":"Refund"}: ${money(x.refund_amount||0)}${x.refund_confirmation_code?` · M-Pesa ${esc(x.refund_confirmation_code)}`:""}</div>`:""}${["credit_partial","credited"].includes(x.payment_status)?`<div class="notice good">${x.payment_status==="credit_partial"?"Partial client credit":"Client credit"}: ${money(x.credit_amount||0)} added to your account.</div>`:""}${bookingRescheduleNote(b,x.id)}${['paid','demo_paid','credit_paid'].includes(x.payment_status)&&!bookingIsInactive(x,'private')?`<div class="actions"><button class="secondary compact-button" onclick="addPrivateCalendarByRef('${esc(x.booking_ref)}')">＋ Add to calendar</button><button class="secondary compact-button" onclick="clientReschedule(${x.id})">Request reschedule · ${Math.max(0,3-Number(x.reschedule_count||0))} left</button><button class="danger compact-button" onclick="clientCancel(${x.id})">Cancel</button></div>`:''}</div>`})}
 for(const x of classRows){const inactive=bookingIsInactive(x,"class"),awaiting=bookingNeedsAttention(x,"class"),manualSubmitted=x.manual_payment_status==="submitted";if(inactive&&!showAll&&!awaiting)continue;const active=x.enrolment_status==="active";const actions=active&&!inactive&&['paid','demo_paid','credit_paid'].includes(x.payment_status)?`<div class="actions"><button class="secondary compact-button" onclick="addClassCalendarByRef('${esc(x.booking_ref)}')">＋ Add all classes to calendar</button><button class="danger compact-button" onclick="clientCancelClass(${x.id})">Cancel course enrolment</button></div>`:"";cards.push({priority:awaiting?0:inactive?2:1,date:x.start_date||"",html:`<div class="card ${inactive?"inactive-booking inactive-class-card":""}"><h3>${awaiting?"Action required · ":""}${esc(x.title)} · ${esc(x.pet_name||'Dog')}</h3><p>${displayDate(x.start_date,{day:'numeric',month:'short',year:'numeric'})}–${displayDate(x.end_date,{day:'numeric',month:'short',year:'numeric'})}</p><p>${esc(x.booking_ref)} · ${manualSubmitted?"Payment submitted":x.payment_status==="no_refund"?"No refund or credit":esc(x.payment_status)}</p>${manualSubmitted?`<div class="notice good">M-Pesa reference submitted — awaiting Amy's payment verification.${x.hold_expires_at?` Your place remains held until ${fmt(x.hold_expires_at)}.`:""}</div>`:x.payment_status==='pending'?`<div class="notice">Awaiting payment${x.hold_expires_at?` — place held until ${fmt(x.hold_expires_at)}`:''}.</div>${active?`<div class="actions"><button class="primary compact-button" onclick="resumePendingClassPayment('${esc(x.booking_ref)}')">Resume payment</button></div>`:''}`:''}${["refund_partial","refunded"].includes(x.payment_status)?`<div class="notice good">${x.payment_status==="refund_partial"?"Partial refund":"Refund"}: ${money(x.refund_amount||0)}</div>`:""}${x.payment_status==="no_refund"&&x.refund_client_note?`<div class="notice">${esc(x.refund_client_note)}</div>`:""}${actions}</div>`})}
 cards.sort((x,y)=>x.priority-y.priority||(x.priority===2?String(y.date).localeCompare(String(x.date)):String(x.date).localeCompare(String(y.date))));let current=-1,html="";for(const card of cards){if(card.priority!==current){current=card.priority;html+=`<h3 class="booking-section-title">${current===0?"Awaiting action":current===1?"Upcoming":"Past / inactive"}</h3>`}html+=card.html}
 return `<div class="booking-view-toggle"><button class="${!showAll?"active":""}" onclick="state.bookingHistoryMode='upcoming';render()">Upcoming</button><button class="${showAll?"active":""}" onclick="state.bookingHistoryMode='all';render()">All bookings</button></div><div class="list">${html||'<div class="center"><p>No bookings to show.</p></div>'}</div>`;
}

async function resumePendingClassPayment(bookingRef){
 try{
  const d=await api(`/api/my/classes/${encodeURIComponent(bookingRef)}/resume-payment`,{method:"POST",body:"{}"});
  if(d.settled){state.completedBooking={...d,type:"class"};state.profile=await api("/api/my/profile");return go("confirmation")}
  state.confirm={...d,type:"class",paymentStartRequired:false};go("payment");
 }catch(e){
  appAlert(e.message);
 }
}

async function resumePendingPayment(id){
 try{
  const d=await api(`/api/my/bookings/${id}/resume-payment`,{method:'POST',body:'{}'});
  if(d.settled){state.completedBooking={...d,type:d.type||'private'};state.profile=await api('/api/my/profile');return go('confirmation')}
  state.confirm={...d,type:d.type||'private',paymentStartRequired:false};go('payment');
 }catch(e){
  if(e.paymentPending){state.confirm={...e,type:e.type||'private',paymentStartRequired:false};go('payment')}
  else appAlert(e.message)
 }
}

async function cancelPendingBooking(id){if(!await appConfirm('Cancel this unpaid booking and release the held time?'))return;try{await api(`/api/my/bookings/${id}/cancel-pending`,{method:'POST',body:'{}'});await portal()}catch(e){appAlert(e.message)}}
async function manualPaymentForBooking(id,amount){
 const code=await appPrompt('Enter the full 10-character M-Pesa confirmation reference:','');
 if(code===null)return;
 const clean=String(code).replace(/\s+/g,'').toUpperCase();
 if(!/^[A-Z0-9]{10}$/.test(clean))return appAlert('Enter the full 10-character M-Pesa confirmation reference.');
 try{await api(`/api/my/bookings/${id}/manual-payment`,{method:'POST',body:JSON.stringify({confirmationCode:clean,amount:Number(amount)})});state.portalTab='bookings';await portal();await appAlert('Amy has been asked to verify your payment.')}catch(e){appAlert(e.message)}
}

function clientReschedule(id){const b=(state.bookings?.privateBookings||[]).find(x=>x.id===id);if(!b)return;if(Number(b.reschedule_count||0)>=3)return appAlert('The three client-requested reschedules have been used. Please contact Amy.');state.rescheduleDraft={bookingId:id,booking:b,date:String(b.start_at||'').slice(0,10),slots:[],selected:null};render();setTimeout(()=>loadRescheduleSlots(),0)}
async function confirmClientReschedule(){const r=state.rescheduleDraft;if(!r?.selected)return;const note=await appPrompt('Optional note for Amy about this request:','');if(note===null)return;try{const d=await api(`/api/my/bookings/${r.bookingId}/reschedule`,{method:'POST',body:JSON.stringify({startAt:r.selected.start,note})});state.rescheduleDraft=null;await portal();appAlert(`Your reschedule request has been sent to Amy. Your original appointment remains confirmed until Amy approves the change. The requested slot is held for 24 hours.`)}catch(e){appAlert(e.message)}}

function accountView(){const u=state.profile?.user||state.user||{};return `<section class="screen"><div class="center"><div class="panel account-panel" style="width:min(680px,100%)"><button class="back" onclick="go(state.user?.role==='trainer'?'trainer':'portal')">← Back</button><div class="eyebrow">Account & billing</div><h2>Your details</h2>${state.user?.role==='client'?`<div class="credit-balance-card"><span>Credit available</span><strong>${money(state.profile?.creditBalance||0)}</strong>${(state.profile?.creditHistory||[]).length?`<small>Recent credit activity is kept in your account history.</small>`:""}</div>`:""}${state.user?.role==='client'?`<label>Name<input id="accountName" value="${esc(u.name||'')}"></label><div class="form-grid"><label>WhatsApp number<input id="accountWhatsapp" value="${esc(u.whatsapp_phone||u.phone||'')}"></label><label>M-Pesa number <span class="small">(if different)</span><input id="accountMpesa" value="${esc(u.mpesa_phone||u.phone||'')}"></label></div><label>KRA PIN <span class="small">(optional — for eTIMS invoices or receipts)</span><input id="accountKra" value="${esc(u.kra_pin||'')}"></label><label class="newsletter-optin"><input id="accountNewsletter" type="checkbox" ${u.newsletter_opt_in?'checked':''}> Please tick here if you would like to receive my newsletter, <em>The Canine Grapevine</em>, which I try to send out at least every 2 months, to keep you informed about upcoming classes, events and other news.</label><div class="actions"><button class="primary" onclick="saveAccountDetails()">Save account details</button></div><hr>`:''}<h3>Change password</h3><label>Current password<input id="currentPassword" type="password" autocapitalize="none" autocorrect="off" spellcheck="false"></label><label>New password<input id="newPassword" type="password" autocapitalize="none" autocorrect="off" spellcheck="false"></label><label>Confirm new password<input id="confirmPassword" type="password" autocapitalize="none" autocorrect="off" spellcheck="false"></label><div class="actions"><button class="secondary" onclick="changePassword()">Change password</button></div></div></div></section>`}
async function saveAccountDetails(){try{const d=await api('/api/my/profile',{method:'PUT',body:JSON.stringify({name:document.getElementById('accountName').value,whatsappPhone:document.getElementById('accountWhatsapp').value,mpesaPhone:document.getElementById('accountMpesa').value,kraPin:document.getElementById('accountKra').value,newsletterOptIn:document.getElementById('accountNewsletter').checked})});state.profile.user=d.user;state.user={...state.user,...d.user};appAlert('Account details saved.');render()}catch(e){appAlert(e.message)}}

function lunchBlock(){const d=state.trainerSelectedDate||state.schedulingDate||nairobiDateKeyClient(0);state.scheduleModal={mode:'block',target:'amy',startDate:d,endDate:d,allDay:false,startTime:'12:00',endTime:'13:00',reason:'Lunch',publicMessage:'',silentCalendar:true};render()}
async function submitScheduleModal(){
 const m=state.scheduleModal;if(!m)return;
 if(m.mode==="block"){
   if(!m.startDate||!m.endDate)return appAlert("Choose the first and last date.");
   if(!m.allDay&&(!m.startTime||!m.endTime||m.startTime>=m.endTime))return appAlert("Choose valid start and end times.");
   try{
     await api("/api/trainer/schedule-blocks",{method:"POST",body:JSON.stringify({id:m.blockId||null,target:m.target,startDate:m.startDate,endDate:m.endDate,allDay:!!m.allDay,startTime:m.startTime,endTime:m.endTime,reason:m.reason||"Unavailable",publicMessage:m.publicMessage||m.reason||"Unavailable",allowExisting:!!m.quickClose,silentCalendar:!!m.silentCalendar})});
     state.scheduleBlocks=await api("/api/trainer/schedule-blocks");state.scheduleModal=null;state.trainer=await api("/api/trainer/summary");
     await loadTrainerCalendar(parseDateKey(state.trainerSelectedDate)||new Date());await loadTrainerMonth(parseDateKey(state.trainerMonthDate)||new Date());
     if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);render();
   }catch(e){appAlert(e.message)}
   return;
 }
 if(m.mode==="trainer-reschedule"){
   if(!m.selected?.start)return appAlert("Choose one of the available start times.");
   try{
     await api(`/api/trainer/bookings/${m.bookingId}/reschedule`,{method:"POST",body:JSON.stringify({startAt:m.selected.start})});
     state.scheduleModal=null;
     await loadTrainerCalendar(parseDateKey(state.trainerSelectedDate)||new Date());
     if(state.trainerSelectedDate)await loadTrainerDayMeta(state.trainerSelectedDate);
     closeTrainerBooking();
     await appAlert("Booking rescheduled.");
   }catch(e){appAlert(e.message)}
 }
}

function workingHoursView(){const d=state.workingHours||{weekly:[],exceptions:[],recurringBlocks:[],dateBlocks:[]},names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],blocks=state.scheduleBlocks||[];return `<section class="screen admin-screen scheduling-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Scheduling</h2><div class="actions"><button class="secondary compact-button" onclick="addClass()">＋ New course</button><button class="secondary compact-button" onclick="openTrainerAdmin('classes')">Scheduled classes</button></div><p>Block time and locations first; normal weekly working hours are kept at the bottom.</p></div></div><div class="scheduling-sections"><section class="panel scheduling-section"><div class="scheduling-section-head"><div><span class="schedule-number">1</span><h3>Block time</h3><p>Use Lunch for a silent 12:00–13:00 hold, or Block time for other restrictions.</p></div><div class="actions"><button class="secondary compact-button" onclick="lunchBlock()">Lunch 12–13</button><button class="primary compact-button" onclick="blockTime()">＋ Block time</button></div></div><div class="schedule-block-list">${blocks.map(b=>`<div class="service-block-row future-restriction ${b.target}"><div><span class="restriction-title">${b.silent_calendar?'Lunch / silent hold':esc(scheduleBlockLabel(b))}</span><small>${esc(scheduleBlockDateLabel(b))}</small><p>${esc(b.reason||'Unavailable')}</p></div><button class="secondary compact-button" onclick="changeScheduleBlock(${b.id})">Change</button></div>`).join('')||'<p class="small">No active blocks.</p>'}</div></section><section class="panel scheduling-section"><div class="scheduling-section-head"><div><span class="schedule-number">2</span><h3>Working hours</h3><p>Amy's normal weekly pattern.</p></div><button class="secondary compact-button" onclick="addWorkingException()">＋ One-off change</button></div><div class="hours-list hours-list-v2176">${d.weekly.map(w=>`<div class="hours-row hours-row-v2176"><label class="check-row hours-day"><input type="checkbox" data-day="${w.weekday}" class="wh-enabled" ${w.enabled?'checked':''}> <span>${names[w.weekday]}</span></label><div class="hours-time-pair"><input type="time" class="wh-start" data-day="${w.weekday}" value="${w.start_time||'08:00'}"><span class="hours-to">to</span><input type="time" class="wh-end" data-day="${w.weekday}" value="${w.end_time||'17:00'}"></div></div>`).join('')}</div><div class="actions"><button class="primary" onclick="saveWorkingHours()">Save weekly hours</button></div></section></div>${workingExceptionModalView()}${scheduleModalView()}</section>`}


function startTrainerClientBooking(userId){const c=state.clientRecord;if(!c||Number(c.user.id)!==Number(userId))return;state.trainerClientBooking={userId:Number(userId),petId:c.pets?.find(p=>!p.archived)?.id||null,service:'standard',locationType:'arena',address:'',date:'',selectedSlot:null,availabilityMessage:'',repeatType:'once',sessionCount:1,packageName:'',packagePrice:'',customDates:[],overrideLocation:false};state.trainerClientBookingSlots=[];render()}

function trainerClientBookingModal(){const m=state.trainerClientBooking,c=state.clientRecord;if(!m||!c)return '';return `<div class="modal-overlay"><div class="trainer-modal package-booking-modal"><button class="close-btn modal-close" onclick="state.trainerClientBooking=null;render()">×</button><div class="eyebrow">Book for a client</div><h2>${esc(c.user.name)}</h2><p>Create a provisional appointment or private training package. All proposed times are held for <b>24 hours</b> while the client confirms and pays.</p><label>Dog<select onchange="state.trainerClientBooking.petId=Number(this.value)">${(c.pets||[]).filter(p=>!p.archived).map(p=>`<option value="${p.id}" ${Number(m.petId)===Number(p.id)?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="form-grid"><label>Training<select onchange="trainerClientBookingOptionChanged('service',this.value)"><option value="consultation" ${m.service==='consultation'?'selected':''}>Initial consultation · 90 min</option><option value="standard" ${m.service==='standard'?'selected':''}>Training · 60 min</option><option value="extra" ${m.service==='extra'?'selected':''}>Training + extra time · 90 min</option></select></label><label>Location<select onchange="trainerClientBookingOptionChanged('locationType',this.value)"><option value="arena" ${m.locationType==='arena'?'selected':''}>Amy's Arena — Ridgeways</option><option value="home" ${m.locationType==='home'?'selected':''}>Home visit</option></select></label></div>${m.locationType==='home'?`<label>Address<input value="${esc(m.address||'')}" onchange="trainerClientBookingOptionChanged('address',this.value)"></label>`:''}<label class="trainer-override-choice"><input type="checkbox" ${m.overrideLocation?'checked':''} onchange="state.trainerClientBooking.overrideLocation=this.checked;invalidateTrainerClientSlots('');render();if(state.trainerClientBooking.date)trainerClientBookingCheckTimes()"> Override arena or home visit unavailability</label><p class="small">This does not change the underlying schedule. Existing bookings, classes, Amy-unavailable time and required travel time still cannot be overridden.</p><div class="trainer-booking-date-row"><label>First date<span class="native-date-wrap"><input class="trainer-booking-date-input" type="date" min="${earliestPrivateDate()}" value="${esc(m.date||'')}" inputmode="none" onkeydown="event.preventDefault()" onbeforeinput="event.preventDefault()" onpaste="event.preventDefault()" onclick="this.showPicker&&this.showPicker()" onchange="trainerClientBookingDateChanged(this.value)" aria-label="Choose first date from calendar"></span></label></div>${m.availabilityMessage?`<div class="notice trainer-client-availability-message">${esc(m.availabilityMessage)}</div>`:""}<div class="time-grid compact-times">${(state.trainerClientBookingSlots||[]).map(slot=>`<button class="time ${m.selectedSlot?.start===slot.start?'selected':''}" onclick='state.trainerClientBooking.selectedSlot=${JSON.stringify(slot)};render()'>${String(slot.start).slice(11,16)}</button>`).join('')}</div><h3>Repeat / package</h3><div class="form-grid"><label>Repeat<select onchange="state.trainerClientBooking.repeatType=this.value;render()"><option value="once" ${m.repeatType==='once'?'selected':''}>One session</option><option value="weekly" ${m.repeatType==='weekly'?'selected':''}>Every week</option><option value="biweekly" ${m.repeatType==='biweekly'?'selected':''}>Every 2 weeks</option><option value="custom" ${m.repeatType==='custom'?'selected':''}>Custom dates</option></select></label><label>Number of sessions<input type="number" min="1" max="20" value="${m.sessionCount||1}" onchange="state.trainerClientBooking.sessionCount=Math.max(1,Number(this.value||1));render()"></label></div>${Number(m.sessionCount||1)>1?`<label>Package name<input value="${esc(m.packageName||'')}" oninput="state.trainerClientBooking.packageName=this.value" placeholder="e.g. Jasiri – 5 Session Training Package"></label><label>Agreed package price (KES)<input type="number" min="0" value="${esc(m.packagePrice||'')}" oninput="state.trainerClientBooking.packagePrice=this.value" placeholder="Leave blank to use standard session total"></label>`:''}${m.repeatType==='custom'&&Number(m.sessionCount||1)>1?`<div class="custom-package-dates"><h3>Package dates</h3><p class="small">${Number(m.sessionCount||1)} sessions total. The first date you chose is Session 1; choose ${Math.max(0,Number(m.sessionCount||1)-1)} more date${Number(m.sessionCount||1)-1===1?'':'s'}.</p>${Array.from({length:Number(m.sessionCount||1)},(_,i)=>`<label>Session ${i+1} of ${Number(m.sessionCount||1)}<input class="package-custom-date" type="date" min="${earliestPrivateDate()}" value="${esc(i===0?(m.date||''):(m.customDates?.[i]||''))}" ${i===0?'readonly':''} inputmode="none" onkeydown="event.preventDefault()" onbeforeinput="event.preventDefault()" onclick="${i===0?'':'this.showPicker&&this.showPicker()'}" onchange="state.trainerClientBooking.customDates=state.trainerClientBooking.customDates||[];state.trainerClientBooking.customDates[${i}]=this.value"></label>`).join('')}</div>`:''}<div class="actions"><button class="secondary" onclick="state.trainerClientBooking=null;render()">Cancel</button><button class="primary" ${!m.petId||!m.selectedSlot?'disabled':''} onclick="createTrainerProvisionalBooking()">Create 24-hour provisional hold</button></div></div></div>`}

async function createTrainerProvisionalBooking(){const m=state.trainerClientBooking;if(!m?.selectedSlot)return;const custom=m.repeatType==='custom'?[...document.querySelectorAll('.package-custom-date')].map(x=>x.value).filter(Boolean):[];if(m.repeatType==='custom'&&custom.length!==Number(m.sessionCount||1))return appAlert(`Please choose exactly ${Number(m.sessionCount||1)} package dates in total.`);try{const d=await api(`/api/trainer/clients/${m.userId}/provisional-booking`,{method:'POST',body:JSON.stringify({petId:m.petId,service:m.service,locationType:m.locationType,address:m.address,startAt:m.selectedSlot.start,requestedDate:m.date,repeatType:m.repeatType,sessionCount:Number(m.sessionCount||1),customDates:custom,packageName:m.packageName,packagePrice:Number(m.packagePrice||0),overrideLocation:!!m.overrideLocation})});state.trainerClientBooking=null;state.trainerClientBookingSlots=[];state.clientRecord=null;state.bookForClientMode=false;state.trainerAdminPage=null;state.trainer=await api('/api/trainer/summary');await loadTrainerCalendar(new Date());await loadTrainerMonth(new Date());state.view='trainer';render();appAlert(`Provisional ${d.packageId?'package':'booking'} created. The times are held for 24 hours.`)}catch(e){appAlert(e.message)}}

async function openBookForClientPicker(){
 state.bookForClientMode=true;
 state.clientRecord=null;
 state.trainerClientBooking=null;
 state.clientAdmin=await api('/api/trainer/clients');
 state.trainerAdminPage='clients';
 state.view='trainerAdmin';
 render();
}
async function selectClientForBooking(id){
 try{
  state.clientRecord=await api(`/api/trainer/client/${id}`);
  startTrainerClientBooking(id);
 }catch(e){appAlert(e.message||'Could not open this client for booking.')}
}
function operationalClientStatusLabel(status){return ({all:'All',unverified:'Unverified',incomplete:'Incomplete',current:'Current',rejected:'Rejected'})[status]||String(status||'')}
function clientStatusDetail(x){
 if(x.client_status==='incomplete')return 'Application not yet submitted';
 if(x.client_status==='unverified'){
  const d=x.applicationDeposit;if(!d||!d.manual_payment_status||d.manual_payment_status==='rejected')return 'Application submitted · payment not submitted';
  if(d.manual_payment_status==='submitted')return `Payment submitted · Unverified${d.manual_payment_code?` · ${d.manual_payment_code}`:''}`;
  return `Application under review · ${d.manual_payment_status}`;
 }
 if(x.client_status==='rejected')return 'Application rejected';
 return x.activity_status&&x.activity_status!=='current'?`Current client · ${x.activity_status}`:'Verified client · booking enabled';
}
function clientAdminView(){
 const rows=state.clientAdmin||[],bookingMode=!!state.bookForClientMode;
 const filter=bookingMode?'current':(state.clientStatusFilter||'all');
 const filtered=rows.filter(x=>filter==='all'||x.client_status===filter);
 const shown=bookingMode?filtered.filter(x=>x.client_status==='current'):filtered;
 const rowAction=x=>x.record_type==='draft'?`openIncompleteClientRecord(${x.id})`:(bookingMode?`selectClientForBooking(${x.id})`:`openClientRecord(${x.id})`);
 const filters=['all','unverified','incomplete','current','rejected'];
 return `<section class="screen admin-screen"><button class="back-dashboard" onclick="state.bookForClientMode=false;dashboardBack()">← Back to Dashboard</button>
 <div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>${bookingMode?'Book for client':'Clients'}</h2>${bookingMode?'<p class="small">Only verified Current clients are shown for trainer-created bookings.</p>':'<p class="small">Filter by the action state you need. Status remains visible on every client card.</p>'}</div><input class="admin-search" placeholder="Search client or dog" oninput="filterClientAdmin(this.value)"></div>
 ${bookingMode?'':`<div class="client-status-filters">${filters.map(f=>`<button class="${filter===f?'primary':'secondary'} compact-button" onclick="state.clientStatusFilter='${f}';render()">${operationalClientStatusLabel(f)} · ${f==='all'?rows.length:rows.filter(x=>x.client_status===f).length}</button>`).join('')}</div>`}
 <div class="client-groups client-groups-stacked"><div class="client-group client-group-wide"><h3>${operationalClientStatusLabel(filter)} · ${shown.length}</h3>${shown.map(x=>`<button class="client-overview-card status-${esc(x.client_status)}" data-search="${esc(([x.name,x.email,x.whatsapp_phone,x.mpesa_phone,...(x.pets||[]).map(p=>p.name)].join(' ')).toLowerCase())}" onclick="${rowAction(x)}"><span class="client-overview-head"><span><span class="client-overview-name">${esc(x.name)}</span><small>${esc(x.email)}${x.whatsapp_phone?` · WhatsApp ${esc(x.whatsapp_phone)}`:''}</small></span><span class="client-status-badge status-${esc(x.client_status)}">${esc(operationalClientStatusLabel(x.client_status))}</span><span class="client-open-arrow">→</span></span><span class="client-status-detail">${esc(clientStatusDetail(x))}</span><span class="client-dog-table">${(x.pets||[]).filter(p=>!p.archived).map(p=>`<span class="client-dog-table-row client-dog-name-only"><span>${esc(p.name)}</span></span>`).join('')||'<span class="small">No dog saved yet.</span>'}</span></button>`).join('')||'<p class="small">None</p>'}</div></div>
 ${bookingMode?'':clientRecordModal()}${trainerClientBookingModal()}</section>`;
}
async function openIncompleteClientRecord(id){try{state.clientRecord=await api(`/api/trainer/application-drafts/${id}`);render()}catch(e){appAlert(e.message)}}

function editTrainerDogNote(id){state.editingTrainerNotePetId=Number(id);render()}
function cancelTrainerDogNoteEdit(){state.editingTrainerNotePetId=null;render()}
function applicationPaymentSummary(c){const d=c.applicationDeposit;if(!d)return 'Not submitted';if(d.manual_payment_status==='submitted')return `KES ${Number(d.amount||1000).toLocaleString('en-KE')} · ${d.manual_payment_code||'No reference'} · Unverified`;if(d.manual_payment_status==='verified')return `KES ${Number(d.amount||1000).toLocaleString('en-KE')} · ${d.manual_payment_code||'—'} · Verified`;if(d.manual_payment_status==='rejected')return 'Payment confirmation rejected / awaiting resubmission';return String(d.manual_payment_status||'Not submitted')}
function clientRecordModal(){const c=state.clientRecord;if(!c)return '';
 const u=c.user||{},status=u.client_status||'current',isDraft=c.record_type==='draft',isUnverified=status==='unverified',isRejected=status==='rejected';
 const household=[u.household_adults!=null?`Adults: ${u.household_adults}`:'',u.household_dogs!=null?`Dogs in household: ${u.household_dogs}`:'',u.children_0_8!=null?`Children 0–8: ${u.children_0_8}`:'',u.children_9_13!=null?`Children 9–13: ${u.children_9_13}`:'',u.children_14_plus!=null?`Children 14+: ${u.children_14_plus}`:''].filter(Boolean).join(' · ');
 return `<div class="modal-overlay"><div class="trainer-modal client-record-modal"><button class="close-btn modal-close" onclick="closeClientRecord()">×</button><div class="eyebrow">${isDraft?'Incomplete application':'Client record'}</div><div class="client-record-title"><div><h2>${esc(u.name||'Applicant')}</h2><p>${esc(u.email||'')}</p><p><span class="client-status-badge status-${esc(status)}">${esc(operationalClientStatusLabel(status))}</span></p><p>WhatsApp: ${esc(u.whatsapp_phone||u.phone||'—')} · M-Pesa: ${esc(u.mpesa_phone||u.phone||'—')}</p><p>Area: ${esc(u.location||'Not supplied')}</p><p>Canine Grapevine: ${u.newsletter_opt_in?'Opted in':'Not subscribed'}</p></div></div>
 <h3>Application</h3><div class="application-review-grid"><div><b>Introduction / training needs</b><p>${esc(u.client_intro_note||c.draft?.introNote||'Not supplied')}</p></div><div><b>Household</b><p>${esc(household||c.draft?.householdAdults?household:'Not supplied')}</p>${u.household_changes?`<p>${esc(u.household_changes)}</p>`:''}${u.household_note?`<p>${esc(u.household_note)}</p>`:''}</div><div><b>Application payment</b><p>${isDraft?'Not yet at submitted application payment stage':esc(applicationPaymentSummary(c))}</p></div></div>
 ${!isDraft?`<div class="credit-balance-card trainer-credit"><span>Account credit</span><strong>${money(c.creditBalance||0)}</strong>${(c.creditHistory||[]).length?`<small>Latest: ${esc(c.creditHistory[0].note||"Credit adjustment")} · ${money(c.creditHistory[0].amount_delta||0)}</small>`:""}</div>`:''}
 <h3>Dogs</h3><div class="trainer-dog-records">${(c.pets||[]).map(p=>`<article class="trainer-dog-record"><h4>${esc(p.name)}</h4><p>${esc(p.breed||c.draft?.dogBreed||'Dog')}${p.gender?` · ${esc(p.gender)}`:''}${p.date_of_birth?` · DOB ${displayDate(p.date_of_birth,{day:'numeric',month:'short',year:'numeric'})}`:''}</p>${!isDraft?`<p>Vaccination: ${esc(p.vaccination_status||'not provided')}</p><label>Amy's private notes<textarea id="trainerNotes-${p.id}" rows="3" ${Number(state.editingTrainerNotePetId)===Number(p.id)?'':'readonly'}>${esc(p.trainer_notes||'')}</textarea></label><div class="actions">${Number(state.editingTrainerNotePetId)===Number(p.id)?`<button class="primary compact-button" onclick="saveTrainerDogNotes(${p.id})">Save note</button><button class="secondary compact-button" onclick="cancelTrainerDogNoteEdit()">Cancel edit</button>`:`<button class="secondary compact-button" onclick="editTrainerDogNote(${p.id})">Edit note</button>`}<button class="secondary compact-button" onclick="openVaccinationReview(${p.id})">Vaccination</button></div>`:'<p class="small">Dog details saved in the unfinished application. Uploaded files are only attached once the application is submitted.</p>'}</article>`).join('')||'<p class="small">No dog details saved yet.</p>'}</div>
 ${!isDraft?`<h3>Resources shared</h3>${(c.resources||[]).length?`<div class="client-shared-resources">${(c.resources||[]).map(r=>`<div class="client-shared-resource"><strong>${esc(r.title)}</strong><span>${esc(r.category||"General")} · ${esc(String(r.type||"").toUpperCase())}</span>${r.note?`<small>${esc(r.note)}</small>`:""}</div>`).join("")}</div>`:'<p class="small">No training resources shared yet.</p>'}`:''}
 <div class="actions client-decision-actions">${isDraft?`<button class="danger" onclick="deleteIncompleteApplication(${u.id})">Delete application</button>`:''}${isUnverified&&c.applicationDeposit?.manual_payment_status==='submitted'?`<button class="primary" onclick="approveNewClient(${c.applicationDeposit.id})">Approve payment + KES 700 credit</button>`:''}${isUnverified?`<button class="danger" onclick="rejectNewClient(${u.id},${c.applicationDeposit?.manual_payment_status==='submitted'?'true':'false'})">${c.applicationDeposit?.manual_payment_status==='submitted'?'Refund & Reject':'Reject application'}</button>`:''}${status==='current'?`<button class="primary" onclick="startTrainerClientBooking(${u.id})">＋ Book for this client</button>`:''}${isRejected?`<button class="danger" onclick="deleteRejectedClient(${u.id})">Delete rejected client</button>`:''}<button class="secondary" onclick="closeClientRecord()">Done</button></div></div></div>`}
async function deleteIncompleteApplication(id){if(!await appConfirm('Delete this incomplete application? The unfinished record will be removed and the email can be used to start again.'))return;try{await api(`/api/trainer/application-drafts/${id}`,{method:'DELETE'});state.clientRecord=null;state.clientAdmin=await api('/api/trainer/clients');render()}catch(e){appAlert(e.message)}}
async function approveNewClient(depositId){if(!await appConfirm('Verify the KES 1,000 application deposit, approve this client and add KES 700 to their account credit?'))return;try{await api(`/api/trainer/application-deposits/${depositId}/verify`,{method:'POST',body:JSON.stringify({approve:true})});state.clientRecord=null;state.clientAdmin=await api('/api/trainer/clients');state.trainer=await api('/api/trainer/summary');render()}catch(e){appAlert(e.message)}}
async function rejectNewClient(id,hasPayment){let refundMethod='',refundReference='';if(hasPayment){refundMethod=String(await appPrompt('Refund method for the KES 700 refundable portion: enter Cash or M-Pesa','M-Pesa')||'').trim();if(!refundMethod)return;if(/^m-?pesa$/i.test(refundMethod)){refundMethod='mpesa';refundReference=String(await appPrompt('Enter the 10-character M-Pesa refund/reference code','')||'').replace(/\s+/g,'').toUpperCase();if(!refundReference)return}else if(/^cash$/i.test(refundMethod))refundMethod='cash';else return appAlert('Please enter Cash or M-Pesa.')}if(!await appConfirm('Reject this application? The client will remain restricted until Amy later deletes the rejected record.'))return;try{await api(`/api/trainer/clients/${id}/reject-application`,{method:'POST',body:JSON.stringify({refundMethod,refundReference})});state.clientRecord=await api(`/api/trainer/client/${id}`);state.clientAdmin=await api('/api/trainer/clients');render()}catch(e){appAlert(e.message)}}
async function deleteRejectedClient(id){if(!await appConfirm('Delete this rejected client from the active system? A historical archive record will be kept and the email can be used for a fresh future application.'))return;try{await api(`/api/trainer/clients/${id}/rejected`,{method:'DELETE'});state.clientRecord=null;state.clientAdmin=await api('/api/trainer/clients');render()}catch(e){appAlert(e.message)}}


function attentionAdminView(){
 const t=state.trainer||{};
 const newClients=(t.notifications||[]).filter(n=>n.kind==='new_account');
 const none=!(t.vaccinationAttention||[]).length&&!(t.cancellationAttention||[]).length&&!(t.classRefundAttention||[]).length&&!(t.rescheduleAttention||[]).length&&!(t.manualPaymentAttention||[]).length&&!(t.classManualPaymentAttention||[]).length&&!(t.applicationDepositAttention||[]).length&&!newClients.length;
 return `<section class="screen admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Needs attention</h2><div class="actions">${(t.pendingReviews||[]).length?`<button class="secondary compact-button" onclick="openTrainerAdmin('reviews')">Pending reviews · ${(t.pendingReviews||[]).length}</button>`:`<button class="secondary compact-button" disabled title="There are no pending reviews">No pending reviews</button>`}</div></div></div><div class="admin-list-large">
 ${(t.rescheduleAttention||[]).map(x=>`<div class="card"><b>Reschedule request · ${esc(x.client_name)} · ${esc(x.pet_name||'')}</b><p>Current: ${fmt(x.old_start_at)}<br>Requested: ${fmt(x.proposed_start_at)}<br>${x.client_note?`Client note: ${esc(x.client_note)}<br>`:""}Held until ${fmt(x.hold_expires_at)}</p><div class="actions"><button class="primary compact-button" onclick="decideRescheduleRequest(${x.id},'approve')">Approve</button><button class="danger compact-button" onclick="decideRescheduleRequest(${x.id},'decline')">Decline</button></div></div>`).join('')}
 ${(t.cancellationAttention||[]).map(x=>`<div class="card"><b>Cancellation · ${esc(x.booking_ref)}</b><p>${esc(x.client_name)} · ${esc(x.pet_name||'')}</p><button class="secondary" onclick="openTrainerBooking(${x.id})">Handle refund</button></div>`).join('')}
 ${(t.classRefundAttention||[]).map(x=>`<div class="card"><b>Class cancellation · ${esc(x.title)}</b><p>${esc(x.client_name)} · ${esc(x.pet_name||'')} · ${x.enrolment_status==="cancelled_by_trainer"?"Cancelled by Amy · ":""}Refund decision required</p><button class="secondary" onclick="openClassRefundFromAttention(${x.class_id},${x.id})">Handle refund</button></div>`).join('')}
 ${(t.manualPaymentAttention||[]).map(x=>`<div class="card"><b>Manual M-Pesa to verify · ${esc(x.client_name)}</b><p>${esc(x.pet_name||'')} · ${esc(x.booking_ref)} · M-Pesa Ref ${esc(x.manual_payment_code)} · Reported ${money(x.manual_payment_amount)} · Due ${money(x.price)}</p><div class="actions"><button class="primary compact-button" onclick="verifyManualPayment(${x.id},true)">Verify payment</button><button class="danger compact-button" onclick="verifyManualPayment(${x.id},false)">Reject</button></div></div>`).join('')}
 ${(t.classManualPaymentAttention||[]).map(x=>`<div class="card"><b>Class manual M-Pesa to verify · ${esc(x.client_name)}</b><p>${esc(x.pet_name||'')} · ${esc(x.title||'Class')} · ${esc(x.booking_ref)} · M-Pesa Ref ${esc(x.manual_payment_code)} · Reported ${money(x.manual_payment_amount)} · Due ${money(x.price)}</p><div class="actions"><button class="primary compact-button" onclick="verifyClassManualPayment(${x.id},true)">Verify payment</button><button class="danger compact-button" onclick="verifyClassManualPayment(${x.id},false)">Reject</button></div></div>`).join('')}
 ${(t.applicationDepositAttention||[]).map(x=>`<div class="card"><b>New client payment waiting · ${esc(x.client_name)}</b><p>M-Pesa Ref ${esc(x.manual_payment_code)} · ${money(x.amount||1000)} · Unverified</p><div class="actions"><button class="primary compact-button" onclick="openClientRecordFromAttention(${x.user_id})">Open client & decide</button></div></div>`).join('')}
 ${newClients.map(n=>`<div class="card"><b>New client · ${esc(n.client_name||'')}</b><p>${esc(n.message)}</p><div class="actions"><button class="secondary" onclick="openClientRecordFromAttention(${n.user_id})">Open client</button><button class="secondary compact-button" onclick="resolveTrainerNotification(${n.id})">Mark seen</button></div></div>`).join('')}
 ${(t.vaccinationAttention||[]).map(x=>`<div class="card"><span>Vaccination · ${esc(x.pet_name)}</span><p>${esc(x.client_name)} · ${Number(x.vaccination_count||0)===0?'No vaccination record uploaded':x.vaccination_status==='rejected'?'Replacement requested':'Record waiting for review'}</p><button class="secondary" onclick="openVaccinationReview(${x.pet_id})">Review record</button></div>`).join('')}
 ${none?'<p class="small">Nothing needs attention.</p>':''}</div></section>`;
}


async function verifyApplicationDeposit(id,approve){
 try{await api(`/api/trainer/application-deposits/${id}/verify`,{method:"POST",body:JSON.stringify({approve})});state.trainer=await api("/api/trainer/summary");render()}catch(e){appAlert(e.message)}
}

async function openClassRefundFromAttention(classId,enrolmentId){
 state.classAdmin=await api("/api/trainer/classes-detail");
 state.selectedClassAdmin=Number(classId);
 state.trainerAdminPage="classes";
 state.view="trainerAdmin";
 render();
 requestAnimationFrame(()=>{
   const el=document.querySelector(`[data-class-enrolment-id="${Number(enrolmentId)}"]`);
   if(el)el.scrollIntoView({block:"center",behavior:"smooth"});
 });
}

async function openClientRecordFromAttention(id){state.clientAdmin=await api('/api/trainer/clients');state.clientRecord=await api(`/api/trainer/client/${id}`);state.trainerAdminPage='clients';state.view='trainerAdmin';render()}
async function resolveTrainerNotification(id){await api(`/api/trainer/notifications/${id}/resolve`,{method:'POST',body:'{}'});state.trainer=await api('/api/trainer/summary');render()}
async function decideRescheduleRequest(id,decision){const note=await appPrompt(decision==='approve'?'Optional note to client:':'Reason / note to client:','');if(note===null)return;try{await api(`/api/trainer/reschedule-requests/${id}/decision`,{method:'POST',body:JSON.stringify({decision,note})});state.trainer=await api('/api/trainer/summary');await loadTrainerCalendar(new Date());await loadTrainerMonth(new Date());render()}catch(e){appAlert(e.message)}}
async function verifyClassManualPayment(id,approve){if(!await appConfirm(approve?'Confirm that this class M-Pesa payment has been received?':'Reject this class manual payment confirmation?'))return;await api(`/api/trainer/class-enrolments/${id}/manual-payment`,{method:'POST',body:JSON.stringify({approve})});state.trainer=await api('/api/trainer/summary');render()}

async function verifyManualPayment(id,approve){if(!await appConfirm(approve?'Confirm that this M-Pesa payment has been received?':'Reject this manual payment confirmation?'))return;await api(`/api/trainer/bookings/${id}/manual-payment`,{method:'POST',body:JSON.stringify({approve})});state.trainer=await api('/api/trainer/summary');render()}

function reportDisplayColumns(report){
 const rows=report?.rows||[],type=state.reportType||'daily';
 const wanted={
  daily:['start_at','end_at','client','dog','whatsapp','service','location','address','payment_status'],
  appointments:['start_at','client','dog','service','location_type','status','payment_status','price','booking_ref'],
  payments:['received_at','client','amount','mpesa_ref','status','refund_credit','source','dog','booking_ref'],
  clients:['name','whatsapp','mpesa','email','dogs','status','newsletter_opt_in','kra_pin'],
  vaccinations:['client','dog','vaccination_status','vaccination_verified_at','files'],
  newsletter:['name','whatsapp','email'],
  rejected_archive:['deleted_at','name','email','whatsapp','area','training_needs','dogs','payment','refund','rejected_at']
 };
 const available=rows[0]?Object.keys(rows[0]):[];
 return (wanted[type]||available).filter(k=>available.includes(k));
}
function reportColumnLabel(k){
 const labels={deleted_at:'Deleted',rejected_at:'Rejected',start_at:'Date / time',received_at:'Received date / time',end_at:'Ends',booking_ref:'Reference',payment_status:'Payment',status:'Status',mpesa_ref:'M-Pesa Ref',refund_credit:'Refund / credit',manual_payment_code:'M-Pesa Ref',manual_payment_amount:'Manual paid',refund_amount:'Refund',location_type:'Location',newsletter_opt_in:'Grapevine',vaccination_status:'Status',vaccination_verified_at:'Verified'};
 return labels[k]||k.replaceAll('_',' ');
}
function formatReportDate(value){
 const str=String(value||'');
 const m=str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
 if(!m)return str;
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const d=`${Number(m[3])} ${months[Number(m[2])-1]} ${m[1]}`;
 return m[4]?`${d}, ${m[4]}:${m[5]}`:d;
}
function reportCellValue(k,v){
 if((k==='start_at'||k==='received_at'||k==='end_at'||k==='vaccination_verified_at'||k==='deleted_at'||k==='rejected_at')&&v)return formatReportDate(v);
 if(k==='newsletter_opt_in')return Number(v)?'Yes':'No';
 if(['amount','manual_payment_amount','refund_amount','price'].includes(k)&&v!==''&&v!=null)return `KES ${Number(v).toLocaleString('en-KE')}`;if(k==='status')return String(v||'').replaceAll('_',' ');
 return v??'';
}
function reportsAdminView(){const r=state.reports;const rows=r?.rows||[];const cols=reportDisplayColumns(r);return `<section class="screen admin-screen reports-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Reports</h2></div></div><div class="panel report-controls"><div class="form-grid"><label>Report<select id="reportType" onchange="state.reportType=this.value"><option value="daily" ${state.reportType==="daily"?"selected":""}>Daily Sheet</option><option value="appointments" ${state.reportType==="appointments"?"selected":""}>Appointments</option><option value="payments" ${state.reportType==="payments"?"selected":""}>Payments</option><option value="clients" ${state.reportType==="clients"?"selected":""}>Clients</option><option value="vaccinations" ${state.reportType==="vaccinations"?"selected":""}>Vaccinations</option><option value="newsletter" ${state.reportType==="newsletter"?"selected":""}>The Canine Grapevine</option><option value="rejected_archive" ${state.reportType==="rejected_archive"?"selected":""}>Rejected Client Archive</option></select></label><label>From / date<input id="reportFrom" type="date" value="${esc(state.reportFrom||nairobiDateKeyClient(0))}"></label><label>To<input id="reportTo" type="date" value="${esc(state.reportTo||nairobiDateKeyClient(0))}"></label></div><div class="actions"><button class="primary" onclick="loadReport()">Generate report</button>${r?`<button class="secondary" onclick="window.print()">Print / Save PDF</button><button class="secondary" onclick="exportReportCsv()">Export CSV</button>`:''}</div></div>${r?`<div class="report-paper"><div class="report-heading"><img src="/brand-logo.png" alt=""><div><h2>The Custom Made Canine</h2><h3>${esc(r.title)}</h3><p>${esc(formatReportDate(r.from||''))}${r.to&&r.to!==r.from?` to ${esc(formatReportDate(r.to))}`:''}</p></div></div><div class="report-table-wrap"><table class="report-table"><thead><tr>${cols.map(k=>`<th>${esc(reportColumnLabel(k))}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${cols.map(k=>`<td>${esc(reportCellValue(k,row[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`:''}</section>`}
async function loadReport(){state.reportType=document.getElementById('reportType')?.value||state.reportType||'daily';state.reportFrom=document.getElementById('reportFrom')?.value||nairobiDateKeyClient(0);state.reportTo=document.getElementById('reportTo')?.value||state.reportFrom;try{state.reports=await api(`/api/trainer/reports/${state.reportType}?from=${encodeURIComponent(state.reportFrom)}&to=${encodeURIComponent(state.reportTo)}`);render()}catch(e){appAlert(e.message)}}
function exportReportCsv(){
 const rows=state.reports?.rows||[];if(!rows.length)return appAlert('Generate a report first.');
 const cols=reportDisplayColumns(state.reports),q=v=>`"${String(v??'').replaceAll('"','""')}"`;
 const csv=[[...cols.map(k=>reportColumnLabel(k))].map(q).join(','),...rows.map(r=>cols.map(k=>q(reportCellValue(k,r[k]))).join(','))].join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),x=document.createElement('a');x.href=URL.createObjectURL(blob);x.download=`cmc-${state.reportType}-${state.reportFrom||'report'}.csv`;x.click();setTimeout(()=>URL.revokeObjectURL(x.href),1000);
}


function homepageContentAdminView(){
 const rows=state.homepageAdmin||[],edit=state.homepageEdit;
 return `<section class="screen admin-screen homepage-admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><div class="admin-head"><div><div class="eyebrow">Amy's workspace</div><h2>Homepage Content</h2><p>Control the class posters, events and short private-training descriptions shown on the public landing page.</p></div><button class="primary" onclick="newHomepageItem()">＋ Add item</button></div>
 <div class="homepage-admin-list">${rows.length?rows.map(x=>`<article class="homepage-admin-row ${x.active?"":"inactive"}"><div><div class="home-offer-meta"><span>${esc(x.item_type)}</span>${x.featured?`<b>Featured</b>`:""}${!x.active?`<i>Hidden</i>`:""}</div>${x.poster_filename?`<img class="homepage-admin-poster" src="/api/homepage-items/${x.id}/poster" alt="${esc(x.title)} poster">`:""}<h3>${esc(x.title)}</h3><p>${esc(x.description||"")}</p><small>${esc(x.date_text||"")}${x.date_text&&x.price_text?" · ":""}${esc(x.price_text||"")}</small></div><div class="actions"><button class="secondary compact-button" onclick="editHomepageItem(${x.id})">Edit</button><button class="danger compact-button" onclick="deleteHomepageItem(${x.id})">Delete</button></div></article>`).join(""):`<div class="panel"><p>No homepage items yet. The public page will show its simple default cards until you add one.</p></div>`}</div>
 ${edit?homepageEditModal(edit):""}</section>`;
}
function homepageEditModal(x){
 return `<div class="modal-overlay"><div class="trainer-modal homepage-edit-modal"><button class="close-btn modal-close" onclick="state.homepageEdit=null;render()">×</button><div class="eyebrow">Homepage content</div><h2>${x.id?"Edit item":"Add item"}</h2>
 <div class="form-grid"><label>Type<select id="hpItemType"><option value="service" ${x.item_type==="service"?"selected":""}>Service</option><option value="class" ${x.item_type==="class"?"selected":""}>Class</option><option value="event" ${x.item_type==="event"?"selected":""}>Event</option><option value="announcement" ${x.item_type==="announcement"?"selected":""}>Announcement</option></select></label><label>Display order<input id="hpSortOrder" type="number" value="${Number(x.sort_order??100)}"></label></div>
 <label>Title<input id="hpTitle" value="${esc(x.title||"")}" maxlength="90"></label>
 <label>Short description<textarea id="hpDescription" rows="4">${esc(x.description||"")}</textarea></label>
 <div class="form-grid"><label>Date / timing text<input id="hpDateText" value="${esc(x.date_text||"")}" placeholder="e.g. Starts 12 October"></label><label>Price text<input id="hpPriceText" value="${esc(x.price_text||"")}" placeholder="e.g. KES 6,000"></label></div>
 <div class="form-grid"><label>Button<select id="hpActionType"><option value="signup" ${x.action_type==="signup"?"selected":""}>Sign up</option><option value="whatsapp" ${x.action_type==="whatsapp"?"selected":""}>WhatsApp Amy</option><option value="classes" ${x.action_type==="classes"?"selected":""}>See classes</option><option value="none" ${x.action_type==="none"?"selected":""}>No button</option></select></label><label>Custom button wording<input id="hpActionLabel" value="${esc(x.action_label||"")}" placeholder="Optional"></label></div>
 <div class="homepage-poster-editor"><label>Advertising poster <span class="small">(optional)</span><input id="hpPoster" type="file" accept="image/jpeg,image/png,image/webp" onchange="state.homepagePosterFile=this.files?.[0]||null;const n=document.getElementById('hpPosterName');if(n)n.textContent=state.homepagePosterFile?state.homepagePosterFile.name:'No new poster selected'"></label><div class="homepage-poster-status">${x.poster_filename?`<img src="/api/homepage-items/${x.id}/poster" alt="Current poster"><button type="button" class="text-button" onclick="removeHomepagePoster(${x.id})">Remove current poster</button>`:""}<strong id="hpPosterName">No new poster selected</strong></div></div>
 <div class="homepage-editor-checks"><label class="check-row"><input id="hpFeatured" type="checkbox" ${x.featured?"checked":""}> Featured</label><label class="check-row"><input id="hpActive" type="checkbox" ${x.active!==0?"checked":""}> Show on homepage</label></div>
 <div class="actions"><button class="secondary" onclick="state.homepageEdit=null;render()">Cancel</button><button class="primary" onclick="saveHomepageItem()">Save</button></div>
 </div></div>`;
}
function newHomepageItem(){state.homepagePosterFile=null;state.homepageEdit={item_type:"service",title:"",description:"",date_text:"",price_text:"",action_type:"signup",action_label:"",featured:0,active:1,sort_order:100};render()}
function editHomepageItem(id){const x=(state.homepageAdmin||[]).find(r=>Number(r.id)===Number(id));if(x){state.homepagePosterFile=null;state.homepageEdit={...x};render()}}
async function saveHomepageItem(){
 const x=state.homepageEdit;if(!x)return;
 const body={itemType:document.getElementById("hpItemType").value,title:document.getElementById("hpTitle").value.trim(),description:document.getElementById("hpDescription").value.trim(),dateText:document.getElementById("hpDateText").value.trim(),priceText:document.getElementById("hpPriceText").value.trim(),actionType:document.getElementById("hpActionType").value,actionLabel:document.getElementById("hpActionLabel").value.trim(),featured:document.getElementById("hpFeatured").checked,active:document.getElementById("hpActive").checked,sortOrder:Number(document.getElementById("hpSortOrder").value||100)};
 if(!body.title)return appAlert("Please add a title.");
 try{
  const saved=await api(x.id?`/api/trainer/homepage-items/${x.id}`:"/api/trainer/homepage-items",{method:x.id?"PUT":"POST",body:JSON.stringify(body)});
  const itemId=x.id||saved.id;
  if(state.homepagePosterFile){
    const fd=new FormData();fd.append("poster",state.homepagePosterFile);
    const resp=await fetch(`/api/trainer/homepage-items/${itemId}/poster`,{method:"POST",body:fd});
    if(!resp.ok){const er=await resp.json().catch(()=>({}));throw new Error(er.error||"The poster could not be uploaded.")}
  }
  state.homepageAdmin=await api("/api/trainer/homepage-items");state.homepageItems=await api("/api/homepage-items");state.homepageEdit=null;state.homepagePosterFile=null;render()
 }catch(e){appAlert(e.message)}
}
async function removeHomepagePoster(id){
 if(!id)return;
 try{await api(`/api/trainer/homepage-items/${id}/poster`,{method:"DELETE"});state.homepageAdmin=await api("/api/trainer/homepage-items");const fresh=(state.homepageAdmin||[]).find(r=>Number(r.id)===Number(id));if(fresh)state.homepageEdit={...fresh};state.homepageItems=await api("/api/homepage-items");render()}catch(e){appAlert(e.message)}
}
async function deleteHomepageItem(id){if(!await appConfirm("Delete this homepage item?"))return;try{await api(`/api/trainer/homepage-items/${id}`,{method:"DELETE"});state.homepageAdmin=await api("/api/trainer/homepage-items");state.homepageItems=await api("/api/homepage-items");render()}catch(e){appAlert(e.message)}}

function trainerAdminView(){if(state.trainerAdminPage==='homepage')return homepageContentAdminView();if(state.trainerAdminPage==='reports')return reportsAdminView();if(state.trainerAdminPage==='attention')return attentionAdminView();if(state.trainerAdminPage==='activity')return activityAdminView();if(state.trainerAdminPage==='clients')return clientAdminView();if(state.trainerAdminPage==='classes')return classesAdminView();if(state.trainerAdminPage==='reviews')return reviewAdminView();if(state.trainerAdminPage==='scheduling')return workingHoursView();return `<section class="screen admin-screen"><button class="back-dashboard" onclick="dashboardBack()">← Back to Dashboard</button><p>Choose a dashboard tool.</p></section>`}

async function openTrainerAdmin(page){state.trainerAdminPage=page;state.view='trainerAdmin';if(page==='clients')state.clientAdmin=await api('/api/trainer/clients');else if(page==='activity')state.activityAdmin=await api('/api/trainer/activity');else if(page==='classes'){state.classAdmin=await api('/api/trainer/classes-detail');state.selectedClassAdmin=state.classAdmin[0]?.id||null}else if(page==='reviews')state.reviewAdmin=await api('/api/trainer/reviews');else if(page==='scheduling'){state.workingHours=await api('/api/trainer/working-hours');state.scheduleBlocks=await api('/api/trainer/schedule-blocks')}else if(page==='attention')state.trainer=await api('/api/trainer/summary');else if(page==='reports'){state.reports=null;state.reportFrom=nairobiDateKeyClient(0);state.reportTo=nairobiDateKeyClient(0)}else if(page==='homepage'){state.homepageAdmin=await api('/api/trainer/homepage-items');state.homepageEdit=null}render()}
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
 else if(state.view==="application")content=applicationView();
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
 if(state.vaccinationReview)content+=vaccinationReviewModal(); if(state.vaccinationInfoOpen)content+=vaccinationInfoModal();
 if(state.scheduleModal?.mode==="class")content+=classModalView();
 else if(state.scheduleModal)content+=scheduleModalView();
 if(state.quickResourcePicker)content+=resourceQuickPickerModal();
 if(state.classRefundEntry)content+=classRefundEntryModal();
 if(state.privateRefundEntry)content+=privateRefundEntryModal();
 if(state.resourceAccessModal)content+=resourceAccessModalView();
 if(state.resourceEdit)content+=resourceEditModal();
 if(state.classResourcePicker)content+=classResourcePickerModal();
 app.innerHTML=shell(content);
}
state.authMode="login";
window.openIncompleteClientRecord=openIncompleteClientRecord;window.deleteIncompleteApplication=deleteIncompleteApplication;window.approveNewClient=approveNewClient;window.rejectNewClient=rejectNewClient;window.deleteRejectedClient=deleteRejectedClient;window.assignResourceFromAppointment=assignResourceFromAppointment;window.filterQuickResources=filterQuickResources;window.filterResourceLibrary=filterResourceLibrary;window.removeResourceAccess=removeResourceAccess;window.resourceFileChosen=resourceFileChosen;window.resourceLinkEntered=resourceLinkEntered;window.editResource=editResource;window.saveResourceEdit=saveResourceEdit;window.loadClassAvailability=loadClassAvailability;window.chooseClassDuration=chooseClassDuration;window.chooseClassStart=chooseClassStart;window.chooseClassEnd=chooseClassEnd;window.classDateChanged=classDateChanged;window.classLocationChanged=classLocationChanged;window.shareResourceToClass=shareResourceToClass;window.filterClassResources=filterClassResources;window.confirmShareResourceToClass=confirmShareResourceToClass;window.shareQuickResource=shareQuickResource;window.submitClassRefundEntry=submitClassRefundEntry;window.submitPrivateRefundEntry=submitPrivateRefundEntry;window.openClassFromAgenda=openClassFromAgenda;window.verifyClassManualPayment=verifyClassManualPayment;window.lunchBlock=lunchBlock;window.saveAccountDetails=saveAccountDetails;window.submitManualPaymentFromPayment=submitManualPaymentFromPayment;window.resumePendingPayment=resumePendingPayment;window.cancelPendingBooking=cancelPendingBooking;window.manualPaymentForBooking=manualPaymentForBooking;window.decideRescheduleRequest=decideRescheduleRequest;window.verifyManualPayment=verifyManualPayment;window.resolveTrainerNotification=resolveTrainerNotification;window.openClassRefundFromAttention=openClassRefundFromAttention;window.openClientRecordFromAttention=openClientRecordFromAttention;window.loadReport=loadReport;window.exportReportCsv=exportReportCsv;window.editClassCourse=editClassCourse;window.deleteClassCourse=deleteClassCourse;window.deleteOneOffBlock=deleteOneOffBlock;window.viewDogPhoto=viewDogPhoto;window.removeDogPhoto=removeDogPhoto;window.openLocationPlan=openLocationPlan;window.addLocationPlanRow=addLocationPlanRow;window.removeLocationPlanRow=removeLocationPlanRow;window.setLocationPlanField=setLocationPlanField;window.saveLocationPlan=saveLocationPlan;window.clearLocationPlan=clearLocationPlan;window.editDog=editDog;window.saveDogEdit=saveDogEdit;window.archiveDog=archiveDog;window.restoreDog=restoreDog;window.rejectClassDog=rejectClassDog;window.decideClassRefund=decideClassRefund;window.pickWorkingExceptionDate=pickWorkingExceptionDate;window.saveWorkingException=saveWorkingException;window.updateServiceRestrictionMessage=updateServiceRestrictionMessage;window.pickServiceRestrictionDate=pickServiceRestrictionDate;window.toggleServiceUntilFurther=toggleServiceUntilFurther;window.setRecurringWeekday=setRecurringWeekday;window.pickRecurringBlockDate=pickRecurringBlockDate;window.toggleRecurringUntilFurther=toggleRecurringUntilFurther;window.saveRecurringBlock=saveRecurringBlock;window.trainerClientBookingDateChanged=trainerClientBookingDateChanged;window.trainerClientBookingOptionChanged=trainerClientBookingOptionChanged;window.openScheduling=openScheduling;window.startAddDogFromBooking=startAddDogFromBooking;window.closeAddDogModal=closeAddDogModal;window.setSchedulingDate=setSchedulingDate;window.organiseSchedulingDay=organiseSchedulingDay;window.blockTimeFromScheduling=blockTimeFromScheduling;window.quickOneOffChange=quickOneOffChange;window.revokeScheduleBlock=revokeScheduleBlock;window.changeScheduleBlock=changeScheduleBlock;window.cancelScheduleBlockFromModal=cancelScheduleBlockFromModal;window.updatePrivateContinueState=updatePrivateContinueState;window.clientCancelClass=clientCancelClass;window.dashboardBack=dashboardBack;window.openTrainerAdmin=openTrainerAdmin;window.openBookForClientPicker=openBookForClientPicker;window.selectClientForBooking=selectClientForBooking;window.editTrainerDogNote=editTrainerDogNote;window.cancelTrainerDogNoteEdit=cancelTrainerDogNoteEdit;window.adminReviewStatus=adminReviewStatus;window.manageReview=manageReview;window.filterClientAdmin=filterClientAdmin;window.setClientStatus=setClientStatus;window.pickTimeButton=pickTimeButton;window.pickDateButton=pickDateButton;window.saveWorkingHours=saveWorkingHours;window.addWorkingException=addWorkingException;window.deleteWorkingException=deleteWorkingException;window.trainerDayView=trainerDayView;window.addRecurringBlock=addRecurringBlock;window.revokeRecurringBlock=revokeRecurringBlock;window.removeVaccinations=removeVaccinations;window.acceptProvisional=acceptProvisional;window.declineProvisional=declineProvisional;window.moveTrainerMonth=moveTrainerMonth;window.selectMonthDate=selectMonthDate;window.moveTrainerDay=moveTrainerDay;window.openServiceAvailability=openServiceAvailability;window.saveServiceAvailability=saveServiceAvailability;window.restoreServiceAvailability=restoreServiceAvailability;window.startTrainerClientBooking=startTrainerClientBooking;window.trainerClientBookingCheckTimes=trainerClientBookingCheckTimes;window.createTrainerProvisionalBooking=createTrainerProvisionalBooking;window.closeClientDirectory=closeClientDirectory;window.closeClientRecord=closeClientRecord;window.openVaccinationReview=openVaccinationReview;window.closeVaccinationReview=closeVaccinationReview;window.openClientRecord=openClientRecord;window.toggleMenu=toggleMenu;window.submitScheduleModal=submitScheduleModal;window.closeScheduleModal=closeScheduleModal;window.submitClassModal=submitClassModal;window.submitResourceUpload=submitResourceUpload;window.changePassword=changePassword;window.decideRefund=decideRefund;window.openTrainerBooking=openTrainerBooking;window.closeTrainerBooking=closeTrainerBooking;window.rescheduleBooking=rescheduleBooking;window.cancelBooking=cancelBooking;window.openResourceLibrary=openResourceLibrary;window.assignResource=assignResource;window.archiveResource=archiveResource;window.manageResourceAccess=manageResourceAccess;window.changePrivateService=changePrivateService;window.openPortalClasses=openPortalClasses;window.loadRescheduleSlots=loadRescheduleSlots;window.chooseRescheduleSlot=chooseRescheduleSlot;window.confirmClientReschedule=confirmClientReschedule;window.closeClientReschedule=closeClientReschedule;window.clientReschedule=clientReschedule;window.clientCancel=clientCancel;window.go=go;window.startPrivate=startPrivate;window.contactAmy=contactAmy;window.portal=portal;window.logout=logout;window.pickLocation=pickLocation;window.selectSlot=selectSlot;window.submitAuth=submitAuth;window.showForgotPassword=showForgotPassword;window.requestReset=requestReset;window.completeReset=completeReset;window.toggleResetPasswords=toggleResetPasswords;window.confirmPrivate=confirmPrivate;window.demoPay=demoPay;window.selectClass=selectClass;window.selectPetForBooking=selectPetForBooking;window.joinClass=joinClass;window.addPet=addPet;window.submitReview=submitReview;window.openResource=openResource;window.reviewStatus=reviewStatus;window.setVaccinationStatus=setVaccinationStatus;window.viewVaccinationFiles=viewVaccinationFiles;window.blockTime=blockTime;window.uploadDogPhoto=uploadDogPhoto;window.uploadVaccinations=uploadVaccinations;window.viewVaccinations=viewVaccinations;window.addResource=addResource;window.addClass=addClass;window.addPrivateCalendarFromConfirmation=addPrivateCalendarFromConfirmation;window.addClassCalendarFromConfirmation=addClassCalendarFromConfirmation;window.addPrivateCalendarByRef=addPrivateCalendarByRef;window.addClassCalendarByRef=addClassCalendarByRef;
init();

// Password accessibility: explicit Show password controls are provided in the forms.
(function () {
  function enhance(input) {
    if (!input || input.dataset.cmcEnhanced === "1") return;
    input.dataset.cmcEnhanced = "1";
    input.setAttribute("autocapitalize","none");
    input.setAttribute("autocorrect","off");
    input.setAttribute("spellcheck","false");
    input.setAttribute("data-gramm","false");
    input.setAttribute("data-gramm_editor","false");
    input.setAttribute("inputmode","text");
    const warning = document.createElement("div");
    warning.className = "caps-lock-warning";
    warning.textContent = "Caps Lock is on";
    input.parentNode.insertBefore(warning, input.nextSibling);
    const update = e => warning.classList.toggle("visible", !!e.getModifierState && e.getModifierState("CapsLock"));
    input.addEventListener("keydown", update);
    input.addEventListener("keyup", update);
    input.addEventListener("blur", () => warning.classList.remove("visible"));
  }
  function scan(){ document.querySelectorAll('input[type="password"]').forEach(enhance); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();
