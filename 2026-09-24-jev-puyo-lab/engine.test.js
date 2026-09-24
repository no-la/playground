import test from "node:test";
import assert from "node:assert/strict";
import { emptyBoard,createSequence,placePair,resolveBoard,enumerateMoves,heuristicMove,isGameOver } from "./engine.js";

test("同じseedは同じ組を生成する",()=>assert.deepEqual(createSequence(42,8),createSequence(42,8)));
test("空盤面には22通りの合法配置がある",()=>assert.equal(enumerateMoves(emptyBoard(),[0,1]).length,22));
test("4個接続を消去して得点化する",()=>{const b=emptyBoard();for(let c=0;c<3;c++)b[12][c]=0;const placed=placePair(b,[0,1],3,1);const result=resolveBoard(placed.board);assert.equal(result.chains,1);assert.equal(result.cleared,4);assert.equal(result.score,40);assert.equal(result.allClear,false);});
test("全消しには2100点を加算する",()=>{const b=emptyBoard();for(let c=0;c<2;c++)b[12][c]=0;const placed=placePair(b,[0,0],2,1);const result=resolveBoard(placed.board);assert.equal(result.allClear,true);assert.equal(result.score,2140);});
test("横向きの組は一体で着地してから段差側だけ落ちる",()=>{const b=emptyBoard();b[12][0]=2;b[11][0]=2;const placed=placePair(b,[0,1],0,1);assert.deepEqual(placed.cells.map(({row,col})=>[row,col]),[[10,0],[10,1]]);const result=resolveBoard(placed.board);assert.equal(result.board[10][0],0);assert.equal(result.board[12][1],1);});
test("中央の死亡判定点が埋まったときだけゲームオーバーになる",()=>{const b=emptyBoard();b[1][1]=0;assert.equal(isGameOver(b),false);b[1][2]=0;assert.equal(isGameOver(b),true);});
test("ヒューリスティックはゲームオーバー手を避ける",()=>{const moves=[{id:"bad",score:0,chains:0,potential:0,maxHeight:12,holes:0,bumpiness:0,gameOver:true},{id:"safe",score:0,chains:0,potential:0,maxHeight:3,holes:0,bumpiness:0,gameOver:false}];assert.equal(heuristicMove(moves).id,"safe");});
test("ルールAIが同一シードを長期自動実行できる",()=>{const sequence=createSequence(4242,400);let board=emptyBoard(),turns=0;for(let i=0;i<200;i++){const moves=enumerateMoves(board,sequence[i]);if(!moves.length)break;const move=heuristicMove(moves);board=move.resultBoard;turns++;if(move.gameOver)break;}assert.ok(turns>30);assert.ok(board.flat().every(cell=>cell===-1||(cell>=0&&cell<4)));});
