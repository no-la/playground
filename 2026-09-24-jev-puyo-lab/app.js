import { COLS,ROWS,EMPTY,emptyBoard,createSequence,enumerateMoves,heuristicMove,boardToText,isGameOver } from "./engine.js";

const $=s=>document.querySelector(s);const boardCanvas=$("#board"),ctx=boardCanvas.getContext("2d"),nextCanvas=$("#next"),nextCtx=nextCanvas.getContext("2d");
const W=boardCanvas.width/COLS,H=boardCanvas.height/(ROWS-1);const PALETTE=["#ed385d","#329cf5","#42d76f","#f5c329"];
let game=null,timer=null,runToken=0,humanMove={col:2,rotation:0};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const STRATEGY_NOTES={balanced:"生存と連鎖をバランスよく評価",chain:"小さな消去を我慢して連鎖の種を育てる",clear:"消せるぷよを早めに消して得点化",survive:"高さ・穴・凹凸を抑えて生存を優先"};

function resetState(){const seed=Number($("#seed").value)||4242;game={seed,sequence:createSequence(seed),index:0,board:emptyBoard(),score:0,maxChain:0,turn:0,running:true,paused:false,latencies:[],confidences:[],logs:[],active:null};}
function pair(){return game.sequence[game.index];}function nextPair(offset=1){return game.sequence[game.index+offset];}

function updateUI(){
  $("#score").textContent=String(game?.score||0).padStart(8,"0");$("#max-chain").textContent=game?.maxChain||0;$("#turn").textContent=game?.turn||0;
  $("#avg-time").textContent=game?.latencies.length?`${Math.round(game.latencies.reduce((a,b)=>a+b,0)/game.latencies.length)}ms`:"—";
  $("#confidence").textContent=game?.confidences.length?`${Math.round(game.confidences.at(-1)*100)}%`:"—";draw();drawNext();
}

function roundRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function drawPuyo(c,color,x,y,size,squash=0,alpha=1){
  const pad=2,cy=y+size/2,cx=x+size/2;c.save();c.globalAlpha=alpha;c.translate(cx,cy);c.scale(1+squash,1-squash);c.translate(-cx,-cy);
  const grad=c.createRadialGradient(x+size*.34,y+size*.27,2,cx,cy,size*.62);grad.addColorStop(0,"#fff");grad.addColorStop(.18,PALETTE[color]);grad.addColorStop(1,shade(PALETTE[color],-38));c.fillStyle=grad;roundRect(c,x+pad,y+pad,size-pad*2,size-pad*2,size*.43);
  c.fillStyle="rgba(255,255,255,.72)";c.beginPath();c.ellipse(x+size*.31,y+size*.25,size*.11,size*.07,-.5,0,Math.PI*2);c.fill();
  c.fillStyle="#fff";c.beginPath();c.ellipse(x+size*.39,y+size*.53,size*.105,size*.15,0,0,Math.PI*2);c.ellipse(x+size*.6,y+size*.53,size*.105,size*.15,0,0,Math.PI*2);c.fill();c.fillStyle="#132039";c.beginPath();c.arc(x+size*.41,y+size*.56,size*.05,0,Math.PI*2);c.arc(x+size*.58,y+size*.56,size*.05,0,Math.PI*2);c.fill();c.restore();
}
function shade(hex,n){const v=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(v>>16)+n)),g=Math.max(0,Math.min(255,((v>>8)&255)+n)),b=Math.max(0,Math.min(255,(v&255)+n));return `rgb(${r},${g},${b})`;}
function draw(){
  ctx.clearRect(0,0,boardCanvas.width,boardCanvas.height);const bg=ctx.createLinearGradient(0,0,0,boardCanvas.height);bg.addColorStop(0,"#101e55");bg.addColorStop(1,"#060b23");ctx.fillStyle=bg;ctx.fillRect(0,0,boardCanvas.width,boardCanvas.height);
  ctx.strokeStyle="rgba(115,158,255,.065)";ctx.lineWidth=1;for(let c=1;c<COLS;c++){ctx.beginPath();ctx.moveTo(c*W,0);ctx.lineTo(c*W,boardCanvas.height);ctx.stroke()}for(let r=1;r<ROWS-1;r++){ctx.beginPath();ctx.moveTo(0,r*H);ctx.lineTo(boardCanvas.width,r*H);ctx.stroke()}
  if(!game)return;for(let r=1;r<ROWS;r++)for(let c=0;c<COLS;c++)if(game.board[r][c]!==EMPTY)drawPuyo(ctx,game.board[r][c],c*W,(r-1)*H,W);
  if(game.active){for(const cell of game.active.cells){const y=(cell.row-1)*H;drawPuyo(ctx,pair()[cell.colorIndex],cell.col*W,y,W,game.active.squash||0,game.active.alpha??1);}}
  if($("#mode").value==="human"&&game.running&&!game.active){const moves=enumerateMoves(game.board,pair()),move=moves.find(m=>m.col===humanMove.col&&m.rotation===humanMove.rotation)||moves[0];if(move){humanMove={col:move.col,rotation:move.rotation};for(const cell of move.cells)drawPuyo(ctx,pair()[cell.colorIndex],cell.col*W,(cell.row-1)*H,W,0,.23);const topCells=spawnCells(humanMove);topCells.forEach((cell,i)=>drawPuyo(ctx,pair()[i],cell.col*W,(cell.row-1)*H,W));}}
}
function spawnCells(move){const offsets=[[0,-1],[1,0],[0,1],[-1,0]],o=offsets[move.rotation];return [{col:move.col,row:1},{col:move.col+o[0],row:1+o[1]}];}
function drawNext(){nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);nextCtx.fillStyle="#07102c";nextCtx.fillRect(0,0,nextCanvas.width,nextCanvas.height);if(!game)return;[nextPair(1),nextPair(2)].forEach((p,i)=>{const size=i?39:48,x=i?63:12,y=i?98:24;drawPuyo(nextCtx,p[1],x,y,size);drawPuyo(nextCtx,p[0],x,y+size-3,size);});}

async function animatePlacement(move,token){const start=performance.now(),duration=220,spawn=spawnCells(move);while(performance.now()-start<duration){if(token!==runToken)return;const t=(performance.now()-start)/duration,e=1-(1-t)**3;game.active={cells:move.cells.map((c,i)=>({...c,row:spawn[i].row+(c.row-spawn[i].row)*e})),squash:Math.sin(t*Math.PI)*-.08};draw();await sleep(16)}game.active=null;}
async function animateResolution(move,token){for(const step of move.steps){if(token!==runToken)return;game.board=step.board;game.score+=step.score;game.maxChain=Math.max(game.maxChain,step.chain);chainCall(step.chain);updateUI();await sleep(520)}game.board=move.resultBoard;updateUI();await sleep(150);}
function chainCall(n){const el=$("#chain-call");el.textContent=`${n} CHAIN!`;el.classList.remove("show");void el.offsetWidth;el.classList.add("show");}

function safeCandidates(moves){return moves.map(({resultBoard,steps,cells,...move})=>move);}
async function chooseMove(moves,mode){
  const strategy=$("#strategy").value;
  if(mode==="heuristic"){const started=performance.now();const move=heuristicMove(moves,strategy);return {move,decision:{moveId:move.id,confidence:1,posture:`${strategy} heuristic`,latencyMs:Math.round(performance.now()-started),model:"LOCAL"}};}
  $(".decision").classList.add("thinking");$("#status").textContent="JEV THINKING";
  const response=await fetch("/api/decide",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({board:boardToText(game.board),pair:"RGBY"[pair()[0]]+"RGBY"[pair()[1]],next:"RGBY"[nextPair()[0]]+"RGBY"[nextPair()[1]],candidates:safeCandidates(moves),mode,strategy})});
  const result=await response.json();$(".decision").classList.remove("thinking");$("#status").textContent="RUNNING";if(!response.ok)throw new Error(result.error||"Jev decision failed");return {move:moves.find(m=>m.id===result.moveId)||heuristicMove(moves,strategy),decision:result};
}

async function playLoop(token){
  while(game.running&&token===runToken){if(game.paused){await sleep(100);continue}if(isGameOver(game.board)){endGame();break}const mode=$("#mode").value;if(mode==="human"){draw();await sleep(100);continue}
    const moves=enumerateMoves(game.board,pair());if(!moves.length){endGame();break}let choice;
    try{choice=await chooseMove(moves,mode)}catch(error){showError(error.message);game.paused=true;break}if(token!==runToken)return;await commitMove(choice.move,choice.decision,token);await sleep(260);
  }
}
async function commitMove(move,decision,token=runToken){
  await animatePlacement(move,token);if(token!==runToken)return;game.turn++;game.latencies.push(decision.latencyMs||0);game.confidences.push(decision.confidence??1);renderDecision(move,decision);await animateResolution(move,token);addLog(move,decision);game.index++;if(isGameOver(game.board)){endGame();return}updateUI();
}
function renderDecision(move,d){$("#move").textContent=move.label;$("#posture").textContent=d.posture||"—";$("#latency").textContent=`${d.latencyMs||0}ms`;$("#model").textContent=(d.model||"LOCAL").replace("typesafe/","");$("#confidence-bar").style.width=`${(d.confidence??1)*100}%`;}
function addLog(move,d){const result=move.allClear?`全消し / +${move.score}`:move.chains?`${move.chains}連鎖 / +${move.score}`:"積み上げ";game.logs.unshift({turn:game.turn,move:move.label,policy:d.posture||$("#mode").value,confidence:d.confidence??1,result});$("#log").innerHTML=game.logs.slice(0,30).map(x=>`<div class="log-row"><span>${String(x.turn).padStart(3,"0")}</span><span>${x.move}</span><span>${x.policy}</span><span>${Math.round(x.confidence*100)}%</span><span class="${x.result!=="積み上げ"?"good":""}">${x.result}</span></div>`).join("");}
function endGame(){$("#status").textContent="GAME OVER";game.running=false;$("#overlay").classList.remove("hidden");$("#overlay").innerHTML=`<h2>FINISH</h2><p>${game.turn}手 / ${game.score.toLocaleString()}点 / 最大${game.maxChain}連鎖</p>`;}
function showError(message){$("#status").textContent="ERROR";$("#overlay").classList.remove("hidden");$("#overlay").innerHTML=`<h2>PAUSED</h2><p>${escapeHtml(message)}</p>`;}
function escapeHtml(s){const e=document.createElement("span");e.textContent=s;return e.innerHTML;}

function start(){runToken++;clearInterval(timer);resetState();humanMove={col:2,rotation:0};$("#overlay").classList.add("hidden");$("#status").textContent="RUNNING";$("#move").textContent="—";$("#posture").textContent="判断待ち";$("#log").innerHTML='<p class="empty">最初の判断を待っています。</p>';updateUI();const token=runToken;playLoop(token);timer=setInterval(()=>{if(game?.running&&!game.paused&&$("#mode").value==="human")lockHuman();},3500);}
async function lockHuman(){if(!game?.running||game.active)return;const moves=enumerateMoves(game.board,pair()),move=moves.find(m=>m.col===humanMove.col&&m.rotation===humanMove.rotation)||moves[0];if(move)await commitMove(move,{confidence:1,posture:"human",latencyMs:0,model:"HUMAN"});}

document.addEventListener("keydown",e=>{if(!game?.running||game.paused||$("#mode").value!=="human")return;const moves=enumerateMoves(game.board,pair());if(e.key==="ArrowLeft")humanMove.col--;else if(e.key==="ArrowRight")humanMove.col++;else if(e.key.toLowerCase()==="z")humanMove.rotation=(humanMove.rotation+3)%4;else if(e.key.toLowerCase()==="x")humanMove.rotation=(humanMove.rotation+1)%4;else if(e.key==="ArrowDown"||e.code==="Space")lockHuman();else return;e.preventDefault();if(!moves.some(m=>m.col===humanMove.col&&m.rotation===humanMove.rotation)){humanMove.col=Math.max(0,Math.min(COLS-1,humanMove.col));const fallback=moves.find(m=>m.rotation===humanMove.rotation&&Math.abs(m.col-humanMove.col)<=1)||moves[0];humanMove={col:fallback.col,rotation:fallback.rotation};}draw();});
$("#start").addEventListener("click",start);$("#pause").addEventListener("click",()=>{if(!game)return;game.paused=!game.paused;$("#pause").textContent=game.paused?"RESUME":"PAUSE";$("#status").textContent=game.paused?"PAUSED":"RUNNING";$("#overlay").classList.toggle("hidden",!game.paused);if(game.paused)$("#overlay").innerHTML="<h2>PAUSED</h2><p>再開すると実験を続けます</p>";});
$("#random-seed").addEventListener("click",()=>{$("#seed").value=Math.floor(Math.random()*999999)});$("#clear-log").addEventListener("click",()=>{$("#log").innerHTML='<p class="empty">ログを消去しました。</p>';if(game)game.logs=[]});
$("#strategy").addEventListener("change",()=>{$("#strategy-note").textContent=STRATEGY_NOTES[$("#strategy").value]});
ctx.fillStyle="#07102c";ctx.fillRect(0,0,boardCanvas.width,boardCanvas.height);
