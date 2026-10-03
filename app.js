const WHEEL_ORDER = ["0","28","9","26","30","11","7","20","32","17","5","22","34","15","3","24","36","13","1","00","27","10","25","29","12","8","19","31","18","6","21","33","16","4","23","35","14","2"];
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACKS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

const state = {
  player:"",
  bankroll:0,
  startBankroll:0,
  selectedChip:25,
  bets:new Map(),
  betHistory:[],
  spinHistory:[],
  spinning:false,
  wheelRotation:0,
  sound:true,
  lastWin:0
};

const els = {
  setupModal:document.getElementById("setupModal"),
  setupForm:document.getElementById("setupForm"),
  app:document.getElementById("app"),
  playerName:document.getElementById("playerName"),
  startingBankroll:document.getElementById("startingBankroll"),
  playerDisplay:document.getElementById("playerDisplay"),
  bankrollDisplay:document.getElementById("bankrollDisplay"),
  bettingTable:document.getElementById("bettingTable"),
  totalBetDisplay:document.getElementById("totalBetDisplay"),
  lastResultDisplay:document.getElementById("lastResultDisplay"),
  lastWinDisplay:document.getElementById("lastWinDisplay"),
  spinButton:document.getElementById("spinButton"),
  spinButtonSub:document.getElementById("spinButtonSub"),
  clearBetsButton:document.getElementById("clearBetsButton"),
  undoButton:document.getElementById("undoButton"),
  soundButton:document.getElementById("soundButton"),
  newSessionButton:document.getElementById("newSessionButton"),
  messageBar:document.getElementById("messageBar"),
  messageText:document.getElementById("messageText"),
  roundStatus:document.getElementById("roundStatus"),
  winnerBadge:document.getElementById("winnerBadge"),
  winnerNumber:document.getElementById("winnerNumber"),
  history:document.getElementById("history"),
  spinCount:document.getElementById("spinCount"),
  resultToast:document.getElementById("resultToast"),
  toastNumber:document.getElementById("toastNumber"),
  toastLabel:document.getElementById("toastLabel"),
  toastMessage:document.getElementById("toastMessage"),
  canvas:document.getElementById("rouletteWheel")
};
const ctx = els.canvas.getContext("2d");

function money(n){
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
}
function colorOf(value){
  if(value==="0" || value==="00") return "green";
  return REDS.has(Number(value)) ? "red" : "black";
}
function betKey(type,value){ return type+":"+String(value); }
function totalBet(){ return [...state.bets.values()].reduce((s,b)=>s+b.amount,0); }
function cryptographicIndex(max){
  if(window.crypto?.getRandomValues){
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random()*max);
}
function setMessage(text,tone=""){
  els.messageText.textContent=text;
  els.messageBar.className="message-bar"+(tone?" "+tone:"");
}
function beep(freq=420,duration=.05,volume=.025){
  if(!state.sound) return;
  try{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    const ac=new AudioContextClass();
    const osc=ac.createOscillator(), gain=ac.createGain();
    osc.type="sine";osc.frequency.value=freq;gain.gain.value=volume;
    osc.connect(gain);gain.connect(ac.destination);osc.start();
    gain.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+duration);
    osc.stop(ac.currentTime+duration);
    setTimeout(()=>ac.close(),Math.ceil(duration*1000)+50);
  }catch{}
}
function updateUI(){
  els.playerDisplay.textContent=state.player||"Guest";
  els.bankrollDisplay.textContent=money(state.bankroll);
  const t=totalBet();
  els.totalBetDisplay.textContent=money(t);
  els.lastWinDisplay.textContent=money(state.lastWin);
  els.spinButton.disabled=state.spinning||t<=0;
  els.clearBetsButton.disabled=state.spinning||t<=0;
  els.undoButton.disabled=state.spinning||state.betHistory.length===0;
  els.spinButtonSub.textContent=state.spinning?"Ball in motion…":t>0?money(t)+" on the table":"Place a bet to spin";
  document.querySelectorAll(".bet-cell").forEach(cell=>{
    const key=cell.dataset.key;
    const bet=state.bets.get(key);
    cell.classList.toggle("has-bet",!!bet);
    let token=cell.querySelector(".bet-token");
    if(bet){
      if(!token){ token=document.createElement("span");token.className="bet-token";cell.appendChild(token); }
      token.textContent=bet.amount>=1000?(bet.amount/1000).toFixed(bet.amount%1000?1:0)+"k":String(bet.amount);
    } else if(token) token.remove();
  });
}
function addBet(type,value,label,payout,el){
  if(state.spinning) return;
  if(state.bankroll<state.selectedChip){
    setMessage("Not enough bankroll for that chip.","loss");beep(170,.1,.03);return;
  }
  const key=betKey(type,value);
  const current=state.bets.get(key)||{type,value,label,payout,amount:0};
  current.amount+=state.selectedChip;
  state.bets.set(key,current);
  state.bankroll-=state.selectedChip;
  state.betHistory.push({key,amount:state.selectedChip});
  el?.animate([{transform:"scale(1)"},{transform:"scale(.96)"},{transform:"scale(1)"}],{duration:180});
  setMessage(state.selectedChip+" chip placed on "+label+".");
  beep(330,.035,.018);
  updateUI();
}
function clearBets(refund=true){
  if(state.spinning) return;
  if(refund) state.bankroll+=totalBet();
  state.bets.clear();state.betHistory=[];
  setMessage(refund?"Bets cleared.":"Choose a chip and place your bets.");
  updateUI();
}
function undoBet(){
  if(state.spinning) return;
  const last=state.betHistory.pop();if(!last) return;
  const b=state.bets.get(last.key);if(!b) return;
  b.amount-=last.amount;state.bankroll+=last.amount;
  if(b.amount<=0) state.bets.delete(last.key);else state.bets.set(last.key,b);
  setMessage("Last chip returned.");
  updateUI();
}

function buildTable(){
  const table=els.bettingTable;
  const append=(label,type,value,payout,className,style={})=>{
    const b=document.createElement("button");
    b.type="button";b.className="bet-cell "+className;
    b.textContent=label;b.dataset.key=betKey(type,value);
    Object.assign(b.style,style);
    b.title=label+" — "+payout+":1";
    b.addEventListener("click",()=>addBet(type,value,label,payout,b));
    table.appendChild(b);return b;
  };
  append("0","straight","0",35,"zero zero-single");
  append("00","straight","00",35,"zero double-zero");

  for(let col=1;col<=12;col++){
    [3,2,1].forEach((numOffset,rowIdx)=>{
      const n=(col-1)*3+numOffset;
      append(String(n),"straight",String(n),35,colorOf(String(n)),{
        gridColumn:String(col+1),gridRow:String(rowIdx+1)
      });
    });
  }
  append("2 to 1","column",3,2,"outside column-bet",{gridRow:"1"});
  append("2 to 1","column",2,2,"outside column-bet",{gridRow:"2"});
  append("2 to 1","column",1,2,"outside column-bet",{gridRow:"3"});
  append("1st 12","dozen",1,2,"outside dozen-1");
  append("2nd 12","dozen",2,2,"outside dozen-2");
  append("3rd 12","dozen",3,2,"outside dozen-3");
  append("1 to 18","half","low",1,"outside outside-a");
  append("EVEN","parity","even",1,"outside outside-b");
  append("RED","color","red",1,"outside red-bet outside-c");
  append("BLACK","color","black",1,"outside black-bet outside-d");
  append("ODD","parity","odd",1,"outside outside-e");
  append("19 to 36","half","high",1,"outside outside-f");
  const note=document.createElement("div");note.className="table-note";
  note.textContent="Straight numbers pay 35:1 · Dozens and columns 2:1 · Outside bets 1:1";
  table.appendChild(note);
}

function betWins(b,result){
  const n=(result==="0"||result==="00")?null:Number(result);
  switch(b.type){
    case "straight": return String(b.value)===String(result);
    case "color": return n!==null&&colorOf(result)===b.value;
    case "parity": return n!==null&&n!==0&&(b.value==="even"?n%2===0:n%2===1);
    case "half": return n!==null&&(b.value==="low"?n>=1&&n<=18:n>=19&&n<=36);
    case "dozen": return n!==null&&n>=1&&n<=36&&Math.ceil(n/12)===Number(b.value);
    case "column": return n!==null&&n>=1&&n<=36&&((n-1)%3)+1===Number(b.value);
    default:return false;
  }
}
function settle(result){
  const staked=totalBet();
  let returned=0;
  for(const bet of state.bets.values()){
    if(betWins(bet,result)) returned += bet.amount*(bet.payout+1);
  }
  state.bankroll+=returned;
  state.lastWin=returned;
  const net=returned-staked;
  state.spinHistory.unshift(result);
  if(state.spinHistory.length>12)state.spinHistory.length=12;
  els.lastResultDisplay.textContent=(result==="00"?"00":result)+" "+colorOf(result).toUpperCase();
  if(net>0) setMessage("Winner! Net profit "+money(net)+".","win");
  else if(net===0) setMessage("Push overall — "+money(returned)+" returned.","");
  else setMessage(returned>0?"Some bets hit. Net result "+money(net)+".":"No winning bets this spin.","loss");
  showResultToast(result,net,returned);
  state.bets.clear();state.betHistory=[];
  renderHistory();updateUI();
}
function renderHistory(){
  els.spinCount.textContent=state.spinHistory.length+(state.spinHistory.length===1?" spin":" spins");
  els.history.innerHTML="";
  if(!state.spinHistory.length){
    els.history.innerHTML='<div class="history-empty">Your results will appear here.</div>';return;
  }
  state.spinHistory.forEach((r,i)=>{
    const d=document.createElement("div");d.className="history-ball "+colorOf(r);d.textContent=r;d.title=(i===0?"Latest: ":"")+colorOf(r)+" "+r;els.history.appendChild(d);
  });
}
function showResultToast(result,net,returned){
  const c=colorOf(result);
  els.toastNumber.textContent=result;els.toastNumber.className="toast-number";
  els.toastNumber.style.background=c==="red"?"#a9363c":c==="black"?"#171e1c":"#0f7d58";
  els.toastMessage.textContent=c[0].toUpperCase()+c.slice(1)+" "+result+(net>0?" · +"+money(net):returned>0?" · "+money(returned)+" returned":"");
  els.toastLabel.textContent=net>0?"WINNER":"WINNING NUMBER";
  els.resultToast.classList.add("show");
  setTimeout(()=>els.resultToast.classList.remove("show"),3300);
}

function drawWheel(rotation=state.wheelRotation,ballAngle=null,ballRadius=0){
  const c=els.canvas.width, center=c/2, outer=354;
  ctx.clearRect(0,0,c,c);
  ctx.save();ctx.translate(center,center);
  const grad=ctx.createRadialGradient(-75,-90,25,0,0,outer);
  grad.addColorStop(0,"#35443f");grad.addColorStop(.5,"#14221d");grad.addColorStop(1,"#050b09");
  ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,outer,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#cda95c";ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,outer-5,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle="#3e3120";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,outer-16,0,Math.PI*2);ctx.stroke();

  ctx.save();ctx.rotate(rotation);
  const step=Math.PI*2/WHEEL_ORDER.length;
  for(let i=0;i<WHEEL_ORDER.length;i++){
    const start=-Math.PI/2-step/2+i*step,end=start+step;
    const val=WHEEL_ORDER[i], col=colorOf(val);
    ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,310,start,end);ctx.closePath();
    ctx.fillStyle=col==="red"?"#b43a40":col==="black"?"#171f1d":"#0b8b60";ctx.fill();
    ctx.strokeStyle="rgba(238,218,171,.43)";ctx.lineWidth=1;ctx.stroke();
    ctx.save();ctx.rotate(start+step/2);ctx.translate(270,0);ctx.rotate(Math.PI/2);
    ctx.fillStyle="#f6f3e9";ctx.font="700 18px DM Sans, sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(val,0,0);ctx.restore();
  }
  ctx.restore();

  ctx.beginPath();ctx.arc(0,0,225,0,Math.PI*2);ctx.fillStyle="#0c3d2e";ctx.fill();
  ctx.strokeStyle="#d0aa5a";ctx.lineWidth=5;ctx.stroke();
  const inner=ctx.createRadialGradient(-40,-55,10,0,0,205);
  inner.addColorStop(0,"#194f3d");inner.addColorStop(.6,"#0d3025");inner.addColorStop(1,"#071a14");
  ctx.fillStyle=inner;ctx.beginPath();ctx.arc(0,0,190,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="rgba(227,183,91,.65)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,120,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<8;i++){
    ctx.save();ctx.rotate(i*Math.PI/4);ctx.fillStyle="#c09a50";
    ctx.beginPath();ctx.roundRect(-9,-170,18,100,8);ctx.fill();ctx.restore();
  }
  const hub=ctx.createRadialGradient(-15,-20,8,0,0,72);
  hub.addColorStop(0,"#e1c27c");hub.addColorStop(.5,"#8e6a31");hub.addColorStop(1,"#3a2917");
  ctx.fillStyle=hub;ctx.beginPath();ctx.arc(0,0,70,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#07130f";ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#d4b269";ctx.font="700 20px Playfair Display, serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("T",0,1);

  if(ballAngle!==null){
    const r=ballRadius||325;
    const x=Math.cos(ballAngle)*r,y=Math.sin(ballAngle)*r;
    const bg=ctx.createRadialGradient(x-4,y-5,1,x,y,11);bg.addColorStop(0,"#fff");bg.addColorStop(.45,"#e7e9e6");bg.addColorStop(1,"#8f9994");
    ctx.shadowColor="rgba(0,0,0,.8)";ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    ctx.fillStyle=bg;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();ctx.shadowColor="transparent";
  }
  ctx.restore();
}
async function spin(){
  if(state.spinning||totalBet()<=0)return;
  state.spinning=true;updateUI();
  els.roundStatus.classList.add("spinning");els.roundStatus.innerHTML="<span></span> Wheel spinning";
  setMessage("No more bets. Good luck.");

  const idx=cryptographicIndex(WHEEL_ORDER.length), result=WHEEL_ORDER[idx];
  const tau=Math.PI*2;
  const step=tau/WHEEL_ORDER.length;
  const startRot=state.wheelRotation;

  // Pick the result first, then build ONE continuous physical-looking path that
  // naturally ends at that pocket. There is no late target/capture correction.
  const wheelSpins=8+cryptographicIndex(4);
  const desiredRotation=((-idx*step)%tau+tau)%tau;
  const delta=((desiredRotation-startRot)%tau+tau)%tau;
  const targetRot=startRot+wheelSpins*tau+delta;

  const duration=9000+cryptographicIndex(1801);
  const ballTurns=17+cryptographicIndex(5)+(cryptographicIndex(100)/100);
  const ballTravel=ballTurns*tau;
  const targetAngle=-Math.PI/2;
  const wobblePhase=cryptographicIndex(628)/100;
  const wobbleStrength=3.5+cryptographicIndex(5);
  const bounceCount=3+cryptographicIndex(3);
  const bounceDirection=cryptographicIndex(2)?1:-1;
  const start=performance.now();
  let lastTick=-1;
  let lastBounce=-1;

  const clamp01=t=>Math.max(0,Math.min(1,t));
  const smoothstep=t=>t*t*(3-2*t);
  const smootherstep=t=>t*t*t*(t*(t*6-15)+10);

  await new Promise(resolve=>{
    const frame=now=>{
      const p=Math.min(1,(now-start)/duration);

      // The wheel itself coasts continuously to its exact final orientation.
      const wheelProgress=1-Math.pow(1-p,3.35);
      state.wheelRotation=startRot+(targetRot-startRot)*wheelProgress;

      // Continuous ball trajectory. This equation already ends EXACTLY at the
      // final pocket with zero angular velocity, so nothing ever has to snap.
      // Slowing begins well before the final seconds and becomes progressively softer.
      const ballProgress=1-Math.pow(1-p,2.55);
      let ballAngle=targetAngle+ballTravel*(1-ballProgress);

      // Subtle imperfections while running the outer rim. Both effects fade to
      // exactly zero smoothly before the ball is near its final pocket.
      const rimFade=1-smoothstep(clamp01((p-.38)/.30));
      ballAngle+=Math.sin(p*51+wobblePhase)*.011*rimFade;
      ballAngle+=Math.sin(p*18.5+wobblePhase*.61)*.006*rimFade;

      // Gradual inward drop. Use smootherstep so radial velocity is also smooth
      // at the beginning and end of the transition.
      const drop=smootherstep(clamp01((p-.50)/.36));
      let radius=331+(288-331)*drop;
      radius+=Math.sin(p*43+wobblePhase)*wobbleStrength*(1-drop)*.30;

      // Separator rattles live ON TOP of the same continuous path. The envelope
      // ramps in and out smoothly, so these can never introduce a position jump.
      const bounceIn=smoothstep(clamp01((p-.58)/.08));
      const bounceOut=1-smoothstep(clamp01((p-.88)/.10));
      const bounceEnvelope=bounceIn*bounceOut;
      if(bounceEnvelope>0){
        const phase=clamp01((p-.58)/.40);
        const decay=Math.pow(1-phase,1.15);
        const angularRattle=Math.sin(phase*Math.PI*bounceCount*2+wobblePhase);
        const radialRattle=Math.abs(Math.sin(phase*Math.PI*bounceCount+wobblePhase*.45));
        ballAngle+=angularRattle*.034*bounceEnvelope*decay*bounceDirection;
        radius+=radialRattle*10*bounceEnvelope*decay;

        const bounceIndex=Math.floor(phase*bounceCount*2);
        if(bounceIndex!==lastBounce && p<.88){
          beep(300+bounceIndex*17,.022,.011);
          lastBounce=bounceIndex;
        }
      }

      // Final pocket roll: tiny damped rocking motion, again with a smooth
      // envelope that reaches exactly zero at p=1.
      const settleIn=smoothstep(clamp01((p-.78)/.08));
      const settleEnvelope=settleIn*Math.pow(1-p,2.25);
      if(settleEnvelope>0){
        ballAngle+=Math.sin((p-.78)*Math.PI*15+wobblePhase)*.13*settleEnvelope;
        radius+=Math.abs(Math.sin((p-.78)*Math.PI*12+wobblePhase*.7))*8*settleEnvelope;
      }

      drawWheel(state.wheelRotation,ballAngle,radius);

      const tick=Math.floor(p*62);
      if(tick!==lastTick&&p<.70){
        beep(220+Math.floor(p*100),.014,.007);
        lastTick=tick;
      }

      if(p<1){
        requestAnimationFrame(frame);
      }else{
        // This is already the exact end position rendered by the same continuous
        // trajectory; the pause simply lets the completed stop register visually.
        setTimeout(resolve,260);
      }
    };
    requestAnimationFrame(frame);
  });

  state.wheelRotation%=tau;
  // Repaint the mathematically identical final state; no visible relocation occurs.
  drawWheel(state.wheelRotation,targetAngle,288);
  els.winnerNumber.textContent=result;
  els.winnerBadge.animate(
    [{transform:"scale(.86)"},{transform:"scale(1.09)"},{transform:"scale(1)"}],
    {duration:520,easing:"cubic-bezier(.2,.8,.2,1)"}
  );
  beep(result==="0"||result==="00"?650:520,.22,.035);
  settle(result);
  els.roundStatus.classList.remove("spinning");els.roundStatus.innerHTML="<span></span> Place your bets";
  state.spinning=false;updateUI();
}
function startSession(name,bankroll){
  state.player=name.trim()||"Player";state.bankroll=bankroll;state.startBankroll=bankroll;
  state.bets.clear();state.betHistory=[];state.spinHistory=[];state.lastWin=0;state.spinning=false;
  els.lastResultDisplay.textContent="—";els.winnerNumber.textContent="—";
  renderHistory();updateUI();setMessage("Choose a chip and place your bets.");
  els.setupModal.classList.add("hidden");els.app.setAttribute("aria-hidden","false");
}
function resetSession(){
  if(state.spinning)return;
  state.bankroll+=totalBet();state.bets.clear();state.betHistory=[];
  els.setupModal.classList.remove("hidden");els.app.setAttribute("aria-hidden","true");
  els.playerName.value=state.player;els.startingBankroll.value=Math.round(state.startBankroll||1000);
  setTimeout(()=>els.playerName.focus(),100);
}

els.setupForm.addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number(els.startingBankroll.value);
  if(!Number.isFinite(amount)||amount<=0)return;
  startSession(els.playerName.value,Math.round(amount*100)/100);
});
document.getElementById("chips").addEventListener("click",e=>{
  const chip=e.target.closest(".chip");if(!chip||state.spinning)return;
  state.selectedChip=Number(chip.dataset.value);
  document.querySelectorAll(".chip").forEach(c=>c.classList.toggle("selected",c===chip));
  setMessage("$"+state.selectedChip+" chip selected.");
  beep(370,.03,.015);
});
els.clearBetsButton.addEventListener("click",()=>clearBets(true));
els.undoButton.addEventListener("click",undoBet);
els.spinButton.addEventListener("click",spin);
els.soundButton.addEventListener("click",()=>{
  state.sound=!state.sound;els.soundButton.textContent=state.sound?"♪":"×";els.soundButton.title=state.sound?"Sound on":"Sound off";
  if(state.sound)beep(450,.05,.02);
});
els.newSessionButton.addEventListener("click",resetSession);
window.addEventListener("resize",()=>drawWheel());
buildTable();drawWheel();updateUI();renderHistory();
setTimeout(()=>els.playerName.focus(),100);