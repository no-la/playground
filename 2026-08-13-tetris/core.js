export const COLS=10, VISIBLE_ROWS=20, HIDDEN_ROWS=20, ROWS=40;
export const TYPES=['I','J','L','O','S','Z','T'];
export const COLORS={I:'#35c9ef',J:'#4178eb',L:'#f29b38',O:'#f5d547',S:'#54d36a',Z:'#ef5260',T:'#b663e6'};

// SRS states in a 4x4 local grid. O's position changes preserve its SRS rotation centre.
export const SHAPES={
 I:[[[0,1],[1,1],[2,1],[3,1]],[[2,0],[2,1],[2,2],[2,3]],[[0,2],[1,2],[2,2],[3,2]],[[1,0],[1,1],[1,2],[1,3]]],
 J:[[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[1,1],[1,2]],[[0,1],[1,1],[2,1],[2,2]],[[1,0],[1,1],[0,2],[1,2]]],
 L:[[[2,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[1,2],[2,2]],[[0,1],[1,1],[2,1],[0,2]],[[0,0],[1,0],[1,1],[1,2]]],
 O:[[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]]],
 S:[[[1,0],[2,0],[0,1],[1,1]],[[1,0],[1,1],[2,1],[2,2]],[[1,1],[2,1],[0,2],[1,2]],[[0,0],[0,1],[1,1],[1,2]]],
 Z:[[[0,0],[1,0],[1,1],[2,1]],[[2,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[1,2],[2,2]],[[1,0],[0,1],[1,1],[0,2]]],
 T:[[[1,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[2,1],[1,2]],[[1,0],[0,1],[1,1],[1,2]]]
};

const JLSTZ={
 '0>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]], '1>0':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
 '1>2':[[0,0],[1,0],[1,1],[0,-2],[1,-2]], '2>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
 '2>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]], '3>2':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
 '3>0':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], '0>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]]
};
const IKICKS={
 '0>1':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]], '1>0':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
 '1>2':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]], '2>1':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
 '2>3':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]], '3>2':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
 '3>0':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]], '0>3':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
};

export function emptyBoard(){return Array.from({length:ROWS},()=>Array(COLS).fill(null));}
export function shuffledBag(random=Math.random){const a=[...TYPES];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function cells(piece){return SHAPES[piece.type][piece.rotation].map(([x,y])=>[x+piece.x,y+piece.y]);}
export function collides(board,piece){return cells(piece).some(([x,y])=>x<0||x>=COLS||y>=ROWS||(y>=0&&board[y][x]));}

export class Game {
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){this.board=emptyBoard();this.queue=[];this.holdType=null;this.canHold=true;this.active=null;this.score=0;this.lines=0;this.level=1;this.combo=-1;this.backToBack=false;this.over=false;this.lockElapsed=0;this.lockResets=0;this.gravityElapsed=0;this.lastEvent='';this.fillQueue();}
 fillQueue(){while(this.queue.length<12)this.queue.push(...shuffledBag(this.random));}
 spawn(type=this.queue.shift()){this.fillQueue();this.active={type,x:3,y:HIDDEN_ROWS-2,rotation:0,lastAction:'spawn',lastKick:-1};if(type==='I')this.active.y=HIDDEN_ROWS-2;if(collides(this.board,this.active)){this.over=true;return false;}this.canHold=true;this.lockElapsed=this.lockResets=this.gravityElapsed=0;return true;}
 grounded(piece=this.active){return collides(this.board,{...piece,y:piece.y+1});}
 move(dx,dy,action='move'){if(!this.active||this.over)return false;const p={...this.active,x:this.active.x+dx,y:this.active.y+dy};if(collides(this.board,p))return false;this.active=p;this.active.lastAction=action;this.active.lastKick=-1;if(this.grounded()&&action==='move'&&this.lockResets<15){this.lockElapsed=0;this.lockResets++;}return true;}
 rotate(dir){if(!this.active||this.over)return false;const from=this.active.rotation,to=(from+dir+4)%4;if(this.active.type==='O'){this.active.rotation=to;this.active.lastAction='rotate';this.active.lastKick=0;return true;}const table=this.active.type==='I'?IKICKS:JLSTZ;const tests=table[`${from}>${to}`];for(let i=0;i<tests.length;i++){const [dx,dyUp]=tests[i],p={...this.active,rotation:to,x:this.active.x+dx,y:this.active.y-dyUp};if(!collides(this.board,p)){this.active=p;this.active.lastAction='rotate';this.active.lastKick=i;if(this.grounded()&&this.lockResets<15){this.lockElapsed=0;this.lockResets++;}return true;}}return false;}
 hardDrop(){if(!this.active)return;let d=0;while(this.move(0,1,'hardDrop'))d++;this.score+=d*2;this.lock();}
 softDrop(){if(this.move(0,1,'softDrop')){this.score++;return true;}return false;}
 hold(){if(!this.active||!this.canHold)return false;const outgoing=this.active.type,incoming=this.holdType;this.holdType=outgoing;this.canHold=false;if(incoming){this.active=null;this.spawn(incoming);}else{this.active=null;this.spawn();}this.canHold=false;return true;}
 ghostY(){if(!this.active)return 0;const p={...this.active};while(!collides(this.board,{...p,y:p.y+1}))p.y++;return p.y;}
 tick(ms){if(!this.active||this.over)return;this.gravityElapsed+=ms;const interval=this.gravityMs();while(this.gravityElapsed>=interval){this.gravityElapsed-=interval;if(!this.move(0,1,'gravity'))break;}if(this.grounded()){this.lockElapsed+=ms;if(this.lockElapsed>=500)this.lock();}else this.lockElapsed=0;}
 gravityMs(){return Math.max(45,1000*Math.pow(0.8-(this.level-1)*0.007,this.level-1));}
 detectTSpin(){const p=this.active;if(p.type!=='T'||p.lastAction!=='rotate')return null;const cx=p.x+1,cy=p.y+1;const occupied=(x,y)=>x<0||x>=COLS||y<0||y>=ROWS||!!this.board[y][x];const corners=[occupied(cx-1,cy-1),occupied(cx+1,cy-1),occupied(cx+1,cy+1),occupied(cx-1,cy+1)];if(corners.filter(Boolean).length<3)return null;const frontByRotation=[[0,1],[1,2],[2,3],[3,0]];const front=frontByRotation[p.rotation];return (corners[front[0]]&&corners[front[1]])||p.lastKick===4?'full':'mini';}
 lock(){if(!this.active)return;const spin=this.detectTSpin();for(const [x,y] of cells(this.active)){if(y>=0&&y<ROWS)this.board[y][x]=this.active.type;}let cleared=0;for(let y=ROWS-1;y>=0;y--){if(this.board[y].every(Boolean)){this.board.splice(y,1);this.board.unshift(Array(COLS).fill(null));cleared++;y++;}}this.applyScore(spin,cleared);const lockedAbove=cells(this.active).every(([,y])=>y<HIDDEN_ROWS);this.active=null;if(lockedAbove){this.over=true;return;}this.spawn();}
 applyScore(spin,cleared){const lvl=this.level;let base=0,label='';if(spin==='full'){base=[400,800,1200,1600][cleared]||0;label=`T-SPIN${cleared?` ${['','SINGLE','DOUBLE','TRIPLE'][cleared]}`:''}`;}else if(spin==='mini'){base=[100,200,400][cleared]||0;label=`T-SPIN MINI${cleared?' SINGLE':''}`;}else if(cleared){base=[0,100,300,500,800][cleared];label=['','SINGLE','DOUBLE','TRIPLE','TETRIS'][cleared];}
  const difficult=cleared>0&&(cleared===4||!!spin),wasBackToBack=this.backToBack;if(difficult&&wasBackToBack){base=Math.floor(base*1.5);label=`B2B ${label}`;}if(cleared){this.combo++;if(this.combo>0)base+=50*this.combo;this.lines+=cleared;}else this.combo=-1;if(difficult)this.backToBack=true;else if(cleared)this.backToBack=false;
  const perfect=cleared>0&&this.board.every(r=>r.every(v=>!v));if(perfect){const pc=cleared===4&&wasBackToBack?3200:[0,800,1200,1800,2000][cleared];base+=pc;label=`PERFECT CLEAR · ${label}`;}this.score+=base*lvl;this.level=Math.floor(this.lines/10)+1;this.lastEvent=label+(this.combo>0?` · ${this.combo+1} COMBO`:'');}
}
