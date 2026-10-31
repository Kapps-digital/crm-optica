@echo off
echo ==============================================
echo Habilitando Puerto 3001 en Firewall de Windows
echo ==============================================
netsh advfirewall firewall delete rule name="CRM_Optica_3001" >nul 2>&1
netsh advfirewall firewall add rule name="CRM_Optica_3001" dir=in action=allow protocol=TCP localport=3001 profile=any
powershell -Command "Set-NetFirewallRule -DisplayName 'Node.js JavaScript Runtime' -Profile Any -ErrorAction SilentlyContinue"
echo.
echo [OK] Puerto 3001 permitido para todas las redes (Privada y Publica).
echo.
pause

