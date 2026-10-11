@echo off
rem ---------------------------------------------------------------------------
rem  Sert les cartes en local ET sur le reseau (pour le telephone).
rem  Double-clique simplement sur ce fichier.
rem
rem  Note : ce serveur ecoute sur toutes les interfaces (pas seulement
rem  127.0.0.1), afin que ton telephone puisse ouvrir les cartes via l'IP du PC.
rem  Ce sont 41 caracteres chinois publics, rien de personnel.
rem ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Python est introuvable dans le PATH.
  echo   Solution de repli : ouvre ce dossier dans VS Code puis Ctrl+Shift+B.
  echo.
  pause
  exit /b 1
)

echo.
echo   Sur ce PC     : http://127.0.0.1:8082
echo   Sur telephone : http://ADRESSE_IP_DU_PC:8082   (voir ci-dessous)
echo.

rem Affiche les adresses IPv4 utilisables par le telephone
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"Adresse IPv4" /c:"IPv4 Address"') do echo   IP possible :%%a

echo.
echo   Laisse cette fenetre ouverte : Ctrl+C ou fermeture = arret du serveur.
echo.

start "" http://127.0.0.1:8082
rem Pas de --bind : ecoute sur toutes les interfaces
python -m http.server 8082
endlocal
