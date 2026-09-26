/* Small interaction layer kept separate from the large game modules. */
(function(){
  'use strict';
  function bindDifficultyFeedback(){
    var grid=document.getElementById('levelsGrid');
    if(!grid||grid.dataset.fxBound==='1')return;
    grid.dataset.fxBound='1';
    grid.addEventListener('click',function(ev){
      var card=ev.target.closest&&ev.target.closest('.level-card');
      if(!card||card.classList.contains('locked'))return;
      grid.querySelectorAll('.level-card.is-preview').forEach(function(x){x.classList.remove('is-preview');});
      card.classList.add('is-preview');
      setTimeout(function(){card.classList.remove('is-preview');},520);
    });
  }
  function bind(){bindDifficultyFeedback();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
