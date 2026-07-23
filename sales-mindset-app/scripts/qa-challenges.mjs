import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appDir, '..');
const candidates = [process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
let chromePath = null;
for (const candidate of candidates) { try { await access(candidate); chromePath = candidate; break; } catch {} }
if (!chromePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH to run challenge QA.');

const server = await createServer({ root: siteRoot, server: { host: '127.0.0.1', port: 4177, strictPort: false } });
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (!baseUrl) throw new Error('Vite did not expose a local URL.');
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--disable-gpu','--no-first-run'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

const makeChallenge = (id, title, tier, type) => ({
  id,title,description:`Practice ${title} with one measurable outcome.`,skill:'opening',call_context:'cold_call',difficulty:'medium',tier,
  estimated_minutes:tier==='quick'?5:tier==='core'?12:18,xp:tier==='quick'?40:tier==='core'?75:110,verification_type:type,
  verification_config:{},action_url:type==='coach'?'coach-home.html#roleplay':'challenges.html',objectives:['Complete the action','Review the result'],example_text:'A safe original example.',active:true,
});

await page.route('**/assets/vendor/supabase-*.min.js', route => route.fulfill({
  contentType:'application/javascript',
  body:`
    window.__xss=0;
    const challenges=[
      {id:'a1',date:'2026-07-19',tier:'quick',status:'assigned',progressCurrent:0,progressTarget:1,evidence:{},xpAwarded:0,challenge:${JSON.stringify(makeChallenge('c1','<img src=x onerror="window.__xss=1"> Reframe rejection','quick','reflection'))}},
      {id:'a2',date:'2026-07-19',tier:'core',status:'assigned',progressCurrent:0,progressTarget:1,evidence:{},xpAwarded:0,challenge:${JSON.stringify(makeChallenge('c2','Deliver a clear opener','core','coach'))}},
      {id:'a3',date:'2026-07-19',tier:'stretch',status:'assigned',progressCurrent:0,progressTarget:1,evidence:{},xpAwarded:0,challenge:${JSON.stringify(makeChallenge('c3','Build a follow-up sequence','stretch','work_sample'))}}
    ];
    function daily(){return {date:'2026-07-19',focusSkill:'opening',summary:{completed:challenges.filter(x=>x.status==='completed').length,total:3,todayXp:challenges.reduce((n,x)=>n+x.xpAwarded,0),streak:0},assignments:challenges,history:[]}}
    const db={
      auth:{getSession:async()=>({data:{session:{access_token:'token'}}}),getUser:async()=>({data:{user:{id:'user-1'}},error:null})},
      from:()=>({select:async()=>({data:[],error:null}),upsert:async()=>({data:null,error:null})}),
      rpc:async(name,args)=>{
        if(name==='get_or_assign_daily_challenges')return {data:daily(),error:null};
        if(name==='start_challenge'){const a=challenges.find(x=>x.id===args.p_assignment_id);a.status='in_progress';return {data:{route:a.challenge.action_url,status:a.status},error:null}}
        if(name==='submit_challenge'){const a=challenges.find(x=>x.id===args.p_assignment_id);a.status='completed';a.xpAwarded=a.challenge.xp;a.evidence=args.p_evidence||{};return {data:{status:'completed',xpAwarded:a.xpAwarded},error:null}}
        if(name==='rate_challenge')return {data:{saved:true},error:null};
        if(name==='replace_challenge')return {data:daily(),error:null};
        return {data:null,error:{message:'Unknown RPC'}};
      }
    };
    window.supabase={createClient:()=>db};
  `,
}));
await page.route('https://fonts.googleapis.com/**', route => route.abort());
await page.route('https://fonts.gstatic.com/**', route => route.abort());

try {
  await page.goto(`${baseUrl}challenges.html`, { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.challenge');
  assert.equal(await page.locator('.challenge').count(),3,'assigns exactly three daily challenges');
  assert.equal(await page.locator('.tier').allTextContents().then(x=>x.map(v=>v.split(' · ')[0]).join(',')),'Quick win,Core practice,Stretch');
  assert.equal(await page.locator('.challenge img').count(),0,'catalog HTML is rendered as text');
  assert.equal(await page.evaluate(()=>window.__xss),0,'catalog HTML never executes');
  assert.equal(await page.getByText('Leaderboard').count(),0,'fake leaderboard is removed');
  assert.equal(await page.getByText('Rewards Shop').count(),0,'fake rewards are removed');

  await page.locator('.challenge').first().getByRole('button',{name:'Start'}).click();
  await page.locator('#evidenceText').fill('<img src=x onerror="window.__xss=2"> This reflection contains enough safe text to complete the challenge.');
  await page.locator('#submitEvidence').click();
  await page.waitForFunction(()=>document.querySelector('.challenge.completed'));
  assert.equal(await page.locator('.evidence-preview img').count(),0,'evidence HTML is rendered as text');
  assert.equal(await page.evaluate(()=>window.__xss),0,'evidence HTML never executes');
  assert.match(await page.locator('#xpStat').innerText(),/40/,'XP comes from completed assignment data');
  assert.deepEqual(pageErrors,[],`browser errors: ${pageErrors.join(', ')}`);

  const migration = await readFile(path.join(siteRoot,'supabase/migrations/20260719030000_practical_challenges.sql'),'utf8');
  assert.equal((migration.match(/^\('[-a-z0-9]+','/gm)||[]).length,24,'catalog contains 24 original challenges');
  assert.match(migration,/auth\.uid\(\)/,'RPCs derive the authenticated user');
  assert.match(migration,/one_active_challenge_per_tier/,'daily tiers are unique');
  assert.match(migration,/assignment_date>=v_date-6/,'seven-day repeats are excluded');
  assert.match(migration,/Daily replacement already used/,'only one replacement is allowed');
  assert.match(migration,/char_length\(v_text\) between 30 and 1000/,'evidence length is enforced server-side');
  assert.match(migration,/if v_a\.status='completed'/,'duplicate XP awards are idempotent');
  assert.match(migration,/revoke insert, update, delete on public\.user_challenge_assignments/,'clients cannot mutate assignment state directly');

  const dashboard = await readFile(path.join(siteRoot,'dashboard.html'),'utf8');
  assert.match(dashboard,/ChallengeSystem\.getDaily\(\)/,'dashboard loads real daily assignment data');
  assert.match(dashboard,/href="challenges\.html">View All/,'dashboard links to the full challenge page');
  console.log('Challenge QA passed: three adaptive tiers, honest UI, safe evidence, secure RPC contract, and dashboard integration.');
} finally {
  await browser.close();
  await server.close();
}
