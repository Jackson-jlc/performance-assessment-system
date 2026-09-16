'============================================================
' JingYing KaoHe System - Local Launcher
' Double-click to start the service in background (no console)
' and open the browser automatically.
' Stop it with "停止经营考核系统.bat".
'============================================================
Option Explicit
Dim fso, ws, baseDir, dir, port, code, i, ok, logPath
Set fso = CreateObject("Scripting.FileSystemObject")
Set ws  = CreateObject("Wscript.Shell")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
dir     = baseDir & "\server"
port    = "4000"

'--- 0. Check Node.js -------------------------------------------------
code = ws.Run("cmd /c node --version >nul 2>nul", 0, True)
If code <> 0 Then
    MsgBox "Node.js not found. Please install Node.js 18 or newer." & vbCrLf & _
           "Download: https://nodejs.org/zh-cn/download", _
           vbExclamation, "JingYing KaoHe System"
    WScript.Quit 1
End If

'--- 1. Already running? Just open the browser ------------------------
code = ws.Run("cmd /c netstat -ano | findstr :" & port & " | findstr LISTENING >nul 2>nul", 0, True)
If code = 0 Then
    ws.Run "http://localhost:" & port, 1, False
    WScript.Quit 0
End If

'--- 2. Start server in background (log -> logs\server.log) ------------
If Not fso.FolderExists(baseDir & "\logs") Then
    fso.CreateFolder(baseDir & "\logs")
End If
logPath = """" & baseDir & "\logs\server.log"""
ws.CurrentDirectory = dir
ws.Run "cmd /c node server.js >> " & logPath & " 2>&1", 0, False

'--- 3. Wait until ready (max 15s), then open browser ------------------
ok = False
For i = 1 To 15
    WScript.Sleep 1000
    code = ws.Run("cmd /c curl -s -o nul http://localhost:" & port & "/api/health", 0, True)
    If code = 0 Then
        ok = True
        Exit For
    End If
Next

ws.Run "http://localhost:" & port, 1, False
If Not ok Then
    MsgBox "Server started but health check timed out." & vbCrLf & _
           "Please open logs\server.log for details.", _
           vbInformation, "JingYing KaoHe System"
End If
WScript.Quit 0
