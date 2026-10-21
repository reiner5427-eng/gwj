import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
const reply = (data: unknown, status=200) => Response.json(data,{status,headers});
const fail = (message: string,status=400)=>reply({error:message},status);
async function ownerHash(req:Request) {
  const token=req.headers.get('X-Album-Owner')||'';
  if(!/^[a-zA-Z0-9-]{32,100}$/.test(token)) return '';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
async function list(hash:string) {
  const result=await env.DB.prepare('SELECT id, name, message, owner_hash, updated_at FROM entries ORDER BY created_at DESC, id DESC').all();
  return result.results.map((row:any)=>({id:row.id,name:row.name,message:row.message,updatedAt:row.updated_at,mine:!!hash&&row.owner_hash===hash}));
}
export async function GET(req:Request) {
  try{return reply({entries:await list(await ownerHash(req))});}
  catch{ return fail('앨범을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',503); }
}
async function mutate(req:Request,method:string) {
  if(req.headers.get('Sec-Fetch-Site')==='cross-site')return fail('이 사이트에서 다시 시도해 주세요.',403);
  if(!req.headers.get('Content-Type')?.startsWith('application/json'))return fail('올바른 형식으로 입력해 주세요.',415);
  const hash=await ownerHash(req);if(!hash)return fail('브라우저 저장을 허용한 뒤 다시 시도해 주세요.',403);
  const raw=await req.text();if(raw.length>4096)return fail('입력 내용이 너무 길어요.',413);
  let data:any;try{data=JSON.parse(raw)}catch{return fail('입력 내용을 확인해 주세요.')}
  if(!data||typeof data!=='object')return fail('입력 내용을 확인해 주세요.');
  try {
    if(method==='DELETE') {
      if(typeof data.id!=='string'||data.id.length>100)return fail('한마디를 찾을 수 없어요.');
      const result=await env.DB.prepare('DELETE FROM entries WHERE id = ? AND owner_hash = ?').bind(data.id,hash).run();
      if(!result.meta.changes)return fail('처음 작성한 브라우저에서만 삭제할 수 있어요. 이미 삭제된 글인지도 확인해 주세요.',403);
    } else {
      const name=typeof data.name==='string'?data.name.trim().normalize('NFKC'):'';
      const message=typeof data.message==='string'?data.message.trim():'';
      if(!name||name.length>20||!message||message.length>300)return fail('이름은 1~20자, 한마디는 1~300자로 적어 주세요.');
      const nameKey=name.replace(/\s/g,'').toLocaleLowerCase('ko');
      if(!nameKey)return fail('이름을 적어 주세요.');
      const duplicate:any=await env.DB.prepare('SELECT id FROM entries WHERE name_key = ?').bind(nameKey).first();
      if(duplicate&&duplicate.id!==data.id)return fail('이미 같은 이름의 한마디가 있어요. 새로고침한 뒤 기존 글의 수정 버튼을 눌러 주세요.',409);
      const now=new Date().toISOString();
      if(method==='POST') {
        const result=await env.DB.prepare('INSERT INTO entries (id,name,name_key,message,owner_hash,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM entries) < 26').bind(crypto.randomUUID(),name,nameKey,message,hash,now,now).run();
        if(!result.meta.changes)return fail('26명의 한마디가 모두 모였어요.',409);
      } else {
        if(typeof data.id!=='string'||data.id.length>100)return fail('한마디를 찾을 수 없어요.');
        const result=await env.DB.prepare('UPDATE entries SET name=?,name_key=?,message=?,updated_at=? WHERE id=? AND owner_hash=?').bind(name,nameKey,message,now,data.id,hash).run();
        if(!result.meta.changes)return fail('처음 작성한 브라우저에서만 수정할 수 있어요. 이미 삭제된 글인지도 확인해 주세요.',403);
      }
    }
    return reply({entries:await list(hash)});
  } catch(error) {
    if(String(error).includes('UNIQUE'))return fail('이미 같은 이름의 한마디가 있어요. 새로고침한 뒤 수정해 주세요.',409);
    return fail('저장하지 못했어요. 입력 내용은 그대로 있어요. 잠시 후 다시 시도해 주세요.',503);
  }
}
export const POST=(req:Request)=>mutate(req,'POST');
export const PATCH=(req:Request)=>mutate(req,'PATCH');
export const DELETE=(req:Request)=>mutate(req,'DELETE');
