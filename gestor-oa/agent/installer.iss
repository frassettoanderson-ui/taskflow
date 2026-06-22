; Instalador do agente e-Continuo do GestorOA (Inno Setup 6)
; Coleta a chave API e a pasta vigiada DENTRO do assistente, grava a config
; ao lado do agente e ja deixa ele rodando + iniciando com o Windows.

#define MyAppName "GestorOA e-Continuo"
#define MyAppVersion "0.3.0"
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

procedure InitializeWizard;
begin
  PgChave := CreateInputQueryPage(wpWelcome,
    'Chave de conexao',
    'Cole a chave API do seu escritorio',
    'No GestorOA acesse: Sistema > e-Continuo > Caixa do Robo > secao Integracao (API) > botao Gerar.' + #13#10 +
    'Copie a chave (comeca com goa_) e cole abaixo:');
  PgChave.Add('Chave API:', False);

  PgPasta := CreateInputDirPage(PgChave.ID,
    'Pasta vigiada',
    'Escolha (ou crie) a pasta que sera monitorada',
    'Todo PDF colocado nesta pasta sera enviado automaticamente ao GestorOA.',
    False, 'GestorOA - guias');
  PgPasta.Add('');
  PgPasta.Values[0] := ExpandConstant('{userdesktop}\GestorOA - guias');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = PgChave.ID then
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
begin
  if CurStep = ssPostInstall then
  begin
    chave := Trim(PgChave.Values[0]);
    pasta := PgPasta.Values[0];
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

    SaveStringToFile(ExpandConstant('{app}\gestoroa-agente.config.json'), cfg, False);
  end;
end;
