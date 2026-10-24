import { Chess } from "chess.js";

const $ = id => document.getElementById(id);
let chess = new Chess(), flipped = false, selected = null, games = [], frequencies = {}, trainedGames = 0;
const glyph = { w:{k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"}, b:{k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"} };
const files = "abcdefgh";
function notify(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
function render(){
 const board=$("board"); board.innerHTML="";
 const rows=chess.board();
 for(let n=0;n<64;n++){
  const sq=flipped?63-n:n, r=Math.floor(sq/8), c=sq%8, p=rows[r][c], el=document.createElement("button");
  el.className="square "+((r+c)%2?"dark":"light"); el.setAttribute("aria-label",files[c]+(8-r));
  if(p){el.textContent=glyph[p.color][p.type];el.classList.add(p.color==="w"?"white-piece":"black-piece")}
  if(selected===files[c]+(8-r))el.classList.add("selected");
  el.onclick=()=>onSquare(files[c]+(8-r));board.appendChild(el);
 }
 $("turn").textContent=chess.turn()==="w"?"Ход белых":"Ход чёрных";
 $("ply").textContent=chess.history().length;
 const vals={p:1,n:3,b:3,r:5,q:9,k:0};let mat=0;
 chess.board().flat().forEach(p=>{if(p&&p.color==="w")mat+=vals[p.type]});
 $("material").textContent=mat; $("moves").textContent=chess.history().length?chess.history().map((m,i)=>(i%2===0?Math.floor(i/2+1)+". ":"")+m).join(" "):"Партия не началась";
 $("trained").textContent=trainedGames;$("observations").textContent=Object.values(frequencies).reduce((a,b)=>a+b,0);
 $("gcount").textContent=games.length;$("mcount").textContent=games.reduce((a,g)=>a+g.moves.length,0);$("unique").textContent=Object.keys(frequencies).length;
 $("model-size").textContent=(JSON.stringify(frequencies).length/1024).toFixed(1)+" KB";
 renderGames();
}
function onSquare(sq){
 if(selected){try{chess.move({from:selected,to:sq,promotion:"q"});selected=null;render();return}catch(e){}}
 const p=chess.get(sq); if(p&&p.color===chess.turn()){selected=sq;render()}else{selected=null;render()}
}
function parsePgn(text,name){
 const blocks=text.split(/(?=\[Event\s)/i).map(x=>x.trim()).filter(Boolean), added=[];
 for(const raw of blocks){const c=new Chess();try{c.loadPgn(raw)}catch(e){continue}
 const moves=c.history();if(!moves.length)continue;
 const headers=c.getHeaders(); const g={name:headers.Event||name,white:headers.White||"Белые",black:headers.Black||"Чёрные",date:headers.Date||"—",result:headers.Result||"*",moves,raw};
 added.push(g);for(const m of moves)frequencies[m]=(frequencies[m]||0)+1;
 }
 games.push(...added);return added.length;
}
async function importFiles(list){let count=0;for(const f of list){try{count+=parsePgn(await f.text(),f.name)}catch(e){}}
 $("import-status").textContent=`Импортировано партий: ${count}.`;notify(`Импортировано партий: ${count}`);render()}
function renderGames(){$("game-list").innerHTML=games.length?games.slice().reverse().map(g=>`<div class="game"><b>${escapeHtml(g.name)}</b><div>${escapeHtml(g.white)} — ${escapeHtml(g.black)} · ${g.moves.length} полуходов · ${escapeHtml(g.result)}</div></div>`).join(""):"Пока нет партий. Импортируйте PGN на вкладке «Доска»."}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function download(data,name,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$("flip").onclick=()=>{flipped=!flipped;render()};
$("reset").onclick=()=>{chess=new Chess();selected=null;render();notify("Новая партия")};
$("back").onclick=()=>{chess.undo();selected=null;render()};$("forward").onclick=()=>notify("Вперёд: сделайте ход или предложите ход модели.");
$("suggest").onclick=()=>{const moves=chess.moves({verbose:true});if(!moves.length){notify("Партия завершена");return}
 const move=moves.map(m=>({m,score:(m.captured?({p:1,n:3,b:3,r:5,q:9}[m.captured]||0)*2:0)+(frequencies[m.san]||0)*.15+Math.random()})).sort((a,b)=>b.score-a.score)[0].m;
 chess.move(move);render();notify("Выполнен легальный демонстрационный ход.")};
$("pgn").onchange=e=>importFiles(e.target.files);
$("train").onclick=()=>{trainedGames=games.length;render();$("train-status").textContent=`Статистика обновлена по ${trainedGames} партиям. Это частотная модель, а не обучение нейросети.`;notify("Статистика обновлена")};
$("clear").onclick=()=>{games=[];frequencies={};trainedGames=0;render();notify("Библиотека очищена")};
$("export-pgn").onclick=()=>download(games.map(g=>g.raw).join("\n\n"),"chesslearner_games.pgn","application/x-chess-pgn");
$("download").onclick=()=>{const f=$("format").value;let data,name,type;
 if(f==="json"){data=JSON.stringify({schema:"chesslearner.v1",model:{trainedGames,moveFrequencies:frequencies},games},null,2);name="chesslearner_model.json";type="application/json"}
 else if(f==="csv"){data="move,frequency\n"+Object.entries(frequencies).map(([k,v])=>`"${k.replace(/"/g,'""')}",${v}`).join("\n");name="move_frequencies.csv";type="text/csv"}
 else if(f==="pgn"){data=games.map(g=>g.raw).join("\n\n");name="games.pgn";type="application/x-chess-pgn"}
 else{data=JSON.stringify({name:"ChessLearner",protocol:"UCI",executable:false,note:"Configuration template only. Integrate a real UCI engine for play.",trainingData:"chesslearner_model.json"},null,2);name="uci_config.json";type="application/json"}
 download(data,name,type);notify("Экспорт подготовлен: "+name)};
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!==b.dataset.view))});
render();