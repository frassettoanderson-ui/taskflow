<?php
require 'auth.php';
$u = usuarioAtual();
$nomes = explode(' ', $u['nome']);
$ini = strtoupper(substr($nomes[0],0,1).(isset($nomes[1])?substr($nomes[1],0,1):''));
$isGesGer = in_array($u['nivel'], ['gestor','gerente']);
?>
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Taskflow</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
  <style>
    :root,[data-theme="dark"]{
      --bg:#141414;--surface:#1e1e1e;--surface2:#252525;--surface3:#2e2e2e;
      --border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.12);
      --text:#f0efe9;--text2:#b0b0b0;--text3:#777;--text4:#555;
      --accent:#F26522;--accent2:#ff8c4a;--accent-hover:#d4551a;
      --sidebar:#181818;--card:#1e1e1e;
      --green:#1D9E75;--blue:#378ADD;--amber:#EF9F27;--red:#E24B4A;--purple:#7F77DD;
      --r:10px;--rlg:14px;--rxl:18px;
      --shadow:0 4px 20px rgba(0,0,0,.4);
    }
    [data-theme="light"]{
      --bg:#f0efe9;--surface:#fff;--surface2:#f5f4f0;--surface3:#ebe9e3;
      --border:rgba(0,0,0,.08);--border2:rgba(0,0,0,.14);
      --text:#1a1a18;--text2:#555;--text3:#999;--text4:#ccc;
      --sidebar:#fff;--card:#fff;
      --shadow:0 4px 20px rgba(0,0,0,.08);
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden;transition:background .3s,color .3s}
    .app{display:flex;height:100vh}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:var(--surface3);border-radius:4px}

    /* ══ SIDEBAR ══ */
    .sidebar{width:230px;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;transition:transform .3s;z-index:30}
    .sb-brand{padding:0;border-bottom:1px solid var(--border);overflow:hidden;height:110px;display:flex;align-items:center;justify-content:center;position:relative;background:var(--surface2)}
    .sb-logo-light{display:none;width:100%;height:100%;object-fit:contain;padding:12px 20px}
    .sb-logo-dark{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;padding:8px}
    .logo-task{font-size:46px;font-weight:700;color:var(--accent);letter-spacing:-2px;line-height:1;text-shadow:0 0 30px rgba(242,101,34,.25)}
    .logo-flow{font-family:'Dancing Script',cursive;font-size:34px;color:var(--text2);line-height:1;margin-top:-6px}
    [data-theme="light"] .sb-logo-dark{display:none}
    [data-theme="light"] .sb-logo-light{display:block}
    .sb-user{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)}
    .sb-av{width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}
    .sb-uname{font-size:14px;font-weight:500;color:var(--text)}
    .sb-nivel{font-size:11px;color:var(--text3)}
    .sb-nav{flex:1;padding:8px;overflow-y:auto}
    .nav-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:var(--r);cursor:pointer;margin-bottom:2px;border:none;background:transparent;width:100%;text-align:left;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text2);transition:all .15s}
    .nav-item:hover{background:var(--surface2);color:var(--text)}
    .nav-item.active{background:var(--surface3);color:var(--accent);font-weight:500}
    .nav-item i{font-size:18px;flex-shrink:0}
    .nav-badge{margin-left:auto;font-size:11px;background:var(--red);color:white;border-radius:10px;padding:2px 7px;font-weight:600;animation:badgePulse 2s infinite}
    .nav-badge.blink{animation:badgeBlink .7s infinite alternate}
    @keyframes badgeBlink{from{opacity:1;transform:scale(1)}to{opacity:.3;transform:scale(.85)}}
    @keyframes badgePulse{0%,100%{box-shadow:0 0 0 0 rgba(226,75,74,.4)}50%{box-shadow:0 0 0 4px rgba(226,75,74,0)}}
    .nav-chevron{margin-left:auto;font-size:14px;transition:transform .25s;color:var(--text3)}
    .nav-chevron.open{transform:rotate(180deg)}
    .submenu{overflow:hidden;max-height:0;transition:max-height .3s ease}
    .submenu.open{max-height:220px}
    .sub-item{display:flex;align-items:center;gap:8px;padding:9px 12px 9px 32px;border-radius:var(--r);cursor:pointer;margin-bottom:1px;border:none;background:transparent;width:100%;text-align:left;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text3);transition:all .15s}
    .sub-item:hover{background:var(--surface2);color:var(--text)}
    .sub-item.active{color:var(--accent);font-weight:500;background:var(--surface2)}
    .sub-item i{font-size:15px;flex-shrink:0}
    .sb-footer{padding:12px 16px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
    .logout-btn{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text3);cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;text-decoration:none;transition:color .2s}
    .logout-btn:hover{color:var(--red)}
    .theme-btn{width:32px;height:32px;border-radius:var(--r);border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text2);display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .2s}
    .theme-btn:hover{background:var(--surface2);color:var(--accent)}

    /* ══ MOBILE ══ */
    .hamburger{display:none;width:36px;height:36px;border-radius:var(--r);border:1px solid var(--border);background:transparent;cursor:pointer;align-items:center;justify-content:center;color:var(--text2)}
    .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:20}
    .overlay.open{display:block}

    /* ══ MAIN ══ */
    .main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;position:relative}
    /* Marca d'água */
    .main::before{content:'taskflow';font-family:'Dancing Script',cursive;font-size:180px;color:var(--accent);opacity:.03;position:absolute;bottom:20px;right:20px;pointer-events:none;z-index:0;white-space:nowrap;transform:rotate(-10deg)}
    .topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--sidebar);border-bottom:1px solid var(--border);flex-shrink:0;gap:10px;position:relative;z-index:1}
    .page-title{font-size:16px;font-weight:600;color:var(--text)}
    .topbar-right{display:flex;align-items:center;gap:10px}
    .notif-btn{width:36px;height:36px;border-radius:var(--r);border:1px solid var(--border);background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);position:relative;font-size:18px;transition:all .2s}
    .notif-btn:hover{background:var(--surface2);color:var(--accent)}
    .notif-dot{position:absolute;top:5px;right:5px;width:8px;height:8px;background:var(--red);border-radius:50%;display:none;animation:badgePulse 2s infinite}
    .btn-new{display:flex;align-items:center;gap:7px;padding:10px 20px;background:var(--accent);color:white;border:none;border-radius:var(--r);font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;box-shadow:0 2px 12px rgba(242,101,34,.35);transition:all .2s}
    .btn-new:hover{background:var(--accent-hover);transform:translateY(-1px);box-shadow:0 4px 20px rgba(242,101,34,.45)}
    .btn-new:active{transform:scale(.97)}
    .btn-new i{font-size:17px}

    /* ══ CONTENT ══ */
    .content{flex:1;padding:18px 20px;overflow-y:auto;position:relative;z-index:1}
    @keyframes pageIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    .page-section{display:none}
    .page-section.active{display:block;animation:pageIn .22s ease both}

    /* ══ DASHBOARD METRICS ══ */
    .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
    @keyframes metricIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
    .metric{background:var(--card);border:1px solid var(--border);border-radius:var(--rlg);padding:18px 20px;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s;animation:metricIn .45s cubic-bezier(.34,1.2,.64,1) both}
    .metric:nth-child(1){animation-delay:.04s}
    .metric:nth-child(2){animation-delay:.1s}
    .metric:nth-child(3){animation-delay:.16s}
    .metric:nth-child(4){animation-delay:.22s}
    .metric:hover{transform:translateY(-3px);box-shadow:0 8px 30px rgba(0,0,0,.35)}
    .metric::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:var(--rlg) var(--rlg) 0 0}
    .metric-total::before{background:linear-gradient(90deg,var(--blue),var(--purple))}
    .metric-pend::before{background:linear-gradient(90deg,var(--red),#ff8c7a)}
    .metric-and::before{background:linear-gradient(90deg,var(--amber),#ffd580)}
    .metric-conc::before{background:linear-gradient(90deg,var(--green),#5DCAA5)}
    .metric-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:12px}
    .metric-total .metric-icon{background:rgba(55,138,221,.15);color:var(--blue)}
    .metric-pend .metric-icon{background:rgba(226,75,74,.15);color:var(--red)}
    .metric-and .metric-icon{background:rgba(239,159,39,.15);color:var(--amber)}
    .metric-conc .metric-icon{background:rgba(29,158,117,.15);color:var(--green)}
    .metric-val{font-size:36px;font-weight:700;color:var(--text);line-height:1;margin-bottom:4px}
    .metric-label{font-size:13px;color:var(--text2);font-weight:500}
    .metric-sub{font-size:11px;color:var(--text3);margin-top:4px}
    .pulse-dot{width:9px;height:9px;border-radius:50%;background:var(--red);display:inline-block;animation:pulseRed 1s infinite alternate;margin-right:4px}
    @keyframes pulseRed{from{opacity:1;transform:scale(1)}to{opacity:.3;transform:scale(.7)}}

    /* ══ DASHBOARD LAYOUT ══ */
    .dash-row{display:grid;gap:14px;margin-bottom:18px}
    .dash-row-2{grid-template-columns:1.4fr 1fr}
    .dash-row-3{grid-template-columns:1fr 1fr 1fr}
    .chart-card{background:var(--card);border:1px solid var(--border);border-radius:var(--rlg);padding:18px}
    .cc-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .cc-title{font-size:15px;font-weight:600;color:var(--text)}
    .cc-sub{font-size:12px;color:var(--text3);margin-top:2px}
    .cc-badge{font-size:11px;padding:3px 9px;border-radius:10px;font-weight:500}
    .leg{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
    .leg-item{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text2)}
    .leg-sq{width:8px;height:8px;border-radius:2px}

    /* Últimas ocorrências na dash */
    .oc-list{display:flex;flex-direction:column;gap:8px}
    .oc-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--r);border-left:3px solid transparent;transition:all .15s;cursor:pointer}
    .oc-item:hover{background:var(--surface3)}
    .oc-item.p-alta{border-left-color:var(--red)}
    .oc-item.p-media{border-left-color:var(--amber)}
    .oc-item.p-baixa{border-left-color:var(--green)}
    .oc-item-info{flex:1;min-width:0}
    .oc-item-title{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .oc-item-meta{font-size:11px;color:var(--text3);margin-top:2px}
    .oc-item-badge{font-size:10px;padding:2px 7px;border-radius:8px;font-weight:500;flex-shrink:0}

    /* Urgentes */
    .urgentes{display:flex;flex-direction:column;gap:6px}
    .urgente-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(226,75,74,.08);border:1px solid rgba(226,75,74,.2);border-radius:var(--r)}
    .urgente-dot{width:8px;height:8px;border-radius:50%;background:var(--red);flex-shrink:0;animation:pulseRed 1s infinite alternate}
    .urgente-info{flex:1;min-width:0}
    .urgente-title{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .urgente-meta{font-size:11px;color:var(--text3)}

    /* ══ KANBAN ══ */
    .kanban-page{height:calc(100vh - 130px);display:flex;flex-direction:column}
    .kb-page-header{display:flex;align-items:center;gap:12px;padding:0 0 16px;border-bottom:1px solid var(--border);margin-bottom:16px;flex-shrink:0}
    .kb-page-title{font-size:22px;font-weight:700;color:var(--text)}
    .kb-page-sub{font-size:13px;color:var(--text3);margin-top:2px}
    .kb-page-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
    .kb-board{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;flex:1;min-height:0}
    .kcol{background:var(--surface2);border-radius:var(--rlg);display:flex;flex-direction:column;transition:all .2s}
    .kcol-head{padding:12px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);flex-shrink:0}
    .kcol-title{font-size:13px;font-weight:600;color:var(--text2)}
    .kcol-count{font-size:11px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:2px 8px;color:var(--text3);font-weight:500}
    .kcol-body{padding:8px;display:flex;flex-direction:column;gap:7px;flex:1;overflow-y:auto;min-height:200px;transition:background .2s}
    .kcol-body.drag-over{background:rgba(242,101,34,.07);outline:2px dashed var(--accent);border-radius:8px}
    .kcol-body.drop-ready{background:rgba(242,101,34,.04)}
    .kcol-pendente .kcol-head{border-top:3px solid #888780;box-shadow:0 -1px 0 0 rgba(136,135,128,.15)}
    .kcol-aceita .kcol-head{border-top:3px solid var(--blue);box-shadow:0 -1px 0 0 rgba(55,138,221,.18)}
    .kcol-andamento .kcol-head{border-top:3px solid var(--amber);box-shadow:0 -1px 0 0 rgba(239,159,39,.18)}
    .kcol-concluida .kcol-head{border-top:3px solid var(--green);box-shadow:0 -1px 0 0 rgba(29,158,117,.18)}

    /* ══ CARDS ══ */
    .kcard{background:var(--card);border-radius:var(--r);border:1px solid var(--border);padding:14px;cursor:pointer;transition:transform .18s,box-shadow .18s,opacity .18s,border-color .18s;border-left:4px solid transparent;position:relative;user-select:none;-webkit-user-select:none}
    .kcard:hover{transform:translateY(-3px)}
    .kcard.prio-left-alta:hover{box-shadow:0 6px 24px rgba(226,75,74,.25);border-color:rgba(226,75,74,.25)}
    .kcard.prio-left-media:hover{box-shadow:0 6px 24px rgba(239,159,39,.2);border-color:rgba(239,159,39,.2)}
    .kcard.prio-left-baixa:hover{box-shadow:0 6px 24px rgba(99,153,34,.18);border-color:rgba(99,153,34,.18)}
    .kcard.dragging{opacity:.3;transform:scale(.95) rotate(1deg);box-shadow:0 8px 30px rgba(0,0,0,.4)}
    .kcard.drag-source{opacity:.4}
    .kcard.card-enter{animation:cardIn .3s cubic-bezier(.34,1.56,.64,1)}
    .kcard.card-exit{animation:cardOut .25s ease forwards}
    .kcard.unread{box-shadow:0 0 0 2px var(--accent),var(--shadow)}
    @keyframes cardIn{from{opacity:0;transform:translateY(15px) scale(.92)}to{opacity:1;transform:none}}
    @keyframes cardOut{to{opacity:0;transform:scale(.85)}}
    .prio-left-alta{border-left-color:var(--red)}
    .prio-left-media{border-left-color:var(--amber)}
    .prio-left-baixa{border-left-color:var(--green)}
    .kcard-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .kcard-id{font-size:11px;color:var(--text3);font-weight:500}
    .kcard-prio{font-size:11px;padding:2px 8px;border-radius:8px;font-weight:500}
    .p-alta{background:rgba(226,75,74,.15);color:#f09595}
    .p-media{background:rgba(239,159,39,.15);color:#EF9F27}
    .p-baixa{background:rgba(99,153,34,.15);color:#8BC34A}
    .kcard-title{font-size:14px;font-weight:500;color:var(--text);line-height:1.4;margin-bottom:8px}
    .kcard-aluno{font-size:12px;color:var(--text3);margin-bottom:8px}
    .kcard-foot{display:flex;align-items:center;justify-content:space-between;gap:6px}
    .kcard-setor{font-size:11px;padding:2px 8px;border-radius:8px;font-weight:500}
    .s-fin{background:rgba(55,138,221,.15);color:#378ADD}
    .s-ger{background:rgba(127,119,221,.15);color:#9D97E8}
    .s-dir{background:rgba(239,159,39,.15);color:#EF9F27}
    .s-adm{background:rgba(29,158,117,.15);color:#1D9E75}
    .msg-dot{width:8px;height:8px;background:var(--red);border-radius:50%;animation:pulseRed 1s infinite alternate}
    .unread-badge{position:absolute;top:-5px;right:-5px;width:14px;height:14px;background:var(--accent);border-radius:50%;border:2px solid var(--surface2);animation:badgePulse 2s infinite}
    .kcard-img{width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:8px;border:1px solid var(--border)}
    .btn-concluir-card{font-size:12px;padding:7px 10px;border-radius:8px;background:var(--green);color:white;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;gap:5px;font-weight:500;transition:all .2s}
    .btn-concluir-card:hover{background:#158a62;transform:scale(1.02)}

    /* Touch drag */
    .kcard.touch-dragging{position:fixed;z-index:1000;opacity:.85;transform:scale(1.05) rotate(2deg);pointer-events:none;box-shadow:0 12px 40px rgba(0,0,0,.5);transition:none}

    /* ══ USERS ══ */
    .users-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .user-row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:8px;transition:all .2s}
    .user-row:hover{border-color:var(--border2)}
    .u-av{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0}
    .u-name{font-size:14px;font-weight:500;color:var(--text)}
    .u-meta{font-size:12px;color:var(--text3);margin-top:2px}
    .u-badge{font-size:11px;padding:3px 9px;border-radius:10px;font-weight:600;margin-left:auto}
    .nb-gestor{background:rgba(242,101,34,.15);color:var(--accent)}
    .nb-gerente{background:rgba(127,119,221,.15);color:#9D97E8}
    .nb-colaborador{background:rgba(29,158,117,.15);color:#1D9E75}
    .u-actions{display:flex;gap:6px;flex-shrink:0}
    .icon-btn{width:32px;height:32px;border-radius:var(--r);border:1px solid var(--border);background:transparent;color:var(--text3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .2s}
    .icon-btn:hover{background:var(--surface2);color:var(--text)}
    .icon-btn.danger:hover{color:var(--red);border-color:rgba(226,75,74,.3)}

    /* ══ CHAT MSN ══ */
    .chat-msn-wrap{display:flex;height:calc(100vh - 130px);gap:0;background:var(--card);border-radius:var(--rlg);border:1px solid var(--border);overflow:hidden}
    .chat-sidebar{width:220px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;background:var(--surface2);overflow-y:auto}
    .chat-sidebar-title{padding:14px 14px 10px;font-size:13px;font-weight:600;color:var(--text2);display:flex;align-items:center;gap:7px;border-bottom:1px solid var(--border)}
    .chat-contact{display:flex;align-items:center;gap:9px;padding:10px 12px;border:none;background:transparent;width:100%;cursor:pointer;transition:all .15s;position:relative;font-family:'DM Sans',sans-serif}
    .chat-contact:hover{background:var(--surface3)}
    .chat-contact.active{background:var(--surface3);border-left:3px solid var(--accent)}
    .contact-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;color:white}
    .contact-info{flex:1;text-align:left;min-width:0}
    .contact-name{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .contact-sub{font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
    .contact-badge{font-size:10px;background:var(--red);color:white;border-radius:10px;padding:1px 6px;font-weight:600;flex-shrink:0;animation:badgePulse 2s infinite}
    .chat-divider{padding:8px 12px 4px;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em}
    .chat-main{flex:1;display:flex;flex-direction:column;min-width:0}
    .chat-main-header{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface2);flex-shrink:0}
    .chat-wrap{display:flex;flex-direction:column;height:calc(100vh - 130px)}
    .chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--surface2);border-radius:var(--rlg);margin-bottom:12px}
    @keyframes msgInLeft{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}
    @keyframes msgInRight{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
    .chat-msg{display:flex;flex-direction:column;max-width:68%}
    .chat-msg.mine{align-self:flex-end;align-items:flex-end;animation:msgInRight .2s ease both}
    .chat-msg.other{align-self:flex-start;animation:msgInLeft .2s ease both}
    .chat-msg-who{font-size:11px;color:var(--text3);margin-bottom:3px;font-weight:500}
    .chat-bubble{padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5}
    .chat-msg.mine .chat-bubble{background:var(--accent);color:white;border-bottom-right-radius:4px}
    .chat-msg.other .chat-bubble{background:var(--card);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px}
    .chat-time{font-size:10px;color:var(--text3);margin-top:3px}
    .chat-input-row{display:flex;gap:10px}
    .chat-input{flex:1;padding:12px 16px;border-radius:var(--r);border:1px solid var(--border);background:var(--card);font-size:14px;font-family:'DM Sans',sans-serif;color:var(--text);outline:none;transition:border-color .2s,box-shadow .2s}
    .chat-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(242,101,34,.1)}
    .chat-input::placeholder{color:var(--text4)}
    .chat-send{padding:12px 18px;background:var(--accent);color:white;border:none;border-radius:var(--r);font-size:14px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;font-weight:500;box-shadow:0 2px 10px rgba(242,101,34,.3)}
    .chat-send:hover{background:var(--accent-hover);transform:translateY(-1px);box-shadow:0 4px 16px rgba(242,101,34,.4)}
    .chat-send:active{transform:scale(.97)}
    .chat-typing{font-size:11px;color:var(--text3);padding:4px 8px;min-height:20px}

    /* ══ RELATÓRIOS ══ */
    .rel-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
    .kpi{background:var(--card);border:1px solid var(--border);border-radius:var(--rlg);padding:16px;text-align:center}
    .kpi-val{font-size:32px;font-weight:700;color:var(--text)}
    .kpi-label{font-size:12px;color:var(--text3);margin-top:4px}
    .kpi-trend{font-size:11px;margin-top:4px;font-weight:500}
    .trend-up{color:var(--green)}
    .trend-down{color:var(--red)}

    /* ══ CONFIGURAÇÕES ══ */
    .config-section{background:var(--card);border:1px solid var(--border);border-radius:var(--rlg);padding:18px;margin-bottom:14px}
    .config-title{font-size:15px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .tipo-row{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface2);border-radius:var(--r);margin-bottom:6px}
    .tipo-nome{flex:1;font-size:14px;color:var(--text)}
    .tipo-setor{font-size:11px;padding:2px 8px;border-radius:8px}

    /* ══ LOCALIZAR ══ */
    .search-box{background:var(--card);border:1px solid var(--border);border-radius:var(--rlg);padding:18px;margin-bottom:14px}
    .search-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
    .result-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;cursor:pointer;margin-bottom:8px;transition:all .15s}
    .result-card:hover{border-color:var(--accent);transform:translateX(3px)}

    /* ══ MODAL ══ */
    .modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)}
    .modal-bg.open{display:flex}
    .modal{background:var(--card);border-radius:var(--rxl);border:1px solid var(--border2);padding:24px;width:100%;max-width:440px;max-height:92vh;overflow-y:auto;animation:mIn .22s cubic-bezier(.34,1.56,.64,1)}
    @keyframes mIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:none}}
    .modal h3{font-size:17px;font-weight:600;margin-bottom:16px;color:var(--text);display:flex;align-items:center;gap:9px}
    .field{margin-bottom:13px}
    .field label{display:block;font-size:11px;color:var(--text2);margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
    .field input,.field select,.field textarea{width:100%;padding:11px 14px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface2);font-size:14px;font-family:'DM Sans',sans-serif;color:var(--text);outline:none;transition:border-color .2s}
    .field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent);background:var(--surface3)}
    .field textarea{resize:vertical;min-height:80px}
    .mfooter{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}
    .tipo-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)}
    .tipo-row:last-child{border-bottom:none}
    .tipo-nome{flex:1;font-size:14px;color:var(--text1)}
    .icon-btn.danger{background:transparent;border:none;color:#e55;cursor:pointer;padding:4px 6px;border-radius:6px;transition:background .2s}
    .icon-btn.danger:hover{background:rgba(230,80,80,.12)}
    .btn-cancel{padding:10px 16px;border-radius:var(--r);border:1px solid var(--border);background:transparent;color:var(--text2);font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s}
    .btn-cancel:hover{background:var(--surface2)}
    .btn-ok{padding:10px 16px;border-radius:var(--r);border:none;background:var(--accent);color:white;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:500;transition:all .2s}
    .btn-ok:hover{background:var(--accent-hover)}
    .btn-danger{padding:10px 16px;border-radius:var(--r);border:none;background:var(--red);color:white;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:500}
    .select-new{display:flex;gap:6px}
    .select-new select{flex:1}
    .btn-add-tipo{padding:10px 14px;border-radius:var(--r);border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;font-weight:500}
    .tip{font-size:12px;padding:3px 10px;border-radius:10px;background:var(--surface2);color:var(--text2)}
    .task-info-row{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
    .task-desc{font-size:14px;color:var(--text2);line-height:1.7;padding:14px;background:var(--surface2);border-radius:var(--r);margin-bottom:14px}
    .tl-item{display:flex;gap:8px;padding:4px 0;font-size:12px;color:var(--text3)}
    .tl-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:5px}
    .task-msgs{max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
    .task-msg{font-size:13px;padding:9px 12px;border-radius:10px;line-height:1.5;max-width:85%}
    .task-msg.mine{background:rgba(242,101,34,.15);color:var(--accent);align-self:flex-end}
    .task-msg.other{background:var(--surface2);color:var(--text);align-self:flex-start}
    .task-msg-who{font-size:10px;font-weight:600;margin-bottom:2px;color:var(--text3)}
    .task-chat-input{display:flex;gap:8px}
    .task-chat-input input{flex:1;padding:10px 14px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface2);font-size:13px;font-family:'DM Sans',sans-serif;color:var(--text);outline:none;transition:border-color .2s}
    .task-chat-input input:focus{border-color:var(--accent)}
    .task-chat-input button{padding:10px 14px;background:var(--accent);color:white;border:none;border-radius:var(--r);font-size:13px;cursor:pointer;transition:all .2s}
    /* Image upload */
    .img-upload-area{border:2px dashed var(--border2);border-radius:var(--r);padding:20px;text-align:center;cursor:pointer;transition:all .2s;position:relative}
    .img-upload-area:hover{border-color:var(--accent);background:rgba(242,101,34,.05)}
    .img-upload-area input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
    .img-preview{width:100%;max-height:200px;object-fit:cover;border-radius:var(--r);margin-top:8px;border:1px solid var(--border)}

    /* ══ NOTIF PANEL ══ */
    .notif-panel{display:none;position:fixed;top:56px;right:16px;width:300px;background:var(--card);border:1px solid var(--border2);border-radius:var(--rxl);z-index:90;padding:16px;box-shadow:var(--shadow)}
    .notif-panel.open{display:block;animation:mIn .2s ease}

    /* ══ TOAST ══ */
    .toast-container{position:fixed;bottom:20px;right:20px;z-index:200;display:flex;flex-direction:column;gap:10px;pointer-events:none}
    .toast{background:var(--card);border:1px solid var(--border2);border-left:4px solid var(--accent);border-radius:var(--rlg);padding:16px;width:310px;box-shadow:var(--shadow);animation:toastIn .35s cubic-bezier(.34,1.56,.64,1);pointer-events:all}
    .toast.removing{animation:toastOut .3s ease forwards}
    @keyframes toastIn{from{opacity:0;transform:translateY(30px) scale(.9)}to{opacity:1;transform:none}}
    @keyframes toastOut{to{opacity:0;transform:translateY(20px) scale(.95)}}
    .toast-title{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;display:flex;align-items:center;gap:6px}
    .toast-msg{font-size:13px;color:var(--text2)}
    .toast-close{margin-left:auto;background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;line-height:1}

    /* ══ RESPONSIVE ══ */
    @media(max-width:1200px){.metrics{grid-template-columns:repeat(2,1fr)}.dash-row-2{grid-template-columns:1fr}.dash-row-3{grid-template-columns:1fr 1fr}.rel-kpis{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:1024px){.kb-board{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:768px){
      .sidebar{position:fixed;left:0;top:0;height:100vh;transform:translateX(-100%);width:260px}
      .sidebar.open{transform:translateX(0)}
      .hamburger{display:flex}
      .metrics{grid-template-columns:repeat(2,1fr)}
      .kb-board{grid-template-columns:1fr}
      .dash-row-2,.dash-row-3{grid-template-columns:1fr}
      .search-grid{grid-template-columns:1fr}
      .content{padding:12px}
      .topbar{padding:10px 14px}
      .btn-new .btn-label{display:none}
      .rel-kpis{grid-template-columns:repeat(2,1fr)}
    }
    @media(max-width:480px){.metrics{grid-template-columns:1fr}.rel-kpis{grid-template-columns:1fr 1fr}}
  </style>
</head>
<body>
<div class="app">
  <div class="overlay" id="overlay" onclick="closeSidebar()"></div>
  <div class="sidebar" id="sidebar">
    <div class="sb-brand">
      <!-- Dark theme logo -->
      <div class="sb-logo-dark">
        <div class="logo-task">task</div>
        <div class="logo-flow">flow</div>
      </div>
      <!-- Light theme: same but different color for flow -->
      <div class="sb-logo-light" style="display:none;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;padding:8px">
        <div style="font-size:46px;font-weight:700;color:#F26522;letter-spacing:-2px;line-height:1">task</div>
        <div style="font-family:'Dancing Script',cursive;font-size:34px;color:#444;line-height:1;margin-top:-6px">flow</div>
      </div>
    </div>
    <div class="sb-user">
      <div class="sb-av"><?= $ini ?></div>
      <div><div class="sb-uname"><?= htmlspecialchars(explode(' ',$u['nome'])[0]) ?></div><div class="sb-nivel"><?= ucfirst($u['nivel']) ?></div></div>
    </div>
    <nav class="sb-nav">
      <button class="nav-item active" onclick="showPage('dashboard',this)"><i class="ti ti-layout-dashboard"></i> Dashboard</button>
      <button class="nav-item" onclick="toggleSubmenu(this)" id="nav-oc-parent">
        <i class="ti ti-clipboard-list"></i> Ocorrências
        <span class="nav-badge blink" id="badge-oc" style="display:none">0</span>
        <i class="ti ti-chevron-down nav-chevron" id="oc-chevron"></i>
      </button>
      <div class="submenu" id="submenu-oc">
        <button class="sub-item" onclick="showKanban('setor',this)"><i class="ti ti-inbox"></i> Para o meu setor</button>
        <button class="sub-item" onclick="showKanban('minhas',this)"><i class="ti ti-send"></i> Minhas solicitações</button>
        <button class="sub-item" onclick="showKanban('concluidas',this)"><i class="ti ti-circle-check"></i> Minhas concluídas</button>
        <?php if ($isGesGer): ?>
        <button class="sub-item" onclick="showKanban('todas',this)"><i class="ti ti-eye"></i> Todas as solicitações</button>
        <?php endif; ?>
      </div>
      <?php if ($isGesGer): ?>
      <button class="nav-item" onclick="showPage('usuarios',this)"><i class="ti ti-users"></i> Usuários</button>
      <?php endif; ?>
      <button class="nav-item" onclick="showPage('relatorios',this)"><i class="ti ti-chart-bar"></i> Relatórios</button>
      <button class="nav-item" onclick="showPage('chat',this)"><i class="ti ti-message-2"></i> Chat <span class="nav-badge" id="badge-chat" style="display:none">0</span></button>
      <button class="nav-item" onclick="showPage('localizar',this)"><i class="ti ti-search"></i> Localizar</button>
      <button class="nav-item" onclick="showPage('configuracoes',this)"><i class="ti ti-settings"></i> Configurações</button>
    </nav>
    <div class="sb-footer">
      <a href="logout.php" class="logout-btn"><i class="ti ti-logout"></i> Sair</a>
      <button class="theme-btn" onclick="toggleTheme()" id="theme-btn" title="Alternar tema"><i class="ti ti-sun"></i></button>
    </div>
  </div>

  <div class="main">
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:10px">
        <button class="hamburger" id="hamburger" onclick="openSidebar()"><i class="ti ti-menu-2" style="font-size:20px"></i></button>
        <div class="page-title" id="page-title">Dashboard</div>
      </div>
      <div class="topbar-right">
        <div class="notif-btn" onclick="toggleNotif()"><i class="ti ti-bell"></i><div class="notif-dot" id="notif-dot"></div></div>
        <button class="btn-new" onclick="abrirModal('ocorrencia')"><i class="ti ti-plus"></i> <span class="btn-label">Nova ocorrência</span></button>
      </div>
    </div>
    <div class="content">

      <!-- DASHBOARD -->
      <div class="page-section active" id="page-dashboard">
        <div class="metrics" id="metrics-grid"></div>
        <div class="dash-row dash-row-2">
          <div class="chart-card">
            <div class="cc-header"><div><div class="cc-title">Ocorrências por status</div><div class="cc-sub">visão geral do kanban</div></div><div class="leg" id="leg-d"></div></div>
            <div style="position:relative;height:200px"><canvas id="cd1"></canvas></div>
          </div>
          <div class="chart-card">
            <div class="cc-header"><div><div class="cc-title">Por prioridade</div><div class="cc-sub">distribuição atual</div></div></div>
            <div style="position:relative;height:200px"><canvas id="cd-prio"></canvas></div>
          </div>
        </div>
        <div class="dash-row dash-row-2">
          <div class="chart-card">
            <div class="cc-header"><div><div class="cc-title">Volume por setor</div><div class="cc-sub">ocorrências ativas</div></div></div>
            <div style="position:relative;height:180px"><canvas id="cd2"></canvas></div>
          </div>
          <div class="chart-card">
            <div class="cc-header"><div><div class="cc-title"><i class="ti ti-alert-triangle" style="color:var(--red);vertical-align:-2px;margin-right:6px"></i>Urgentes</div><div class="cc-sub">alta prioridade em aberto</div></div></div>
            <div class="urgentes" id="urgentes-list"></div>
          </div>
        </div>
        <div class="chart-card">
          <div class="cc-header"><div><div class="cc-title">Últimas ocorrências</div><div class="cc-sub">mais recentes no sistema</div></div></div>
          <div class="oc-list" id="oc-recentes"></div>
        </div>
      </div>

      <!-- KANBAN -->
      <div class="page-section" id="page-kanban">
        <div class="kanban-page">
          <div class="kb-page-header" id="kb-page-header"></div>
          <div class="kb-board" id="kb-board"></div>
        </div>
      </div>

      <!-- USUÁRIOS -->
      <?php if ($isGesGer): ?>
      <div class="page-section" id="page-usuarios">
        <div class="users-header"><div style="font-size:16px;font-weight:600">Usuários</div><button class="btn-new" onclick="abrirModal('usuario')"><i class="ti ti-plus"></i> <span class="btn-label">Novo usuário</span></button></div>
        <div id="users-list"></div>
      </div>
      <?php endif; ?>

      <!-- RELATÓRIOS -->
      <div class="page-section" id="page-relatorios"><div id="rel-content"></div></div>

      <!-- CHAT -->
      <div class="page-section" id="page-chat">
        <div class="chat-msn-wrap">
          <!-- Sidebar contatos -->
          <div class="chat-sidebar">
            <div class="chat-sidebar-title"><i class="ti ti-message-2" style="color:var(--accent)"></i> Mensagens</div>
            <button class="chat-contact active" id="contact-geral" onclick="abrirChat('geral',this)">
              <div class="contact-av" style="background:var(--accent)"><i class="ti ti-users" style="font-size:14px;color:white"></i></div>
              <div class="contact-info"><div class="contact-name">Chat Geral</div><div class="contact-sub" id="last-geral">Todos os usuários</div></div>
              <span class="contact-badge" id="badge-geral" style="display:none">0</span>
            </button>
            <div class="chat-divider">Usuários</div>
            <div id="contatos-list"></div>
          </div>
          <!-- Área do chat -->
          <div class="chat-main">
            <div class="chat-main-header" id="chat-header">
              <div class="contact-av" style="background:var(--accent)" id="chat-av"><i class="ti ti-users" style="font-size:14px;color:white"></i></div>
              <div><div style="font-size:14px;font-weight:600;color:var(--text)" id="chat-nome">Chat Geral</div><div style="font-size:12px;color:var(--text3)" id="chat-sub">Todos os usuários</div></div>
            </div>
            <div class="chat-messages" id="chat-msgs"></div>
            <div class="chat-input-row">
              <input class="chat-input" id="chat-input" placeholder="Digite uma mensagem..." onkeydown="if(event.key==='Enter')enviarChatAtual()">
              <button class="chat-send" onclick="enviarChatAtual()"><i class="ti ti-send"></i></button>
            </div>
          </div>
        </div>
      </div>

      <!-- LOCALIZAR -->
      <div class="page-section" id="page-localizar">
        <div class="search-box">
          <div style="font-size:16px;font-weight:600;margin-bottom:14px">Localizar ocorrências</div>
          <div class="search-grid">
            <div class="field"><label>Nome do aluno</label><input type="text" id="s-aluno" placeholder="Nome do aluno"></div>
            <div class="field"><label>ID do aluno</label><input type="text" id="s-alunoId" placeholder="Ex: A001"></div>
            <div class="field"><label>Setor</label><select id="s-setor"><option value="">Todos</option><option value="Financeiro">Financeiro</option><option value="Gerente">Gerente</option><option value="Direcao">Direção</option><option value="Administrativo">Administrativo</option></select></div>
            <div class="field"><label>Criador</label><input type="text" id="s-criador" placeholder="Nome do criador"></div>
            <div class="field"><label>Status</label><select id="s-status"><option value="">Todos</option><option value="pendente">Pendente</option><option value="aceita">Aceita</option><option value="andamento">Em andamento</option><option value="concluida">Concluída</option></select></div>
            <div class="field"><label>Data início</label><input type="date" id="s-data-ini"></div>
            <div class="field"><label>Data fim</label><input type="date" id="s-data-fim"></div>
          </div>
          <button class="btn-new" onclick="buscar()"><i class="ti ti-search"></i> <span class="btn-label">Buscar</span></button>
        </div>
        <div id="search-results"></div>
      </div>

      <!-- CONFIGURAÇÕES -->
      <?php if ($isGesGer): ?>
      <div class="page-section" id="page-configuracoes">
        <div class="config-section">
          <div class="config-title"><i class="ti ti-tag" style="color:var(--accent)"></i> Tipos de ocorrência</div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:14px">Gerencie os tipos disponíveis para abertura de ocorrências.</div>
          <button class="btn-new" onclick="abrirTiposPopup()"><i class="ti ti-settings"></i> Alterar tipos de ocorrência</button>
        </div>
        <div class="config-section">
          <div class="config-title"><i class="ti ti-building" style="color:var(--accent)"></i> Setores</div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:14px">Crie novos setores para o sistema.</div>
          <button class="btn-new" onclick="abrirSetoresPopup()"><i class="ti ti-settings"></i> Gerenciar setores</button>
        </div>
        <div class="config-section">
          <div class="config-title"><i class="ti ti-bell" style="color:var(--accent)"></i> Notificações</div>
          <div style="display:flex;flex-direction:column;gap:12px" id="notif-config">
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
              <div style="position:relative;width:44px;height:24px;background:var(--surface3);border-radius:12px;transition:background .2s" id="toggle-som" onclick="toggleConfig('som')">
                <div style="position:absolute;top:2px;left:2px;width:20px;height:20px;background:white;border-radius:50%;transition:transform .2s" id="toggle-som-ball"></div>
              </div>
              <div><div style="font-size:14px;font-weight:500;color:var(--text)">Som de notificação</div><div style="font-size:12px;color:var(--text3)">Toca som ao receber nova ocorrência ou mensagem</div></div>
            </label>
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
              <div style="position:relative;width:44px;height:24px;background:var(--surface3);border-radius:12px;transition:background .2s" id="toggle-notif" onclick="toggleConfig('notif')">
                <div style="position:absolute;top:2px;left:2px;width:20px;height:20px;background:white;border-radius:50%;transition:transform .2s" id="toggle-notif-ball"></div>
              </div>
              <div><div style="font-size:14px;font-weight:500;color:var(--text)">Pop-up de notificação</div><div style="font-size:12px;color:var(--text3)">Exibe pop-up ao receber nova ocorrência</div></div>
            </label>
          </div>
        </div>
      </div>
      <?php else: ?>
      <div class="page-section" id="page-configuracoes">
        <div class="config-section">
          <div class="config-title"><i class="ti ti-bell" style="color:var(--accent)"></i> Notificações</div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
              <div style="position:relative;width:44px;height:24px;background:var(--surface3);border-radius:12px;transition:background .2s" id="toggle-som" onclick="toggleConfig('som')">
                <div style="position:absolute;top:2px;left:2px;width:20px;height:20px;background:white;border-radius:50%;transition:transform .2s" id="toggle-som-ball"></div>
              </div>
              <div><div style="font-size:14px;font-weight:500;color:var(--text)">Som de notificação</div><div style="font-size:12px;color:var(--text3)">Toca som ao receber nova ocorrência ou mensagem</div></div>
            </label>
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
              <div style="position:relative;width:44px;height:24px;background:var(--surface3);border-radius:12px;transition:background .2s" id="toggle-notif" onclick="toggleConfig('notif')">
                <div style="position:absolute;top:2px;left:2px;width:20px;height:20px;background:white;border-radius:50%;transition:transform .2s" id="toggle-notif-ball"></div>
              </div>
              <div><div style="font-size:14px;font-weight:500;color:var(--text)">Pop-up de notificação</div><div style="font-size:12px;color:var(--text3)">Exibe pop-up ao receber nova ocorrência</div></div>
            </label>
          </div>
        </div>
      </div>
      <?php endif; ?>

    </div>
  </div>

  <div class="modal-bg" id="modal-bg"><div class="modal" id="modal-content"></div></div>
  <div class="notif-panel" id="notif-panel">
    <div style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:6px"><i class="ti ti-bell" style="color:var(--accent)"></i> Notificações</div>
    <div id="notif-list"></div>
  </div>
  <div class="toast-container" id="toast-container"></div>
</div>

<script>
const ME={id:<?= $u['id'] ?>,nome:<?= json_encode($u['nome']) ?>,nivel:<?= json_encode($u['nivel']) ?>,setor:<?= json_encode($u['setor']) ?>};
const IS_GES_GER=<?= $isGesGer?'true':'false' ?>;
const SETOR_L={Financeiro:'Financeiro',Gerente:'Gerente',Direcao:'Direção',Administrativo:'Administrativo'};
const SETOR_CL={Financeiro:'s-fin',Gerente:'s-ger',Direcao:'s-dir',Administrativo:'s-adm'};
const STATUS_L={pendente:'Pendente',aceita:'Aceita',andamento:'Em andamento',concluida:'Concluída'};
const STATUS_C={pendente:'#888780',aceita:'#378ADD',andamento:'#EF9F27',concluida:'#1D9E75'};
const STATUS_ORDER=['pendente','aceita','andamento','concluida'];
const TIPO_SETOR_MAP={'Cancelamento de matrícula':'Financeiro','Solicitação de reembolso':'Financeiro','Pedido de desconto':'Financeiro','Reclamação de aluno':'Gerente','Problema com equipamento':'Administrativo','Solicitação de relatório':'Direcao','Contratação/demissão':'Direcao'};

let tarefas=[],tarefasConcluidas=[],tiposList=[],usuariosList=[],setoresList=['Financeiro','Gerente','Direcao','Administrativo'];
let dragId=null,dragFromStatus=null;
let chartD1=null,chartD2=null,chartPrio=null;
let currentKanban='setor';
let chatAberto=false;
let lastPollTime=new Date(Date.now()-60000).toISOString().slice(0,19).replace('T',' ');
let lastKnownId=0;
let lastMsgId=0;
let lastHistId=0;
let lastChatTime=new Date(Date.now()-60000).toISOString().slice(0,19).replace('T',' ');
let chatMsgCount=0;

// ══ TEMA ══
function toggleTheme(){
  const html=document.documentElement;
  const isDark=html.getAttribute('data-theme')==='dark';
  const newTheme=isDark?'light':'dark';
  html.setAttribute('data-theme',newTheme);
  document.getElementById('theme-btn').innerHTML=newTheme==='dark'?'<i class="ti ti-sun"></i>':'<i class="ti ti-moon"></i>';
  // swap logo
  document.querySelector('.sb-logo-dark').style.display=newTheme==='dark'?'flex':'none';
  document.querySelector('.sb-logo-light').style.display=newTheme==='light'?'flex':'none';
  localStorage.setItem('tf-theme',newTheme);
}
(function(){
  const t=localStorage.getItem('tf-theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);
  document.getElementById('theme-btn').innerHTML=t==='dark'?'<i class="ti ti-sun"></i>':'<i class="ti ti-moon"></i>';
  document.querySelector('.sb-logo-dark').style.display=t==='dark'?'flex':'none';
  document.querySelector('.sb-logo-light').style.display=t==='light'?'flex':'none';
})();

// ══ MOBILE ══
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('overlay').classList.add('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('open');}

// ══ SUBMENU ══
function toggleSubmenu(el){
  const sub=document.getElementById('submenu-oc');
  const chev=document.getElementById('oc-chevron');
  sub.classList.toggle('open');
  chev.classList.toggle('open');
}

// ══ API ══
async function api(endpoint,data=null){
  const opts=data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{method:'GET'};
  const res=await fetch('api/'+endpoint,opts);
  return res.json();
}
async function carregarTarefas(){
  tarefas=await api('ocorrencias.php');
  tarefasConcluidas=await api('ocorrencias.php?concluidas=1');
  tarefasConcluidas=tarefasConcluidas.filter(t=>t.concluida==1&&t.criador_id==ME.id);
  renderAll();
}
async function carregarTipos(){const r=await api('tipos.php');tiposList=r.map(t=>t.nome);}

function nomeSetor(nome,setor){return nome.split(' ')[0]+' · '+(SETOR_L[setor]||setor);}

// ══ PAGES ══
function showPage(p,el){
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item,.sub-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  if(el)el.classList.add('active');
  const titles={dashboard:'Dashboard',kanban:'Ocorrências',usuarios:'Usuários',relatorios:'Relatórios',chat:'Chat interno',localizar:'Localizar',configuracoes:'Configurações'};
  document.getElementById('page-title').textContent=titles[p]||p;
  if(p==='relatorios')renderRelatorio();
  if(p==='usuarios')carregarUsuarios();
  if(p==='chat'){chatAberto=true;carregarChat();}else{chatAberto=false;}
  if(p==='configuracoes'){if(IS_GES_GER)carregarConfiguracoes();aplicarConfig();}
  closeSidebar();
}

function showKanban(tipo,el){
  currentKanban=tipo;
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item,.sub-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-kanban').classList.add('active');
  if(el)el.classList.add('active');
  const titles={setor:'Para o meu setor',minhas:'Minhas solicitações',todas:'Todas as solicitações',concluidas:'Minhas concluídas'};
  document.getElementById('page-title').textContent=titles[tipo];
  renderKanbanPage();
  renderKanbanHeader(tipo);
  closeSidebar();
}

function renderKanbanHeader(tipo){
  const cfg={
    setor:{icon:'ti-inbox',color:'var(--blue)',bg:'rgba(55,138,221,.15)',title:'Para o meu setor',sub:'Ocorrências destinadas ao seu setor — você pode mover e resolver'},
    minhas:{icon:'ti-send',color:'var(--accent)',bg:'rgba(242,101,34,.15)',title:'Minhas solicitações',sub:'Ocorrências que você criou — acompanhe o andamento'},
    todas:{icon:'ti-eye',color:'var(--purple)',bg:'rgba(127,119,221,.15)',title:'Todas as solicitações',sub:'Visão completa de todas as ocorrências do sistema'},
    concluidas:{icon:'ti-circle-check',color:'var(--green)',bg:'rgba(29,158,117,.15)',title:'Minhas concluídas',sub:'Histórico de ocorrências que você criou e foram concluídas'},
  };
  const c=cfg[tipo]||cfg.setor;
  const h=document.getElementById('kb-page-header');
  if(h) h.innerHTML=`<div class="kb-page-icon" style="background:${c.bg};color:${c.color}"><i class="ti ${c.icon}"></i></div><div><div class="kb-page-title">${c.title}</div><div class="kb-page-sub">${c.sub}</div></div>`;
}

// ══ POLLING ══
async function poll(){
  try{
    const r=await fetch('api/polling.php?since='+encodeURIComponent(lastPollTime)+'&last_id='+lastKnownId+'&last_msg_id='+lastMsgId+'&last_hist_id='+lastHistId);
    if(r.redirected||!r.ok){window.location.href='login.php';return;}
    const d=await r.json();
    // Sessão inválida (outro login detectado)
    if(d.session_invalida){window.location.href='login.php';return;}
    lastPollTime=d.timestamp;
    if(typeof d.max_id!=='undefined'&&d.max_id>lastKnownId)lastKnownId=d.max_id;
    if(typeof d.max_msg_id!=='undefined'&&d.max_msg_id>lastMsgId)lastMsgId=d.max_msg_id;
    if(typeof d.max_hist_id!=='undefined'&&d.max_hist_id>lastHistId)lastHistId=d.max_hist_id;
    if(d.notif_count>0)document.getElementById('notif-dot').style.display='block';
    // Badge chat — usa contagem real do servidor (sem acumular)
    const bChat=document.getElementById('badge-chat');
    bChat.textContent=d.chat_count||0;
    bChat.style.display=(d.chat_count>0&&!chatAberto)?'inline':'none';
    if(d.chat_count>0&&chatAberto)carregarChatSince();
    if(chatAberto) atualizarBadgesPrivados();
    // Novas tarefas
    if(d.novas_tarefas&&d.novas_tarefas.length>0&&userConfig.notif_ativa){
      d.novas_tarefas.forEach(t=>{
        mostrarToast('🔔 Nova ocorrência!',`${t.tipo} — Prioridade ${({alta:'Alta',media:'Média',baixa:'Baixa'}[t.prioridade]||t.prioridade)}`);
        if(userConfig.som_ativo) tocarSomMSN();
      });
      await carregarTarefas();
      if(document.getElementById('page-kanban').classList.contains('active'))renderKanbanPage();
    }
    // Mensagens internas — usa ID para não repetir
    if(d.novas_msgs&&d.novas_msgs.length>0&&userConfig.notif_ativa){
      d.novas_msgs.forEach(m=>{
        mostrarToast('💬 Nova mensagem!',`Resposta na tarefa ${m.codigo} — ${m.tipo}`);
        if(userConfig.som_ativo) tocarSomMSN();
      });
      await carregarTarefas();
    }
    // Badge setor — fonte da verdade é o servidor
    const bOc=document.getElementById('badge-oc');
    if(typeof d.badge_setor !== 'undefined'){
      bOc.textContent=d.badge_setor;
      bOc.style.display=d.badge_setor>0?'inline':'none';
      bOc.classList.toggle('blink',d.badge_setor>0);
      bOc.style.background=d.tem_alta?'var(--accent)':'var(--red)';
    }
  }catch(e){}
}
setInterval(poll,3500);

// ══ SOM MSN ══
function tocarSomMSN(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [{f:880,t:0,d:.1},{f:1109,t:.12,d:.1},{f:987,t:.24,d:.1},{f:1319,t:.36,d:.18}].forEach(n=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(n.f,ctx.currentTime+n.t);
      g.gain.setValueAtTime(0,ctx.currentTime+n.t);
      g.gain.linearRampToValueAtTime(0.2,ctx.currentTime+n.t+.02);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+n.t+n.d);
      o.start(ctx.currentTime+n.t);o.stop(ctx.currentTime+n.t+n.d+.05);
    });
  }catch(e){}
}
function tocarSomDrop(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.setValueAtTime(600,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(400,ctx.currentTime+.08);
    g.gain.setValueAtTime(0.15,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+.12);
    o.start();o.stop(ctx.currentTime+.15);
  }catch(e){}
}
function tocarSomConcluir(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [{f:523,t:0,d:.08},{f:659,t:.09,d:.08},{f:784,t:.18,d:.08},{f:1047,t:.27,d:.2}].forEach(n=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='sine';o.frequency.setValueAtTime(n.f,ctx.currentTime+n.t);
      g.gain.setValueAtTime(0,ctx.currentTime+n.t);
      g.gain.linearRampToValueAtTime(0.18,ctx.currentTime+n.t+.01);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+n.t+n.d);
      o.start(ctx.currentTime+n.t);o.stop(ctx.currentTime+n.t+n.d+.05);
    });
  }catch(e){}
}

// ══ TOAST ══
function mostrarToast(titulo,msg){
  const c=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className='toast';
  t.innerHTML=`<div class="toast-title">${titulo}<button class="toast-close" onclick="this.closest('.toast').remove()">×</button></div><div class="toast-msg">${msg}</div>`;
  c.appendChild(t);
  setTimeout(()=>{if(t.parentNode){t.classList.add('removing');setTimeout(()=>t.remove(),300);}},5000);
}

// ══ KANBAN ══
function getListaKanban(){
  if(currentKanban==='minhas') return tarefas.filter(t=>t.criador_id==ME.id&&!t.concluida);
  if(currentKanban==='setor')  return tarefas.filter(t=>t.setor_responsavel===ME.setor&&!t.concluida);
  if(currentKanban==='concluidas') return []; // handled separately with 2 boards
  return tarefas.filter(t=>!t.concluida);
}

function renderKanbanConcluidas(){
  const cont=document.getElementById('kb-board');
  // Board 1: tarefas que eu concluí (era responsável)
  const euConclui=tarefasConcluidas.filter(t=>t.setor_responsavel===ME.setor&&t.criador_id!=ME.id);
  // Board 2: minhas solicitações concluídas (eu criei)
  const euSolicitei=tarefasConcluidas.filter(t=>t.criador_id==ME.id);
  
  cont.innerHTML=''; // clear grid layout
  cont.style.display='block';
  cont.innerHTML=`
    <div style="margin-bottom:20px">
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(29,158,117,.15);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--green)"><i class="ti ti-check"></i></div>
        <div><div>Tarefas que concluí</div><div style="font-size:12px;font-weight:400;color:var(--text3)">Solicitações do meu setor que finalizei</div></div>
        <span style="margin-left:auto;background:var(--green);color:white;border-radius:10px;padding:2px 10px;font-size:12px">${euConclui.length}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr;gap:8px">
        ${euConclui.length?euConclui.map(t=>`
          <div style="background:var(--card);border:1px solid var(--border);border-left:4px solid var(--green);border-radius:var(--r);padding:14px;cursor:pointer;transition:all .2s" onclick="abrirTarefa(${t.id},true)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:11px;color:var(--text3)">${t.codigo}</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(29,158,117,.15);color:var(--green);font-weight:500">Concluída</span>
            </div>
            <div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:6px">${t.tipo}</div>
            ${t.nome_aluno?`<div style="font-size:12px;color:var(--text3);margin-bottom:6px"><i class="ti ti-user" style="font-size:11px"></i> ${t.nome_aluno}${t.id_aluno?' · '+t.id_aluno:''}</div>`:''}
            <div style="font-size:11px;color:var(--text3)">Solicitado por: ${(t.criador_nome||'').split(' ')[0]} · ${t.atualizado_em?t.atualizado_em.substr(0,10):''}</div>
          </div>`).join(''):'<div style="text-align:center;padding:30px;font-size:13px;color:var(--text3);background:var(--surface2);border-radius:var(--r)"><i class="ti ti-circle-check" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4"></i>Nenhuma tarefa concluída por você</div>'}
      </div>
    </div>
    <div>
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(242,101,34,.15);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--accent)"><i class="ti ti-send"></i></div>
        <div><div>Minhas solicitações concluídas</div><div style="font-size:12px;font-weight:400;color:var(--text3)">Ocorrências que você criou e foram finalizadas</div></div>
        <span style="margin-left:auto;background:var(--accent);color:white;border-radius:10px;padding:2px 10px;font-size:12px">${euSolicitei.length}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr;gap:8px">
        ${euSolicitei.length?euSolicitei.map(t=>`
          <div style="background:var(--card);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:var(--r);padding:14px;cursor:pointer;transition:all .2s" onclick="abrirTarefa(${t.id},true)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:11px;color:var(--text3)">${t.codigo}</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(242,101,34,.15);color:var(--accent);font-weight:500">Concluída</span>
            </div>
            <div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:6px">${t.tipo}</div>
            ${t.nome_aluno?`<div style="font-size:12px;color:var(--text3);margin-bottom:6px"><i class="ti ti-user" style="font-size:11px"></i> ${t.nome_aluno}${t.id_aluno?' · '+t.id_aluno:''}</div>`:''}
            <div style="font-size:11px;color:var(--text3)">Setor: ${(t.setor_responsavel?t.setor_responsavel:'')} · ${t.atualizado_em?t.atualizado_em.substr(0,10):''}</div>
          </div>`).join(''):'<div style="text-align:center;padding:30px;font-size:13px;color:var(--text3);background:var(--surface2);border-radius:var(--r)"><i class="ti ti-send" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4"></i>Nenhuma solicitação sua foi concluída ainda</div>'}
      </div>
    </div>`;
}

function renderKanbanPage(){
  if(currentKanban==='concluidas'){renderKanbanConcluidas();return;}
  const lista=getListaKanban();
  const canDrag=currentKanban==='setor';
  const cont=document.getElementById('kb-board');
  cont.style.display=''; // reset from concluidas view
  const bC={pendente:'#888780',aceita:'#378ADD',andamento:'#EF9F27',concluida:'#1D9E75'};
  cont.innerHTML=STATUS_ORDER.map(s=>`
    <div class="kcol kcol-${s}">
      <div class="kcol-head" style="border-top:3px solid ${bC[s]}">
        <span class="kcol-title">${STATUS_L[s]}</span>
        <span class="kcol-count">${lista.filter(t=>t.status===s).length}</span>
      </div>
      <div class="kcol-body" id="kb-${s}"
        ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event,'${s}')">
        ${lista.filter(t=>t.status===s).map(t=>cardHTML(t,canDrag)).join('')||'<div style="text-align:center;padding:40px 10px;font-size:13px;color:var(--text3)"><i class="ti ti-inbox" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4"></i>Nenhuma ocorrência</div>'}
      </div>
    </div>`).join('');

  if(canDrag){
    cont.querySelectorAll('.kcard[draggable="true"]').forEach(c=>{
      // Desktop drag
      c.addEventListener('dragstart',e=>{
        dragId=c.dataset.id;
        dragFromStatus=tarefas.find(t=>t.id==c.dataset.id)?.status;
        setTimeout(()=>c.classList.add('dragging'),0);
        e.dataTransfer.effectAllowed='move';
      });
      c.addEventListener('dragend',e=>{c.classList.remove('dragging');dragId=null;dragFromStatus=null;});
      // Touch drag
      c.addEventListener('touchstart',onTouchStart,{passive:false});
    });
  }
}

// ══ TOUCH DRAG ══
let touchCard=null,touchClone=null,touchStartX=0,touchStartY=0;
function onTouchStart(e){
  if(currentKanban!=='setor')return;
  const card=e.currentTarget;
  touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;
  let moved=false;
  const onMove=ev=>{
    if(!moved){
      moved=true;
      dragId=card.dataset.id;
      dragFromStatus=tarefas.find(t=>t.id==card.dataset.id)?.status;
      touchClone=card.cloneNode(true);
      touchClone.className=card.className+' touch-dragging';
      touchClone.style.width=card.offsetWidth+'px';
      document.body.appendChild(touchClone);
      card.style.opacity='.3';
    }
    ev.preventDefault();
    const tx=ev.touches[0].clientX,ty=ev.touches[0].clientY;
    if(touchClone){touchClone.style.left=(tx-card.offsetWidth/2)+'px';touchClone.style.top=(ty-30)+'px';}
    // highlight col under finger
    document.querySelectorAll('.kcol-body').forEach(col=>{
      col.classList.remove('drag-over');
      const r=col.getBoundingClientRect();
      if(tx>=r.left&&tx<=r.right&&ty>=r.top&&ty<=r.bottom)col.classList.add('drag-over');
    });
  };
  const onEnd=ev=>{
    card.removeEventListener('touchmove',onMove);
    card.removeEventListener('touchend',onEnd);
    card.style.opacity='';
    if(touchClone){touchClone.remove();touchClone=null;}
    document.querySelectorAll('.kcol-body').forEach(col=>col.classList.remove('drag-over'));
    if(!moved||!dragId)return;
    const tx=ev.changedTouches[0].clientX,ty=ev.changedTouches[0].clientY;
    let targetStatus=null;
    STATUS_ORDER.forEach(s=>{
      const col=document.getElementById('kb-'+s);if(!col)return;
      const r=col.getBoundingClientRect();
      if(tx>=r.left&&tx<=r.right&&ty>=r.top&&ty<=r.bottom)targetStatus=s;
    });
    if(targetStatus&&targetStatus!==dragFromStatus){
      doMove(dragId,targetStatus);
    }
    dragId=null;dragFromStatus=null;
  };
  card.addEventListener('touchmove',onMove,{passive:false});
  card.addEventListener('touchend',onEnd);
}

async function doMove(id,novoStatus){
  // Allow both forward and backward movement for setor kanban
  await api('ocorrencias.php',{acao:'mover',id,status:novoStatus,allowBack:true});
  tocarSomDrop();
  await carregarTarefas();
  renderKanbanPage();
}

function cardHTML(t,canDrag){
  const hasUnread=t.tem_unread;
  const isResp=IS_GES_GER||(ME.setor===t.setor_responsavel&&t.criador_id!=ME.id);
  const showConcluir=t.status==='concluida'&&isResp&&currentKanban==='setor';
  const sl=SETOR_CL[t.setor_responsavel]||'s-adm';
  const pLabel={alta:'Alta',media:'Média',baixa:'Baixa'}[t.prioridade]||t.prioridade;
  const imgHtml=t.imagem?`<img class="kcard-img" src="uploads/ocorrencias/${t.imagem}" alt="Imagem da ocorrência">`:'';
  return`<div class="kcard ${canDrag?'prio-left-'+t.prioridade:''}${hasUnread?' unread':''}" ${canDrag?'draggable="true"':''} data-id="${t.id}" onclick="abrirTarefa(${t.id})">
    ${hasUnread?'<div class="unread-badge"></div>':''}
    ${imgHtml}
    <div class="kcard-top"><span class="kcard-id">${t.codigo}</span><span class="kcard-prio p-${t.prioridade}">${pLabel}</span></div>
    <div class="kcard-title">${t.tipo}</div>
    ${t.nome_aluno?`<div class="kcard-aluno"><i class="ti ti-user" style="font-size:11px"></i> ${t.nome_aluno}${t.id_aluno?' · '+t.id_aluno:''}</div>`:''}
    <div class="kcard-foot"><span class="kcard-setor ${sl}">${SETOR_L[t.setor_responsavel]||t.setor_responsavel}</span>${t.msgs&&t.msgs.length?`<span style="font-size:11px;color:var(--text3)"><i class="ti ti-message" style="font-size:12px;vertical-align:-1px"></i> ${t.msgs.length}</span>`:''}</div>
    ${showConcluir?`<button class="btn-concluir-card" onclick="event.stopPropagation();concluirTarefa(${t.id})"><i class="ti ti-circle-check"></i> Concluir tarefa</button>`:''}
  </div>`;
}

function onDragOver(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function onDragLeave(e){e.currentTarget.classList.remove('drag-over');}
async function onDrop(e,novoStatus){
  e.preventDefault();e.currentTarget.classList.remove('drag-over');
  if(!dragId)return;
  if(novoStatus!==dragFromStatus&&currentKanban==='setor')await doMove(dragId,novoStatus);
  else if(novoStatus!==dragFromStatus&&currentKanban!=='setor'){}// read only
}

async function abrirTarefa(id, readOnly=false){
  const t=tarefas.find(x=>x.id==id)||tarefasConcluidas.find(x=>x.id==id);
  if(!t)return;
  if(t.tem_unread&&!readOnly){
    await api('ocorrencias.php',{acao:'marcar_lida',id});
    t.tem_unread=false;
    renderKanbanPage();
    const nv=tarefas.filter(t=>t.setor_responsavel===ME.setor&&t.criador_id!=ME.id&&t.tem_unread).length;
    const bOc=document.getElementById('badge-oc');
    bOc.textContent=nv;bOc.style.display=nv>0?'inline':'none';
  }
  const isMeu=t.criador_id==ME.id;
  const isResp=(ME.setor===t.setor_responsavel&&!isMeu)||IS_GES_GER;
  const kanbanSetor=currentKanban==='setor';
  const podeTransferir=IS_GES_GER&&!readOnly&&kanbanSetor;
  const podeDevolver=isResp&&t.status!=='concluida'&&!readOnly;
  const podeExcluir=isMeu&&!readOnly;
  const sl=SETOR_CL[t.setor_responsavel]||'s-adm';
  const mc=document.getElementById('modal-content');
  let transferOpts='';
  if(podeTransferir){
    const users=await api('usuarios.php');
    transferOpts=users.filter(u=>u.id!=ME.id).map(u=>`<option value="${u.id}">${u.nome.split(' ')[0]} — ${SETOR_L[u.setor]||u.setor}</option>`).join('');
  }
  const imgSection=t.imagem?`<img src="uploads/ocorrencias/${t.imagem}" style="width:100%;max-height:200px;object-fit:cover;border-radius:var(--r);margin-bottom:12px;border:1px solid var(--border)" alt="Imagem da ocorrência">`:'';
  mc.innerHTML=`<h3><i class="ti ti-clipboard-text"></i> ${t.codigo} — ${t.tipo}</h3>
    <div class="task-info-row">
      <span class="tip kcard-setor ${sl}">${SETOR_L[t.setor_responsavel]||t.setor_responsavel}</span>
      <span class="tip" style="background:${STATUS_C[t.status]};color:white">${STATUS_L[t.status]}</span>
      <span class="tip">${{alta:'Alta',media:'Média',baixa:'Baixa'}[t.prioridade]||t.prioridade}</span>
      <span class="tip">Por: ${(t.criador_nome||'').split(' ')[0]}</span>
    </div>
    ${t.nome_aluno?`<div style="font-size:13px;color:var(--text2);margin-bottom:10px"><i class="ti ti-user"></i> ${t.nome_aluno}${t.id_aluno?' · ID: '+t.id_aluno:''}</div>`:''}
    ${imgSection}
    <div class="task-desc">${t.descricao}</div>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:600;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Histórico</div>
      ${(t.timeline||[]).map(tl=>`<div class="tl-item"><div class="tl-dot"></div><span>${tl}</span></div>`).join('')||'<div class="tl-item"><div class="tl-dot"></div><span>Sem histórico</span></div>'}
    </div>
    ${(t.vistas&&t.vistas.length>0)?`<div style="font-size:11px;color:var(--green);margin-bottom:10px;display:flex;align-items:center;gap:5px"><i class="ti ti-eye" style="font-size:13px"></i> Visto por: ${t.vistas.map(v=>v.nome.split(' ')[0]+' ('+v.visto_em.substr(11,5)+')').join(', ')}</div>`:'<div style="font-size:11px;color:var(--text3);margin-bottom:10px;display:flex;align-items:center;gap:5px"><i class="ti ti-eye-off" style="font-size:13px"></i> Ainda não foi visto pelo responsável</div>'}
    ${!readOnly?`<div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:8px"><i class="ti ti-message-dots" style="vertical-align:-2px;margin-right:4px"></i> Mensagens</div>
      <div class="task-msgs">
        ${(t.msgs||[]).length?(t.msgs||[]).map(m=>{const mine=m.usuario_id==ME.id;return`<div class="task-msg ${mine?'mine':'other'}"><div class="task-msg-who">${(m.nome||'').split(' ')[0]}</div>${m.mensagem}<div style="font-size:10px;margin-top:2px;opacity:.6">${(m.criado_em||'').substr(11,5)}</div></div>`}).join(''):'<div style="font-size:13px;color:var(--text3);text-align:center;padding:10px 0">Nenhuma mensagem ainda</div>'}
      </div>
      <div class="task-chat-input"><input id="tmsg-${id}" placeholder="Mensagem..." onkeydown="if(event.key==='Enter')enviarMsgTarefa(${id})"><button onclick="enviarMsgTarefa(${id})"><i class="ti ti-send"></i></button></div>
    </div>`:''}
    ${podeDevolver?`<div id="devolver-panel" style="display:none;border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-top:12px;background:var(--surface2)">
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:8px"><i class="ti ti-arrow-back-up"></i> Devolver tarefa</div>
      <textarea id="devolver-just-${id}" style="width:100%;padding:10px 12px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface3);font-size:13px;font-family:DM Sans,sans-serif;color:var(--text);resize:none;height:80px;outline:none;display:block;margin-bottom:10px" placeholder="Explique o motivo da devolução..."></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn-cancel" onclick="document.getElementById('devolver-panel').style.display='none'">Cancelar</button>
        <button class="btn-ok" style="background:var(--orange,#f26522)" onclick="devolverTarefa(${id})"><i class="ti ti-arrow-back-up"></i> Confirmar devolução</button>
      </div>
    </div>`:''}
    ${podeTransferir?`<div id="transfer-panel" style="display:none;border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-top:12px;background:var(--surface2)">
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:10px"><i class="ti ti-arrows-transfer-up"></i> Transferir tarefa</div>
      <div class="field"><label>Transferir para</label><select id="transfer-user">${transferOpts}</select></div>
      <div class="field"><label>Motivo da transferência</label><textarea id="transfer-motivo" style="width:100%;padding:8px 12px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface3);font-size:13px;font-family:DM Sans,sans-serif;color:var(--text);resize:none;height:70px;outline:none" placeholder="Descreva o motivo..."></textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn-cancel" onclick="document.getElementById('transfer-panel').style.display='none'">Cancelar</button><button class="btn-ok" onclick="transferirTarefa(${id})">Confirmar transferência</button></div>
    </div>`:''}
    <div class="mfooter">
      ${podeDevolver?`<button class="btn-cancel" onclick="const p=document.getElementById('devolver-panel');const t2=document.getElementById('transfer-panel');if(t2)t2.style.display='none';p.style.display=p.style.display==='none'?'block':'none';if(p.style.display==='block')document.getElementById('devolver-just-${id}').focus()"><i class="ti ti-arrow-back-up"></i> Devolver</button>`:''}
      ${podeTransferir?`<button class="btn-cancel" onclick="const p=document.getElementById('transfer-panel');const d2=document.getElementById('devolver-panel');if(d2)d2.style.display='none';p.style.display=p.style.display==='none'?'block':'none'"><i class="ti ti-arrows-transfer-up"></i> Transferir tarefa</button>`:''}
      ${podeExcluir?`<button class="btn-danger" onclick="confirmarExcluir(${id})"><i class="ti ti-trash"></i> Excluir</button>`:''}
      <button class="btn-ok" style="margin-left:auto" onclick="fecharModal()">Fechar</button>
    </div>`;
  document.getElementById('modal-bg').classList.add('open');
}

async function transferirTarefa(id){
  const uid=document.getElementById('transfer-user').value;
  const motivo=(document.getElementById('transfer-motivo')?.value||'').trim();
  if(!motivo){alert('Informe o motivo da transferência.');return;}
  await api('usuarios.php',{acao:'transferir_tarefa',ocorrencia_id:id,usuario_id:uid,motivo});
  tocarSomMSN();mostrarToast('✅ Transferida','Tarefa transferida com sucesso.');
  fecharModal();await carregarTarefas();renderKanbanPage();
}
async function enviarMsgTarefa(id){
  const inp=document.getElementById('tmsg-'+id);if(!inp||!inp.value.trim())return;
  await api('ocorrencias.php',{acao:'mensagem',id,texto:inp.value.trim()});
  inp.value='';await carregarTarefas();abrirTarefa(id);
}
async function devolverTarefa(id){
  const just=document.getElementById('devolver-just-'+id);
  if(!just||!just.value.trim()){alert('Por favor informe o motivo da devolução.');return;}
  const res=await api('ocorrencias.php',{acao:'devolver',id,justificativa:just.value.trim()});
  if(res.erro){alert(res.erro);return;}
  fecharModal();await carregarTarefas();renderKanbanPage();
}
function confirmarExcluir(id){
  document.getElementById('modal-content').innerHTML=`<h3><i class="ti ti-alert-triangle" style="color:var(--red)"></i> Confirmar exclusão</h3>
    <div style="font-size:14px;color:var(--text2);margin-bottom:16px;line-height:1.6">Tem certeza? Esta ação não pode ser desfeita.</div>
    <div class="mfooter"><button class="btn-cancel" onclick="fecharModal()">Cancelar</button><button class="btn-danger" onclick="excluirTarefa(${id})"><i class="ti ti-trash"></i> Excluir</button></div>`;
}
async function excluirTarefa(id){await api('ocorrencias.php',{acao:'excluir',id});fecharModal();await carregarTarefas();renderKanbanPage();}
async function concluirTarefa(id){
  tocarSomConcluir();
  await api('ocorrencias.php',{acao:'concluir',id});
  fecharModal();
  mostrarToast('✅ Concluída!','Tarefa marcada como concluída.');
  await carregarTarefas();renderKanbanPage();
}

// ══ DASHBOARD ══
function animateCount(el,target){
  let start=0,dur=800,step=16;
  const inc=target/(dur/step);
  const t=setInterval(()=>{start+=inc;if(start>=target){el.textContent=target;clearInterval(t);}else el.textContent=Math.floor(start);},step);
}

function renderMetrics(){
  const pend=tarefas.filter(t=>t.status==='pendente').length;
  const hp=pend>0;
  const mg=document.getElementById('metrics-grid');
  mg.innerHTML=`
    <div class="metric metric-total"><div class="metric-icon"><i class="ti ti-clipboard-list"></i></div><div class="metric-val" id="mv-total">0</div><div class="metric-label">Total de ocorrências</div><div class="metric-sub">ativas no sistema</div></div>
    <div class="metric metric-pend" style="${hp?'border-color:rgba(226,75,74,.3)':''}"><div class="metric-icon">${hp?'<span class="pulse-dot" style="width:12px;height:12px;margin:0"></span>':'<i class="ti ti-clock"></i>'}</div><div class="metric-val" id="mv-pend" style="${hp?'color:var(--red)':''}">0</div><div class="metric-label">Pendentes</div><div class="metric-sub">aguardando ação</div></div>
    <div class="metric metric-and"><div class="metric-icon"><i class="ti ti-loader"></i></div><div class="metric-val" id="mv-and">0</div><div class="metric-label">Em andamento</div><div class="metric-sub">sendo resolvidas</div></div>
    <div class="metric metric-conc"><div class="metric-icon"><i class="ti ti-circle-check"></i></div><div class="metric-val" id="mv-conc">0</div><div class="metric-label">Concluídas</div><div class="metric-sub">finalizadas</div></div>`;
  setTimeout(()=>{
    animateCount(document.getElementById('mv-total'),tarefas.length);
    animateCount(document.getElementById('mv-pend'),pend);
    animateCount(document.getElementById('mv-and'),tarefas.filter(t=>t.status==='andamento').length);
    animateCount(document.getElementById('mv-conc'),tarefas.filter(t=>t.concluida==1).length);
  },50);
  // Badge is updated by polling, not here
}

function cssColor(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||'#888';}
function renderCharts(){
  const sC=STATUS_ORDER.map(s=>tarefas.filter(t=>t.status===s).length);
  document.getElementById('leg-d').innerHTML=STATUS_ORDER.map((s,i)=>`<span class="leg-item"><span class="leg-sq" style="background:${STATUS_C[s]}"></span>${STATUS_L[s]} ${sC[i]}</span>`).join('');
  if(chartD1)chartD1.destroy();
  chartD1=new Chart(document.getElementById('cd1'),{type:'doughnut',data:{labels:STATUS_ORDER.map(s=>STATUS_L[s]),datasets:[{data:sC,backgroundColor:STATUS_ORDER.map(s=>STATUS_C[s]),borderWidth:3,borderColor:'transparent',hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:false}}}});
  const setores=['Financeiro','Gerente','Direcao','Administrativo'];
  if(chartD2)chartD2.destroy();
  const tickColor=cssColor('--text3');
  chartD2=new Chart(document.getElementById('cd2'),{type:'bar',data:{labels:['Financeiro','Gerente','Direção','Adm.'],datasets:[{data:setores.map(s=>tarefas.filter(t=>t.setor_responsavel===s).length),backgroundColor:['rgba(55,138,221,.8)','rgba(127,119,221,.8)','rgba(239,159,39,.8)','rgba(29,158,117,.8)'],borderRadius:8,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:12},color:tickColor}},y:{beginAtZero:true,ticks:{stepSize:1,font:{size:11},color:tickColor},grid:{color:'rgba(128,128,128,.08)'}}}}});
  // Prioridade
  const pC=['alta','media','baixa'].map(p=>tarefas.filter(t=>t.prioridade===p).length);
  if(chartPrio)chartPrio.destroy();
  chartPrio=new Chart(document.getElementById('cd-prio'),{type:'doughnut',data:{labels:['Alta','Média','Baixa'],datasets:[{data:pC,backgroundColor:['rgba(226,75,74,.8)','rgba(239,159,39,.8)','rgba(99,153,34,.8)'],borderWidth:3,borderColor:'transparent',hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{color:cssColor('--text2'),font:{size:12},padding:12}}}}});
  // Urgentes
  const urgentes=tarefas.filter(t=>t.prioridade==='alta'&&t.status!=='concluida').slice(0,4);
  document.getElementById('urgentes-list').innerHTML=urgentes.length?urgentes.map(t=>`<div class="urgente-item" onclick="abrirTarefa(${t.id})" style="cursor:pointer"><div class="urgente-dot"></div><div class="urgente-info"><div class="urgente-title">${t.codigo} — ${t.tipo}</div><div class="urgente-meta">${SETOR_L[t.setor_responsavel]||t.setor_responsavel} · ${STATUS_L[t.status]}</div></div></div>`).join(''):'<div style="font-size:13px;color:var(--text3);padding:12px 0;text-align:center"><i class="ti ti-check" style="font-size:20px;display:block;margin-bottom:4px;color:var(--green)"></i>Nenhuma urgente!</div>';
  // Recentes
  const recentes=tarefas.slice(0,5);
  const setorCl=SETOR_CL;
  document.getElementById('oc-recentes').innerHTML=recentes.length?recentes.map(t=>`<div class="oc-item p-${t.prioridade}" onclick="abrirTarefa(${t.id})" style="cursor:pointer"><div class="oc-item-info"><div class="oc-item-title">${t.codigo} — ${t.tipo}</div><div class="oc-item-meta">${t.nome_aluno||'Sem aluno'} · ${SETOR_L[t.setor_responsavel]||t.setor_responsavel}</div></div><span class="oc-item-badge kcard-setor ${setorCl[t.setor_responsavel]||'s-adm'}" style="font-size:11px">${STATUS_L[t.status]}</span></div>`).join(''):'<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px">Nenhuma ocorrência</div>';
}

async function renderRelatorio(){
  const rc=document.getElementById('rel-content');
  const hoje=new Date().toISOString().slice(0,10);
  const pool=[...tarefas,...tarefasConcluidas.filter(t=>!tarefas.find(x=>x.id==t.id))];
  const tarefasHoje=pool.filter(t=>(t.criado_em||'').startsWith(hoje));
  const total=tarefasHoje.length;
  const concl=tarefasHoje.filter(t=>t.concluida==1).length;
  const pend=tarefasHoje.filter(t=>t.status==='pendente').length;
  const alta=tarefasHoje.filter(t=>t.prioridade==='alta'&&!t.concluida).length;
  const taxaConc=total>0?Math.round(concl/total*100):0;
  if(IS_GES_GER){
    const users=await api('usuarios.php');
    const setores=['Financeiro','Gerente','Direcao','Administrativo'];
    const colors={Financeiro:'rgba(55,138,221,.8)',Gerente:'rgba(127,119,221,.8)',Direcao:'rgba(239,159,39,.8)',Administrativo:'rgba(29,158,117,.8)'};
    const max=Math.max(...setores.map(s=>tarefas.filter(t=>t.setor_responsavel===s).length),1);
    rc.innerHTML=`
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="margin:0"><label style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Data início</label><input type="date" id="rel-data-inicio" style="padding:8px 12px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface2);font-size:13px;color:var(--text);font-family:DM Sans,sans-serif"></div>
      <div class="field" style="margin:0"><label style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Data fim</label><input type="date" id="rel-data-fim" style="padding:8px 12px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface2);font-size:13px;color:var(--text);font-family:DM Sans,sans-serif"></div>
      <button class="btn-new" onclick="filtrarRelatorio()" style="margin-bottom:0"><i class="ti ti-filter"></i> Filtrar</button>
    </div>
    <div class="rel-kpis">
      <div class="kpi"><div class="kpi-val">${total}</div><div class="kpi-label">Total de ocorrências</div></div>
      <div class="kpi"><div class="kpi-val" style="color:var(--green)">${concl}</div><div class="kpi-label">Concluídas</div><div class="kpi-trend trend-up">${taxaConc}% de resolução</div></div>
      <div class="kpi"><div class="kpi-val" style="color:var(--red)">${pend}</div><div class="kpi-label">Pendentes</div></div>
      <div class="kpi"><div class="kpi-val" style="color:var(--amber)">${alta}</div><div class="kpi-label">Urgentes (Alta)</div></div>
    </div>
    <div class="dash-row dash-row-2" style="margin-bottom:14px">
      <div class="chart-card">
        <div class="cc-title" style="margin-bottom:12px">Performance por usuário</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:8px;color:var(--text3);font-weight:600;font-size:11px;text-transform:uppercase">Usuário</th>
            <th style="text-align:left;padding:8px;color:var(--text3);font-weight:600;font-size:11px;text-transform:uppercase">Nível</th>
            <th style="text-align:center;padding:8px;color:var(--text3);font-weight:600;font-size:11px;text-transform:uppercase">Criadas</th>
            <th style="text-align:center;padding:8px;color:var(--text3);font-weight:600;font-size:11px;text-transform:uppercase">Concluídas</th>
            <th style="text-align:center;padding:8px;color:var(--text3);font-weight:600;font-size:11px;text-transform:uppercase">Aberto</th>
          </tr></thead>
          <tbody>${users.map(u=>{
            const cr=tarefas.filter(t=>t.criador_id==u.id).length;
            const co=tarefas.filter(t=>t.criador_id==u.id&&t.concluida==1).length;
            const ab=tarefas.filter(t=>t.criador_id==u.id&&!t.concluida).length;
            const tx=cr>0?Math.round(co/cr*100):0;
            return`<tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 8px"><strong>${u.nome.split(' ')[0]}</strong></td><td style="padding:10px 8px"><span class="u-badge nb-${u.nivel}">${u.nivel.charAt(0).toUpperCase()+u.nivel.slice(1)}</span></td><td style="padding:10px 8px;text-align:center">${cr}</td><td style="padding:10px 8px;text-align:center;color:var(--green);font-weight:600">${co} <span style="font-size:10px;color:var(--text3)">(${tx}%)</span></td><td style="padding:10px 8px;text-align:center;color:${ab>0?'var(--amber)':'var(--text3)'}">${ab}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <div class="chart-card">
        <div class="cc-title" style="margin-bottom:12px">Volume por setor</div>
        ${setores.map(s=>{const n=tarefas.filter(t=>t.setor_responsavel===s).length;return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="font-size:13px;width:90px;flex-shrink:0">${SETOR_L[s]}</div><div style="flex:1;height:10px;background:var(--surface2);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.round(n/max*100)}%;background:${colors[s]};border-radius:5px;transition:width .6s ease"></div></div><div style="font-size:13px;font-weight:600;width:24px;text-align:right">${n}</div></div>`}).join('')}
      </div>
    </div>
    <div class="chart-card">
      <div class="cc-title" style="margin-bottom:12px">Ocorrências urgentes em aberto</div>
      ${tarefas.filter(t=>t.prioridade==='alta'&&!t.concluida).length?tarefas.filter(t=>t.prioridade==='alta'&&!t.concluida).map(t=>`<div class="oc-item p-alta" onclick="abrirTarefa(${t.id})" style="cursor:pointer;margin-bottom:6px"><div class="oc-item-info"><div class="oc-item-title">${t.codigo} — ${t.tipo}</div><div class="oc-item-meta">${t.nome_aluno||'Sem aluno'} · ${SETOR_L[t.setor_responsavel]}</div></div><span class="oc-item-badge kcard-setor ${SETOR_CL[t.setor_responsavel]||'s-adm'}">${STATUS_L[t.status]}</span></div>`).join(''):'<div style="font-size:13px;color:var(--green);text-align:center;padding:16px"><i class="ti ti-circle-check" style="font-size:24px;display:block;margin-bottom:6px"></i>Nenhuma urgente em aberto!</div>'}
    </div>`;
  }else{
    const criadas=tarefas.filter(t=>t.criador_id==ME.id).length;
    const co=tarefas.filter(t=>t.criador_id==ME.id&&t.concluida==1).length;
    const ab=tarefas.filter(t=>t.criador_id==ME.id&&!t.concluida).length;
    rc.innerHTML=`
    <div class="rel-kpis">
      <div class="kpi"><div class="kpi-val">${criadas}</div><div class="kpi-label">Criadas por mim</div></div>
      <div class="kpi"><div class="kpi-val" style="color:var(--green)">${co}</div><div class="kpi-label">Concluídas</div><div class="kpi-trend trend-up">${criadas>0?Math.round(co/criadas*100):0}%</div></div>
      <div class="kpi"><div class="kpi-val" style="color:var(--amber)">${ab}</div><div class="kpi-label">Em aberto</div></div>
      <div class="kpi"><div class="kpi-val" style="color:var(--red)">${tarefas.filter(t=>t.criador_id==ME.id&&t.prioridade==='alta'&&!t.concluida).length}</div><div class="kpi-label">Urgentes</div></div>
    </div>
    <div class="chart-card"><div class="cc-title" style="margin-bottom:12px">Minhas ocorrências</div>
    ${tarefas.filter(t=>t.criador_id==ME.id).length?tarefas.filter(t=>t.criador_id==ME.id).map(t=>`<div class="oc-item p-${t.prioridade}" onclick="abrirTarefa(${t.id})" style="cursor:pointer;margin-bottom:6px"><div class="oc-item-info"><div class="oc-item-title">${t.codigo} — ${t.tipo}</div><div class="oc-item-meta">${SETOR_L[t.setor_responsavel]}</div></div><span style="font-size:11px;padding:2px 8px;border-radius:8px;background:${STATUS_C[t.status]};color:white">${STATUS_L[t.status]}</span></div>`).join(''):'<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px">Nenhuma ocorrência criada</div>'}
    </div>`;
  }
}

async function carregarUsuarios(){
  const users=await api('usuarios.php');usuariosList=users;
  document.getElementById('users-list').innerHTML=users.map(u=>{
    const ini=u.nome.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
    return`<div class="user-row"><div class="u-av" style="background:var(--surface3);color:var(--accent)">${ini}</div><div style="flex:1"><div class="u-name">${u.nome}</div><div class="u-meta">${u.email}${u.whatsapp?' · '+u.whatsapp:''}</div></div><span class="u-badge nb-${u.nivel}">${u.nivel.charAt(0).toUpperCase()+u.nivel.slice(1)}</span><div class="u-actions"><button class="icon-btn" onclick="editarUsuario(${u.id})" title="Editar"><i class="ti ti-edit"></i></button><button class="icon-btn danger" onclick="confirmarExcluirUser(${u.id},'${u.nome}')" title="Excluir"><i class="ti ti-trash"></i></button></div></div>`;
  }).join('');
}

function editarUsuario(id){
  const u=usuariosList.find(x=>x.id==id);if(!u)return;
  document.getElementById('modal-content').innerHTML=`<h3><i class="ti ti-edit"></i> Editar usuário</h3>
    <div class="field"><label>Nome</label><input type="text" id="eu-nome" value="${u.nome}"></div>
    <div class="field"><label>E-mail</label><input type="email" id="eu-email" value="${u.email}"></div>
    <div class="field"><label>WhatsApp</label><input type="text" id="eu-whats" value="${u.whatsapp||''}"></div>
    <div class="field"><label>Nova senha (em branco = manter)</label><input type="password" id="eu-senha" placeholder="••••••••"></div>
    <div class="field"><label>Nível</label><select id="eu-nivel"><option value="gestor"${u.nivel==='gestor'?' selected':''}>Gestor</option><option value="gerente"${u.nivel==='gerente'?' selected':''}>Gerente</option><option value="colaborador"${u.nivel==='colaborador'?' selected':''}>Colaborador</option></select></div>
    <div class="field"><label>Setor</label><select id="eu-setor"><option value="Direcao"${u.setor==='Direcao'?' selected':''}>Direção</option><option value="Gerente"${u.setor==='Gerente'?' selected':''}>Gerente</option><option value="Financeiro"${u.setor==='Financeiro'?' selected':''}>Financeiro</option><option value="Administrativo"${u.setor==='Administrativo'?' selected':''}>Administrativo</option></select></div>
    <div class="mfooter"><button class="btn-cancel" onclick="fecharModal()">Cancelar</button><button class="btn-ok" onclick="salvarEdicaoUsuario(${id})">Salvar</button></div>`;
  document.getElementById('modal-bg').classList.add('open');
}
async function salvarEdicaoUsuario(id){
  const res=await api('usuarios.php',{acao:'editar',id,nome:document.getElementById('eu-nome').value.trim(),email:document.getElementById('eu-email').value.trim(),whatsapp:document.getElementById('eu-whats').value.trim(),senha:document.getElementById('eu-senha').value.trim(),nivel:document.getElementById('eu-nivel').value,setor:document.getElementById('eu-setor').value});
  if(res.erro){alert(res.erro);return;}fecharModal();carregarUsuarios();mostrarToast('✅ Atualizado','Usuário atualizado com sucesso.');
}
function confirmarExcluirUser(id,nome){
  if(id===ME.id){alert('Não pode excluir o usuário logado.');return;}
  document.getElementById('modal-content').innerHTML=`<h3><i class="ti ti-alert-triangle" style="color:var(--red)"></i> Confirmar exclusão</h3>
    <div style="font-size:14px;color:var(--text2);margin-bottom:16px;line-height:1.6">Deseja excluir <strong>${nome}</strong>? Tarefas abertas serão transferidas para o Gerente.</div>
    <div class="mfooter"><button class="btn-cancel" onclick="fecharModal()">Cancelar</button><button class="btn-danger" onclick="excluirUser(${id})"><i class="ti ti-trash"></i> Excluir</button></div>`;
  document.getElementById('modal-bg').classList.add('open');
}
async function excluirUser(id){await api('usuarios.php',{acao:'excluir',id});fecharModal();carregarUsuarios();}

// ══ CHAT MSN ══
let chatLastMsg='';
let chatPrivadoLastMsg='';
let chatAtual='geral'; // 'geral' ou user id
let usuariosChat=[];

async function carregarChat(){
  // Carrega usuários para lista de contatos
  usuariosChat=await api('usuarios.php');
  renderContatosChat();
  // Abre geral por padrão
  await abrirChat('geral', document.getElementById('contact-geral'));
  const b=document.getElementById('badge-chat');b.textContent='0';b.style.display='none';
}

function renderContatosChat(){
  const lista=document.getElementById('contatos-list');
  if(!lista) return;
  lista.innerHTML=usuariosChat.filter(u=>u.id!=ME.id).map(u=>{
    const ini=u.nome.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
    const colors=['#F26522','#378ADD','#7F77DD','#1D9E75','#EF9F27','#E24B4A'];
    const cor=colors[u.id%colors.length];
    return`<button class="chat-contact" id="contact-${u.id}" onclick="abrirChat(${u.id},this)">
      <div class="contact-av" style="background:${cor}">${ini}</div>
      <div class="contact-info">
        <div class="contact-name">${u.nome.split(' ')[0]}</div>
        <div class="contact-sub" id="last-priv-${u.id}">${u.nivel}</div>
      </div>
      <span class="contact-badge" id="badge-priv-${u.id}" style="display:none">0</span>
    </button>`;
  }).join('');
}

async function abrirChat(destino, el){
  chatAtual=destino;
  document.querySelectorAll('.chat-contact').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');

  const header_av=document.getElementById('chat-av');
  const header_nome=document.getElementById('chat-nome');
  const header_sub=document.getElementById('chat-sub');

  if(destino==='geral'){
    header_av.innerHTML='<i class="ti ti-users" style="font-size:14px;color:white"></i>';
    header_av.style.background='var(--accent)';
    header_nome.textContent='Chat Geral';
    header_sub.textContent='Todos os usuários';
    await carregarMsgsGeral();
  } else {
    const u=usuariosChat.find(x=>x.id==destino);
    if(u){
      const ini=u.nome.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
      const colors=['#F26522','#378ADD','#7F77DD','#1D9E75','#EF9F27','#E24B4A'];
      header_av.innerHTML=ini;
      header_av.style.background=colors[u.id%colors.length];
      header_nome.textContent=u.nome.split(' ')[0];
      header_sub.textContent=u.nivel;
    }
    await carregarMsgsPrivado(destino);
    // Zera badge
    const b=document.getElementById('badge-priv-'+destino);
    if(b){b.textContent='0';b.style.display='none';}
  }
}

async function carregarMsgsGeral(){
  const msgs=await api('chat.php');
  chatLastMsg=msgs.length?msgs[msgs.length-1].criado_em:'';
  renderChatMsgs(msgs,'geral');
  api('chat.php',{acao:'limpar_unread'});
}

async function carregarMsgsPrivado(userId){
  const msgs=await api('chat_privado.php?com='+userId);
  chatPrivadoLastMsg=msgs.length?msgs[msgs.length-1].criado_em:'';
  renderChatMsgs(msgs,'priv');
}

async function carregarChatSince(){
  if(!chatAberto) return;
  if(chatAtual==='geral'){
    const since=chatLastMsg||new Date(Date.now()-5000).toISOString().slice(0,19).replace('T',' ');
    const msgs=await api('chat.php?since='+encodeURIComponent(since));
    if(msgs&&msgs.length>0){
      const cont=document.getElementById('chat-msgs');if(!cont)return;
      msgs.forEach(m=>{
        const mine=m.usuario_id==ME.id;
        const el=document.createElement('div');
        el.className='chat-msg '+(mine?'mine':'other');
        el.innerHTML=`<div class="chat-msg-who">${nomeSetor(m.nome,m.setor)}</div><div class="chat-bubble">${m.mensagem}</div><div class="chat-time">${(m.criado_em||'').substr(11,5)}</div>`;
        cont.appendChild(el);
        chatLastMsg=m.criado_em;
      });
      cont.scrollTop=cont.scrollHeight;
    }
  } else {
    const since=chatPrivadoLastMsg||new Date(Date.now()-5000).toISOString().slice(0,19).replace('T',' ');
    const msgs=await api('chat_privado.php?com='+chatAtual+'&since='+encodeURIComponent(since));
    if(msgs&&msgs.length>0){
      const cont=document.getElementById('chat-msgs');if(!cont)return;
      msgs.forEach(m=>{
        const mine=m.de_id==ME.id;
        const el=document.createElement('div');
        el.className='chat-msg '+(mine?'mine':'other');
        el.innerHTML=`<div class="chat-msg-who">${(m.nome||'').split(' ')[0]}</div><div class="chat-bubble">${m.mensagem}</div><div class="chat-time">${(m.criado_em||'').substr(11,5)}</div>`;
        cont.appendChild(el);
        chatPrivadoLastMsg=m.criado_em;
      });
      cont.scrollTop=cont.scrollHeight;
    }
  }
}

function renderChatMsgs(msgs, tipo){
  const cont=document.getElementById('chat-msgs');if(!cont)return;
  cont.innerHTML=msgs.length?msgs.map(m=>{
    const mine=tipo==='priv'?(m.de_id==ME.id):(m.usuario_id==ME.id);
    const nome=tipo==='priv'?(m.nome||'').split(' ')[0]:nomeSetor(m.nome,m.setor);
    return`<div class="chat-msg ${mine?'mine':'other'}"><div class="chat-msg-who">${nome}</div><div class="chat-bubble">${m.mensagem}</div><div class="chat-time">${(m.criado_em||'').substr(11,5)}</div></div>`;
  }).join(''):'<div style="text-align:center;font-size:14px;color:var(--text3);padding:40px 0"><i class="ti ti-message" style="font-size:32px;display:block;margin-bottom:8px;opacity:.3"></i>Nenhuma mensagem ainda</div>';
  cont.scrollTop=cont.scrollHeight;
}

async function enviarChatAtual(){
  const inp=document.getElementById('chat-input');
  if(!inp.value.trim()) return;
  const msg=inp.value.trim(); inp.value='';
  if(chatAtual==='geral'){
    await api('chat.php',{mensagem:msg});
  } else {
    await api('chat_privado.php',{para_id:chatAtual,mensagem:msg});
  }
  await carregarChatSince();
}

// Keep old enviarChat for compatibility
async function enviarChat(){await enviarChatAtual();}

// Update poll to check private messages
async function atualizarBadgesPrivados(){
  try{
    const counts=await api('chat_privado.php',{acao:'unread_counts'});
    let totalPriv=0;
    Object.entries(counts).forEach(([uid,qtd])=>{
      const b=document.getElementById('badge-priv-'+uid);
      if(b){b.textContent=qtd;b.style.display=qtd>0?'inline':'none';}
      totalPriv+=qtd;
    });
    // Update main chat badge
    const totalChat=(parseInt(document.getElementById('badge-chat').textContent)||0);
    if(totalPriv>0){
      const b=document.getElementById('badge-chat');
      b.textContent=totalPriv;b.style.display='inline';
    }
  }catch(e){}
}

// ══ CONFIGURAÇÕES ══
async function carregarConfiguracoes(){
  const tipos=await api('configuracoes.php');
  const sl={Financeiro:'s-fin',Gerente:'s-ger',Direcao:'s-dir',Administrativo:'s-adm'};
  document.getElementById('tipos-list').innerHTML=tipos.map(t=>`
    <div class="tipo-row">
      <div class="tipo-nome">${t.nome}</div>
      <span class="tipo-setor kcard-setor ${sl[t.setor]||'s-adm'}">${SETOR_L[t.setor]||t.setor}</span>
      <button class="icon-btn danger" onclick="excluirTipo(${t.id},'${t.nome}')" title="Excluir"><i class="ti ti-trash"></i></button>
    </div>`).join('');
}
async function excluirTipo(id,nome){
  if(!confirm(`Excluir o tipo "${nome}"?`))return;
  const res=await api('configuracoes.php',{acao:'excluir',id});
  if(res.erro){alert(res.erro);return;}
  carregarConfiguracoes();carregarTipos();
}

// ══ LOCALIZAR ══
function buscar(){
  const al=document.getElementById('s-aluno').value.toLowerCase();
  const ai=document.getElementById('s-alunoId').value.toLowerCase();
  const st=document.getElementById('s-setor').value;
  const status=document.getElementById('s-status').value;
  const cr=document.getElementById('s-criador').value.toLowerCase();
  const dataIni=document.getElementById('s-data-ini').value;
  const dataFim=document.getElementById('s-data-fim').value;
  // Sempre inclui concluídas na busca (pool completo)
  const pool=[...tarefas,...tarefasConcluidas.filter(t=>!tarefas.find(x=>x.id==t.id))];
  const res=pool.filter(t=>{
    if(al&&!(t.nome_aluno||'').toLowerCase().includes(al))return false;
    if(ai&&!(t.id_aluno||'').toLowerCase().includes(ai))return false;
    if(st&&t.setor_responsavel!==st)return false;
    if(status&&t.status!==status)return false;
    if(cr&&!(t.criador_nome||'').toLowerCase().includes(cr))return false;
    if(dataIni&&(t.criado_em||'')<dataIni)return false;
    if(dataFim&&(t.criado_em||'')>dataFim+' 23:59:59')return false;
    return true;
  });
  document.getElementById('search-results').innerHTML=res.length?res.map(t=>`<div class="result-card" onclick="abrirTarefa(${t.id},true)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:14px;font-weight:600">${t.codigo} — ${t.tipo}</span><span style="font-size:12px;padding:3px 10px;border-radius:8px;background:${STATUS_C[t.status]};color:white">${STATUS_L[t.status]}</span></div>${t.nome_aluno?`<div style="font-size:13px;color:var(--text3);margin-bottom:5px"><i class="ti ti-user" style="font-size:12px"></i> ${t.nome_aluno}${t.id_aluno?' · '+t.id_aluno:''}</div>`:''}<div style="display:flex;gap:8px"><span class="kcard-setor ${SETOR_CL[t.setor_responsavel]||'s-adm'}">${SETOR_L[t.setor_responsavel]||t.setor_responsavel}</span><span style="font-size:12px;color:var(--text3)">Por: ${(t.criador_nome||'').split(' ')[0]}</span><span style="font-size:12px;color:var(--text3)">${(t.criado_em||'').substr(0,10)}</span></div></div>`).join(''):'<div style="font-size:14px;color:var(--text3);text-align:center;padding:30px">Nenhum resultado.</div>';
}

// ══ NOTIFICAÇÕES ══
async function toggleNotif(){
  const p=document.getElementById('notif-panel');p.classList.toggle('open');
  if(p.classList.contains('open')){
    const notifs=await api('notificacoes.php');
    document.getElementById('notif-list').innerHTML=notifs.length?notifs.map(n=>`<div style="padding:9px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2)">${n.mensagem}<div style="font-size:11px;color:var(--text3);margin-top:2px">${(n.criado_em||'').substr(11,5)}</div></div>`).join(''):'<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px">Nenhuma notificação</div>';
    document.getElementById('notif-dot').style.display='none';
    await api('notificacoes.php',{acao:'marcar_lidas'});
  }
}
document.addEventListener('click',e=>{const p=document.getElementById('notif-panel');if(p.classList.contains('open')&&!p.contains(e.target)&&!e.target.closest('.notif-btn'))p.classList.remove('open');});

// ══ MODAL ══
function abrirModal(tipo){
  const mc=document.getElementById('modal-content');
  if(tipo==='ocorrencia'){
    mc.innerHTML=`<h3><i class="ti ti-clipboard-plus"></i> Nova ocorrência</h3>
      <div class="field"><label>Tipo</label><div class="select-new"><select id="f-tipo" onchange="autoSetor()">${tiposList.map(t=>`<option>${t}</option>`).join('')}</select><button class="btn-add-tipo" onclick="abrirModal('novo-tipo')"><i class="ti ti-plus"></i> Novo</button></div></div>
      <div class="field"><label>Nome do aluno</label><input type="text" id="f-aluno" placeholder="Nome completo"></div>
      <div class="field"><label>ID do aluno</label><input type="text" id="f-alunoId" placeholder="Ex: A001"></div>
      <div class="field"><label>Descrição</label><textarea id="f-desc" placeholder="Descreva a ocorrência..."></textarea></div>
      <div class="field"><label>Imagem (opcional)</label>
        <div class="img-upload-area" id="img-upload-area">
          <input type="file" id="f-imagem" accept="image/*" capture="environment" onchange="previewImagem(this)">
          <i class="ti ti-camera" style="font-size:24px;color:var(--text3);display:block;margin-bottom:6px"></i>
          <div style="font-size:13px;color:var(--text3)">Toque para fotografar ou selecionar</div>
          <img id="img-preview" class="img-preview" style="display:none">
        </div>
      </div>
      <div class="field"><label>Setor responsável</label><select id="f-setor">${setoresList.filter(s=>s!==ME.setor).map(s=>`<option value="${s}">${SETOR_L[s]||s}</option>`).join('')}</select></div>
      <div class="field"><label>Prioridade</label><select id="f-prio"><option value="alta">Alta</option><option value="media" selected>Média</option><option value="baixa">Baixa</option></select></div>
      <div class="mfooter"><button class="btn-cancel" onclick="fecharModal()">Cancelar</button><button class="btn-ok" onclick="criarOcorrencia()">Registrar</button></div>`;
    autoSetor();
  }else if(tipo==='usuario'){
    mc.innerHTML=`<h3><i class="ti ti-user-plus"></i> Novo usuário</h3>
      <div class="field"><label>Nome</label><input type="text" id="u-nome" placeholder="Nome completo"></div>
      <div class="field"><label>E-mail (login)</label><input type="email" id="u-email" placeholder="email@exemplo.com"></div>
      <div class="field"><label>WhatsApp</label><input type="text" id="u-whats" placeholder="48999999999"></div>
      <div class="field"><label>Senha inicial</label><input type="password" id="u-senha" placeholder="••••••••"></div>
      <div class="field"><label>Nível</label><select id="u-nivel"><option value="gestor">Gestor</option><option value="gerente">Gerente</option><option value="colaborador" selected>Colaborador</option></select></div>
      <div class="field"><label>Setor</label><select id="u-setor"><option value="Direcao">Direção</option><option value="Gerente">Gerente</option><option value="Financeiro">Financeiro</option><option value="Administrativo" selected>Administrativo</option></select></div>
      <div class="mfooter"><button class="btn-cancel" onclick="fecharModal()">Cancelar</button><button class="btn-ok" onclick="criarUsuario()">Cadastrar</button></div>`;
  }else if(tipo==='novo-tipo'||tipo==='novo-tipo-config'){
    mc.innerHTML=`<h3><i class="ti ti-tag"></i> Novo tipo</h3>
      <div class="field"><label>Nome do tipo</label><input type="text" id="nt-nome" placeholder="Ex: Troca de plano"></div>
      <div class="field"><label>Setor padrão</label><select id="nt-setor"><option value="Financeiro">Financeiro</option><option value="Gerente">Gerente</option><option value="Direcao">Direção</option><option value="Administrativo">Administrativo</option></select></div>
      <div class="mfooter"><button class="btn-cancel" onclick="${tipo==='novo-tipo'?'abrirModal(\'ocorrencia\')':'fecharModal()'}">Voltar</button><button class="btn-ok" onclick="salvarTipo('${tipo}')">Criar tipo</button></div>`;
  }
  document.getElementById('modal-bg').classList.add('open');
}

function previewImagem(input){
  const prev=document.getElementById('img-preview');
  if(input.files&&input.files[0]){
    const reader=new FileReader();
    reader.onload=e=>{prev.src=e.target.result;prev.style.display='block';};
    reader.readAsDataURL(input.files[0]);
  }
}

function fecharModal(){document.getElementById('modal-bg').classList.remove('open');}
function autoSetor(){const t=document.getElementById('f-tipo');const s=document.getElementById('f-setor');if(t&&s&&TIPO_SETOR_MAP[t.value])s.value=TIPO_SETOR_MAP[t.value];}

async function salvarTipo(origem){
  const n=document.getElementById('nt-nome').value.trim();const s=document.getElementById('nt-setor').value;
  if(!n){alert('Digite o nome.');return;}
  if(tiposList.map(t=>t.toLowerCase()).includes(n.toLowerCase())){alert('Este tipo já existe!');return;}
  await api('tipos.php',{acao:'criar',nome:n,setor:s});tiposList.push(n);
  if(origem==='novo-tipo-config'){fecharModal();carregarConfiguracoes();}else abrirModal('ocorrencia');
}

async function criarOcorrencia(){
  const tipo=document.getElementById('f-tipo').value;
  const desc=document.getElementById('f-desc').value.trim();
  if(!desc){alert('Preencha a descrição.');return;}
  const res=await api('ocorrencias.php',{acao:'criar',tipo,descricao:desc,nome_aluno:document.getElementById('f-aluno').value.trim(),id_aluno:document.getElementById('f-alunoId').value.trim(),setor:document.getElementById('f-setor').value,prioridade:document.getElementById('f-prio').value});
  // Upload imagem se houver
  const imgFile=document.getElementById('f-imagem')?.files[0];
  if(imgFile&&res.ok&&res.id){
    const fd=new FormData();fd.append('imagem',imgFile);fd.append('ocorrencia_id',res.id);
    await fetch('api/upload.php',{method:'POST',body:fd});
  }
  fecharModal();await carregarTarefas();
}

async function criarUsuario(){
  const nome=document.getElementById('u-nome').value.trim();const email=document.getElementById('u-email').value.trim();
  if(!nome||!email){alert('Preencha nome e e-mail.');return;}
  const senha=document.getElementById('u-senha').value.trim();
  if(!senha){alert('Informe uma senha para o novo usuário.');return;}
  const res=await api('usuarios.php',{acao:'criar',nome,email,whatsapp:document.getElementById('u-whats').value.trim(),senha,nivel:document.getElementById('u-nivel').value,setor:document.getElementById('u-setor').value});
  if(res.erro){alert(res.erro);return;}fecharModal();carregarUsuarios();
}

// ══ POPUP TIPOS ══
async function abrirTiposPopup(){
  const tipos=await api('configuracoes.php');
  const sl={Financeiro:'s-fin',Gerente:'s-ger',Direcao:'s-dir',Administrativo:'s-adm'};
  const mc=document.getElementById('modal-content');
  mc.innerHTML=`<h3><i class="ti ti-tag"></i> Tipos de ocorrência</h3>
    <div id="tipos-popup-list" style="margin-bottom:16px">
      ${tipos.map(t=>`<div class="tipo-row"><div class="tipo-nome">${t.nome}</div><span class="tipo-setor kcard-setor ${sl[t.setor]||'s-adm'}">${SETOR_L[t.setor]||t.setor}</span><button class="icon-btn danger" onclick="excluirTipoPopup(${t.id},'${t.nome.replace(/'/g,"\\'")}')" title="Excluir"><i class="ti ti-trash"></i></button></div>`).join('')||'<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px">Nenhum tipo cadastrado</div>'}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:14px">
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:10px">Novo tipo</div>
      <div class="field"><label>Nome</label><input type="text" id="nt2-nome" placeholder="Ex: Troca de plano"></div>
      <div class="field"><label>Setor padrão</label><select id="nt2-setor"><option value="Financeiro">Financeiro</option><option value="Gerente">Gerente</option><option value="Direcao">Direção</option><option value="Administrativo">Administrativo</option></select></div>
      <button class="btn-ok" onclick="criarTipoPopup()"><i class="ti ti-plus"></i> Criar tipo</button>
    </div>
    <div class="mfooter"><button class="btn-ok" style="margin-left:auto" onclick="fecharModal()">Fechar</button></div>`;
  document.getElementById('modal-bg').classList.add('open');
}
async function criarTipoPopup(){
  const n=document.getElementById('nt2-nome').value.trim();
  const s=document.getElementById('nt2-setor').value;
  if(!n){alert('Digite o nome do tipo.');return;}
  const res=await api('configuracoes.php',{acao:'criar',nome:n,setor:s});
  if(res.erro){alert(res.erro);return;}
  await carregarTipos();
  abrirTiposPopup();
}
async function excluirTipoPopup(id,nome){
  if(!confirm(`Excluir o tipo "${nome}"?`))return;
  const res=await api('configuracoes.php',{acao:'excluir',id});
  if(res.erro){alert(res.erro);return;}
  await carregarTipos();
  abrirTiposPopup();
}

// ══ POPUP SETORES ══
async function abrirSetoresPopup(){
  const setores=await api('configuracoes.php?tipo=setores');
  const mc=document.getElementById('modal-content');
  mc.innerHTML=`<h3><i class="ti ti-building"></i> Setores</h3>
    <div style="margin-bottom:16px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:10px">Setores padrão do sistema: Financeiro, Gerente, Direção, Administrativo</div>
      ${setores.map(s=>`<div class="tipo-row"><div class="tipo-nome">${s.nome}</div><button class="icon-btn danger" onclick="excluirSetorPopup(${s.id},'${s.nome.replace(/'/g,"\\'")}')" title="Excluir"><i class="ti ti-trash"></i></button></div>`).join('')||'<div style="font-size:13px;color:var(--text3);padding:8px 0">Nenhum setor adicional cadastrado</div>'}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:14px">
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:10px">Novo setor</div>
      <div class="field"><label>Nome do setor</label><input type="text" id="ns-nome" placeholder="Ex: Recepção"></div>
      <button class="btn-ok" onclick="criarSetorPopup()"><i class="ti ti-plus"></i> Criar setor</button>
    </div>
    <div class="mfooter"><button class="btn-ok" style="margin-left:auto" onclick="fecharModal()">Fechar</button></div>`;
  document.getElementById('modal-bg').classList.add('open');
}
async function criarSetorPopup(){
  const n=document.getElementById('ns-nome').value.trim();
  if(!n){alert('Digite o nome do setor.');return;}
  const res=await api('configuracoes.php',{acao:'criar_setor',nome:n});
  if(res.erro){alert(res.erro);return;}
  await carregarSetores();
  abrirSetoresPopup();
}
async function excluirSetorPopup(id,nome){
  if(!confirm(`Excluir o setor "${nome}"?`))return;
  await api('configuracoes.php',{acao:'excluir_setor',id});
  await carregarSetores();
  abrirSetoresPopup();
}

// ══ SETORES DINÂMICOS ══
async function carregarSetores(){
  try{
    const extras=await api('configuracoes.php?tipo=setores');
    extras.forEach(s=>{
      if(!setoresList.includes(s.nome)){
        setoresList.push(s.nome);
        SETOR_L[s.nome]=s.nome;
        SETOR_CL[s.nome]='s-adm';
      }
    });
  }catch(e){}
}

function renderAll(){renderMetrics();renderCharts();}
function toggleConfig(tipo){
  if(tipo==='som'){
    userConfig.som_ativo=userConfig.som_ativo?0:1;
    document.getElementById('toggle-som').style.background=userConfig.som_ativo?'var(--accent)':'var(--surface3)';
    document.getElementById('toggle-som-ball').style.transform=userConfig.som_ativo?'translateX(20px)':'translateX(0)';
  } else {
    userConfig.notif_ativa=userConfig.notif_ativa?0:1;
    document.getElementById('toggle-notif').style.background=userConfig.notif_ativa?'var(--accent)':'var(--surface3)';
    document.getElementById('toggle-notif-ball').style.transform=userConfig.notif_ativa?'translateX(20px)':'translateX(0)';
  }
  api('config_usuario.php',{som_ativo:userConfig.som_ativo,notif_ativa:userConfig.notif_ativa});
}
function aplicarConfig(){
  ['som','notif'].forEach(t=>{
    const ativo=t==='som'?userConfig.som_ativo:userConfig.notif_ativa;
    const el=document.getElementById('toggle-'+t);
    const ball=document.getElementById('toggle-'+t+'-ball');
    if(el)el.style.background=ativo?'var(--accent)':'var(--surface3)';
    if(ball)ball.style.transform=ativo?'translateX(20px)':'translateX(0)';
  });
}

// Add filter for relatorio por periodo
function filtrarRelatorio(){
  const di=document.getElementById('rel-data-inicio')?.value;
  const df=document.getElementById('rel-data-fim')?.value;
  renderRelatorio(di,df);
}

(async()=>{
  await carregarTipos();
  await carregarSetores();
  await carregarTarefas();
  try{const cfg=await api('config_usuario.php');if(cfg){userConfig=cfg;aplicarConfig();}}catch(e){}
})();
</script>
</body>
</html>
