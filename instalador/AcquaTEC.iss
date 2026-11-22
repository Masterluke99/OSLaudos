#define AppName "AcquaTEC"
#define AppVersion "1.0.0"

[Setup]
AppId={{BA1E5477-14D4-44E1-B15D-8A4F69A943B4}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=AcquaTEC
DefaultDirName={localappdata}\Programs\AcquaTEC
DefaultGroupName=AcquaTEC
PrivilegesRequired=lowest
OutputDir=..\dist\instaladores
OutputBaseFilename=AcquaTEC-Setup
SetupIconFile=..\logo.png
UninstallDisplayIcon={app}\AcquaTEC.exe
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern
Compression=lzma
SolidCompression=yes

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"

[Files]
Source: "..\dist\AcquaTEC\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "dados\*"

[Icons]
Name: "{group}\AcquaTEC"; Filename: "{app}\AcquaTEC.exe"
Name: "{autodesktop}\AcquaTEC"; Filename: "{app}\AcquaTEC.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\AcquaTEC.exe"; Description: "Abrir AcquaTEC"; Flags: postinstall nowait skipifsilent
