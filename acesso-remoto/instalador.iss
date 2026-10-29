; HolyTech Remoto — instala o cliente oficial do RustDesk já apontado para o
; servidor próprio (VPS OX Cloud) e, se informada, define a senha permanente.
; Compilar com build.ps1 (baixa o MSI oficial antes).

#define AppNome "HolyTech Remoto"
#define AppVersao "1.0.0"
#define RustDeskVersao "1.5.0"
#define Servidor "178.238.226.21"
#define Chave "RO+BSgUSgcTp5rY1AY62i+3jptBiYajH5B8GCiMMj64="
; Mesma config acima no formato de "exportar configuração" do RustDesk (JSON em base64, invertido)
#define ConfigStr "=0nI9QjNq1UTpN0R4IUNIpWYZlmQ0BnazsSayYTWBFTWyVDcUN2ZTV1ZTJ0KPJlI6ISeltmIsIiI6ISawFmIsIiI6ISehxWZyJCLiEjMuYjMy4COzIjL4cTMiojI0N3boJye"

[Setup]
AppId={{6DA7E105-C78F-45D8-BCA1-A72EBE19F8C2}
AppName={#AppNome}
AppVersion={#AppVersao}
AppPublisher=HolyTech Solutions
DefaultDirName={autopf}\RustDesk
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
Uninstallable=no
PrivilegesRequired=admin
OutputDir=Output
OutputBaseFilename=HolyTech-Remoto-Setup
SetupIconFile=holytech-remoto.ico
WizardStyle=modern
Compression=lzma2
SolidCompression=yes

[Languages]
Name: "pt"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "vendor\rustdesk-{#RustDeskVersao}-x86_64.msi"; DestDir: "{tmp}"; DestName: "rustdesk.msi"; Flags: deleteafterinstall

[Code]
var
  PaginaSenha: TInputQueryWizardPage;
  IdMaquina: String;

procedure InitializeWizard;
begin
  PaginaSenha := CreateInputQueryPage(wpWelcome,
    'Senha de acesso',
    'Senha permanente para acessar este computador sem alguém aceitar',
    'Deixe em branco se este computador só vai ACESSAR outros (não ser acessado).' + #13#10 +
    'Mínimo de 8 caracteres.');
  PaginaSenha.Add('Senha:', True);
  PaginaSenha.Add('Repita a senha:', True);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = PaginaSenha.ID then
  begin
    if PaginaSenha.Values[0] <> PaginaSenha.Values[1] then
    begin
      MsgBox('As senhas não conferem.', mbError, MB_OK);
      Result := False;
    end
    else if Pos('"', PaginaSenha.Values[0]) > 0 then
    begin
      MsgBox('A senha não pode ter aspas (").', mbError, MB_OK);
      Result := False;
    end
    else if (PaginaSenha.Values[0] <> '') and (Length(PaginaSenha.Values[0]) < 8) then
    begin
      MsgBox('Use pelo menos 8 caracteres.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function Exe: String;
begin
  Result := ExpandConstant('{commonpf64}\RustDesk\rustdesk.exe');
end;

// true quando o RustDesk instalado é 1.2 ou mais novo (aceita --config/--password)
function VersaoNova: Boolean;
var
  MS, LS: Cardinal;
begin
  Result := FileExists(Exe) and GetVersionNumbers(Exe, MS, LS) and
    ((MS shr 16 > 1) or ((MS shr 16 = 1) and ((MS and $FFFF) >= 2)));
end;

procedure Rodar(const Params: String);
var
  Cod: Integer;
begin
  Exec(Exe, Params, '', SW_HIDE, ewWaitUntilTerminated, Cod);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Cod, Tentativas: Integer;
  Saida: AnsiString;
  ArqId: String;
begin
  if CurStep <> ssPostInstall then Exit;

  // RustDesk antigo (instalado pelo .exe, não pelo MSI) impede o MSI e não entende --config
  if FileExists(Exe) and not VersaoNova then
  begin
    WizardForm.StatusLabel.Caption := 'Removendo o RustDesk antigo...';
    Exec(Exe, '--uninstall', '', SW_HIDE, ewWaitUntilTerminated, Cod);
    Tentativas := 0;
    while FileExists(Exe) and (Tentativas < 60) do
    begin
      Sleep(1000);
      Tentativas := Tentativas + 1;
    end;
    RegDeleteKeyIncludingSubkeys(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\RustDesk');
  end;

  WizardForm.StatusLabel.Caption := 'Instalando o RustDesk...';
  Exec('msiexec.exe', '/i "' + ExpandConstant('{tmp}\rustdesk.msi') + '" /qn /norestart', '',
    SW_HIDE, ewWaitUntilTerminated, Cod);

  Tentativas := 0;
  while (not VersaoNova) and (Tentativas < 60) do
  begin
    Sleep(1000);
    Tentativas := Tentativas + 1;
  end;
  if not VersaoNova then
  begin
    MsgBox('O RustDesk {#RustDeskVersao} não foi instalado (msiexec código ' + IntToStr(Cod) + ').' + #13#10 +
      'Desinstale qualquer RustDesk antigo pelo Painel de Controle e rode de novo.', mbError, MB_OK);
    Exit;
  end;
  Sleep(3000);

  WizardForm.StatusLabel.Caption := 'Apontando para o servidor HolyTech...';
  Rodar('--config "{#ConfigStr}"');
  Rodar('--option custom-rendezvous-server {#Servidor}');
  Rodar('--option key "{#Chave}"');

  if PaginaSenha.Values[0] <> '' then
  begin
    WizardForm.StatusLabel.Caption := 'Definindo a senha permanente...';
    Rodar('--password "' + PaginaSenha.Values[0] + '"');
  end;

  // config herdada de RustDesk antigo pode ter o serviço desligado; e o serviço pode ter
  // sido apagado pelo desinstalador antigo depois do MSI
  Rodar('--option stop-service ""');
  if not RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\RustDesk') then
  begin
    WizardForm.StatusLabel.Caption := 'Instalando o serviço...';
    Rodar('--install-service');
    Sleep(3000);
  end;

  Exec(ExpandConstant('{sys}\sc.exe'), 'stop RustDesk', '', SW_HIDE, ewWaitUntilTerminated, Cod);
  Sleep(2000);
  Exec(ExpandConstant('{sys}\sc.exe'), 'start RustDesk', '', SW_HIDE, ewWaitUntilTerminated, Cod);
  Sleep(3000);

  ArqId := ExpandConstant('{tmp}\id.txt');
  Exec(ExpandConstant('{cmd}'), '/c ""' + Exe + '" --get-id > "' + ArqId + '""', '',
    SW_HIDE, ewWaitUntilTerminated, Cod);
  if LoadStringFromFile(ArqId, Saida) then
    IdMaquina := Trim(String(Saida));
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and (IdMaquina <> '') then
    WizardForm.FinishedLabel.Caption :=
      'Pronto! Este computador já está no servidor HolyTech.' + #13#10#13#10 +
      'ID deste computador: ' + IdMaquina + #13#10#13#10 +
      'Anote o ID para acessá-lo depois.';
end;
