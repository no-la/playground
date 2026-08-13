import {Game,COLORS,SHAPES,HIDDEN_ROWS} from './core.js';
const board=document.querySelector('#board'),ctx=board.getContext('2d');
const hold=document.querySelector('#hold'),hctx=hold.getContext('2d');
const next=document.querySelector('#next'),nctx=next.getContext('2d');
const overlay=document.querySelector('#overlay'),title=document.querySelector('#overlay-title'),copy=document.querySelector('#overlay-copy'),startBtn=document.querySelector('#start');
const scoreEl=document.querySelector('#score'),levelEl=document.querySelector('#level'),linesEl=document.querySelector('#lines'),callout=document.querySelector('#callout');
const game=new Game();let running=false,paused=false,last=0,lastEvent='';
const cell=30;

function block(c,x,y,size=cell,alpha=1){c.globalAlpha=alpha;c.fillStyle=COLORS[x];c.fillRect(y[0]+1,y[1]+1,size-2,size-2);const g=c.createLinearGradient(y[0],y[1],y[0],y[1]+size);g.addColorStop(0,'#fff5');g.addColorStop(.32,'#fff0');g.addColorStop(1,'#0004');c.fillStyle=g;c.fillRect(y[0]+1,y[1]+1,size-2,size-2);c.strokeStyle='#fff3';c.strokeRect(y[0]+1.5,y[1]+1.5,size-3,size-3);c.globalAlpha=1;}
function draw(){ctx.clearRect(0,0,board.width,board.height);ctx.strokeStyle='#ffffff0b';ctx.lineWidth=1;for(let x=0;x<=10;x++){ctx.beginPath();ctx.moveTo(x*cell+.5,0);ctx.lineTo(x*cell+.5,600);ctx.stroke();}for(let y=0;y<=20;y++){ctx.beginPath();ctx.moveTo(0,y*cell+.5);ctx.lineTo(300,y*cell+.5);ctx.stroke();}
 for(let y=HIDDEN_ROWS;y<game.board.length;y++)for(let x=0;x<10;x++)if(game.board[y][x])block(ctx,game.board[y][x],[x*cell,(y-HIDDEN_ROWS)*cell]);
 if(game.active){const ghost={...game.active,y:game.ghostY()};for(const [x,y] of SHAPES[ghost.type][ghost.rotation]){const yy=ghost.y+y-HIDDEN_ROWS;if(yy>=0)block(ctx,ghost.type,[(ghost.x+x)*cell,yy*cell],cell,.2);}for(const [x,y] of SHAPES[game.active.type][game.active.rotation]){const yy=game.active.y+y-HIDDEN_ROWS;if(yy>=0)block(ctx,game.active.type,[(game.active.x+x)*cell,yy*cell]);}}
 drawMini(hctx,hold,game.holdType? [game.holdType]:[],88);drawMini(nctx,next,game.queue.slice(0,5),68);scoreEl.textContent=game.score.toLocaleString();levelEl.textContent=game.level;linesEl.textContent=game.lines;
 if(game.lastEvent&&game.lastEvent!==lastEvent){lastEvent=game.lastEvent;callout.textContent=lastEvent;callout.classList.remove('show');void callout.offsetWidth;callout.classList.add('show');}}
function drawMini(c,canvas,types,rowH){c.clearRect(0,0,canvas.width,canvas.height);types.forEach((type,i)=>{const shape=SHAPES[type][0],size=18,minX=Math.min(...shape.map(p=>p[0])),maxX=Math.max(...shape.map(p=>p[0])),minY=Math.min(...shape.map(p=>p[1])),maxY=Math.max(...shape.map(p=>p[1]));const ox=(canvas.width-(maxX-minX+1)*size)/2-minX*size,oy=i*rowH+(rowH-(maxY-minY+1)*size)/2-minY*size;shape.forEach(([x,y])=>block(c,type,[ox+x*size,oy+y*size],size));});}
function showOverlay(heading,text,button){title.textContent=heading;copy.textContent=text;startBtn.textContent=button;overlay.classList.remove('hidden');}
function begin(){game.reset();game.spawn();running=true;paused=false;last=performance.now();lastEvent='';overlay.classList.add('hidden');requestAnimationFrame(loop);draw();}
function loop(now){if(!running||paused)return;const dt=Math.min(50,now-last);last=now;game.tick(dt);draw();if(game.over){running=false;showOverlay('GAME OVER',`${game.score.toLocaleString()} POINTS · ${game.lines} LINES`,'PLAY AGAIN');return;}requestAnimationFrame(loop);}
function action(name){if(!running||paused)return;({left:()=>game.move(-1,0),right:()=>game.move(1,0),soft:()=>game.softDrop(),ccw:()=>game.rotate(-1),cw:()=>game.rotate(1),hard:()=>game.hardDrop(),hold:()=>game.hold()}[name]?.());draw();}
const keymap={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'soft',ArrowUp:'cw',z:'ccw',Z:'ccw',x:'cw',X:'cw',' ':'hard',c:'hold',C:'hold',Shift:'hold'};
document.addEventListener('keydown',e=>{if(e.key==='p'||e.key==='P'||e.key==='Escape'){togglePause();return;}const a=keymap[e.key];if(a){e.preventDefault();action(a);}});
document.querySelectorAll('[data-action]').forEach(btn=>{let timer,repeat;const act=()=>action(btn.dataset.action);btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);btn.classList.add('active');act();if(['left','right','soft'].includes(btn.dataset.action))timer=setTimeout(()=>repeat=setInterval(act,55),170);});const stop=()=>{clearTimeout(timer);clearInterval(repeat);btn.classList.remove('active');};btn.addEventListener('pointerup',stop);btn.addEventListener('pointercancel',stop);});
function togglePause(){if(!running)return;paused=!paused;if(paused)showOverlay('PAUSED','ひと休み。盤面はそのままです。','RESUME');else{overlay.classList.add('hidden');last=performance.now();requestAnimationFrame(loop);}}
startBtn.addEventListener('click',()=>paused?togglePause():begin());document.querySelector('#pause').addEventListener('click',togglePause);document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)togglePause();});
draw();
