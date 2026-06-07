<?php
require '../auth.php';
require '../conexao.php';
header('Content-Type: application/json');

if($_SERVER['REQUEST_METHOD']==='GET'){
  echo json_encode($pdo->query("SELECT * FROM tipos_ocorrencia ORDER BY nome")->fetchAll());
} elseif($_SERVER['REQUEST_METHOD']==='POST'){
  $d=json_decode(file_get_contents('php://input'),true);
  if($d['acao']==='criar'){
    if($pdo->prepare("SELECT id FROM tipos_ocorrencia WHERE LOWER(nome)=LOWER(?)")->execute([$d['nome']])&&$pdo->query("SELECT id FROM tipos_ocorrencia WHERE LOWER(nome)=LOWER('{$d['nome']}')")->fetch()){echo json_encode(['erro'=>'Tipo já existe.']);exit;}
    $pdo->prepare("INSERT INTO tipos_ocorrencia (nome,setor) VALUES (?,?)")->execute([$d['nome'],$d['setor']]);
    echo json_encode(['ok'=>true]);
  }
}
