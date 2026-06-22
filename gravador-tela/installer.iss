; ============================================================================
;  installer.iss — Script do Inno Setup para gerar o instalador do
;  Gravador de Tela (Windows).
;
;  PRÉ-REQUISITOS:
;    1. Rodar antes:  .\build.ps1   (gera dist\GravadorDeTela.exe + dist\ffmpeg.exe)
;    2. Instalar o Inno Setup:  https://jrsoftware.org/isdl.php
;
;  COMO GERAR O INSTALADOR:
;    - Abra este arquivo no Inno Setup e clique em "Build > Compile" (ou F9), OU
;    - Pela linha de comando:
;         & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
;
;  RESULTADO:
;    Output\GravadorDeTela-Setup.exe   <- mande este arquivo para seus amigos.
; ============================================================================

#define MyAppName "Gravador de Tela"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Anderson"
#define MyAppExeName "GravadorDeTela.exe"

[Setup]
AppId={{B7F3A1C2-5E4D-4A9B-9C2F-1A2B3C4D5E6F}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; Saída do instalador
OutputDir=Output
OutputBaseFilename=GravadorDeTela-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Ícone do próprio instalador (opcional)
SetupIconFile=icon.ico
; Instala para o usuário atual (não exige admin). Use "admin" p/ todos os usuários.
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar um atalho na Área de Trabalho"; GroupDescription: "Atalhos:"

[Files]
; Programa principal
Source: "dist\GravadorDeTela.exe"; DestDir: "{app}"; Flags: ignoreversion
; FFmpeg embutido (precisa estar ao lado do .exe)
Source: "dist\ffmpeg.exe";         DestDir: "{app}"; Flags: ignoreversion
; Documentação (opcional)
Source: "README.md";               DestDir: "{app}"; Flags: ignoreversion isreadme

[Icons]
Name: "{group}\{#MyAppName}";        Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}";  Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Oferece abrir o programa ao final da instalação
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir o {#MyAppName} agora"; Flags: nowait postinstall skipifsilent
