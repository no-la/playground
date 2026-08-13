import assert from 'node:assert/strict';
import {Game,TYPES,SHAPES,emptyBoard,shuffledBag} from './core.js';

assert.deepEqual([...shuffledBag(()=>0.5)].sort(),[...TYPES].sort(),'bag contains all seven pieces');
for(const type of TYPES)assert.equal(SHAPES[type].length,4,`${type} has four SRS states`);
const g=new Game(()=>0.5);g.spawn('T');assert.equal(g.rotate(1),true);assert.equal(g.active.rotation,1);assert.equal(g.hold(),true);assert.equal(g.canHold,false);assert.equal(g.hold(),false);
g.board=emptyBoard();g.active={type:'I',x:3,y:38,rotation:0,lastAction:'hardDrop',lastKick:-1};g.board[39]=Array(10).fill('J');for(let x=3;x<7;x++)g.board[39][x]=null;g.lock();assert.equal(g.lines,1);assert.equal(g.score,900); // Single + Perfect Clear
console.log('All core tests passed.');
