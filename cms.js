(async()=>{
const A=window.KeleAPI,U=window.KeleUtils,e=U.escape;let data;
const status=document.querySelector('#booking-status');
if(!A.configured){if(status)status.textContent='Appointments are not yet open online.';return;}
try{data=await A.publicData();if(!data.settings)throw new Error('Studio settings are not available.');}
catch(error){if(status)status.textContent='Appointments are temporarily unavailable. Please try again later.';const n=document.createElement('p');n.className='message';n.setAttribute('role','status');n.textContent=error.message.includes('Could not find the table')?'Online bookings are being set up. Please check back soon.':'We could not load the latest studio information. Please try again later.';document.querySelector('main').prepend(n);return;}
const settings=data.settings;
const hero=document.querySelector('.hero-photo');
if(hero){
  const img=data.images.find(x=>x.placement==='hero');
  const url=img&&U.imageURL(img.url);
  // Never display the old bundled photo while CMS data or the new image loads.
  if(url){
    const preload=new Image();
    preload.onload=async()=>{
      try{await preload.decode();}catch{}
      hero.alt=img.alt||'';
      hero.src=url;
      hero.hidden=false;
    };
    preload.onerror=()=>{hero.hidden=true;};
    preload.src=url;
  }
}
const gallery=document.querySelector('.gallery');if(gallery){gallery.innerHTML=data.images.filter(x=>x.placement==='gallery').map(x=>`<figure class="gallery-card"><img class="gallery-image" src="${e(U.imageURL(x.url))}" alt="${e(x.alt)}" loading="lazy"><figcaption>${e(x.caption)}</figcaption></figure>`).join('')||'<p>New nail photos are coming soon.</p>';}
const services=document.querySelector('.services-list');if(services)services.innerHTML=data.services.map(x=>`<details class="service"><summary>${e(x.name)} <span class="price">${e(U.money(x.price))}</span></summary><div class="service-content"><p>${e(x.description)}</p><p>${e(x.duration_minutes)} minutes</p><a href="/contact/?service=${encodeURIComponent(x.id)}#booking">Choose this treatment</a></div></details>`).join('')||'<p>Our updated service menu is coming soon.</p>';
const team=document.querySelector('#team');if(team){team.innerHTML=data.therapists.map(x=>`<article class="team-card">${x.photo_url?`<img src="${e(U.imageURL(x.photo_url))}" alt="${e(x.name)}" loading="lazy">`:''}<h3>${e(x.name)}</h3><p>${e(x.bio)}</p><a href="/contact/?therapist=${encodeURIComponent(x.id)}#booking">Book with ${e(x.name)}</a></article>`).join('');document.querySelector('#team-section').hidden=!data.therapists.length;}
const cards=document.querySelectorAll('.contact-card p');if(cards.length){cards[0].textContent=settings.location||'Studio location will be added soon.';cards[1].textContent=settings.opening_hours||'Appointment hours will be added soon.';cards[2].replaceChildren();if(U.validWhatsApp(settings.whatsapp_number)){const a=document.createElement('a');a.href='https://wa.me/'+settings.whatsapp_number;a.target='_blank';a.rel='noopener';a.textContent='WhatsApp: +'+settings.whatsapp_number;cards[2].append(a);}if(settings.email){const p=document.createElement('p');p.textContent=settings.email;cards[2].append(p);}if(!cards[2].textContent)cards[2].textContent='Contact details will be added soon.';}
const form=document.querySelector('#whatsapp-form');if(!form)return;
const service=document.querySelector('#service'),therapist=document.querySelector('#therapist'),date=document.querySelector('#date'),slot=document.querySelector('#slot'),send=document.querySelector('#send-whatsapp');
service.innerHTML='<option value="">Choose a nail service</option>'+data.services.map(x=>`<option value="${e(x.id)}">${e(x.name)} · ${e(U.money(x.price))}</option>`).join('');
therapist.innerHTML='<option value="">Choose a therapist</option>'+data.therapists.map(x=>`<option value="${e(x.id)}">${e(x.name)}</option>`).join('');
const params=new URLSearchParams(location.search);service.value=data.services.find(x=>x.id===params.get('service')||x.name===params.get('service'))?.id||'';therapist.value=params.get('therapist')||'';
date.min=new Date(Date.now()+7200000).toISOString().slice(0,10);date.value=date.min;
const enabled=settings.booking_enabled&&U.validWhatsApp(settings.whatsapp_number)&&data.services.length>0&&data.therapists.length>0;
form.querySelectorAll('input,select,textarea,button').forEach(x=>x.disabled=!enabled);send.disabled=true;
status.textContent=enabled?settings.booking_notice:'Appointments are not yet open online.';
let slots=[],generation=0;
async function updateSlots(){const mine=++generation;document.querySelector('#whatsapp-result').hidden=true;slot.innerHTML='<option value="">Choose a time slot</option>';send.disabled=true;if(!enabled||!therapist.value||!service.value||!date.value)return;status.textContent='Checking available times…';try{const fetched=await A.slots(therapist.value,date.value);if(mine!==generation)return;slots=fetched;const duration=data.services.find(x=>x.id===service.value)?.duration_minutes||0;const relevant=slots.filter(x=>new Date(x.starts_at)>new Date());slot.innerHTML='<option value="">Choose a time slot</option>'+relevant.map(x=>{const fit=(new Date(x.ends_at)-new Date(x.starts_at))/60000>=duration;const available=x.status==='available'&&fit;return `<option value="${e(x.id)}" ${available?'':'disabled'}>${e(U.time(x.starts_at))} – ${e(U.time(x.ends_at))} · ${x.status==='full'?'Full':x.status==='blocked'?'Unavailable':!fit?'Too short for this service':'Available'}</option>`;}).join('');status.textContent=relevant.some(x=>x.status==='available'&&(new Date(x.ends_at)-new Date(x.starts_at))/60000>=duration)?settings.booking_notice:'No suitable slots are available for this date. Choose another date or therapist.';}catch(err){if(mine===generation)status.textContent='Could not check times. Please try again.';}}
for(const x of [service,therapist,date])x.addEventListener('change',updateSlots);slot.addEventListener('change',()=>{send.disabled=!slot.value;document.querySelector('#whatsapp-result').hidden=true;});await updateSlots();
form.addEventListener('submit',async event=>{event.preventDefault();send.disabled=true;const chosen=slots.find(x=>x.id===slot.value),svc=data.services.find(x=>x.id===service.value),person=data.therapists.find(x=>x.id===therapist.value);if(!chosen||!svc||!person){status.textContent='Choose a service, therapist and time.';return;}try{const [latest,currentSettings,currentServices,currentTherapists]=await Promise.all([A.rows('kele_slots',`id=eq.${encodeURIComponent(chosen.id)}`),A.rows('kele_settings','id=eq.1'),A.rows('kele_services',`id=eq.${encodeURIComponent(svc.id)}&active=eq.true`),A.rows('kele_therapists',`id=eq.${encodeURIComponent(person.id)}&active=eq.true`)]);const current=latest[0],cfg=currentSettings[0];if(!cfg?.booking_enabled||!U.validWhatsApp(cfg.whatsapp_number))throw Error('Online bookings are currently closed.');if(!current||current.status!=='available'||new Date(current.starts_at)<=new Date())throw Error('That slot is no longer available. Choose another time.');if(!currentServices[0]||!currentTherapists[0])throw Error('This service or therapist is no longer available. Refresh the page.');if((new Date(current.ends_at)-new Date(current.starts_at))/60000<currentServices[0].duration_minutes)throw Error('This slot is too short for your service.');const values={service:currentServices[0].name,therapist:currentTherapists[0].name,date:U.date(current.starts_at),time:U.time(current.starts_at),price:U.money(currentServices[0].price),name:document.querySelector('#customer-name').value.trim(),notes:document.querySelector('#notes').value.trim()};const message=cfg.whatsapp_template.replace(/\{(service|therapist|date|time|price|name|notes)\}/g,(_,k)=>values[k]);const result=document.querySelector('#whatsapp-result');result.replaceChildren();const a=document.createElement('a');a.className='btn';a.href='https://wa.me/'+cfg.whatsapp_number+'?text='+encodeURIComponent(message);a.target='_blank';a.rel='noopener';a.textContent='Open WhatsApp to send';result.append(a);const p=document.createElement('p');p.className='muted';p.textContent=cfg.booking_notice;result.append(p);result.hidden=false;status.textContent='Your message is ready. Open WhatsApp to send it.';}catch(err){await updateSlots();status.textContent=err.message;}finally{send.disabled=!slot.value;}});
})();
