/** Smoke test local. Cria registros reais de teste; nunca execute em produção. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.API_BASE_URL||'http://localhost:3000';
const adminEmail=process.env.ADMIN_EMAIL||'admin@urbanizago.local';
const adminPassword=process.env.ADMIN_PASSWORD||'UrbanizaGO-dev-2026!';
async function call(path,{method='GET',body,token,expected=200}={}){const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body!==undefined&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}const res=await fetch(base+'/api/v1'+path,{method,headers,body});const data=await res.json();assert.equal(res.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);return data.data;}
const health=await fetch(base+'/health');assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');console.log('OK health');
const email=`smoke-${randomUUID().slice(0,8)}@urbanizago.local`,password='Smoke-local-2026!';
const user=await call('/auth/register',{method:'POST',body:{name:'Cidadão Smoke',email,password,neighborhood:'Bairro Smoke'},expected:201});
let citizen=await call('/auth/login',{method:'POST',body:{email,password,client:'mobile'}});
const admin=await call('/auth/login',{method:'POST',body:{email:adminEmail,password:adminPassword,client:'mobile'}});assert.equal(admin.user.role,'ADMIN');
await call('/dashboard',{token:citizen.accessToken,expected:403});
const old=citizen.refreshToken;citizen=await call('/auth/refresh',{method:'POST',body:{client:'mobile',refreshToken:old}});assert.notEqual(citizen.refreshToken,old);await call('/auth/refresh',{method:'POST',body:{client:'mobile',refreshToken:old},expected:401});console.log('OK autenticação, perfil e rotação');
const categories=await call('/categories',{token:citizen.accessToken});const cat=categories.find(r=>r.code==='POTHOLE');assert(cat,'Categoria POTHOLE deve existir no seed');
const lat=-15+Math.random()*4,lng=-48+Math.random()*4;
function occurrenceBody(description){const form=new FormData();for(const [k,v] of Object.entries({categoryId:cat.id,description,latitude:String(lat),longitude:String(lng),address:'Rua de Teste, 1',neighborhood:'Bairro Smoke',city:'Cidade Teste'}))form.append(k,v);form.append('photos',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'teste.png');return form;}
const o=await call('/occurrences',{method:'POST',token:citizen.accessToken,body:occurrenceBody('Teste automatizado local'),expected:201});assert.match(o.protocol,/^#OG\d{4}-\d{6,}$/);assert.equal(o.validationStatus,'PENDENTE');
const detail=await call(`/occurrences/${o.id}`,{token:citizen.accessToken});assert.equal(detail.photos.length,1);const photo=await fetch(new URL(detail.photos[0].url,base));assert.equal(photo.status,200);console.log('OK ocorrência, protocolo e foto assinada');
const update=(id,status)=>call(`/occurrences/${id}/status`,{method:'PATCH',token:admin.accessToken,body:{status}});
await update(o.id,'EM_ANALISE');await update(o.id,'EM_ANALISE');await update(o.id,'EM_ATENDIMENTO');await update(o.id,'RESOLVIDO');
const dupe=await call('/occurrences',{method:'POST',token:citizen.accessToken,body:occurrenceBody('Teste duplicata local'),expected:201});assert.equal(dupe.duplicateOfId,o.id);await update(dupe.id,'EM_ANALISE');
const ledger=await call('/gamification/points?limit=100',{token:citizen.accessToken});assert.equal(ledger.filter(x=>x.occurrenceId===o.id).reduce((sum,x)=>sum+x.points,0),30);assert.equal(ledger.filter(x=>x.occurrenceId===dupe.id).length,0);
await call(`/occurrences/${o.id}/rating`,{method:'POST',token:citizen.accessToken,body:{score:5,comment:'Smoke local'},expected:201});assert((await call('/notifications',{token:citizen.accessToken})).items.length>0);console.log('OK status, idempotência, duplicata, pontuação, avaliação e notificações');
await call('/dashboard',{token:admin.accessToken});const report=await fetch(base+'/api/v1/reports/export?format=csv',{headers:{Authorization:`Bearer ${admin.accessToken}`}});assert.equal(report.status,200);assert((await report.text()).includes(o.protocol));
const sanction=await call(`/moderation/users/${user.id}/sanctions`,{method:'POST',token:admin.accessToken,body:{type:'BANIMENTO',reason:'Teste local temporário'},expected:201});
await call('/occurrences',{token:citizen.accessToken,expected:403});const sanctions=await call('/moderation/me',{token:citizen.accessToken});assert(sanctions.some(s=>s.id===sanction.id));const appeal=await call('/appeals',{method:'POST',token:citizen.accessToken,body:{sanctionId:sanction.id,text:'Recurso de teste'},expected:201});await call(`/appeals/${appeal.id}`,{method:'PATCH',token:admin.accessToken,body:{status:'ACEITO',response:'Teste revertido'}});await call('/occurrences',{token:citizen.accessToken});console.log('OK relatórios, banimento restrito e recurso');
const mail=await call('/email-logs?limit=100',{token:admin.accessToken});assert(mail.items.some(r=>r.occurrenceId===o.id));console.log('OK outbox; verificar entrega no MailHog após worker.');
console.log(`Smoke concluído. Dados locais de teste: ${email}, ${o.protocol}, ${dupe.protocol}.`);
