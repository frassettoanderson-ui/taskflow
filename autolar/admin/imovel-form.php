<?php
require __DIR__ . '/auth-check.php';

$id = input_int('id', 0);
$editando = $id > 0;

$difsPadrao = ['Piscina','Mobiliado','Condomínio fechado','Churrasqueira','Área gourmet','Vista para o mar','Academia','Jardim','Alto padrão'];
$finalidades = ['venda','aluguel'];
$tipos  = ['casa','apartamento','sobrado','terreno','comercial','sitio'];
$status = ['disponivel','reservado','vendido','alugado'];

/* ----------------------------- SALVAR ----------------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_validar()) { flash_set('err', 'Sessão expirada. Tente novamente.'); redirecionar('admin/imovel-form.php' . ($editando ? "?id=$id" : '')); }

    $cidade = input_str('cidade');
    $preco  = input_moeda('preco');
    $erros = [];
    if ($cidade === '')  $erros[] = 'Informe a cidade.';
    if ($preco === null) $erros[] = 'Informe o preço.';

    if ($erros) {
        flash_set('err', implode(' ', $erros));
    } else {
        $dados = [
            'titulo'      => input_str('titulo') ?: null,
            'finalidade'  => input_enum('finalidade', $finalidades, 'venda'),
            'tipo'        => input_enum('tipo', $tipos, 'casa'),
            'cidade'      => $cidade,
            'bairro'      => input_str('bairro') ?: null,
            'endereco'    => input_str('endereco') ?: null,
            'preco'       => $preco,
            'condominio'  => input_moeda('condominio'),
            'quartos'     => input_int('quartos'),
            'suites'      => input_int('suites'),
            'banheiros'   => input_int('banheiros'),
            'vagas'       => input_int('vagas'),
            'area'        => input_float('area'),
            'area_total'  => input_float('area_total'),
            'descricao'   => input_str('descricao') ?: null,
            'destaque'    => isset($_POST['destaque']) ? 1 : 0,
            'novo'        => isset($_POST['novo']) ? 1 : 0,
            'ativo'       => isset($_POST['ativo']) ? 1 : 0,
            'status'      => input_enum('status', $status, 'disponivel'),
        ];

        if ($editando) {
            $set = implode(',', array_map(fn($k) => "$k=?", array_keys($dados)));
            $pdo->prepare("UPDATE imoveis SET $set WHERE id=?")->execute([...array_values($dados), $id]);
        } else {
            $cols = implode(',', array_keys($dados));
            $ph = implode(',', array_fill(0, count($dados), '?'));
            $pdo->prepare("INSERT INTO imoveis ($cols) VALUES ($ph)")->execute(array_values($dados));
            $id = (int)$pdo->lastInsertId();
        }

        // Diferenciais
        $pdo->prepare('DELETE FROM imovel_diferenciais WHERE imovel_id=?')->execute([$id]);
        $difs = $_POST['dif'] ?? [];
        if (!is_array($difs)) $difs = [];
        foreach (explode(',', input_str('dif_custom')) as $c) { $c = trim($c); if ($c !== '') $difs[] = $c; }
        $difs = array_unique(array_filter(array_map('trim', $difs)));
        if ($difs) {
            $ins = $pdo->prepare('INSERT INTO imovel_diferenciais (imovel_id, nome) VALUES (?,?)');
            foreach ($difs as $d) $ins->execute([$id, mb_substr($d, 0, 80)]);
        }

        // Remover imagens
        $remover = $_POST['remover'] ?? [];
        if (is_array($remover) && $remover) {
            $in = implode(',', array_fill(0, count($remover), '?'));
            $sel = $pdo->prepare("SELECT id, arquivo FROM imovel_imagens WHERE imovel_id=? AND id IN ($in)");
            $sel->execute([$id, ...array_map('intval', $remover)]);
            foreach ($sel->fetchAll() as $img) excluir_arquivo_imagem($img['arquivo'], 'imoveis');
            $pdo->prepare("DELETE FROM imovel_imagens WHERE imovel_id=? AND id IN ($in)")->execute([$id, ...array_map('intval', $remover)]);
        }

        // Reordenar
        $ordens = $_POST['ordem'] ?? [];
        if (is_array($ordens)) {
            $upd = $pdo->prepare('UPDATE imovel_imagens SET ordem=? WHERE id=? AND imovel_id=?');
            foreach ($ordens as $imgId => $o) $upd->execute([(int)$o, (int)$imgId, $id]);
        }

        // Novas imagens
        $up = processar_uploads('fotos', 'imoveis');
        if ($up['erros']) flash_set('info', implode(' ', $up['erros']));
        if ($up['salvos']) {
            $maxOrdem = (int)$pdo->query("SELECT COALESCE(MAX(ordem),0) FROM imovel_imagens WHERE imovel_id=$id")->fetchColumn();
            $ins = $pdo->prepare('INSERT INTO imovel_imagens (imovel_id, arquivo, ordem, capa) VALUES (?,?,?,0)');
            foreach ($up['salvos'] as $arq) $ins->execute([$id, $arq, ++$maxOrdem]);
        }

        // Capa
        $capa = input_int('capa');
        if ($capa) {
            $pdo->prepare('UPDATE imovel_imagens SET capa=0 WHERE imovel_id=?')->execute([$id]);
            $pdo->prepare('UPDATE imovel_imagens SET capa=1 WHERE id=? AND imovel_id=?')->execute([$capa, $id]);
        }
        garantir_capa($pdo, 'imovel_imagens', 'imovel_id', $id);

        flash_set('ok', $editando ? 'Imóvel atualizado com sucesso.' : 'Imóvel cadastrado com sucesso.');
        redirecionar('admin/imoveis.php');
    }
}

/* ----------------------------- CARREGAR --------------------------------- */
$im = [
    'titulo'=>'','finalidade'=>'venda','tipo'=>'casa','cidade'=>'','bairro'=>'','endereco'=>'',
    'preco'=>'','condominio'=>'','quartos'=>'','suites'=>'','banheiros'=>'','vagas'=>'','area'=>'','area_total'=>'',
    'descricao'=>'','destaque'=>0,'novo'=>0,'ativo'=>1,'status'=>'disponivel',
];
$imagens = []; $difSelec = [];
if ($editando) {
    $st = $pdo->prepare('SELECT * FROM imoveis WHERE id=?');
    $st->execute([$id]);
    $found = $st->fetch();
    if (!$found) { flash_set('err', 'Imóvel não encontrado.'); redirecionar('admin/imoveis.php'); }
    $im = $found;
    $imagens = imagens_do_registro($pdo, 'imovel_imagens', 'imovel_id', $id);
    $difSelec = diferenciais_do_registro($pdo, 'imovel_diferenciais', 'imovel_id', $id);
}

$admin_titulo = $editando ? 'Editar imóvel' : 'Novo imóvel';
$admin_atual = 'imoveis';
$admin_action = '<a class="btn btn-ghost" href="' . e(url('admin/imoveis.php')) . '">← Voltar</a>';
include __DIR__ . '/includes/admin-header.php';
?>

<form method="post" enctype="multipart/form-data" action="<?= e(url('admin/imovel-form.php' . ($editando ? "?id=$id" : ''))) ?>">
  <?= csrf_field() ?>
  <div class="form-grid">
    <div>
      <div class="form-section">
        <h3>Dados do imóvel</h3>
        <div class="field"><label>Título <span class="hint">(opcional — gerado automaticamente se vazio)</span></label><input name="titulo" value="<?= e($im['titulo']) ?>" placeholder="Ex.: Apartamento à beira-mar com 3 dormitórios"></div>
        <div class="grid-3">
          <div class="field"><label>Finalidade</label><select name="finalidade"><?php foreach ($finalidades as $f): ?><option value="<?= $f ?>" <?= $im['finalidade']===$f?'selected':'' ?>><?= $f==='venda'?'Venda':'Aluguel' ?></option><?php endforeach; ?></select></div>
          <div class="field"><label>Tipo</label><select name="tipo"><?php foreach ($tipos as $t): ?><option value="<?= $t ?>" <?= $im['tipo']===$t?'selected':'' ?>><?= e(rotulo_tipo_imovel($t)) ?></option><?php endforeach; ?></select></div>
          <div class="field"><label>Preço (R$) *</label><input data-mask="money" inputmode="numeric" name="preco" value="<?= $im['preco'] !== '' ? e(number_format((float)$im['preco'],0,',','.')) : '' ?>" required></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Cidade *</label><input name="cidade" value="<?= e($im['cidade']) ?>" required></div>
          <div class="field"><label>Bairro</label><input name="bairro" value="<?= e($im['bairro']) ?>"></div>
          <div class="field"><label>Condomínio (R$/mês)</label><input data-mask="money" inputmode="numeric" name="condominio" value="<?= $im['condominio'] !== '' && $im['condominio'] !== null ? e(number_format((float)$im['condominio'],0,',','.')) : '' ?>"></div>
        </div>
        <div class="field"><label>Endereço</label><input name="endereco" value="<?= e($im['endereco']) ?>" placeholder="Rua, número (opcional)"></div>
      </div>

      <div class="form-section">
        <h3>Características</h3>
        <div class="grid-3">
          <div class="field"><label>Quartos</label><input type="number" name="quartos" value="<?= e($im['quartos']) ?>"></div>
          <div class="field"><label>Suítes</label><input type="number" name="suites" value="<?= e($im['suites']) ?>"></div>
          <div class="field"><label>Banheiros</label><input type="number" name="banheiros" value="<?= e($im['banheiros']) ?>"></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Vagas</label><input type="number" name="vagas" value="<?= e($im['vagas']) ?>"></div>
          <div class="field"><label>Área útil (m²)</label><input type="number" step="0.01" name="area" value="<?= e($im['area']) ?>"></div>
          <div class="field"><label>Área total (m²)</label><input type="number" step="0.01" name="area_total" value="<?= e($im['area_total']) ?>"></div>
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
          <input name="dif_custom" placeholder="Ex.: Varanda gourmet, Portaria 24h"
            value="<?= e(implode(', ', array_values(array_diff($difSelec, $difsPadrao)))) ?>"></div>
      </div>

      <div class="form-section">
        <h3>Descrição</h3>
        <div class="field"><textarea name="descricao" placeholder="Detalhes do imóvel, acabamento, localização…"><?= e($im['descricao']) ?></textarea></div>
      </div>

      <div class="form-section">
        <h3>Fotos</h3>
        <?php if ($imagens): ?>
          <div class="img-manager">
            <?php foreach ($imagens as $img): ?>
              <div class="img-item <?= $img['capa']?'cover':'' ?>">
                <?php if ($img['capa']): ?><span class="cover-tag">Capa</span><?php endif; ?>
                <img src="<?= e(imagem_url($img['arquivo'], 'imoveis')) ?>" alt="">
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

    <aside>
      <div class="form-section" style="position:sticky;top:1rem">
        <h3>Publicação</h3>
        <div class="field"><label>Status</label>
          <select name="status"><?php foreach ($status as $s): ?><option value="<?= $s ?>" <?= $im['status']===$s?'selected':'' ?>><?= e(rotulo_status_imovel($s)) ?></option><?php endforeach; ?></select>
        </div>
        <div class="switch-row">
          <span>Em destaque</span>
          <label class="switch"><input type="checkbox" name="destaque" <?= $im['destaque']?'checked':'' ?>><span class="sl"></span></label>
        </div>
        <div class="switch-row">
          <span>Marcar como “Novo”</span>
          <label class="switch"><input type="checkbox" name="novo" <?= $im['novo']?'checked':'' ?>><span class="sl"></span></label>
        </div>
        <div class="switch-row">
          <span>Ativo (visível no site)</span>
          <label class="switch"><input type="checkbox" name="ativo" <?= $im['ativo']?'checked':'' ?>><span class="sl"></span></label>
        </div>
        <button class="btn btn-blue btn-block" style="margin-top:1.2rem" type="submit"><?= $editando?'Salvar alterações':'Cadastrar imóvel' ?></button>
        <a class="btn btn-ghost btn-block" style="margin-top:.5rem" href="<?= e(url('admin/imoveis.php')) ?>">Cancelar</a>
      </div>
    </aside>
  </div>
</form>

<?php include __DIR__ . '/includes/admin-footer.php'; ?>
