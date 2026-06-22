  </main>
</div>
<script>
(function(){
  var btn=document.getElementById('menuBtn'),sb=document.getElementById('sidebar'),bd=document.getElementById('backdrop');
  function toggle(o){if(sb)sb.classList.toggle('open',o);if(bd)bd.classList.toggle('hidden',!o);}
  if(btn)btn.addEventListener('click',function(){toggle(!sb.classList.contains('open'));});
  if(bd)bd.addEventListener('click',function(){toggle(false);});

  // confirmação de exclusão
  document.querySelectorAll('[data-confirm]').forEach(function(f){
    f.addEventListener('submit',function(e){if(!confirm(f.getAttribute('data-confirm')))e.preventDefault();});
  });

  // preview de novas imagens
  var inp=document.getElementById('fotos'),pv=document.getElementById('preview');
  if(inp&&pv){inp.addEventListener('change',function(){pv.innerHTML='';Array.prototype.forEach.call(inp.files,function(f){
    if(!f.type.startsWith('image/'))return;var img=document.createElement('img');img.src=URL.createObjectURL(f);pv.appendChild(img);});});}

  // marcação visual da capa
  document.querySelectorAll('input[name="capa"]').forEach(function(r){
    r.addEventListener('change',function(){
      document.querySelectorAll('.img-item').forEach(function(it){it.classList.remove('cover');});
      var it=r.closest('.img-item');if(it)it.classList.add('cover');
    });
  });
})();
</script>
</body>
</html>
