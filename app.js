(() => {
  "use strict";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const STORE = "reflex-v1-data";
  const SETTINGS = "reflex-v1-settings";
  let data = loadData();
  let settings = loadSettings();
  let testState = "ready", testTimer = null, signalAt = 0, attemptId = 0, round = 1, sessionResults = [];
  let toastTimer = null, activeGame = null, gameTimer = null, gameInterval = null, gameState = {};
  let gameTimeouts = new Set(), gameRunId = 0;
  const pageNames = {overview:"Overview",test:"Reaction test",trainer:"Trainer games",analysis:"Analysis",settings:"Settings"};

  function loadData(){try{const saved=JSON.parse(localStorage.getItem(STORE)) || {};return {tests:Array.isArray(saved.tests)?saved.tests:[],games:Array.isArray(saved.games)?saved.games:[]};}catch{return {tests:[],games:[]};}}
  function saveData(){try{localStorage.setItem(STORE,JSON.stringify(data));return true;}catch(error){console.error("REFLEX could not save local data:",error);toast("Browser storage is unavailable. Check your browser storage settings.");return false;}}
  function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS)) || {sound:true,motion:false};}catch{return {sound:true,motion:false};}}
  function saveSettings(){localStorage.setItem(SETTINGS,JSON.stringify(settings));}
  function average(arr){return arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):null;}
  function fmt(ms){return ms == null ? "—" : Math.round(ms).toString();}
  function dateText(iso){return new Date(iso).toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"});}
  function timeText(iso){return new Date(iso).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});}
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2500);}
  function beep(freq=700,duration=.08){if(!settings.sound)return;try{const C=window.AudioContext||window.webkitAudioContext;const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=freq;o.type="sine";g.gain.value=.035;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration);o.onended=()=>c.close();}catch{}}

  function showPage(page,options={}){if(!pageNames[page])page="overview";if(!options.fromHistory&&location.hash!==`#${page}`)history.pushState({page},"",`#${page}`);$$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));$$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#crumbCurrent").textContent=pageNames[page];$("#sidebar").classList.remove("open");if(page==="overview"||page==="analysis")setTimeout(drawCharts,30);if(page==="overview"||page==="analysis")renderStats();if(page==="trainer"||page==="analysis")renderGameHistory();}
  window.addEventListener("popstate",()=>showPage(location.hash.slice(1),{fromHistory:true}));
  window.addEventListener("hashchange",()=>{const page=location.hash.slice(1);if(pageNames[page])showPage(page,{fromHistory:true});});
  $$(".nav-link").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
  $$("[data-go]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.go)));
  $("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  function setAnalysisTab(tab){
    const reaction=tab==="reaction";
    $("#analysis-reaction-panel").hidden=!reaction;
    $("#analysis-games-panel").hidden=reaction;
    $$(".analysis-tab").forEach(button=>{
      const selected=button.dataset.analysisTab===tab;
      button.classList.toggle("active",selected);
      button.setAttribute("aria-selected",String(selected));
    });
    if(reaction)drawCharts();
    else renderGameHistory();
  }
  $$(".analysis-tab").forEach(button=>button.addEventListener("click",()=>setAnalysisTab(button.dataset.analysisTab)));
  setAnalysisTab("reaction");
  $("#todayLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"short",day:"2-digit",month:"short"}).toUpperCase();

  const stages = {
    overview:{stage:$("#overviewStage"),title:$("#overviewStageTitle"),copy:$("#overviewStageCopy"),icon:$("#overviewStageIcon"),ms:$("#overviewStageMs"),hint:$("#overviewStageHint"),button:$("#overviewStart")},
    main:{stage:$("#mainStage"),title:$("#mainStageTitle"),copy:$("#mainStageCopy"),icon:$("#mainStageIcon"),ms:$("#mainStageMs"),hint:$("#mainStageHint"),button:$("#mainStart")}
  };
  function setStage(which,state,title,copy,ms=""){const s=stages[which];s.stage.className=`reaction-stage ${which==="main"?"large ":""}${state}`;s.title.textContent=title;s.copy.textContent=copy;s.ms.textContent=ms;s.icon.textContent=state==="go"?"●":state==="waiting"?"⌛":state==="result"?"✓":"◎";s.hint.textContent=state==="waiting"?"WAIT FOR GREEN":state==="go"?"CLICK NOW / PRESS SPACE":state==="result"?"ROUND RECORDED":"DO NOT CLICK UNTIL GREEN";s.button.hidden=state==="waiting"||state==="go";if(state==="waiting")beep(250,.08);}
  function normaliseEventTime(event){const stamp=Number(event?.timeStamp);return Number.isFinite(stamp)&&stamp>=0&&stamp<1e12?stamp:performance.now();}
  function startAttempt(which){if(testState==="waiting"||testState==="arming"||testState==="go")return;if(which==="main"&&round>5){finishSession();return;}const token=++attemptId;signalAt=0;testState="waiting";setStage(which,"waiting","Wait for green…","Stay focused. Do not click yet.");const delay=1000+Math.random()*4000;clearTimeout(testTimer);testTimer=setTimeout(()=>{if(token!==attemptId)return;testState="arming";setStage(which,"go","CLICK NOW!","The signal is green. Respond immediately.");requestAnimationFrame(frameTime=>{if(token!==attemptId||testState!=="arming")return;signalAt=frameTime;testState="go";if(settings.sound)beep(880,.11);});},delay);}
  function handleStageAction(which,eventTime=performance.now()){if(testState==="arming")return;if(testState==="waiting"){++attemptId;clearTimeout(testTimer);testState="ready";setStage(which,"result","False start!","You clicked before the green signal. Try again.");toast("False start — wait for the green signal.");return;}if(testState==="go"){if(!signalAt)return;const ms=Math.max(0,eventTime-signalAt);++attemptId;testState="result";recordTest(ms);if(which==="main"){sessionResults.push(ms);updateSession();const dots=$$("#roundDots i");dots.forEach((d,i)=>d.className=i<round?"done":i===round?"current":"");setStage(which,"result",`${Math.round(ms)} ms`,round<5?"Round recorded. Continue when ready.":"Final round recorded.");round++;$("#testRoundLabel").textContent=round<=5?`Round ${round} of 5`:"Session complete";}else{setStage(which,"result",`${Math.round(ms)} ms`,"Reaction recorded. Start another attempt when ready.");}renderStats();return;}}
  function bindStage(which){const s=stages[which];s.stage.addEventListener("pointerdown",e=>{if(testState==="waiting"||testState==="go"){e.preventDefault();handleStageAction(which,normaliseEventTime(e));}});s.stage.addEventListener("click",e=>{if(e.detail===0&&(testState==="waiting"||testState==="go"))handleStageAction(which,normaliseEventTime(e));});s.stage.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&(testState==="waiting"||testState==="go")){e.preventDefault();handleStageAction(which,normaliseEventTime(e));}});s.button.addEventListener("click",e=>{e.stopPropagation();if(which==="main"&&round>5)resetTestSession();startAttempt(which);});}
  bindStage("overview");bindStage("main");
  document.addEventListener("keydown",e=>{if(e.code!=="Space"||e.repeat||$("#gameModal").classList.contains("open"))return;const active=$(".page.active");if(!active)return;const which=active.id==="page-test"?"main":active.id==="page-overview"?"overview":null;if(which&&(testState==="go"||testState==="waiting")){e.preventDefault();handleStageAction(which,normaliseEventTime(e));}});
  function recordTest(ms){data.tests.unshift({ms:Number(ms.toFixed(2)),at:new Date().toISOString()});data.tests=data.tests.slice(0,5000);saveData();}
  function updateSession(){const avg=average(sessionResults),best=sessionResults.length?Math.min(...sessionResults):null;$("#sessionAverage").textContent=avg?`${avg} ms`:"— ms";$("#sessionBest").textContent=best?`${best} ms`:"— ms";}
  function resetTestSession(){++attemptId;clearTimeout(testTimer);testState="ready";signalAt=0;round=1;sessionResults=[];updateSession();$("#testRoundLabel").textContent="Round 1 of 5";$("#roundDots").innerHTML="<i class='current'></i><i></i><i></i><i></i><i></i>";setStage("main","ready","Ready?","Press start. Wait for the screen to turn green.");}
  $("#resetSession").addEventListener("click",resetTestSession);
  function finishSession(){setStage("main","result","Session complete","You finished all five rounds.",`${average(sessionResults)} ms average`);$("#mainStageHint").textContent="FIVE ROUNDS COMPLETE";$("#mainStart").hidden=false;$("#mainStart").textContent="NEW SESSION ↻";round=6;toast("Session complete — results saved.");}

  function streakDays(){const days=new Set(data.tests.map(t=>new Date(t.at).toDateString()));if(!days.size)return 0;let count=0,d=new Date();while(days.has(d.toDateString())){count++;d.setDate(d.getDate()-1);}return count;}
  function renderStats(){const vals=data.tests.map(t=>t.ms),avg=average(vals),best=vals.length?Math.min(...vals):null,week= data.tests.filter(t=>Date.now()-new Date(t.at).getTime()<7*86400000).length;
    $("#overviewAverage").innerHTML=avg?`${avg}<small> ms</small>`:"—<small> ms</small>";$("#overviewBest").innerHTML=best?`${best}<small> ms</small>`:"—<small> ms</small>";$("#overviewTests").textContent=vals.length;$("#overviewStreak").innerHTML=`${streakDays()}<small> days</small>`;
    $("#analysisAverage").innerHTML=avg?`${avg}<small> ms</small>`:"—<small> ms</small>";$("#analysisBest").innerHTML=best?`${best}<small> ms</small>`:"—<small> ms</small>";$("#analysisCount").textContent=vals.length;$("#analysisWeek").textContent=week;
    const recent=data.tests.slice(0,5);$("#recentResults").innerHTML=recent.length?recent.map(t=>`<div class="recent-item"><div><strong>${t.ms} ms</strong><small>${dateText(t.at)} · ${timeText(t.at)}</small></div><span class="result-pill">${labelFor(t.ms)}</span></div>`).join(""):'<div class="empty-state">No results yet. Run your first test to see your data here.</div>';
    $("#historyTable").innerHTML=data.tests.length?data.tests.slice(0,100).map((t,i)=>`<tr><td>${i+1}</td><td>${t.ms} ms</td><td>${dateText(t.at)}</td><td>${timeText(t.at)}</td><td><span class="result-pill">${labelFor(t.ms)}</span></td></tr>`).join(""):'<tr><td colspan="5" class="empty-state">No attempts recorded yet.</td></tr>';$("#logCount").textContent=`${data.tests.length} RECORDS`;drawCharts();}
  function labelFor(ms){return ms<150?"EXCEPTIONAL":ms<200?"VERY FAST":ms<250?"TYPICAL":"KEEP TRAINING";}
  function drawOneChart(canvasId,records){const canvas=$("#"+canvasId);if(!canvas)return;const rect=canvas.getBoundingClientRect(),w=Math.max(300,rect.width),h=canvasId==="analysisChart"?230:170,dpr=window.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.height=h+"px";const c=canvas.getContext("2d");c.scale(dpr,dpr);c.clearRect(0,0,w,h);const pad={l:38,r:12,t:12,b:25},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;c.font="9px 'DM Mono'";c.strokeStyle="#263034";c.fillStyle="#758286";c.lineWidth=1;
    const vals=records.map(x=>x.ms),min=Math.max(0,Math.floor((Math.min(...vals,100)-30)/50)*50),max=Math.ceil((Math.max(...vals,350)+30)/50)*50;for(let i=0;i<5;i++){const y=pad.t+ph*i/4;c.beginPath();c.moveTo(pad.l,y);c.lineTo(w-pad.r,y);c.stroke();c.fillText(Math.round(max-(max-min)*i/4),3,y+3);}
    if(!records.length){c.fillStyle="#657276";c.textAlign="center";c.fillText("Complete a reaction test to populate your chart",w/2,h/2);return;}
    const ordered=records.slice(0,canvasId==="analysisChart"?40:12).reverse(),x=i=>pad.l+(ordered.length===1?pw/2:pw*i/(ordered.length-1)),y=v=>pad.t+ph-(v-min)/(max-min||1)*ph;
    c.strokeStyle="#a7ff4f";c.lineWidth=2;c.beginPath();ordered.forEach((r,i)=>i?c.lineTo(x(i),y(r.ms)):c.moveTo(x(i),y(r.ms)));c.stroke();ordered.forEach((r,i)=>{c.beginPath();c.fillStyle="#a7ff4f";c.arc(x(i),y(r.ms),3,0,Math.PI*2);c.fill();});c.fillStyle="#758286";c.textAlign="left";c.fillText("OLDER",pad.l,h-5);c.textAlign="right";c.fillText("NEWER",w-pad.r,h-5);}
  function drawCharts(){drawOneChart("overviewChart",data.tests);drawOneChart("analysisChart",data.tests);}
  window.addEventListener("resize",()=>{clearTimeout(window._chartResize);window._chartResize=setTimeout(drawCharts,120);});

  $("#exportCsv").addEventListener("click",()=>{if(!data.tests.length){toast("There are no test results to export yet.");return;}const rows=[["reaction_ms","date_iso"],...data.tests.map(t=>[t.ms,t.at])];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="reflex-reaction-history.csv";a.click();URL.revokeObjectURL(a.href);});
  function clearAll(){if(!confirm("Delete all REFLEX reaction and game history from this browser? This cannot be undone."))return;data={tests:[],games:[]};saveData();renderStats();renderGameHistory();toast("Local data cleared.");}
  $("#clearAll").addEventListener("click",clearAll);$("#resetData").addEventListener("click",clearAll);
  $("#soundToggle").checked=settings.sound;$("#motionToggle").checked=settings.motion;$("#soundToggle").addEventListener("change",e=>{settings.sound=e.target.checked;saveSettings();});$("#motionToggle").addEventListener("change",e=>{settings.motion=e.target.checked;document.body.classList.toggle("reduced-motion",settings.motion);saveSettings();});document.body.classList.toggle("reduced-motion",settings.motion);

  // Training games
  const gameInfo={
    target:{title:"Target Rush",desc:"Hit as many targets as possible in 30 seconds.",instructions:"Click the glowing target. It moves after every hit."},
    memory:{title:"Pattern Memory",desc:"Watch the tile sequence, then repeat it.",instructions:"Memorize the sequence of glowing tiles and repeat it in order."},
    nogo:{title:"Go / No-Go",desc:"Click green GO signals. Do not click red STOP signals.",instructions:"Green means click. Red means do nothing. 20 signals total."},
    focus:{title:"Focus Finder",desc:"Find the unique symbol among the decoys.",instructions:"Click the one symbol that is different from all the others."},
    tracking:{title:"Moving Target",desc:"Click the moving target as many times as you can in 30 seconds.",instructions:"The target moves around the board. Keep your eyes on it."}
  };
  // Bind the launch buttons directly. They remain available after the modal is closed.
  $$(".game-launch").forEach(button=>button.addEventListener("click",event=>{
    event.preventDefault();
    openGame(button.dataset.game);
  }));
  function openGame(type){
    if(!gameInfo[type])return;
    stopGameTimers();
    activeGame=type;
    const info=gameInfo[type];
    $("#modalTitle").textContent=info.title;
    $("#modalDescription").textContent=info.desc;
    $("#gameInstructions").textContent=info.instructions;
    $("#gameModal").classList.add("open");
    $("#gameModal").setAttribute("aria-hidden","false");
    resetGameUI();
  }
  function closeGame(){
    const hadRun=!!gameState.started;
    if(hadRun&&!gameState.finished&&gameState.attempts>0)finishGame("Session saved");
    stopGameTimers();
    gameState.finished=true;
    const modal=$("#gameModal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
    activeGame=null;
    $("#gameBoard").innerHTML="";
    $("#gameBoard").classList.remove("game-selection-mode");
    $("#restartGame").hidden=true;
  }
  $("#closeModal").addEventListener("click",closeGame);
  function returnToGameSelection(){
    if(gameState.started&&!gameState.finished&&gameState.attempts>0)finishGame("Session saved");
    stopGameTimers();
    gameState.finished=true;
    activeGame=null;
    $("#modalTitle").textContent="Choose another game";
    $("#modalDescription").textContent="Pick a challenge. Your game cards include a preview of each activity.";
    $("#gameScore").textContent="SCORE —";
    $("#gameTimer").textContent="READY";
    $("#gameAccuracy").textContent="ACCURACY —";
    $("#gameFeedback").textContent="Choose a game to continue training.";
    $("#restartGame").hidden=true;
    const board=$("#gameBoard");
    board.classList.add("game-selection-mode");
    board.innerHTML='<div class="game-picker"><div class="game-switch-list"></div></div>';
    const list=board.querySelector(".game-switch-list");
    const art={
      target:'<div class="game-art target-art"><span>◎</span><i></i><i></i><i></i></div>',
      memory:'<div class="game-art memory-art"><span>▦</span><i></i><i></i></div>',
      nogo:'<div class="game-art nogo-art"><span>GO</span><i>STOP</i></div>',
      focus:'<div class="game-art focus-art"><span>✣</span><i></i><i></i></div>',
      tracking:'<div class="game-art track-art"><span>↗</span><i></i><i></i></div>'
    };
    Object.entries(gameInfo).forEach(([type,info])=>{
      const button=document.createElement("button");
      button.type="button";
      button.className="game-switch-option";
      button.innerHTML=art[type]+'<span class="game-switch-title">'+info.title+'</span><span class="game-switch-desc">'+info.desc+'</span>';
      button.addEventListener("click",()=>{
        activeGame=type;
        $("#modalTitle").textContent=info.title;
        $("#modalDescription").textContent=info.desc;
        board.classList.remove("game-selection-mode");
        resetGameUI();
      });
      list.append(button);
    });
  }
  $("#switchGame").addEventListener("click",returnToGameSelection);
  $("#gameModal").addEventListener("click",e=>{if(e.target===$("#gameModal"))closeGame();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#gameModal").classList.contains("open"))closeGame();});
  function scheduleGame(fn,delay){const run=gameRunId;const id=setTimeout(()=>{gameTimeouts.delete(id);if(run!==gameRunId||!$("#gameModal").classList.contains("open")||gameState.finished)return;fn();},delay);gameTimeouts.add(id);return id;}
  function stopGameTimers(){gameRunId++;if(gameTimer!==null)clearInterval(gameTimer);if(gameInterval!==null)clearInterval(gameInterval);gameTimeouts.forEach(clearTimeout);gameTimeouts.clear();gameTimer=null;gameInterval=null;}
  function resetGameUI(){
    stopGameTimers();gameState={score:0,attempts:0,hits:0,remaining:30,sequence:[],input:[],step:0,signal:0,signals:0,correct:0,finished:false,started:null};
    $("#gameScore").textContent="SCORE 0";$("#gameTimer").textContent=activeGame==="memory"?"LEVEL 1":"TIME 30";$("#gameAccuracy").textContent="ACCURACY —";
    $("#gameBoard").innerHTML=`<div class="game-intro"><div class="game-intro-icon">✦</div><h3>Ready to train?</h3><p>${gameInfo[activeGame].instructions}</p><button class="primary-button" id="startGame">START GAME ↗</button></div>`;
    $("#gameFeedback").textContent="Your training scores are saved locally.";$("#restartGame").hidden=true;
    $("#startGame").addEventListener("click",startGame,{once:true});
  }
  function startGame(){if(gameState.started||gameState.finished)return;gameState.started=Date.now();if(activeGame==="target"||activeGame==="tracking"||activeGame==="focus"){$("#gameBoard").innerHTML="";startTimedGame();}else if(activeGame==="memory"){startMemoryGame();}else if(activeGame==="nogo"){startNogoGame();}}
  function startClock(seconds){gameState.remaining=seconds;$("#gameTimer").textContent=`TIME ${seconds}`;gameTimer=setInterval(()=>{if(gameState.finished)return;gameState.remaining--;$("#gameTimer").textContent=`TIME ${gameState.remaining}`;if(gameState.remaining<=0)finishGame();},1000);}
  function updateGameHud(){const accuracy=gameState.attempts?Math.round(gameState.hits/gameState.attempts*100):0;$("#gameScore").textContent=`SCORE ${gameState.score}`;$("#gameAccuracy").textContent=`ACCURACY ${gameState.attempts?accuracy+"%":"—"}`;}
  function startTimedGame(){startClock(30);if(activeGame==="target")spawnTarget();if(activeGame==="tracking")spawnMoving();if(activeGame==="focus")spawnFocus();}
  function randomPos(el){const board=$("#gameBoard"),maxX=Math.max(0,board.clientWidth-el.offsetWidth-12),maxY=Math.max(0,board.clientHeight-el.offsetHeight-12);el.style.left=(10+Math.random()*Math.max(0,maxX-10))+"px";el.style.top=(10+Math.random()*Math.max(0,maxY-10))+"px";}
  function spawnTarget(){const b=$("#gameBoard");b.innerHTML="";const t=document.createElement("button");t.className="game-target";t.textContent="+";t.setAttribute("aria-label","Target");b.append(t);randomPos(t);t.addEventListener("click",()=>{if(gameState.finished)return;gameState.attempts++;gameState.hits++;gameState.score+=10;updateGameHud();randomPos(t);beep(650,.04);});}
  function spawnMoving(){const b=$("#gameBoard");b.innerHTML="";const t=document.createElement("button");t.className="moving-target";t.setAttribute("aria-label","Moving target");b.append(t);randomPos(t);t.addEventListener("click",()=>{if(gameState.finished)return;gameState.attempts++;gameState.hits++;gameState.score+=10;updateGameHud();randomPos(t);beep(650,.04);});gameInterval=setInterval(()=>{if(t.isConnected&&!gameState.finished)randomPos(t);},650);}
  function spawnFocus(){const b=$("#gameBoard");b.innerHTML="";const symbols=["✦","✧","✦","✦","✦","✦","✦","✦","✦","✦","✦","✦"];const targetIndex=Math.floor(Math.random()*symbols.length);symbols[targetIndex]="✧";symbols.forEach((symbol,i)=>{const el=document.createElement("button");el.className="focus-symbol"+(i===targetIndex?" target":"");el.textContent=symbol;el.style.border="0";el.style.background="transparent";el.style.left=(5+Math.random()*85)+"%";el.style.top=(5+Math.random()*75)+"%";b.append(el);el.addEventListener("click",()=>{if(gameState.finished)return;gameState.attempts++;if(i===targetIndex){gameState.hits++;gameState.score+=15;updateGameHud();spawnFocus();}else{gameState.score=Math.max(0,gameState.score-5);updateGameHud();toast("That was a decoy. Find the unique symbol.");}});});}
  function startNogoGame(){showSignal();}
  function showSignal(){if(gameState.finished)return;if(gameState.signals>=20){finishGame();return;}const go=Math.random()>.42;gameState.signal=go?1:0;gameState.signals++;$("#gameTimer").textContent=`SIGNAL ${gameState.signals}/20`;const b=$("#gameBoard");b.innerHTML=`<button class="signal-card" style="border:0;background:transparent;color:${go?'#a7ff4f':'#f05b63'}">${go?'GO':'STOP'}</button><div style="position:absolute;bottom:17px;color:#829092;font:9px var(--mono)">CLICK ONLY ON GREEN GO</div>`;let responded=false;const act=()=>{if(responded||gameState.finished)return;responded=true;gameState.attempts++;if(go){gameState.hits++;gameState.score+=10;}else{gameState.score=Math.max(0,gameState.score-8);}updateGameHud();scheduleGame(showSignal,450);};b.querySelector("button").addEventListener("click",act);scheduleGame(()=>{if(responded)return;responded=true;gameState.attempts++;if(!go){gameState.hits++;gameState.score+=5;}updateGameHud();showSignal();},1000);}
  function startMemoryGame(){gameState.level=1;gameState.sequence=[];gameState.input=[];memoryLevel();}
  function memoryLevel(){if(gameState.finished)return;gameState.sequence.push(Math.floor(Math.random()*9));gameState.input=[];gameState.step=0;$("#gameTimer").textContent=`LEVEL ${gameState.level}`;const b=$("#gameBoard");b.innerHTML='<div class="game-tile-grid">'+Array.from({length:9},(_,i)=>`<button class="memory-tile" data-tile="${i}"></button>`).join("")+'</div>';const tiles=$$(".memory-tile",b);let i=0;$("#gameFeedback").textContent="Watch the sequence…";gameInterval=setInterval(()=>{if(gameState.finished)return;tiles.forEach(t=>t.classList.remove("lit"));if(i<gameState.sequence.length){const tileIndex=gameState.sequence[i++];tiles[tileIndex].classList.add("lit");scheduleGame(()=>tiles[tileIndex]?.classList.remove("lit"),330);}else{clearInterval(gameInterval);gameInterval=null;$("#gameFeedback").textContent="Your turn — repeat the sequence.";tiles.forEach(t=>t.addEventListener("click",()=>memoryPick(Number(t.dataset.tile),tiles)));}},600);}
  function memoryPick(n,tiles){if(gameState.finished||gameState.step>=gameState.sequence.length)return;gameState.attempts++;const expected=gameState.sequence[gameState.step];if(n!==expected){updateGameHud();$("#gameFeedback").textContent="Sequence missed — your score has been saved.";finishGame("Pattern ended");return;}tiles[n].classList.add("lit");scheduleGame(()=>tiles[n]?.classList.remove("lit"),200);gameState.hits++;gameState.step++;if(gameState.step===gameState.sequence.length){gameState.score+=gameState.level*10;gameState.level++;updateGameHud();if(gameState.level>10){finishGame("10 levels completed");return;}$("#gameFeedback").textContent="Correct! Next level…";scheduleGame(memoryLevel,650);}else{updateGameHud();}}
  function renderGameHistory(){const rows=Array.isArray(data.games)?data.games:[];$("#gameLogCount").textContent=`${rows.length} RECORDS`;$("#gameHistoryTable").innerHTML=rows.length?rows.slice(0,100).map(g=>`<tr><td>${gameInfo[g.type]?.title||"Training game"}</td><td>${Number(g.score)||0}</td><td>${Number(g.accuracy)||0}%</td><td>${dateText(g.at)}</td><td>${timeText(g.at)}</td></tr>`).join(""):'<tr><td colspan="5" class="empty-state">Play a trainer game to save your first score.</td></tr>';const byType=Object.keys(gameInfo).map(type=>{const list=rows.filter(g=>g.type===type);return {type,list,best:list.length?Math.max(...list.map(g=>Number(g.score)||0)):0,accuracy:list.length?average(list.map(g=>Number(g.accuracy)||0)):0};});$("#gameAnalysisSessions").textContent=rows.length;$("#gameAnalysisAccuracy").textContent=rows.length?`${average(rows.map(g=>Number(g.accuracy)||0))}%`:"—";$("#gameAnalysisTypes").textContent=byType.filter(x=>x.list.length).length;$("#gameBreakdownTable").innerHTML=byType.map(x=>`<tr><td>${gameInfo[x.type].title}</td><td>${x.list.length}</td><td>${x.list.length?x.best:"—"}</td><td>${x.list.length?x.accuracy+"%":"—"}</td><td>${x.list.length?dateText(x.list[0].at):"—"}</td></tr>`).join("");$("#trainingLogCount").textContent=`${rows.length} RECORDS`;$("#gameSessionTable").innerHTML=rows.length?rows.slice(0,50).map(g=>`<tr><td>${gameInfo[g.type]?.title||"Training game"}</td><td>${Number(g.score)||0}</td><td>${Number(g.accuracy)||0}%</td><td>${Number(g.attempts)||0}</td><td>${dateText(g.at)}</td></tr>`).join(""):'<tr><td colspan="5" class="empty-state">Complete a training game to build your performance history.</td></tr>';}
  function finishGame(reason="Challenge complete"){
    if(gameState.finished)return;gameState.finished=true;stopGameTimers();const accuracy=gameState.attempts?Math.round(gameState.hits/gameState.attempts*100):0;
    data.games.unshift({type:activeGame,score:gameState.score,accuracy,attempts:gameState.attempts,hits:gameState.hits,at:new Date().toISOString()});data.games=data.games.slice(0,500);const saved=saveData();renderGameHistory();
    $("#gameBoard").innerHTML=`<div class="game-intro"><div class="game-intro-icon">✦</div><h3>${reason}</h3><p>You scored <strong style="color:var(--green)">${gameState.score}</strong> points with ${accuracy}% accuracy.</p></div>`;
    $("#gameFeedback").textContent=saved?`${gameInfo[activeGame].title} result saved locally.`:"Could not save this result. Check browser storage permissions.";$("#restartGame").hidden=false;updateGameHud();
  }
  $("#restartGame").addEventListener("click",resetGameUI);

  renderStats();renderGameHistory();const initialPage=location.hash.slice(1);if(pageNames[initialPage])showPage(initialPage,{fromHistory:true});setStage("overview","ready","Ready when you are","Wait for green. Then click as fast as you can.");setStage("main","ready","Ready?","Press start. Wait for the screen to turn green.");
})();