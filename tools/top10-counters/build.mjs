import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {existsSync,createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
const here=path.dirname(fileURLToPath(import.meta.url));
const tools=process.env.TOP10_TOOLS_DIR||here;
const output=process.argv[2];if(!output)throw Error('Pass the counter output directory');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const filename=url.pathname.startsWith('/three/')?path.join(tools,'node_modules',url.pathname.slice(1)):path.join(here,process.env.TOP10_PREMIUM==='1'?'premium.html':'counter.html');if(url.pathname.startsWith('/three/')&&!filename.startsWith(path.join(tools,'node_modules','three')))throw Error('Invalid path');res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.json')?'application/json':'text/html');res.end(await readFile(filename));}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
 page.on('pageerror',error=>process.stderr.write(error.message+'\n'));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.counterReady,{timeout:60000});
 const manifest={width:1080,height:1920,fps:30,models:{pink3d:{frames:30},film:{frames:24}}};
 for(const [model,meta] of Object.entries(manifest.models)){
  if(process.env.TOP10_MODELS&&!process.env.TOP10_MODELS.split(',').includes(model))continue;
  await mkdir(path.join(output,model),{recursive:true});
  for(let rank=10;rank>=1;rank--){
   if(model==='pink3d' && process.env.TOP10_PINK_RANKS && !process.env.TOP10_PINK_RANKS.split(',').map(Number).includes(rank))continue;
   const target=path.join(output,model,`${String(rank).padStart(2,'0')}.mp4`);
   if(existsSync(target)&&process.env.TOP10_FORCE_REBUILD!=='1'){try{const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',target],{encoding:'utf8'}));if(Math.abs(Number(probe.format.duration)-meta.frames/30)<.05){process.stdout.write(`SKIP ${model} ${rank}\n`);continue}}catch{}}
   const audio=process.env.TOP10_AUDIO_REFERENCE;
   const audioInput=audio?['-i',audio]:['-f','lavfi','-i',`sine=frequency=${model==='film'?880:440}:sample_rate=48000:duration=${meta.frames/30}`];
   const audioEncoding=audio?['-c:a','copy']:['-af','volume=0.18,afade=t=out:st=0.05:d=0.18','-c:a','aac','-ar','48000','-ac','2'];
   const ffmpeg=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','30','-vcodec','png','-i','pipe:0',...audioInput,'-map','0:v:0','-map','1:a:0','-frames:v',String(meta.frames),'-t',String(meta.frames/30),'-c:v','libx264','-threads','2','-crf','18','-preset','fast','-pix_fmt','yuv420p',...audioEncoding,'-movflags','+faststart',target],{stdio:['pipe','ignore','pipe']});
   let errors='';ffmpeg.stderr.on('data',chunk=>errors+=chunk);const closed=once(ffmpeg,'close');
   for(let frame=0;frame<meta.frames;frame++){await page.evaluate(({model,rank,frame})=>window.counterFrame(model,rank,frame),{model,rank,frame});const png=await page.screenshot({type:'png'});if(!ffmpeg.stdin.write(png))await once(ffmpeg.stdin,'drain')}
   ffmpeg.stdin.end();const [code]=await closed;if(code)throw Error(errors);
   process.stdout.write(`COUNTER=OK ${model} ${rank}\n`);
   if(process.env.TOP10_SAMPLE==='1')break;
  }
 }
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}finally{await browser.close();server.close()}
