/* 두 모드의 수치. HARD는 기존 7스테이지 규칙을 그대로 사용한다. */
const Difficulty = (function () {
  'use strict';
  const profiles = Object.freeze({
    easy: Object.freeze({id:'easy',label:'EASY',description:'적은 편대 · 느린 탄속 · 잔기 5 · 폭탄 3',
      enemyHp:.70,groundHp:.75,midHp:.75,bossHp:.80,partHp:.80,
      bulletSpeed:.78,attackRate:.80,patternScale:.75,
      lives:5,bombs:3,power:2,stageInv:3.5,respawnInv:4,resetPower:false}),
    hard: Object.freeze({id:'hard',label:'HARD',description:'기존 탄막 · 원래 탄속 · 잔기 3 · 폭탄 2',
      enemyHp:1,groundHp:1,midHp:1,bossHp:1,partHp:1,
      bulletSpeed:1,attackRate:1,patternScale:1,
      lives:3,bombs:2,power:1,stageInv:2.2,respawnInv:2.8,resetPower:true})
  });
  function normalize(id) { return id==='hard' ? 'hard' : 'easy'; }
  function get(id) { return profiles[normalize(id)]; }
  function formationCount(event,id) {
    return normalize(id)==='hard' ? event.n : Math.max(1,event.baseN || Math.round(event.n/1.5));
  }
  function patternCount(n,id) {
    if(n<=3 || normalize(id)==='hard')return n;
    let count=Math.max(2,Math.floor(n*get(id).patternScale));
    // 기존 홀짝 대칭을 보존해 양갈래 사격의 중앙 통로를 유지한다.
    if(count%2!==n%2)count--;
    return Math.max(n%2 ? 3 : 2,count);
  }
  function recordKeys(id) {
    return normalize(id)==='hard'
      ? {hi:'is_hi',last:'is_last',ranking:'is_scores'}
      : {hi:'is_easy_hi',last:'is_easy_last',ranking:'is_easy_scores'};
  }
  return {profiles:profiles,normalize:normalize,get:get,formationCount:formationCount,patternCount:patternCount,recordKeys:recordKeys};
})();
