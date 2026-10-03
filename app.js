const WHEEL_ORDER = ["0","28","9","26","30","11","7","20","32","17","5","22","34","15","3","24","36","13","1","00","27","10","25","29","12","8","19","31","18","6","21","33","16","4","23","35","14","2"];
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACKS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);
const TAU = Math.PI*2;
const WHEEL_STEP = TAU/WHEEL_ORDER.length;
const IDLE_WHEEL_SPEED = 0.14; // radians per second — a slow continuous dealer-style rotation

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
  restingPocket:null,
  sound:true,
  lastWin:0,
  game:"roulette",
  blackjack:{
    shoe:[],
    phase:"betting",
    selectedChip:25,
    bet:0,
    betHistory:[],
    insurance:0,
    hands:[],
    activeHand:0,
    dealer:[],
    history:[],
    handCount:0,
    roundStartBankroll:0,
    lastResult:"—"
  }
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
  canvas:document.getElementById("rouletteWheel"),
  rouletteGame:document.getElementById("rouletteGame"),
  blackjackGame:document.getElementById("blackjackGame"),
  brandGameLabel:document.getElementById("brandGameLabel"),
  bjStatus:document.getElementById("bjStatus"),
  dealerCards:document.getElementById("dealerCards"),
  dealerTotal:document.getElementById("dealerTotal"),
  playerHands:document.getElementById("playerHands"),
  bjActionMessage:document.getElementById("bjActionMessage"),
  bjActionRow:document.getElementById("bjActionRow"),
  bjInsuranceRow:document.getElementById("bjInsuranceRow"),
  bjBetDisplay:document.getElementById("bjBetDisplay"),
  bjLastResult:document.getElementById("bjLastResult"),
  bjShoeDisplay:document.getElementById("bjShoeDisplay"),
  bjClearBetButton:document.getElementById("bjClearBetButton"),
  bjUndoBetButton:document.getElementById("bjUndoBetButton"),
  dealButton:document.getElementById("dealButton"),
  hitButton:document.getElementById("hitButton"),
  standButton:document.getElementById("standButton"),
  doubleButton:document.getElementById("doubleButton"),
  splitButton:document.getElementById("splitButton"),
  surrenderButton:document.getElementById("surrenderButton"),
  insuranceButton:document.getElementById("insuranceButton"),
  noInsuranceButton:document.getElementById("noInsuranceButton"),
  bjHistory:document.getElementById("bjHistory"),
  bjHandCount:document.getElementById("bjHandCount")
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
  updateBlackjackUI();
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
  const startRot=state.wheelRotation;
  const duration=9200+cryptographicIndex(1801);
  const durationSec=duration/1000;
  const extraWheelTurns=1.75+cryptographicIndex(126)/100;
  const extraWheelTravel=extraWheelTurns*TAU;

  // The wheel never stops. During a spin it gets an extra smooth push, then
  // naturally returns to the exact same slow idle angular velocity.
  const endRot=startRot+(IDLE_WHEEL_SPEED*durationSec)+extraWheelTravel;

  // Begin from the ball's real current screen position if it is already resting
  // in a pocket. First spin gets a randomized starting point on the outer track.
  const startBallAngle=state.restingPocket===null
    ? (cryptographicIndex(6283)/1000)
    : (-Math.PI/2+state.restingPocket*WHEEL_STEP+startRot);

  // The winning pocket can finish anywhere around the wheel. Choose an unwrapped
  // target many counter-clockwise revolutions away so one continuous curve lands
  // exactly inside that moving pocket with no pointer and no late correction.
  const targetPocketEnd=-Math.PI/2+idx*WHEEL_STEP+endRot;
  const ballTurns=15+cryptographicIndex(6);
  let finalBallAngle=targetPocketEnd;
  while(finalBallAngle>=startBallAngle) finalBallAngle-=TAU;
  finalBallAngle-=ballTurns*TAU;

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

  // The ball is no longer considered parked while it is in motion.
  state.restingPocket=null;

  await new Promise(resolve=>{
    const frame=now=>{
      const elapsed=Math.min(duration,now-start);
      const p=elapsed/duration;
      const elapsedSec=elapsed/1000;

      // Smootherstep contributes zero extra velocity at both ends, so the wheel
      // enters and exits the spin at precisely its idle rotation speed.
      state.wheelRotation=startRot+(IDLE_WHEEL_SPEED*elapsedSec)+extraWheelTravel*smootherstep(p);

      // One trajectory, start to finish. The deceleration is baked into the path
      // from the beginning and reaches zero relative ball speed at the pocket.
      const ballProgress=1-Math.pow(1-p,2.65);
      let ballAngle=startBallAngle+(finalBallAngle-startBallAngle)*ballProgress;

      // Lift from the previous pocket to the outer rim smoothly, stay on the rim,
      // then make a long gradual inward descent.
      const launch=smootherstep(clamp01(p/.13));
      const drop=smootherstep(clamp01((p-.48)/.40));
      let radius=288+(331-288)*launch-(331-288)*drop;

      // Small imperfect rim motion that fades out long before final settlement.
      const rimFade=(1-smoothstep(clamp01((p-.34)/.32)))*launch;
      ballAngle+=Math.sin(p*49+wobblePhase)*.011*rimFade;
      ballAngle+=Math.sin(p*18+wobblePhase*.61)*.006*rimFade;
      radius+=Math.sin(p*41+wobblePhase)*wobbleStrength*rimFade*.28;

      // Damped separator rattles. These only perturb the continuous trajectory;
      // the envelope returns exactly to zero, so they can never cause a jump.
      const bounceIn=smoothstep(clamp01((p-.56)/.08));
      const bounceOut=1-smoothstep(clamp01((p-.88)/.09));
      const bounceEnvelope=bounceIn*bounceOut;
      if(bounceEnvelope>0){
        const phase=clamp01((p-.56)/.41);
        const decay=Math.pow(1-phase,1.2);
        const angularRattle=Math.sin(phase*Math.PI*bounceCount*2+wobblePhase);
        const radialRattle=Math.abs(Math.sin(phase*Math.PI*bounceCount+wobblePhase*.45));
        ballAngle+=angularRattle*.032*bounceEnvelope*decay*bounceDirection;
        radius+=radialRattle*9*bounceEnvelope*decay;

        const bounceIndex=Math.floor(phase*bounceCount*2);
        if(bounceIndex!==lastBounce&&p<.88){
          beep(300+bounceIndex*17,.022,.011);
          lastBounce=bounceIndex;
        }
      }

      // Gentle pocket rocking that dies to exactly zero as the moving target
      // pocket carries the ball around the wheel.
      const settleIn=smoothstep(clamp01((p-.76)/.09));
      const settleEnvelope=settleIn*Math.pow(1-p,2.35);
      if(settleEnvelope>0){
        ballAngle+=Math.sin((p-.76)*Math.PI*14+wobblePhase)*.12*settleEnvelope;
        radius+=Math.abs(Math.sin((p-.76)*Math.PI*11+wobblePhase*.7))*7*settleEnvelope;
      }

      drawWheel(state.wheelRotation,ballAngle,radius);

      const tick=Math.floor(p*62);
      if(tick!==lastTick&&p<.70){
        beep(220+Math.floor(p*100),.014,.007);
        lastTick=tick;
      }

      if(p<1) requestAnimationFrame(frame);
      else setTimeout(resolve,220);
    };
    requestAnimationFrame(frame);
  });

  // Park the ball in the actual winning pocket. From this point forward the idle
  // animation rotates BOTH the wheel and the resting ball together.
  state.wheelRotation=((endRot%TAU)+TAU)%TAU;
  state.restingPocket=idx;
  const restingAngle=-Math.PI/2+idx*WHEEL_STEP+state.wheelRotation;
  drawWheel(state.wheelRotation,restingAngle,288);

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

// ------------------------- BLACKJACK -------------------------
const BJ_SUITS=["♠","♥","♦","♣"];
const BJ_RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const bj=state.blackjack;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function bjRand(max){ return cryptographicIndex(max); }

function buildBlackjackShoe(){
  const shoe=[];
  for(let deck=0;deck<6;deck++){
    for(const suit of BJ_SUITS){
      for(const rank of BJ_RANKS) shoe.push({rank,suit});
    }
  }
  for(let i=shoe.length-1;i>0;i--){
    const j=bjRand(i+1);
    [shoe[i],shoe[j]]=[shoe[j],shoe[i]];
  }
  bj.shoe=shoe;
}

function bjDraw(){
  if(!bj.shoe.length) buildBlackjackShoe();
  return bj.shoe.pop();
}

function bjCardBaseValue(card){
  if(card.rank==="A")return 11;
  if(["K","Q","J"].includes(card.rank))return 10;
  return Number(card.rank);
}

function bjHandValue(cards){
  let total=0,aces=0;
  cards.forEach(card=>{total+=bjCardBaseValue(card);if(card.rank==="A")aces++;});
  let soft=aces>0;
  while(total>21&&aces>0){total-=10;aces--;soft=aces>0;}
  return {total,soft};
}

function bjNatural(hand){
  return hand.cards.length===2&&!hand.fromSplit&&bjHandValue(hand.cards).total===21;
}

function bjCanSplit(hand){
  if(!hand||hand.cards.length!==2||hand.status!=="playing"||bj.hands.length>=4)return false;
  if(hand.splitAces)return false;
  return hand.cards[0].rank===hand.cards[1].rank&&state.bankroll>=hand.bet;
}

function bjCardHTML(card,hidden=false){
  if(hidden)return '<div class="playing-card back" aria-label="Face-down card"></div>';
  const red=card.suit==="♥"||card.suit==="♦";
  return '<div class="playing-card'+(red?' red-suit':'')+'" aria-label="'+card.rank+' of '+card.suit+'">'+
    '<div class="card-rank">'+card.rank+'</div><div class="card-suit">'+card.suit+'</div>'+
    '<div class="card-center">'+card.suit+'</div></div>';
}

function renderBlackjack(){
  const hideHole=["dealing","insurance","player"].includes(bj.phase);
  els.dealerCards.innerHTML=bj.dealer.map((card,i)=>bjCardHTML(card,hideHole&&i===1)).join("");
  if(!bj.dealer.length){
    els.dealerCards.innerHTML='<div class="history-empty">Dealer is waiting.</div>';
    els.dealerTotal.textContent="—";
  }else if(hideHole&&bj.dealer.length>1){
    els.dealerTotal.textContent=String(bjCardBaseValue(bj.dealer[0]));
  }else{
    const dv=bjHandValue(bj.dealer);
    els.dealerTotal.textContent=String(dv.total)+(dv.soft&&dv.total<=21?" soft":"");
  }

  if(!bj.hands.length){
    els.playerHands.innerHTML='<div class="history-empty">Place a wager to begin a hand.</div>';
  }else{
    els.playerHands.innerHTML=bj.hands.map((hand,index)=>{
      const hv=bjHandValue(hand.cards);
      const active=bj.phase==="player"&&index===bj.activeHand&&hand.status==="playing";
      const done=hand.status!=="playing";
      let label=hand.resultText||"";
      let tone=hand.resultTone||"";
      const title=bj.hands.length>1?"HAND "+(index+1):"YOUR HAND";
      return '<div class="bj-hand'+(active?' active':'')+(done?' done':'')+'">'+
        '<div class="bj-hand-head"><span>'+title+'</span><strong>'+hv.total+(hv.soft&&hv.total<=21?' soft':'')+'</strong><span>'+money(hand.bet)+'</span></div>'+
        '<div class="card-row">'+hand.cards.map(c=>bjCardHTML(c,false)).join("")+'</div>'+
        '<div class="bj-hand-result '+tone+'">'+label+'</div></div>';
    }).join("");
  }
}

function updateBlackjackUI(){
  if(!els.bjBetDisplay)return;
  const active=bj.hands[bj.activeHand];
  els.bjBetDisplay.textContent=money(bj.bet);
  els.bjLastResult.textContent=bj.lastResult;
  const decks=(bj.shoe.length/52);
  els.bjShoeDisplay.textContent=bj.shoe.length?decks.toFixed(1)+" decks":"6 decks";
  els.bjHandCount.textContent=bj.handCount+(bj.handCount===1?" hand":" hands");

  const betting=bj.phase==="betting";
  document.querySelectorAll("#bjChips .chip").forEach(c=>c.disabled=!betting);
  els.bjClearBetButton.disabled=!betting||bj.bet<=0;
  els.bjUndoBetButton.disabled=!betting||!bj.betHistory.length;
  els.dealButton.disabled=!betting||bj.bet<=0;
  els.bjActionRow.style.display=bj.phase==="player"?"flex":"none";
  els.bjInsuranceRow.classList.toggle("show",bj.phase==="insurance");

  const canAct=bj.phase==="player"&&active?.status==="playing";
  els.hitButton.disabled=!canAct;
  els.standButton.disabled=!canAct;
  els.doubleButton.disabled=!canAct||active.cards.length!==2||state.bankroll<active.bet||active.splitAces;
  els.splitButton.disabled=!canAct||!bjCanSplit(active);
  els.surrenderButton.disabled=!canAct||bj.hands.length!==1||active.cards.length!==2||active.fromSplit;
  els.insuranceButton.disabled=bj.phase!=="insurance"||state.bankroll<bj.hands[0].bet/2;

  let status="Place your bet";
  if(bj.phase==="dealing")status="Dealing";
  else if(bj.phase==="insurance")status="Insurance";
  else if(bj.phase==="player")status="Your turn";
  else if(bj.phase==="dealer")status="Dealer's turn";
  els.bjStatus.innerHTML="<span></span> "+status;
  els.bjStatus.classList.toggle("spinning",["dealing","dealer"].includes(bj.phase));

  renderBlackjack();
}

function bjSetMessage(text){ els.bjActionMessage.textContent=text; }

function bjPlaceChip(value){
  if(bj.phase!=="betting")return;
  if(state.bankroll<value){bjSetMessage("Not enough bankroll for that chip.");beep(170,.1,.03);return;}
  state.bankroll-=value;
  bj.bet+=value;
  bj.betHistory.push(value);
  bjSetMessage(money(bj.bet)+" wagered.");
  beep(335,.035,.016);
  updateUI();
}

function bjUndoBet(){
  if(bj.phase!=="betting")return;
  const value=bj.betHistory.pop();if(!value)return;
  bj.bet-=value;state.bankroll+=value;
  bjSetMessage(bj.bet?money(bj.bet)+" wagered.":"Choose your wager and deal.");
  updateUI();
}

function bjClearBet(){
  if(bj.phase!=="betting")return;
  state.bankroll+=bj.bet;bj.bet=0;bj.betHistory=[];
  bjSetMessage("Bet cleared.");
  updateUI();
}

async function bjDealInitial(){
  if(bj.phase!=="betting"||bj.bet<=0)return;
  if(bj.shoe.length<78)buildBlackjackShoe();

  bj.phase="dealing";
  bj.roundStartBankroll=state.bankroll+bj.bet;
  bj.insurance=0;
  bj.hands=[{cards:[],bet:bj.bet,status:"playing",fromSplit:false,splitAces:false,resultText:"",resultTone:""}];
  bj.dealer=[];
  bj.activeHand=0;
  bjSetMessage("Cards out.");
  updateUI();

  const sequence=[
    ()=>bj.hands[0].cards.push(bjDraw()),
    ()=>bj.dealer.push(bjDraw()),
    ()=>bj.hands[0].cards.push(bjDraw()),
    ()=>bj.dealer.push(bjDraw())
  ];
  for(const deal of sequence){
    deal();renderBlackjack();beep(390,.025,.009);await wait(230);
  }

  const dealerUp=bj.dealer[0];
  if(dealerUp.rank==="A"){
    bj.phase="insurance";
    bjSetMessage(bjNatural(bj.hands[0])?"Blackjack. Take insurance for even money, or decline.":"Dealer shows an Ace. Insurance is half your main bet.");
    updateUI();
    return;
  }

  if(bjCardBaseValue(dealerUp)===10&&bjHandValue(bj.dealer).total===21){
    await bjDealerBlackjack();
    return;
  }

  if(bjNatural(bj.hands[0])){
    await bjPayNatural();
    return;
  }

  bj.phase="player";
  bjSetMessage("Hit, stand, double, split, or surrender when available.");
  updateUI();
}

async function bjResolveInsurance(take){
  if(bj.phase!=="insurance")return;
  const hand=bj.hands[0];
  if(take){
    const cost=hand.bet/2;
    if(state.bankroll<cost)return;
    state.bankroll-=cost;bj.insurance=cost;
    bjSetMessage("Insurance placed. Dealer checks the hole card…");
  }else{
    bjSetMessage("No insurance. Dealer checks the hole card…");
  }
  bj.phase="dealing";updateUI();await wait(450);

  if(bjHandValue(bj.dealer).total===21){
    await bjDealerBlackjack();
    return;
  }

  if(bj.insurance>0){
    // Insurance lost when dealer does not have blackjack.
    bjSetMessage("No dealer blackjack. Insurance loses.");
  }
  if(bjNatural(hand)){
    await wait(300);await bjPayNatural();return;
  }
  bj.phase="player";
  bjSetMessage("No dealer blackjack. Play your hand.");
  updateUI();
}

async function bjDealerBlackjack(){
  bj.phase="dealer";renderBlackjack();await wait(450);
  const hand=bj.hands[0];
  let returned=0;
  if(bj.insurance>0){
    returned+=bj.insurance*3;
    state.bankroll+=bj.insurance*3;
  }
  if(bjNatural(hand)){
    returned+=hand.bet;state.bankroll+=hand.bet;
    hand.resultText="Push — both blackjack";hand.resultTone="push";
  }else{
    hand.resultText="Dealer blackjack";hand.resultTone="loss";
  }
  await bjFinishRound("Dealer blackjack");
}

async function bjPayNatural(){
  const hand=bj.hands[0];
  state.bankroll+=hand.bet*2.5;
  hand.resultText="Blackjack · 3:2";hand.resultTone="win";
  bj.phase="dealer";renderBlackjack();beep(690,.18,.03);await wait(500);
  await bjFinishRound("Blackjack");
}

async function bjHit(){
  const hand=bj.hands[bj.activeHand];
  if(bj.phase!=="player"||!hand||hand.status!=="playing")return;
  hand.cards.push(bjDraw());beep(400,.025,.009);renderBlackjack();await wait(260);
  const v=bjHandValue(hand.cards).total;
  if(v>21){
    hand.status="bust";hand.resultText="Bust";hand.resultTone="loss";
    await bjAdvanceHand();
  }else if(v===21){
    hand.status="stood";hand.resultText="21";hand.resultTone="";
    await bjAdvanceHand();
  }else updateUI();
}

async function bjStand(){
  const hand=bj.hands[bj.activeHand];
  if(bj.phase!=="player"||!hand)return;
  hand.status="stood";hand.resultText="Standing";hand.resultTone="";
  await bjAdvanceHand();
}

async function bjDouble(){
  const hand=bj.hands[bj.activeHand];
  if(bj.phase!=="player"||!hand||hand.cards.length!==2||state.bankroll<hand.bet||hand.splitAces)return;
  state.bankroll-=hand.bet;hand.bet*=2;hand.doubled=true;
  bjSetMessage("Double down — one card.");
  hand.cards.push(bjDraw());beep(430,.03,.012);renderBlackjack();updateUI();await wait(300);
  const v=bjHandValue(hand.cards).total;
  if(v>21){hand.status="bust";hand.resultText="Doubled · bust";hand.resultTone="loss";}
  else{hand.status="stood";hand.resultText="Doubled · "+v;hand.resultTone="";}
  await bjAdvanceHand();
}

async function bjSplit(){
  const hand=bj.hands[bj.activeHand];
  if(bj.phase!=="player"||!bjCanSplit(hand))return;
  state.bankroll-=hand.bet;
  const [first,second]=hand.cards;
  const isAces=first.rank==="A";
  const h1={cards:[first],bet:hand.bet,status:"playing",fromSplit:true,splitAces:isAces,resultText:"",resultTone:""};
  const h2={cards:[second],bet:hand.bet,status:"playing",fromSplit:true,splitAces:isAces,resultText:"",resultTone:""};
  bj.hands.splice(bj.activeHand,1,h1,h2);
  bjSetMessage(isAces?"Split Aces receive one card each.":"Hand split.");
  updateUI();await wait(180);
  h1.cards.push(bjDraw());beep(390,.025,.009);renderBlackjack();await wait(220);
  h2.cards.push(bjDraw());beep(390,.025,.009);renderBlackjack();await wait(260);

  if(isAces){
    h1.status="stood";h2.status="stood";
    h1.resultText=String(bjHandValue(h1.cards).total);h2.resultText=String(bjHandValue(h2.cards).total);
    await bjAdvanceHand(true);
  }else{
    updateUI();
  }
}

async function bjSurrender(){
  const hand=bj.hands[bj.activeHand];
  if(bj.phase!=="player"||!hand||bj.hands.length!==1||hand.cards.length!==2||hand.fromSplit)return;
  state.bankroll+=hand.bet/2;
  hand.status="surrender";hand.resultText="Surrender · half returned";hand.resultTone="loss";
  await bjFinishRound("Surrender");
}

async function bjAdvanceHand(forceDealer=false){
  let next=bj.activeHand+1;
  while(next<bj.hands.length&&bj.hands[next].status!=="playing")next++;
  if(!forceDealer&&next<bj.hands.length){
    bj.activeHand=next;
    bjSetMessage("Playing hand "+(next+1)+" of "+bj.hands.length+".");
    updateUI();return;
  }
  await bjDealerPlay();
}

async function bjDealerPlay(){
  const live=bj.hands.some(h=>!["bust","surrender"].includes(h.status));
  if(!live){await bjFinishRound("All hands complete");return;}
  bj.phase="dealer";bjSetMessage("Dealer reveals.");renderBlackjack();updateUI();await wait(500);

  while(true){
    const dv=bjHandValue(bj.dealer);
    if(dv.total>=17)break; // S17: stand on both hard and soft 17
    bj.dealer.push(bjDraw());beep(380,.025,.009);renderBlackjack();await wait(420);
  }
  await wait(250);
  bjSettleHands();
  await bjFinishRound("Round complete");
}

function bjSettleHands(){
  const dealerValue=bjHandValue(bj.dealer).total;
  const dealerBust=dealerValue>21;
  for(const hand of bj.hands){
    if(hand.status==="surrender"||hand.status==="bust")continue;
    const player=bjHandValue(hand.cards).total;
    if(dealerBust){
      state.bankroll+=hand.bet*2;hand.resultText="Win · dealer bust";hand.resultTone="win";
    }else if(player>dealerValue){
      state.bankroll+=hand.bet*2;hand.resultText="Win";hand.resultTone="win";
    }else if(player===dealerValue){
      state.bankroll+=hand.bet;hand.resultText="Push";hand.resultTone="push";
    }else{
      hand.resultText="Loss";hand.resultTone="loss";
    }
    hand.status="done";
  }
}

async function bjFinishRound(label){
  bj.phase="dealer";renderBlackjack();updateUI();
  await wait(350);
  const net=state.bankroll-bj.roundStartBankroll;
  const tone=net>0?"win":net<0?"loss":"push";
  const result=net>0?"+"+money(net):net<0?"−"+money(Math.abs(net)):"Push";
  bj.lastResult=result;
  bj.handCount++;
  bj.history.unshift({label,result,tone});
  if(bj.history.length>6)bj.history.length=6;
  bjSetMessage(net>0?"Round won "+money(net)+".":net<0?"Round lost "+money(Math.abs(net))+".":"Round pushed.");
  if(net>0)beep(650,.16,.028);
  else if(net<0)beep(190,.14,.02);
  renderBjHistory();

  bj.phase="betting";
  bj.bet=0;bj.betHistory=[];bj.insurance=0;
  updateUI();
}

function renderBjHistory(){
  if(!bj.history.length){
    els.bjHistory.innerHTML='<div class="history-empty">Your blackjack results will appear here.</div>';
    return;
  }
  els.bjHistory.innerHTML=bj.history.map(h=>
    '<div class="bj-history-item"><span>'+h.label+'</span><strong class="'+h.tone+'">'+h.result+'</strong></div>'
  ).join("");
}

function switchGame(game){
  if(!["roulette","blackjack"].includes(game))return;
  state.game=game;
  document.querySelectorAll(".game-tab").forEach(btn=>btn.classList.toggle("active",btn.dataset.game===game));
  els.rouletteGame.classList.toggle("active",game==="roulette");
  els.blackjackGame.classList.toggle("active",game==="blackjack");
  els.brandGameLabel.textContent=game==="roulette"?"Roulette":"Blackjack";
  if(game==="blackjack")updateBlackjackUI();
}

function startSession(name,bankroll){
  state.player=name.trim()||"Player";state.bankroll=bankroll;state.startBankroll=bankroll;
  state.bets.clear();state.betHistory=[];state.spinHistory=[];state.lastWin=0;state.spinning=false;state.restingPocket=null;
  bj.phase="betting";bj.bet=0;bj.betHistory=[];bj.insurance=0;bj.hands=[];bj.dealer=[];bj.history=[];bj.handCount=0;bj.lastResult="—";
  buildBlackjackShoe();renderBjHistory();
  els.lastResultDisplay.textContent="—";els.winnerNumber.textContent="—";
  renderHistory();updateUI();setMessage("Choose a chip and place your bets.");
  els.setupModal.classList.add("hidden");els.app.setAttribute("aria-hidden","false");
}
function resetSession(){
  if(state.spinning||["dealing","insurance","player","dealer"].includes(bj.phase))return;
  state.bankroll+=totalBet()+bj.bet;state.bets.clear();state.betHistory=[];bj.bet=0;bj.betHistory=[];
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

document.querySelectorAll(".game-tab").forEach(btn=>btn.addEventListener("click",()=>switchGame(btn.dataset.game)));
document.getElementById("bjChips").addEventListener("click",e=>{
  const chip=e.target.closest(".chip");if(!chip||bj.phase!=="betting")return;
  bj.selectedChip=Number(chip.dataset.value);
  document.querySelectorAll("#bjChips .chip").forEach(c=>c.classList.toggle("selected",c===chip));
  bjPlaceChip(bj.selectedChip);
});
els.bjUndoBetButton.addEventListener("click",bjUndoBet);
els.bjClearBetButton.addEventListener("click",bjClearBet);
els.dealButton.addEventListener("click",bjDealInitial);
els.hitButton.addEventListener("click",bjHit);
els.standButton.addEventListener("click",bjStand);
els.doubleButton.addEventListener("click",bjDouble);
els.splitButton.addEventListener("click",bjSplit);
els.surrenderButton.addEventListener("click",bjSurrender);
els.insuranceButton.addEventListener("click",()=>bjResolveInsurance(true));
els.noInsuranceButton.addEventListener("click",()=>bjResolveInsurance(false));

function drawCurrentWheel(){
  const restingAngle=state.restingPocket===null
    ? null
    : -Math.PI/2+state.restingPocket*WHEEL_STEP+state.wheelRotation;
  drawWheel(state.wheelRotation,restingAngle,state.restingPocket===null?0:288);
}

let idleLast=performance.now();
function idleWheelLoop(now){
  const dt=Math.min(.05,Math.max(0,(now-idleLast)/1000));
  idleLast=now;
  if(!state.spinning){
    state.wheelRotation=(state.wheelRotation+IDLE_WHEEL_SPEED*dt)%TAU;
    drawCurrentWheel();
  }
  requestAnimationFrame(idleWheelLoop);
}

window.addEventListener("resize",drawCurrentWheel);
buildTable();buildBlackjackShoe();drawCurrentWheel();updateUI();renderHistory();renderBjHistory();switchGame("roulette");
requestAnimationFrame(idleWheelLoop);
setTimeout(()=>els.playerName.focus(),100);