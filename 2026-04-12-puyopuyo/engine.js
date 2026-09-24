export const COLS = 6;
export const ROWS = 13;
export const VISIBLE_ROWS = 12;
export const COLORS = 4;
export const EMPTY = -1;
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
  const a = { row:heights[col]-1, col };
  const b = { row:heights[col+dc]-1, col:col+dc };
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
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (board[r][c]!==EMPTY&&!seen[r][c]) {
    const color=board[r][c], stack=[[r,c]], group=[]; seen[r][c]=true;
    while(stack.length){const [y,x]=stack.pop();group.push([y,x]);for(const [dy,dx] of [[-1,0],[1,0],[0,-1],[0,1]]){const ny=y+dy,nx=x+dx;if(ny>=0&&ny<ROWS&&nx>=0&&nx<COLS&&!seen[ny][nx]&&board[ny][nx]===color){seen[ny][nx]=true;stack.push([ny,nx]);}}}
    if(group.length>=4) groups.push({color,cells:group});
  }
  for(const group of groups) for(const [r,c] of group.cells) board[r][c]=EMPTY;
  return groups;
}

export function resolveBoard(input) {
  const board=cloneBoard(input); let chains=0,totalScore=0,cleared=0; const steps=[];
  while(true){const groups=popGroups(board);if(!groups.length)break;chains++;const count=groups.reduce((n,g)=>n+g.cells.length,0);const colors=new Set(groups.map(g=>g.color)).size;const groupBonus=groups.reduce((n,g)=>n+(GROUP_BONUS[Math.min(g.cells.length,10)]??10),0);const bonus=Math.max(1,(CHAIN_POWER[Math.min(chains-1,CHAIN_POWER.length-1)]??512)+COLOR_BONUS[colors]+groupBonus);const score=count*10*bonus;totalScore+=score;cleared+=count;steps.push({chain:chains,groups,count,score,board:cloneBoard(board)});applyGravity(board);}
  const allClear=chains>0&&board.every(row=>row.every(cell=>cell===EMPTY));
  if(allClear)totalScore+=2100;
  return {board,chains,score:totalScore,cleared,steps,allClear};
}

export function boardFeatures(board) {
  const heights=[];let holes=0,potential=0;
  for(let c=0;c<COLS;c++){let top=ROWS;for(let r=0;r<ROWS;r++)if(board[r][c]!==EMPTY){top=Math.min(top,r);for(let y=r+1;y<ROWS;y++)if(board[y][c]===EMPTY)holes++;break;}heights.push(ROWS-top);}
  const seen=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c]!==EMPTY&&!seen[r][c]){let size=0;const color=board[r][c],stack=[[r,c]];seen[r][c]=true;while(stack.length){const[y,x]=stack.pop();size++;for(const[dy,dx]of[[-1,0],[1,0],[0,-1],[0,1]]){const ny=y+dy,nx=x+dx;if(ny>=0&&ny<ROWS&&nx>=0&&nx<COLS&&!seen[ny][nx]&&board[ny][nx]===color){seen[ny][nx]=true;stack.push([ny,nx]);}}}if(size<4)potential+=size*size;}
  return {maxHeight:Math.max(...heights),holes,bumpiness:heights.slice(1).reduce((n,h,i)=>n+Math.abs(h-heights[i]),0),potential,gameOver:board[1][2]!==EMPTY};
}

export function enumerateMoves(board,pair) {
  const moves=[];let index=0;
  for(let rotation=0;rotation<4;rotation++)for(let col=0;col<COLS;col++){const placed=placePair(board,pair,col,rotation);if(!placed)continue;const resolved=resolveBoard(placed.board);const f=boardFeatures(resolved.board);moves.push({id:`m${index++}`,col,rotation,label:`${col+1}列・${["上","右","下","左"][rotation]}`,chains:resolved.chains,cleared:resolved.cleared,score:resolved.score,allClear:resolved.allClear,...f,resultBoard:resolved.board,steps:resolved.steps,cells:placed.cells});}
  return moves;
}

export function heuristicMove(moves) {
  return [...moves].sort((a,b) => scoreMove(b)-scoreMove(a))[0];
}
export function scoreMove(m) { return m.score*2 + m.chains*700 + m.potential*5 - m.maxHeight*55 - m.holes*180 - m.bumpiness*9 - (m.gameOver?100000:0); }
export function boardToText(board) { return board.slice(1).map(row => row.map(v => v===EMPTY?".":"RGBY"[v]).join("")).join("\n"); }
