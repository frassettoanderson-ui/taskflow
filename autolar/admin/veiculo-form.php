<?php
require __DIR__ . '/auth-check.php';

$id = input_int('id', 0);
$editando = $id > 0;

$difsPadrao = ['Único dono','4x4','7 lugares','Teto solar','Couro','Multimídia','Blindado','Garantia de fábrica'];
$cambios = ['manual','automatico','automatizado','cvt'];
$combs   = ['flex','gasolina','diesel','eletrico','hibrido','gnv'];
$cats    = ['hatch','sedan','suv','picape','eletrico','utilitario','cupe','outro'];
$status  = ['disponivel','reservado','vendido'];

/* ----------------------------- SALVAR ----------------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_validar()) { flash_set('err', 'Sessão expirada. Tente novamente.'); redirecionar('admin/veiculo-form.php' . ($editando ? "?id=$id" : '')); }

    $marca  = input_str('marca');
    $modelo = input_str('modelo');
    $ano    = input_int('ano');
    $preco  = input_moeda('preco');
    $erros = [];
    if ($marca === '')  $erros[] = 'Informe a marca.';
    if ($modelo === '') $erros[] = 'Informe o modelo.';
    if (!$ano)          $erros[] = 'Informe o ano.';
    if ($preco === null) $erros[] = 'Informe o preço.';

    if ($erros) {
        flash_set('err', implode(' ', $erros));
    } else {
        $dados = [
            'marca'       => $marca,
            'modelo'      => $modelo,
            'versao'      => input_str('versao') ?: null,
            'ano'         => $ano,
            'ano_modelo'  => input_int('ano_modelo'),
            'preco'       => $preco,
            'km'          => input_int('km', 0),
            'cambio'      => input_enum('cambio', $cambios, 'manual'),
            'combustivel' => input_enum('combustivel', $combs, 'flex'),
            'cor'         => input_str('cor') ?: null,
            'portas'      => input_int('portas'),
            'categoria'   => input_enum('categoria', $cats, 'outro'),
            'descricao'   => input_str('descricao') ?: null,
            'destaque'    => isset($_POST['destaque']) ? 1 : 0,
            'ativo'       => isset($_POST['ativo']) ? 1 : 0,
            'status'      => input_enum('status', $status, 'disponivel'),
        ];

        if ($editando) {
            $sql = 'UPDATE veiculos SET marca=?,modelo=?,versao=?,ano=?,ano_modelo=?,preco=?,km=?,cambio=?,combustivel=?,cor=?,portas=?,categoria=?,descricao=?,destaque=?,ativo=?,status=? WHERE id=?';
            $pdo->prepare($sql)->execute([...array_values($dados), $id]);
        } else {
            $cols = implode(',', array_keys($dados));
            $ph = implode(',', array_fill(0, count($dados), '?'));
            $pdo->prepare("INSERT INTO veiculos ($cols) VALUES ($ph)")->execute(array_values($dados));
            $id = (int)$pdo->lastInsertId();
        }

        // Diferenciais
        $pdo->prepare('DELETE FROM veiculo_diferenciais WHERE veiculo_id=?')->execute([$id]);
        $difs = $_POST['dif'] ?? [];
        if (!is_array($difs)) $difs = [];
        foreach (explode(',', input_str('dif_custom')) as $c) { $c = trim($c); if ($c !== '') $difs[] = $c; }
        $difs = array_unique(array_filter(array_map('trim', $difs)));
        if ($difs) {
            $ins = $pdo->prepare('INSERT INTO veiculo_diferenciais (veiculo_id, nome) VALUES (?,?)');
            foreach ($difs as $d) $ins->execute([$id, mb_substr($d, 0, 80)]);
        }

        // Remover imagens marcadas
        $remover = $_POST['remover'] ?? [];
        if (is_array($remover) && $remover) {
            $in = implode(',', array_fill(0, count($remover), '?'));
            $sel = $pdo->prepare("SELECT id, arquivo FROM veiculo_imagens WHERE veiculo_id=? AND id IN ($in)");
            $sel->execute([$id, ...array_map('intval', $remover)]);
            foreach ($sel->fetchAll() as $img) excluir_arquivo_imagem($img['arquivo'], 'veiculos');
            $pdo->prepare("DELETE FROM veiculo_imagens WHERE veiculo_id=? AND id IN ($in)")->execute([$id, ...array_map('intval', $remover)]);
        }

        // Reordenar existentes
        $ordens = $_POST['ordem'] ?? [];
        if (is_array($ordens)) {
            $upd = $pdo->prepare('UPDATE veiculo_imagens SET ordem=? WHERE id=? AND veiculo_id=?');
            foreach ($ordens as $imgId => $o) $upd->execute([(int)$o, (int)$imgId, $id]);
        }

        // Novas imagens
        $up = processar_uploads('fotos', 'veiculos');
        if ($up['erros']) flash_set('info', implode(' ', $up['erros']));
        if ($up['salvos']) {
            $maxOrdem = (int)$pdo->query("SELECT COALESCE(MAX(ordem),0) FROM veiculo_imagens WHERE veiculo_id=$id")->fetchColumn();
            $ins = $pdo->prepare('INSERT INTO veiculo_imagens (veiculo_id, arquivo, ordem, capa) VALUES (?,?,?,0)');
            foreach ($up['salvos'] as $arq) $ins->execute([$id, $arq, ++$maxOrdem]);
        }

        // Capa
        $capa = input_int('capa');
        if ($capa) {
            $pdo->prepare('UPDATE veiculo_imagens SET capa=0 WHERE veiculo_id=?')->execute([$id]);
            $pdo->prepare('UPDATE veiculo_imagens SET capa=1 WHERE id=? AND veiculo_id=?')->execute([$capa, $id]);
        }
        garantir_capa($pdo, 'veiculo_imagens', 'veiculo_id', $id);

        flash_set('ok', $editando ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.');
        redirecionar('admin/veiculos.php');
    }
}

/* ----------------------------- CARREGAR --------------------------------- */
$v = [
    'marca'=>'','modelo'=>'','versao'=>'','ano'=>'','ano_modelo'=>'','preco'=>'','km'=>'',
    'cambio'=>'manual','combustivel'=>'flex','cor'=>'','portas'=>'','categoria'=>'outro',
    'descricao'=>'','destaque'=>0,'ativo'=>1,'status'=>'disponivel',
];
$imagens = []; $difSelec = [];
if ($editando) {
    $st = $pdo->prepare('SELECT * FROM veiculos WHERE id=?');
    $st->execute([$id]);
    $found = $st->fetch();
    if (!$found) { flash_set('err', 'Veículo não encontrado.'); redirecionar('admin/veiculos.php'); }
    $v = $found;
    $imagens = imagens_do_registro($pdo, 'veiculo_imagens', 'veiculo_id', $id);
    $difSelec = diferenciais_do_registro($pdo, 'veiculo_diferenciais', 'veiculo_id', $id);
}

$admin_titulo = $editando ? 'Editar veículo' : 'Novo veículo';
$admin_atual = 'veiculos';
$admin_action = '<a class="btn btn-ghost" href="' . e(url('admin/veiculos.php')) . '">← Voltar</a>';
include __DIR__ . '/includes/admin-header.php';
?>

<form method="post" enctype="multipart/form-data" action="<?= e(url('admin/veiculo-form.php' . ($editando ? "?id=$id" : ''))) ?>">
  <?= csrf_field() ?>
  <div class="form-grid">
    <div>
      <div class="form-section">
        <h3>Dados do veículo</h3>
        <div class="grid-2">
          <div class="field"><label>Marca *</label><input name="marca" value="<?= e($v['marca']) ?>" required></div>
          <div class="field"><label>Modelo *</label><input name="modelo" value="<?= e($v['modelo']) ?>" required></div>
        </div>
        <div class="field"><label>Versão</label><input name="versao" value="<?= e($v['versao']) ?>" placeholder="Ex.: 1.0 TGDI Platinum"></div>
        <div class="grid-3">
          <div class="field"><label>Ano *</label><input type="number" name="ano" value="<?= e($v['ano']) ?>" required></div>
          <div class="field"><label>Ano modelo</label><input type="number" name="ano_modelo" value="<?= e($v['ano_modelo']) ?>"></div>
          <div class="field"><label>Preço (R$) *</label><input data-mask="money" inputmode="numeric" name="preco" value="<?= $v['preco'] !== '' ? e(number_format((float)$v['preco'],0,',','.')) : '' ?>" required></div>
        </div>
      </div>

      <div class="form-section">
        <h3>Detalhes</h3>
        <div class="grid-3">
          <div class="field"><label>Quilometragem</label><input type="number" name="km" value="<?= e($v['km']) ?>"></div>
          <div class="field"><label>Câmbio</label><select name="cambio"><?php foreach ($cambios as $c): ?><option value="<?= $c ?>" <?= $v['cambio']===$c?'selected':'' ?>><?= e(rotulo_cambio($c)) ?></option><?php endforeach; ?></select></div>
          <div class="field"><label>Combustível</label><select name="combustivel"><?php foreach ($combs as $c): ?><option value="<?= $c ?>" <?= $v['combustivel']===$c?'selected':'' ?>><?= e(rotulo_combustivel($c)) ?></option><?php endforeach; ?></select></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Cor</label><input name="cor" value="<?= e($v['cor']) ?>"></div>
          <div class="field"><label>Portas</label><input type="number" name="portas" value="<?= e($v['portas']) ?>"></div>
          <div class="field"><label>Categoria</label><select name="categoria"><?php foreach ($cats as $c): ?><option value="<?= $c ?>" <?= $v['categoria']===$c?'selected':'' ?>><?= e(rotulo_categoria_veic($c)) ?></option><?php endforeach; ?></select></div>
        </div>
      </div>

      <div class="form-section">
        <h3>Diferenciais</h3>
        <div class="check-grid">
          <?php foreach ($difsPadrao as $d): ?>
            <label class="chk"><input type="checkbox" name="dif[]" value="<?= e($d) ?>" <?= in_array($d, $difSelec, true)?'checked':'' ?>> <?= e($d) ?></label>
          <?php endforeach; ?>
        </div>
        <div class="field" style="margin-top:1rem"><label>Outros (separados por vírgula)</label>
          <input name="dif_custom" placeholder="Ex.: Som premium, Rodas de liga"
            value="<?= e(implode(', ', array_values(array_diff($difSelec, $difsPadrao)))) ?>"></div>
      </div>

      <div class="form-section">
        <h3>Descrição</h3>
        <div class="field"><textarea name="descricao" placeholder="Detalhes, estado de conservação, opcionais…"><?= e($v['descricao']) ?></textarea></div>
      </div>

      <div class="form-section">
        <h3>Fotos</h3>
        <?php if ($imagens): ?>
          <div class="img-manager">
            <?php foreach ($imagens as $img): ?>
              <div class="img-item <?= $img['capa']?'cover':'' ?>">
                <?php if ($img['capa']): ?><span class="cover-tag">Capa</span><?php endif; ?>
                <img src="<?= e(imagem_url($img['arquivo'], 'veiculos')) ?>" alt="">
                <div class="bar">
                  <label title="Definir como capa"><input type="radio" name="capa" value="<?= (int)$img['id'] ?>" <?= $img['capa']?'checked':'' ?>> Capa</label>
                  <input type="number" name="ordem[<?= (int)$img['id'] ?>]" value="<?= (int)$img['ordem'] ?>" style="width:48px;padding:.2rem" title="Ordem">
                </div>
                <div class="bar" style="border-top:1px solid var(--line)">
                  <label style="color:var(--red)"><input type="checkbox" name="remover[]" value="<?= (int)$img['id'] ?>"> Remover</label>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
        <?php else: ?>
          <p style="color:var(--slate-500);font-size:.88rem;margin-bottom:.8rem">Nenhuma foto ainda. Adicione abaixo.</p>
        <?php endif; ?>

        <div class="dropzone" style="margin-top:1rem">
          Selecione uma ou mais imagens (JPG, PNG ou WEBP — até <?= (int)(UPLOAD_MAX_BYTES/1024/1024) ?>MB cada)
          <input type="file" id="fotos" name="fotos[]" accept="image/*" multiple>
        </div>
        <div id="preview"></div>
      </div>
    </div>

    <!-- Sidebar publicação -->
    <aside>
      <div class="form-section" style="position:sticky;top:1rem">
        <h3>Publicação</h3>
        <div class="field"><label>Status</label>
          <select name="status"><?php foreach ($status as $s): ?><option value="<?= $s ?>" <?= $v['status']===$s?'selected':'' ?>><?= e(rotulo_status_veic($s)) ?></option><?php endforeach; ?></select>
        </div>
        <div class="switch-row">
          <span>Em destaque</span>
          <label class="switch"><input type="checkbox" name="destaque" <?= $v['destaque']?'checked':'' ?>><span class="sl"></span></label>
        </div>
        <div class="switch-row">
          <span>Ativo (visível no site)</span>
          <label class="switch"><input type="checkbox" name="ativo" <?= $v['ativo']?'checked':'' ?>><span class="sl"></span></label>
        </div>
        <button class="btn btn-gold btn-block" style="margin-top:1.2rem" type="submit"><?= $editando?'Salvar alterações':'Cadastrar veículo' ?></button>
        <a class="btn btn-ghost btn-block" style="margin-top:.5rem" href="<?= e(url('admin/veiculos.php')) ?>">Cancelar</a>
      </div>
    </aside>
  </div>
</form>

<?php include __DIR__ . '/includes/admin-footer.php'; ?>
