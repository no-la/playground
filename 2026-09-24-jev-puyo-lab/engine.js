export const COLS = 6;
export const ROWS = 13;
export const VISIBLE_ROWS = 12;
export const COLORS = 4;
export const EMPTY = -1;
export const GARBAGE = 4;
export const DEATH_ROW = 1;
export const DEATH_COL = 2;
const ROTATIONS = [[0,-1],[1,0],[0,1],[-1,0]];
const CHAIN_POWER = [0,8,16,32,64,96,128,160,192,224,256,288,320,352,384,416,448,480,512];
const COLOR_BONUS = [0,0,3,6,12];
const GROUP_BONUS = [0,0,0,0,0,2,3,4,5,6,7];

export function mulberry32(seed) { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const emptyBoard = () => Array.from({ length:ROWS }, () => Array(COLS).fill(EMPTY));
export const cloneBoard = (board) => board.map((row) => [...row]);

export function createSequence(seed, count = 2048) {
  const random = mulberry32(seed >>> 0);
  return Array.from({ length:count }, () => [Math.floor(random()*COLORS), Math.floor(random()*COLORS)]);
}

export function cellsForPlacement(col, rotation) {
  const [dc] = ROTATIONS[rotation];
  return [{ col, colorIndex:0 }, { col:col+dc, colorIndex:1 }];
}

function landingRows(board, col, rotation) {
  const [dc, dr] = ROTATIONS[rotation];
  if (col < 0 || col >= COLS || col+dc < 0 || col+dc >= COLS) return null;
  const heights = Array.from({ length:COLS }, (_,c) => board.findIndex((row) => row[c] !== EMPTY));
  for (let c=0;c<COLS;c++) if (heights[c] < 0) heights[c] = ROWS;
  if (dc === 0) {
    const lower = heights[col]-1;
    const pivot = dr === 1 ? lower-1 : lower;
    const satellite = dr === 1 ? lower : lower-1;
    if (pivot < 0 || satellite < 0) return null;
    return [{row:pivot,col},{row:satellite,col}];
  }
  // 横向きの組は、どちらか一方が接地するまで一体のまま落ちる。
  // 高さの違う列へ置いた場合、もう一方はこの後の重力で「ちぎり」落下する。
  const row = Math.min(heights[col], heights[col+dc])-1;
  const a = { row, col };
  const b = { row, col:col+dc };
  return a.row < 0 || b.row < 0 ? null : [a,b];
}

export function placePair(board, pair, col, rotation) {
  const cells = landingRows(board,col,rotation); if (!cells) return null;
  cells.forEach((cell,index) => { cell.colorIndex = index; });
  const next = cloneBoard(board);
  next[cells[0].row][cells[0].col] = pair[0]; next[cells[1].row][cells[1].col] = pair[1];
  return { board:next, cells };
}

export function applyGravity(board) {
  for (let c=0;c<COLS;c++) {
    let write=ROWS-1;
    for (let r=ROWS-1;r>=0;r--) if (board[r][c] !== EMPTY) { board[write][c]=board[r][c]; if (write!==r) board[r][c]=EMPTY; write--; }
    while (write>=0) board[write--][c]=EMPTY;
  }
}

export function popGroups(board) {
  const seen=Array.from({length:ROWS},()=>Array(COLS).fill(false)); const groups=[];
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (board[r][c]!==EMPTY&&board[r][c]!==GARBAGE&&!seen[r][c]) {
    const color=board[r][c], stack=[[r,c]], group=[]; seen[r][c]=true;
    while(stack.length){const [y,x]=stack.pop();group.push([y,x]);for(const [dy,dx] of [[-1,0],[1,0],[0,-1],[0,1]]){const ny=y+dy,nx=x+dx;if(ny>=0&&ny<ROWS&&nx>=0&&nx<COLS&&!seen[ny][nx]&&board[ny][nx]===color){seen[ny][nx]=true;stack.push([ny,nx]);}}}
    if(group.length>=4) groups.push({color,cells:group});
  }
  const adjacentGarbage=new Set();
  for(const group of groups) for(const [r,c] of group.cells){board[r][c]=EMPTY;for(const[dy,dx]of[[-1,0],[1,0],[0,-1],[0,1]]){const y=r+dy,x=c+dx;if(y>=0&&y<ROWS&&x>=0&&x<COLS&&board[y][x]===GARBAGE)adjacentGarbage.add(`${y},${x}`);}}
  for(const key of adjacentGarbage){const [r,c]=key.split(",").map(Number);board[r][c]=EMPTY;}
  return groups;
}

export function dropGarbage(input, count, seed = 1) {
  const board=cloneBoard(input),random=mulberry32(seed>>>0);let remaining=Math.max(0,Math.floor(count));
  while(remaining>0){const columns=[0,1,2,3,4,5].sort(()=>random()-.5);for(const col of columns){if(!remaining)break;let row=ROWS-1;while(row>=0&&board[row][col]!==EMPTY)row--;if(row<0)return {board,overflow:true,dropped:count-remaining};board[row][col]=GARBAGE;remaining--;}}
  applyGravity(board);return {board,overflow:false,dropped:count};
}

export function resolveBoard(input) {
  const board=cloneBoard(input); let chains=0,totalScore=0,cleared=0; const steps=[];
  applyGravity(board);
  while(true){const beforeBoard=cloneBoard(board),groups=popGroups(board);if(!groups.length)break;chains++;const count=groups.reduce((n,g)=>n+g.cells.length,0);const colors=new Set(groups.map(g=>g.color)).size;const groupBonus=groups.reduce((n,g)=>n+(GROUP_BONUS[Math.min(g.cells.length,10)]??10),0);const bonus=Math.max(1,(CHAIN_POWER[Math.min(chains-1,CHAIN_POWER.length-1)]??512)+COLOR_BONUS[colors]+groupBonus);const score=count*10*bonus;totalScore+=score;cleared+=count;const poppedBoard=cloneBoard(board);applyGravity(board);steps.push({chain:chains,groups,count,score,beforeBoard,poppedBoard,afterBoard:cloneBoard(board),board:poppedBoard});}
  const allClear=chains>0&&board.every(row=>row.every(cell=>cell===EMPTY));
  if(allClear)totalScore+=2100;
  return {board,chains,score:totalScore,cleared,steps,allClear};
}

export function boardFeatures(board) {
  const heights=[];let holes=0,potential=0;
  for(let c=0;c<COLS;c++){let top=ROWS;for(let r=0;r<ROWS;r++)if(board[r][c]!==EMPTY){top=Math.min(top,r);for(let y=r+1;y<ROWS;y++)if(board[y][c]===EMPTY)holes++;break;}heights.push(ROWS-top);}
  const seen=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c]!==EMPTY&&board[r][c]!==GARBAGE&&!seen[r][c]){let size=0;const color=board[r][c],stack=[[r,c]];seen[r][c]=true;while(stack.length){const[y,x]=stack.pop();size++;for(const[dy,dx]of[[-1,0],[1,0],[0,-1],[0,1]]){const ny=y+dy,nx=x+dx;if(ny>=0&&ny<ROWS&&nx>=0&&nx<COLS&&!seen[ny][nx]&&board[ny][nx]===color){seen[ny][nx]=true;stack.push([ny,nx]);}}}if(size<4)potential+=size*size;}
  return {maxHeight:Math.max(...heights),holes,bumpiness:heights.slice(1).reduce((n,h,i)=>n+Math.abs(h-heights[i]),0),potential,gameOver:isGameOver(board)};
}

export function isGameOver(board) { return board[DEATH_ROW][DEATH_COL] !== EMPTY; }

export function enumerateMoves(board,pair) {
  const moves=[];let index=0;
  for(let rotation=0;rotation<4;rotation++)for(let col=0;col<COLS;col++){const placed=placePair(board,pair,col,rotation);if(!placed)continue;const resolved=resolveBoard(placed.board);const f=boardFeatures(resolved.board);moves.push({id:`m${index++}`,col,rotation,label:`${col+1}列・${["上","右","下","左"][rotation]}`,chains:resolved.chains,cleared:resolved.cleared,score:resolved.score,allClear:resolved.allClear,...f,resultBoard:resolved.board,steps:resolved.steps,cells:placed.cells});}
  return moves;
}

export function heuristicMove(moves, strategy = "balanced") {
  return [...moves].sort((a,b) => scoreMove(b,strategy)-scoreMove(a,strategy))[0];
}
export function scoreMove(m, strategy = "balanced") {
  const danger = m.maxHeight*55 + m.holes*180 + m.bumpiness*9 + (m.gameOver?100000:0);
  if(strategy === "chain") return m.potential*24 + m.chains*350 + m.score*.15 - danger - (m.chains===1?500:0);
  if(strategy === "clear") return m.score*4 + m.cleared*80 + m.chains*900 - danger;
  if(strategy === "survive") return m.score*.5 + m.potential*2 - m.maxHeight*180 - m.holes*350 - m.bumpiness*30 - (m.gameOver?100000:0);
  return m.score*2 + m.chains*700 + m.potential*5 - danger;
}

function chainSearchValue(move, bestChain) {
  const structure = move.potential*18 - move.maxHeight*65 - move.holes*240 - move.bumpiness*10;
  const targetFire = move.chains >= 10 ? 50_000_000 + Math.pow(move.chains,4)*180 : -move.chains*2500;
  const achieved = bestChain >= 10 ? 50_000_000 + Math.pow(bestChain,4)*240 : 0;
  return structure + targetFire + achieved - (move.gameOver?1e9:0);
}

// 各初手から既知のNEXT列をビーム探索し、将来発火できる最大連鎖を見積もる。
export function forecastChains(moves, futurePairs, depth = 8, width = 18) {
  const forecasts = new Map();
  for (const root of moves) {
    let beam=[{board:root.resultBoard,best:root.chains,value:chainSearchValue(root,root.chains)}];
    for(let ply=0;ply<Math.min(depth,futurePairs.length);ply++){
      const expanded=[];
      for(const state of beam) for(const move of enumerateMoves(state.board,futurePairs[ply])){
        const best=Math.max(state.best,move.chains);
        expanded.push({board:move.resultBoard,best,value:chainSearchValue(move,best)});
      }
      if(!expanded.length)break;
      expanded.sort((a,b)=>b.value-a.value);beam=expanded.slice(0,width);
    }
    const best=beam.sort((a,b)=>b.value-a.value)[0];
    forecasts.set(root.id,{forecastChain:best?.best??root.chains,forecastValue:Math.round(best?.value??-1e9)});
  }
  return forecasts;
}

export function chainPlannerMove(moves, futurePairs, depth = 8, width = 18) {
  const forecasts=forecastChains(moves,futurePairs,depth,width);
  return [...moves].sort((a,b)=>(forecasts.get(b.id)?.forecastValue??-1e9)-(forecasts.get(a.id)?.forecastValue??-1e9))[0];
}
export function boardToText(board) { return board.slice(1).map(row => row.map(v => v===EMPTY?".":"RGBYO"[v]).join("")).join("\n"); }
