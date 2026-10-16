<#
    ==========================================================================
    ajouter-niveau.ps1 — déroule toute la chaîne pour un nouveau niveau HSK
    ==========================================================================

    À QUOI ÇA SERT
    --------------
    Importer un niveau demande huit étapes, toutes déjà outillées mais faciles à
    oublier dans l'ordre. Ce script les enchaîne, s'arrête à la première erreur,
    et affiche le titre de chaque étape :

        1. sens en français              traduire.ps1 -Quoi sens
        2. étymologies en français       traduire.ps1 -Quoi etymo
        3. gloses des composants         traduire-composants.ps1
        4. choix des mots d'exemple      build-exemples.js
        5. traduction de ces mots        traduire-mots.ps1
        6. écriture des mots             apply-exemples.js
        7. phrases d'exemple             generer-phrases.ps1
        8. écriture des phrases          apply-phrases.js

    Chaque étape est relançable : les fichiers produits sont complétés après
    chaque lot, donc une interruption ne fait rien perdre — il suffit de
    relancer le script.

    L'IMPORT N'EST PAS INCLUS : il dépend du filtre voulu, et le faire à part
    permet de vérifier le fichier avant de payer les traductions.

        .\import-hanzi-db.ps1 -FilterFile ..\hanzi-db\filtres\hsk3.txt `
            -Category 'HSK 3' -Output data\cards-hsk3.json
        .\ajouter-niveau.ps1 -Niveau hsk3

    USAGE
    -----
        .\ajouter-niveau.ps1 -Niveau hsk3        # tout le niveau
        .\ajouter-niveau.ps1 -Niveau hsk3 -SansPhrases
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Niveau,   # hsk3, hsk4… (le fichier cards-<Niveau>.json)
    [switch]$SansPhrases,                            # sauter les deux dernières étapes
    [switch]$SansMots                                # ne faire que les traductions
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$fichier = "data\cards-$Niveau.json"
$chemin = Join-Path $root $fichier

if (-not (Test-Path $chemin)) {
    throw "Fichier introuvable : $chemin (lancer import-hanzi-db.ps1 d'abord)"
}

Write-Host ""
Write-Host ("Niveau : " + $Niveau + "  (" + $fichier + ")") -ForegroundColor Cyan
$n = (Get-Content $chemin -Raw -Encoding UTF8 | ConvertFrom-Json).cards.Count
Write-Host ("Fiches : " + $n) -ForegroundColor Cyan

$etapes = New-Object System.Collections.ArrayList
[void]$etapes.Add(@{ titre = '1/8  sens en francais';        action = { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'traduire.ps1') -Quoi sens -Fichier $fichier } })
[void]$etapes.Add(@{ titre = '2/8  etymologies en francais'; action = { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'traduire.ps1') -Quoi etymo -Fichier $fichier } })
[void]$etapes.Add(@{ titre = '3/8  gloses des composants';   action = { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'traduire-composants.ps1') -Fichier $fichier } })
if (-not $SansMots) {
    [void]$etapes.Add(@{ titre = '4/8  choix des mots d''exemple'; action = { & node (Join-Path $root 'build-exemples.js') $fichier } })
    [void]$etapes.Add(@{ titre = '5/8  traduction de ces mots';    action = { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'traduire-mots.ps1') -Fichier $fichier } })
    [void]$etapes.Add(@{ titre = '6/8  ecriture des mots';         action = { & node (Join-Path $root 'apply-exemples.js') $fichier } })
}
if (-not $SansPhrases -and -not $SansMots) {
    [void]$etapes.Add(@{ titre = '7/8  generation des phrases';  action = { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'generer-phrases.ps1') -Fichier $fichier } })
    [void]$etapes.Add(@{ titre = '8/8  ecriture des phrases';    action = { & node (Join-Path $root 'apply-phrases.js') $fichier } })
}

$chrono = [Diagnostics.Stopwatch]::StartNew()
foreach ($e in $etapes) {
    Write-Host ""
    Write-Host ("===== " + $e.titre) -ForegroundColor Yellow
    & $e.action 2>&1 | ForEach-Object { "    " + $_.ToString().TrimEnd() }
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
        Write-Host ("    ECHEC (code " + $LASTEXITCODE + ") — on s'arrete ici.") -ForegroundColor Red
        break
    }
}
$chrono.Stop()

Write-Host ""
Write-Host ("Chaine terminee en " + [math]::Round($chrono.Elapsed.TotalMinutes, 1) + " minutes.") -ForegroundColor Green
Write-Host "Etape suivante : declarer le niveau dans assets/app.js (NIVEAUX), puis build-mobile.ps1" -ForegroundColor DarkGray