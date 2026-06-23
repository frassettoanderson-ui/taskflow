; Instalador do agente e-Continuo do GestorOA (Inno Setup 6)
;
; FLUXO NOVO (instalador "carimbado"):
;   O admin baixa o instalador de DENTRO do GestorOA. O download injeta a chave
;   do escritorio no NOME do arquivo, ex.: "GestorOA-eContinuo-Setup__goa_XXXX.exe".
;   O instalador le essa chave do proprio nome e configura tudo sozinho:
;   next -> next -> finish, sem digitar nada, pasta criada automatica.
;
;   Se o arquivo NAO trouxer a chave no nome (instalador generico), o assistente
;   pede a chave e a pasta como antes (fallback).

#define MyAppName "GestorOA e-Continuo"
#define MyAppVersion "0.4.0"
#define MyAppExe "gestoroa-agente.exe"
#define ApiUrlPadrao "http://89.117.79.163:8090"

[Setup]
AppId={{8F2A6B30-9C44-4E21-A7E5-2C7E9D1B4A60}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=GestorOA
DefaultDirName={localappdata}\GestorOA-eContinuo
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=GestorOA-eContinuo-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupLogging=no
UninstallDisplayName={#MyAppName}

[Languages]
Name: "br"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "dist\{#MyAppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Inicia junto com o Windows (oculto - o agente e' subsystem GUI, nao mostra janela).
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; Parameters: "--bg"

[Run]
; Inicia o agente assim que terminar a instalacao.
Filename: "{app}\{#MyAppExe}"; Parameters: "--bg"; Flags: nowait runhidden

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C taskkill /IM {#MyAppExe} /F"; Flags: runhidden; RunOnceId: "killagent"

[Code]
var
  PgChave: TInputQueryWizardPage;
  PgPasta: TInputDirWizardPage;
  ChaveAuto: String;   // chave lida do nome do arquivo (vazio = instalador generico)

// Mantem apenas os caracteres validos de uma chave (a-z A-Z 0-9 _), parando no
// primeiro caractere diferente (espaco, ponto, parentese do "(1)" do navegador).
function LimpaChave(s: String): String;
var
  i: Integer;
  c: Char;
  r: String;
begin
  r := '';
  for i := 1 to Length(s) do
  begin
    c := s[i];
    if ((c >= 'a') and (c <= 'z')) or ((c >= 'A') and (c <= 'Z')) or
       ((c >= '0') and (c <= '9')) or (c = '_') then
      r := r + c
    else
      Break;
  end;
  Result := r;
end;

// Extrai a chave embutida no nome do instalador (depois de "__").
function ChaveEmbutida(): String;
var
  nome, resto: String;
  p: Integer;
begin
  Result := '';
  nome := ExtractFileName(ExpandConstant('{srcexe}'));
  p := Pos('__', nome);
  if p > 0 then
  begin
    resto := LimpaChave(Copy(nome, p + 2, Length(nome)));
    if Copy(resto, 1, 4) = 'goa_' then
      Result := resto;
  end;
end;

procedure InitializeWizard;
begin
  ChaveAuto := ChaveEmbutida();

  PgChave := CreateInputQueryPage(wpWelcome,
    'Chave de conexao',
    'Cole a chave API do seu escritorio',
    'No GestorOA acesse: Sistema > e-Continuo > Configurar obrigacoes > botao "Baixar agente".' + #13#10 +
    'Dica: baixando por ali, a chave ja vem embutida e voce nem precisa preencher isto.' + #13#10#13#10 +
    'Se preferir, cole a chave manualmente abaixo (comeca com goa_):');
  PgChave.Add('Chave API:', False);

  PgPasta := CreateInputDirPage(PgChave.ID,
    'Pasta vigiada',
    'Escolha (ou crie) a pasta que sera monitorada',
    'Todo PDF colocado nesta pasta sera enviado automaticamente ao GestorOA.',
    False, 'GestorOA - guias');
  PgPasta.Add('');
  PgPasta.Values[0] := ExpandConstant('{userdesktop}\GestorOA - guias');

  // Veio com a chave no nome? Preenche e pula as duas paginas (next/next/finish).
  if ChaveAuto <> '' then
    PgChave.Values[0] := ChaveAuto;
end;

// Quando a chave veio embutida, nao mostra as paginas de chave/pasta.
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (ChaveAuto <> '') and ((PageID = PgChave.ID) or (PageID = PgPasta.ID)) then
    Result := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = PgChave.ID) and (ChaveAuto = '') then
  begin
    if Trim(PgChave.Values[0]) = '' then
    begin
      MsgBox('Informe a chave API para continuar.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  chave, pasta, pastaJson, cfg: String;
  linhas: TArrayOfString;
  ResultCode: Integer;
begin
  // Antes de copiar o exe novo: mata qualquer instancia antiga e limpa a trava (lock).
  // Sem isso, uma instancia presa de uma instalacao anterior faz a nova sair na hora
  // por achar que "ja tem um rodando" - e a pasta vigiada nunca recebe os arquivos.
  if CurStep = ssInstall then
  begin
    Exec('taskkill.exe', '/IM gestoroa-agente.exe /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    DeleteFile(ExpandConstant('{app}\gestoroa-agente.lock'));
  end;

  if CurStep = ssPostInstall then
  begin
    if ChaveAuto <> '' then
      chave := ChaveAuto
    else
      chave := Trim(PgChave.Values[0]);

    pasta := PgPasta.Values[0];
    if pasta = '' then
      pasta := ExpandConstant('{userdesktop}\GestorOA - guias');
    ForceDirectories(pasta);

    // escapa as barras invertidas do caminho para o JSON (\ -> \\)
    pastaJson := pasta;
    StringChangeEx(pastaJson, '\', '\\', True);

    cfg :=
      '{' + #13#10 +
      '  "apiUrl": "{#ApiUrlPadrao}",' + #13#10 +
      '  "apiKey": "' + chave + '",' + #13#10 +
      '  "pasta": "' + pastaJson + '",' + #13#10 +
      '  "setor": "' + ExtractFileName(pasta) + '"' + #13#10 +
      '}';

    // CRUCIAL: gravar em UTF-8 (sem BOM). O agente (Node) le o config em UTF-8;
    // se gravar em ANSI, o acento de "Area de Trabalho" corrompe e o robo passa
    // a vigiar uma pasta-fantasma. SaveStringToFile gravaria ANSI - nao usar.
    SetArrayLength(linhas, 1);
    linhas[0] := cfg;
    SaveStringsToUTF8File(ExpandConstant('{app}\gestoroa-agente.config.json'), linhas, False);
  end;
end;
