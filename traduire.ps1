<#
    ==========================================================================
    traduire.ps1 — traduit les fiches importées en français, par Ziya
    ==========================================================================

    POURQUOI CE DÉTOUR
    ------------------
    Les 212 fiches importées de Make Me a Hanzi ont un sens et une étymologie
    en anglais. Plutôt que de manipuler une clé d'API, on demande la traduction
    à l'assistant OpenClaw (Ziya), qui tourne déjà sur DeepSeek et détient ses
    propres identifiants.

    Le prompt est écrit dans un fichier UTF-8 et transmis par --message-file :
    c'est le seul moyen fiable de faire passer des caractères chinois par la
    ligne de commande.

    USAGE
    -----
        .\traduire.ps1 -Quoi sens  -Limit 25      # essai sur un seul lot
        .\traduire.ps1 -Quoi sens                 # tous les sens manquants
        .\traduire.ps1 -Quoi etymo                # toutes les étymologies
        .\traduire.ps1 -Quoi sens -AppliquerSeul  # réapplique le fichier déjà obtenu

    SORTIE
    ------
        data/traductions-sens.json    { "爱": "aimer, affection", ... }
        data/traductions-etymo.json   { "爱": "Une main qui offre son cœur…", ... }

    Le fichier de sortie est complété après CHAQUE lot : une interruption ne
    fait rien perdre, il suffit de relancer. L'ancien fichier de fiches est sauvegardé
    dans data/cards.backup.json avant toute écriture.
#>
[CmdletBinding()]
param(
    [ValidateSet('sens', 'etymo')] [string]$Quoi = 'sens',
    [string]$Fichier,          # fiches à traduire (défaut : data\cards-hsk1.json)
    [int]$Taille = 25,
    [int]$Limit = 0,
    [switch]$AppliquerSeul,
    [switch]$SansAppliquer
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
# Le fichier de fiches : celui du niveau de base par défaut, ou celui demandé
# (-Fichier data\cards-hsk2.json). Les noms des fichiers produits en découlent,
# pour que deux niveaux ne s'écrasent pas l'un l'autre.
if (-not $Fichier) { $Fichier = Join-Path $root 'data\cards-hsk1.json' }
elseif (-not [IO.Path]::IsPathRooted($Fichier)) { $Fichier = Join-Path $root $Fichier }
$cardsPath = $Fichier
$suffixe = ''
$feuille = Split-Path $cardsPath -Leaf
if ($feuille -ne 'cards.json') { $suffixe = '-' + ($feuille -replace '^cards-', '' -replace '\.json$', '') }
$sortie = Join-Path $root ("data\traductions-$Quoi$suffixe.json")
$promptPath = Join-Path $env:TEMP "dsh-prompt-$Quoi$suffixe.txt"
$utf8 = New-Object Text.UTF8Encoding($false)
$utf8Bom = New-Object Text.UTF8Encoding($true)

# --- l'assistant, avec un PATH reconstruit (les shells peuvent être en retard)
$machinePath = ([Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Session Manager\Environment')).GetValue('Path', '', 'DoNotExpandEnvironmentNames')
$userPath = ([Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')).GetValue('Path', '', 'DoNotExpandEnvironmentNames')
$env:Path = [Environment]::ExpandEnvironmentVariables("$machinePath;$userPath")
$oc = Join-Path $env:APPDATA 'npm\openclaw.cmd'
if (-not (Test-Path $oc)) { throw "commande openclaw introuvable : $oc" }

function Get-Traductions {
    param([string]$Texte)
    # Le modèle encadre parfois sa réponse de texte ou de ``` : on isole le
    # premier objet JSON complet, puis on le relit.
    $debut = $Texte.IndexOf('{')
    $fin = $Texte.LastIndexOf('}')
    if ($debut -lt 0 -or $fin -le $debut) { throw "aucun objet JSON dans la réponse" }
    $brut = $Texte.Substring($debut, $fin - $debut + 1)
    return ($brut | ConvertFrom-Json)
}

function Get-DejaFait {
    $res = @{}
    if (-not (Test-Path $sortie)) { return $res }
    try {
        $lu = Get-Content $sortie -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($p in $lu.PSObject.Properties) {
            # Un ancien fichier ecrit par ConvertTo-Json contenait les
            # proprietes internes de la table de hachage : on les ignore.
            if ($p.Name -in 'Count','Keys','Values','IsReadOnly','IsFixedSize','IsSynchronized','SyncRoot','Length') { continue }
            $res[$p.Name] = $p.Value
        }
    } catch { }
    return $res
}

# --------------------------------------------------------------------------
#  1. Chargement et sélection du travail
# --------------------------------------------------------------------------

$doc = Get-Content $cardsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$cartes = @($doc.cards)
Write-Host "Fiches au total : $($cartes.Count)" -ForegroundColor Cyan

$dejaFait = Get-DejaFait
$fait = @{}
foreach ($cle in $dejaFait.Keys) { $fait[$cle] = $dejaFait[$cle] }

# Seules les fiches importées (source = Make Me a Hanzi) ont besoin de traduction.
$aFaire = @()
foreach ($c in $cartes) {
    if (-not $c.source) { continue }        # fiches écrites à la main : déjà en français
    if ($Quoi -eq 'sens') {
        if (-not $c.meaning -and $c.meaningEn -and -not $fait.ContainsKey($c.char)) { $aFaire += $c }
    } else {
        if ($c.etymology -and $c.etymology.Count -ge 2 -and $c.etymology[1] -and -not $fait.ContainsKey($c.char)) { $aFaire += $c }
    }
}
Write-Host "A traduire ($Quoi) : $($aFaire.Count) fiches (déjà faites : $($fait.Count))" -ForegroundColor Cyan

if ($AppliquerSeul -or $aFaire.Count -eq 0) {
    Write-Host "Rien à collecter." -ForegroundColor DarkGray
} else {
    # ----------------------------------------------------------------------
    #  2. Collecte, lot par lot
    # ----------------------------------------------------------------------

    if ($Limit -gt 0 -and $aFaire.Count -gt $Limit) { $aFaire = $aFaire[0..($Limit - 1)] }
    $lots = [Math]::Ceiling($aFaire.Count / $Taille)
    Write-Host "Découpage : $lots lot(s) de $Taille" -ForegroundColor Cyan

    $faitLot = 0
    for ($i = 0; $i -lt $aFaire.Count; $i += $Taille) {
        $fin = [Math]::Min($i + $Taille - 1, $aFaire.Count - 1)
        $lot = $aFaire[$i..$fin]
        $faitLot++

        # --- consigne + données, dans un fichier UTF-8
        if ($Quoi -eq 'sens') {
            $entete = @"
Tu es traducteur. Traduis en francais les definitions anglaises de caracteres chinois ci-dessous.
Regles :
- deux a six mots, sans article inutile ; separe les sens par des virgules
- registre simple et concret
- reponds UNIQUEMENT par un objet JSON valide sur UNE SEULE LIGNE : {"car":"traduction", ...}
- aucune phrase avant ou apres, aucune balise de code
- si tu ne connais pas un caractere, mets une chaine vide

"@
        } else {
            $entete = @"
Tu es traducteur. Traduis en francais ces explications etymologiques de caracteres chinois (elles viennent d'une base anglaise).
Regles :
- garde les caracteres chinois cites tels quels, avec leurs espaces
- une phrase courte, ton pedagogique
- reponds UNIQUEMENT par un objet JSON valide sur UNE SEULE LIGNE : {"car":"traduction", ...}
- aucune phrase avant ou apres, aucune balise de code

"@
        }

        $lignes = @()
        foreach ($c in $lot) {
            if ($Quoi -eq 'sens') { $lignes += "$($c.char) : $($c.meaningEn)" }
            else { $lignes += "$($c.char) : $($c.etymology[1])" }
        }
        [IO.File]::WriteAllText($promptPath, ($entete + ($lignes -join "`n")), $utf8)

        Write-Host "[$faitLot/$lots] $($lot.Count) fiches…" -ForegroundColor Cyan -NoNewline
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $reponse = & $oc agent --message-file $promptPath 2>&1 | Out-String
        $sw.Stop()

        try {
            $nouvelles = Get-Traductions $reponse
            $ajout = 0
            foreach ($p in $nouvelles.PSObject.Properties) {
                if ($p.Name -in 'Count','Keys','Values','IsReadOnly','IsFixedSize','IsSynchronized','SyncRoot','Length') { continue }
                $v = [string]$p.Value
                if ($v.Trim()) { $fait[$p.Name] = $v.Trim(); $ajout++ }
            }
            # On réécrit le fichier de sortie après chaque lot. Écriture
            # manuelle : ConvertTo-Json sur une table de hachage y ajouterait
            # ses propres propriétés (Count, Keys, Values…).
            $paires = @()
            foreach ($entree in $fait.GetEnumerator()) {
                $paires += ('  ' + (ConvertTo-Json $entree.Key) + ': ' + (ConvertTo-Json $entree.Value))
            }
            $json = '{' + [Environment]::NewLine + ($paires -join (',' + [Environment]::NewLine)) + [Environment]::NewLine + '}'
            [IO.File]::WriteAllText($sortie, $json, $utf8Bom)
            Write-Host " $ajout traductions en $([math]::Round($sw.Elapsed.TotalSeconds,1)) s" -ForegroundColor Green
        } catch {
            Write-Host " ECHEC ($($_.Exception.Message)) en $([math]::Round($sw.Elapsed.TotalSeconds,1)) s" -ForegroundColor Yellow
            Write-Host "   réponse : $($reponse.Trim().Substring(0, [Math]::Min(200, $reponse.Trim().Length)))" -ForegroundColor DarkGray
        }
    }

    Write-Host ""
    $nbFait = @($fait.GetEnumerator()).Count
Write-Host "Traductions enregistrees : $nbFait  -> $sortie" -ForegroundColor Green
}

# --------------------------------------------------------------------------
#  3. Application dans cards.json
# --------------------------------------------------------------------------

if ($SansAppliquer) { Write-Host "Application sautée (-SansAppliquer)." -ForegroundColor DarkGray; return }

$appliquees = 0
foreach ($c in $cartes) {
    if (-not $c.source) { continue }
    if (-not $fait.ContainsKey($c.char)) { continue }
    $trad = $fait[$c.char]
    if ($Quoi -eq 'sens') {
        # Les fiches importées n'ont pas de champ « meaning » : il faut le créer
        # (une affectation directe échoue sur un objet qui ne le possède pas).
        if (-not $c.meaning) {
            $c | Add-Member -NotePropertyName meaning -NotePropertyValue $trad -Force
            $appliquees++
        }
    } else {
        if ($c.etymology -and $c.etymology.Count -ge 2) {
            # L'anglais reste dans le fichier, sous etymologyEn, pour référence.
            if (-not $c.etymologyEn) { $c | Add-Member -NotePropertyName etymologyEn -NotePropertyValue $c.etymology[1] -Force }
            $c.etymology[1] = $trad
            $appliquees++
        }
    }
}

if ($appliquees -eq 0) { Write-Host "Aucune nouvelle traduction à appliquer." -ForegroundColor DarkGray; return }

Copy-Item $cardsPath (Join-Path $root 'data\cards.backup.json') -Force
[IO.File]::WriteAllText($cardsPath, ($doc | ConvertTo-Json -Depth 8), $utf8)

Write-Host ""
Write-Host "Applique dans $feuille : $appliquees fiche(s)" -ForegroundColor Green
Write-Host "Pense a relancer build-mobile.ps1, puis a committer." -ForegroundColor DarkGray
