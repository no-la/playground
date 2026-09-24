import test from "node:test";
import assert from "node:assert/strict";
import { emptyBoard,createSequence,placePair,resolveBoard,enumerateMoves,heuristicMove } from "./engine.js";

test("同じseedは同じ組を生成する",()=>assert.deepEqual(createSequence(42,8),createSequence(42,8)));
test("空盤面には22通りの合法配置がある",()=>assert.equal(enumerateMoves(emptyBoard(),[0,1]).length,22));
test("4個接続を消去して得点化する",()=>{const b=emptyBoard();for(let c=0;c<3;c++)b[12][c]=0;const placed=placePair(b,[0,1],3,1);const result=resolveBoard(placed.board);assert.equal(result.chains,1);assert.equal(result.cleared,4);assert.equal(result.score,40);assert.equal(result.allClear,false);});
test("全消しには2100点を加算する",()=>{const b=emptyBoard();for(let c=0;c<2;c++)b[12][c]=0;const placed=placePair(b,[0,0],2,1);const result=resolveBoard(placed.board);assert.equal(result.allClear,true);assert.equal(result.score,2140);});
test("ヒューリスティックはゲームオーバー手を避ける",()=>{const moves=[{id:"bad",score:0,chains:0,potential:0,maxHeight:12,holes:0,bumpiness:0,gameOver:true},{id:"safe",score:0,chains:0,potential:0,maxHeight:3,holes:0,bumpiness:0,gameOver:false}];assert.equal(heuristicMove(moves).id,"safe");});
test("ルールAIが同一シードを長期自動実行できる",()=>{const sequence=createSequence(4242,400);let board=emptyBoard(),turns=0;for(let i=0;i<200;i++){const moves=enumerateMoves(board,sequence[i]);if(!moves.length)break;const move=heuristicMove(moves);board=move.resultBoard;turns++;if(move.gameOver)break;}assert.ok(turns>30);assert.ok(board.flat().every(cell=>cell===-1||(cell>=0&&cell<4)));});
