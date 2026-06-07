<?php
session_start();
if (isset($_SESSION['usuario_id'])) { header("Location: dashboard.php"); exit; }
$erro = "";
$msg_rec = "";
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $acao = $_POST['acao'] ?? 'login';
    require 'conexao.php';
    if ($acao === 'recuperar') {
        $email = trim($_POST['email_rec'] ?? '');
        $msg_rec = "Se este e-mail estiver cadastrado, você receberá as instruções em breve.";
    } else {
        $email = trim($_POST['email'] ?? '');
        $senha = $_POST['senha'] ?? '';
        if (empty($email) || empty($senha)) {
            $erro = "Preencha e-mail e senha.";
        } else {
            $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE email = ? AND ativo = 1 LIMIT 1");
            $stmt->execute([$email]);
            $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($usuario && password_verify($senha, $usuario['senha'])) {
                $_SESSION['usuario_id'] = $usuario['id'];
                $_SESSION['nome']       = $usuario['nome'];
                $_SESSION['nivel']      = $usuario['nivel'];
                $_SESSION['setor']      = $usuario['setor'];
                $_SESSION['ini']        = strtoupper(substr($usuario['nome'],0,1).(strpos($usuario['nome'],' ')!==false?substr($usuario['nome'],strpos($usuario['nome'],' ')+1,1):''));
                header("Location: dashboard.php"); exit;
            } else { $erro = "E-mail ou senha incorretos."; }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Taskflow — Acesso</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;font-family:'DM Sans',sans-serif;overflow:hidden}
    
    /* ── Canvas background ── */
    #bg-canvas{position:fixed;inset:0;z-index:0}
    
    /* ── Page ── */
    .page{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
    
    /* ── Logo ── */
    .logo{display:flex;flex-direction:column;align-items:center;margin-bottom:36px;animation:logoIn .8s cubic-bezier(.34,1.56,.64,1) both}
    @keyframes logoIn{from{opacity:0;transform:translateY(-30px) scale(.8)}to{opacity:1;transform:none}}
    .logo-tesk{font-size:72px;font-weight:700;color:#F26522;letter-spacing:-3px;line-height:1;text-shadow:0 0 40px rgba(242,101,34,.3)}
    .logo-flow{font-family:'Dancing Script',cursive;font-size:52px;color:rgba(255,255,255,.85);line-height:1;margin-top:-8px;text-shadow:0 0 20px rgba(255,255,255,.1)}
    
    /* ── Card ── */
    .card-wrap{animation:cardIn .9s cubic-bezier(.34,1.56,.64,1) .2s both;perspective:1000px}
    @keyframes cardIn{from{opacity:0;transform:translateY(40px) scale(.9)}to{opacity:1;transform:none}}
    .card{background:rgba(30,30,30,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:24px;border:1px solid rgba(255,255,255,.08);padding:40px;width:100%;max-width:400px;transition:transform .1s ease-out,box-shadow .3s;box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.05);transform-style:preserve-3d}
    .card:hover{box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(242,101,34,.1)}
    .card-title{font-size:22px;font-weight:700;color:#fff;margin-bottom:6px;text-align:center}
    .card-sub{font-size:14px;color:#666;margin-bottom:28px;text-align:center}
    
    /* ── Alert ── */
    .alert{display:flex;align-items:center;gap:10px;background:rgba(226,75,74,.12);border:1px solid rgba(226,75,74,.25);border-radius:12px;padding:12px 14px;margin-bottom:20px;font-size:13px;color:#f09595;animation:shake .3s ease}
    .alert-success{background:rgba(29,158,117,.12);border:1px solid rgba(29,158,117,.25);color:#5DCAA5}
    @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
    
    /* ── Fields ── */
    .field{margin-bottom:18px}
    .field label{display:block;font-size:11px;color:#666;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.07em}
    .input-wrap{position:relative}
    .input-wrap input{width:100%;height:52px;padding:0 16px 0 48px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;font-family:'DM Sans',sans-serif;font-size:15px;color:#fff;outline:none;transition:all .2s}
    .input-wrap input:focus{border-color:#F26522;background:rgba(242,101,34,.07);box-shadow:0 0 0 3px rgba(242,101,34,.12)}
    .input-wrap input::placeholder{color:#444}
    .input-icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);width:18px;height:18px;stroke:rgba(255,255,255,.25);fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;transition:stroke .2s}
    .input-wrap input:focus ~ .input-icon,.input-wrap input:focus + .input-icon{stroke:#F26522}
    .eye-btn{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#444;display:flex;padding:4px;transition:color .2s}
    .eye-btn:hover{color:#F26522}
    .eye-btn svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
    
    /* ── Lembrar ── */
    .lembrar{display:flex;align-items:center;gap:9px;margin-bottom:24px;cursor:pointer;user-select:none}
    .lembrar input{display:none}
    .check-box{width:20px;height:20px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
    .lembrar input:checked ~ .check-box{background:#F26522;border-color:#F26522;box-shadow:0 0 12px rgba(242,101,34,.4)}
    .check-box svg{width:11px;height:11px;stroke:white;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;display:none}
    .lembrar input:checked ~ .check-box svg{display:block}
    .lembrar span{font-size:14px;color:#666}
    
    /* ── Button ── */
    .btn-login{width:100%;height:54px;background:linear-gradient(135deg,#F26522,#ff8c4a);color:#fff;border:none;border-radius:14px;font-family:'DM Sans',sans-serif;font-size:16px;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:.02em;box-shadow:0 4px 20px rgba(242,101,34,.4)}
    .btn-login:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(242,101,34,.5)}
    .btn-login:active{transform:scale(.97)}
    
    /* ── Esqueceu ── */
    .esqueceu{text-align:center;margin-top:16px}
    .esqueceu a{font-size:13px;color:#555;text-decoration:none;cursor:pointer;transition:color .2s}
    .esqueceu a:hover{color:#F26522}
    .rec-form{display:none}
    .rec-form.open{display:block}
    .btn-back{background:none;border:none;color:#555;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:5px;margin-bottom:18px;padding:0;transition:color .2s}
    .btn-back:hover{color:#F26522}
    .btn-sec{width:100%;height:52px;background:transparent;color:#F26522;border:1.5px solid rgba(242,101,34,.5);border-radius:14px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;cursor:pointer;transition:all .2s}
    .btn-sec:hover{background:rgba(242,101,34,.1);border-color:#F26522}
    
    /* ── Footer ── */
    .footer{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);font-size:12px;color:rgba(255,255,255,.2);text-align:center;white-space:nowrap;animation:fadeIn 1s 1s both}
    .footer span{color:rgba(255,255,255,.35)}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    
    @media(max-width:480px){.card{padding:28px 22px}.logo-tesk{font-size:56px}.logo-flow{font-size:40px}}
  </style>
</head>
<body>
<canvas id="bg-canvas"></canvas>

<div class="page">
  <div class="logo">
    <div class="logo-tesk">tesk</div>
    <div class="logo-flow">flow</div>
  </div>

  <div class="card-wrap">
    <div class="card" id="login-card">

      <div id="form-login">
        <div class="card-title">Bem-vindo de volta</div>
        <div class="card-sub">Acesse com seu e-mail e senha</div>
        <?php if (!empty($erro)): ?>
        <div class="alert"><?= htmlspecialchars($erro) ?></div>
        <?php endif; ?>
        <form method="POST">
          <input type="hidden" name="acao" value="login">
          <div class="field">
            <label>E-mail</label>
            <div class="input-wrap">
              <input type="email" name="email" placeholder="seu@email.com" value="<?= htmlspecialchars($_POST['email'] ?? '') ?>" autocomplete="email" required>
              <svg class="input-icon" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
            </div>
          </div>
          <div class="field">
            <label>Senha</label>
            <div class="input-wrap">
              <input type="password" id="senha" name="senha" placeholder="••••••••" autocomplete="current-password" required>
              <svg class="input-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <button type="button" class="eye-btn" onclick="toggleSenha()">
                <svg id="eye-icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
          <label class="lembrar">
            <input type="checkbox" name="lembrar">
            <span class="check-box"><svg viewBox="0 0 12 12"><polyline points="1,6 4.5,9.5 11,2"/></svg></span>
            <span>Manter conectado</span>
          </label>
          <button type="submit" class="btn-login">Entrar</button>
        </form>
        <div class="esqueceu"><a onclick="mostrarRecuperar()">Esqueceu sua senha?</a></div>
      </div>

      <div id="form-recuperar" class="rec-form">
        <button type="button" class="btn-back" onclick="voltarLogin()">← Voltar ao login</button>
        <div class="card-title">Recuperar senha</div>
        <div class="card-sub" style="margin-bottom:22px">Informe seu e-mail cadastrado</div>
        <?php if (!empty($msg_rec)): ?>
        <div class="alert alert-success"><?= htmlspecialchars($msg_rec) ?></div>
        <?php endif; ?>
        <form method="POST">
          <input type="hidden" name="acao" value="recuperar">
          <div class="field">
            <label>E-mail</label>
            <div class="input-wrap">
              <input type="email" name="email_rec" placeholder="seu@email.com" required>
              <svg class="input-icon" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
            </div>
          </div>
          <button type="submit" class="btn-sec">Enviar instruções</button>
        </form>
      </div>

    </div>
  </div>
</div>

<div class="footer">desenvolvido por <span>Anderson Frassetto</span></div>

<script>
// ── Toggle senha ──
function toggleSenha(){
  const i=document.getElementById('senha'),ic=document.getElementById('eye-icon');
  if(i.type==='password'){i.type='text';ic.innerHTML='<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';}
  else{i.type='password';ic.innerHTML='<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';}
}
function mostrarRecuperar(){document.getElementById('form-login').style.display='none';document.getElementById('form-recuperar').classList.add('open');}
function voltarLogin(){document.getElementById('form-login').style.display='block';document.getElementById('form-recuperar').classList.remove('open');}
<?php if (!empty($msg_rec)): ?>mostrarRecuperar();<?php endif; ?>

// ── Canvas particles ──
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let W, H, particles = [], mouse = {x: 0, y: 0};

function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
resize();
window.addEventListener('resize', resize);

class Particle {
  constructor(){this.reset();}
  reset(){
    this.x = Math.random()*W;
    this.y = Math.random()*H;
    this.size = Math.random()*2+0.5;
    this.speedX = (Math.random()-0.5)*0.4;
    this.speedY = (Math.random()-0.5)*0.4;
    this.opacity = Math.random()*0.4+0.05;
    this.color = Math.random()>0.7 ? '#F26522' : '#ffffff';
  }
  update(){
    this.x += this.speedX;
    this.y += this.speedY;
    // Attract slightly to mouse
    const dx=mouse.x-this.x, dy=mouse.y-this.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<200){this.x+=dx*0.003;this.y+=dy*0.003;}
    if(this.x<0||this.x>W||this.y<0||this.y>H)this.reset();
  }
  draw(){
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.size,0,Math.PI*2);
    ctx.fillStyle=this.color;
    ctx.globalAlpha=this.opacity;
    ctx.fill();
    ctx.globalAlpha=1;
  }
}

// Init particles
for(let i=0;i<120;i++) particles.push(new Particle());

// Connect nearby particles
function connect(){
  for(let i=0;i<particles.length;i++){
    for(let j=i+1;j<particles.length;j++){
      const dx=particles[i].x-particles[j].x;
      const dy=particles[i].y-particles[j].y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<100){
        ctx.beginPath();
        ctx.moveTo(particles[i].x,particles[i].y);
        ctx.lineTo(particles[j].x,particles[j].y);
        ctx.strokeStyle='rgba(242,101,34,'+(0.08*(1-dist/100))+')';
        ctx.lineWidth=0.5;
        ctx.stroke();
      }
    }
  }
}

function animate(){
  ctx.fillStyle='#111111';
  ctx.fillRect(0,0,W,H);
  // Radial glow following mouse
  const grd=ctx.createRadialGradient(mouse.x,mouse.y,0,mouse.x,mouse.y,400);
  grd.addColorStop(0,'rgba(242,101,34,0.06)');
  grd.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grd;
  ctx.fillRect(0,0,W,H);
  connect();
  particles.forEach(p=>{p.update();p.draw();});
  requestAnimationFrame(animate);
}
animate();

// Mouse tracking
document.addEventListener('mousemove', e=>{
  mouse.x=e.clientX; mouse.y=e.clientY;
  // Parallax on card
  const card=document.getElementById('login-card');
  const cx=W/2, cy=H/2;
  const rx=(e.clientY-cy)/cy*6;
  const ry=(e.clientX-cx)/cx*-6;
  card.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg)`;
});
document.addEventListener('mouseleave',()=>{
  document.getElementById('login-card').style.transform='rotateX(0) rotateY(0)';
  mouse.x=W/2;mouse.y=H/2;
});

// Touch parallax
document.addEventListener('touchmove',e=>{
  mouse.x=e.touches[0].clientX;
  mouse.y=e.touches[0].clientY;
},{passive:true});
</script>
</body>
</html>
