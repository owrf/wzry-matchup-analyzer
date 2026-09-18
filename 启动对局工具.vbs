' Launch the draft-analysis tool (local server + browser)
Option Explicit
Dim fso, sh, base, serverJs, nodeExe, chrome1, chrome2, chrome3, cmd, i, cands
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

base     = fso.GetParentFolderName(WScript.ScriptFullName)
serverJs = base & "\tools\server.js"

If Not fso.FileExists(serverJs) Then
  MsgBox "server.js not found:" & vbCrLf & serverJs, 16, "Error"
  WScript.Quit 1
End If

' 1) kill old process on port 8777
On Error Resume Next
sh.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :8777 ^| findstr LISTENING') do taskkill /F /PID %a", 0, True
On Error Goto 0

' 2) locate node.exe
nodeExe = ""
cands = Array( _
  sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\nodejs\node.exe", _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\nodejs\node.exe" )
For i = 0 To UBound(cands)
  If fso.FileExists(cands(i)) Then nodeExe = cands(i)
Next
If nodeExe = "" Then
  MsgBox "node.exe not found. Please install Node.js first:" & vbCrLf & "https://nodejs.org", 48, "Notice"
  WScript.Quit 1
End If

' 3) start server hidden
sh.CurrentDirectory = base & "\tools"
sh.Run """" & nodeExe & """ """ & serverJs & """", 0, False

WScript.Sleep 2500

' 4) open in Chrome
chrome1 = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"
chrome2 = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe"
chrome3 = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"

If fso.FileExists(chrome1) Then
  cmd = """" & chrome1 & """"
ElseIf fso.FileExists(chrome2) Then
  cmd = """" & chrome2 & """"
ElseIf fso.FileExists(chrome3) Then
  cmd = """" & chrome3 & """"
Else
  cmd = ""
End If

If cmd <> "" Then
  sh.Run cmd & " --new-window ""http://127.0.0.1:8777/""", 1, False
Else
  sh.Run "http://127.0.0.1:8777/", 1, False
End If