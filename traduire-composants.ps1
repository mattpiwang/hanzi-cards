<#
    ==========================================================================
    traduire-composants.ps1 — traduit les gloses des radicaux d'un niveau
    ==========================================================================

    À QUOI ÇA SERT
    --------------
    Chaque fiche décrit ses radicaux sous la forme [caractère, glose, rôle].
    Les gloses viennent de Make Me a Hanzi, donc EN ANGLAIS. L'application ne
    devant jamais afficher d'anglais, il faut les traduire.

    Le script est le frère de traduire.ps1 (qui s'occupe des sens et des
    étymologies) : même méthode — Ziya, un fichier prompt en UTF-8, un JSON
    relu entre chaque lot — et mêmes garanties : on peut le relancer, il
    reprend là où il s'est arrêté.

    ENTRÉES / SORTIE
    ----------------
        data\cards-hsk1.json            par défaut (-Fichier pour un autre niveau)
        data\traductions-composants[-niveau].json      gloses traduites

    USAGE
    -----
        .\traduire-composants.ps1 -Fichier data\cards-hsk2.json
        .\traduire-composants.ps1 -Fichier data\cards-hsk2.json -SansAppliquer
#>
[CmdletBinding()]
param(
    [string]$Fichier,          # fiches à traiter (défaut : data\cards-hsk1.json)
    [int]$Taille = 30,         # gloses par lot envoyé à Ziya
    [switch]$SansAppliquer
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding($false)
$utf8Bom = New-Object Text.UTF8Encoding($true)

$oc = Join-Path $env:APPDATA 'npm\openclaw.cmd'
if (-not (Test-Path $oc)) { throw "OpenClaw introuvable : $oc" }

# ---- le fichier de fiches, et le nom des fichiers produits -----------------
if (-not $Fichier) { $Fichier = Join-Path $root 'data\cards-hsk1.json' }
elseif (-not [IO.Path]::IsPathRooted($Fichier)) { $Fichier = Join-Path $root $Fichier }
$feuille = Split-Path $Fichier -Leaf
$suffixe = ''
if ($feuille -ne 'cards.json') { $suffixe = '-' + ($feuille -replace '^cards-', '' -replace '\.json$', '') }
$sortie = Join-Path $root ("data\traductions-composants$suffixe.json")
$promptPath = Join-Path $env:TEMP "dsh-prompt-composants$suffixe.txt"

# ---- les gloses déjà traduites (on reprend) --------------------------------
$fait = @{}
if (Test-Path $sortie) {
    try {
        $ancien = Get-Content $sortie -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($p in $ancien.PSObject.Properties) {
            if ($p.Name -in 'Count','Keys','Values','IsReadOnly','IsFixedSize','IsSynchronized','SyncRoot','Length') { continue }
            if ([string]$p.Value -and ([string]$p.Value).Trim()) { $fait[$p.Name] = ([string]$p.Value).Trim() }
        }
    } catch { Write-Host "  (fichier de traductions illisible, on repart)" -ForegroundColor DarkYellow }
}

# ---- les gloses à traduire -------------------------------------------------
$doc = Get-Content $Fichier -Raw -Encoding UTF8 | ConvertFrom-Json
$cartes = @($doc.cards)
$aFaire = @{}
foreach ($c in $cartes) {
    if (-not $c.components) { continue }
    foreach ($comp in $c.components) {
        $g = [string]$comp[1]
        if (-not $g -or $g.Trim() -eq '') { continue }
        if (-not $aFaire.ContainsKey($g)) { $aFaire[$g] = $true }
    }
}
$liste = @($aFaire.Keys | Where-Object { -not $fait.ContainsKey($_) })
Write-Host ("Gloses distinctes : " + $aFaire.Count + "  (deja traduites : " + (@($aFaire.Keys | Where-Object { $fait.ContainsKey($_) }).Count) + ")") -ForegroundColor Cyan
Write-Host ("A traduire : " + $liste.Count) -ForegroundColor Cyan

# ---- traduction par lots ---------------------------------------------------
$lots = [Math]::Ceiling($liste.Count / $Taille)
for ($i = 0; $i -lt $liste.Count; $i += $Taille) {
    $fin = [Math]::Min($i + $Taille - 1, $liste.Count - 1)
    $lot = @($liste[$i..$fin])
    $n = [int]($i / $Taille) + 1
    $entete = @"
Tu es traducteur. Traduis en francais ces gloses de radicaux chinois (elles viennent d'un dictionnaire anglais).
Regles :
- deux a cinq mots, sans article initial, registre courant
- ce sont des sens de radicaux : garde-les concrets et courts
- reponds UNIQUEMENT par un objet JSON valide sur UNE SEULE LIGNE : {"glose anglaise":"glose francaise", ...}
- aucune phrase avant ou apres, aucune balise de code

"@
    $corps = ($lot | ForEach-Object { "- " + $_ }) -join "`n"
    [IO.File]::WriteAllText($promptPath, ($entete + $corps), $utf8)

    $chrono = [Diagnostics.Stopwatch]::StartNew()
    $rep = & $oc agent --message-file $promptPath 2>&1 | Out-String
    $chrono.Stop()
    $d = $rep.IndexOf('{'); $f = $rep.LastIndexOf('}')
    if ($d -ge 0 -and $f -gt $d) {
        try {
            $o = $rep.Substring($d, $f - $d + 1) | ConvertFrom-Json
            $ajout = 0
            foreach ($p in $o.PSObject.Properties) {
                if ($p.Name -in 'Count','Keys','Values','IsReadOnly','IsFixedSize','IsSynchronized','SyncRoot','Length') { continue }
                $v = ([string]$p.Value).Trim()
                if ($v) { $fait[$p.Name] = $v; $ajout++ }
            }
            Write-Host ("[$n/$lots] " + $lot.Count + " gloses -> " + $ajout + " traductions en " + [math]::Round($chrono.Elapsed.TotalSeconds,1) + " s")
        } catch { Write-Host ("[$n/$lots] ECHEC d'analyse : " + $_.Exception.Message) -ForegroundColor Red }
    } else {
        Write-Host ("[$n/$lots] ECHEC : pas de JSON dans la reponse") -ForegroundColor Red
    }

    # On écrit après chaque lot : une coupure ne fait rien perdre.
    $paires = @()
    foreach ($e in $fait.GetEnumerator()) {
        $paires += ('  ' + (ConvertTo-Json $e.Key) + ': ' + (ConvertTo-Json $e.Value))
    }
    [IO.File]::WriteAllText($sortie, ('{' + [Environment]::NewLine + ($paires -join (',' + [Environment]::NewLine)) + [Environment]::NewLine + '}'), $utf8Bom)
}

Write-Host ""
Write-Host ("Traductions enregistrees : " + $fait.Count + "  -> " + $sortie) -ForegroundColor Green

# ---- application dans le fichier de fiches ---------------------------------
if ($SansAppliquer) { return }

$manquantes = 0
foreach ($c in $cartes) {
    if (-not $c.components) { continue }
    $nouveaux = @()
    foreach ($comp in $c.components) {
        $g = [string]$comp[1]
        if ($fait.ContainsKey($g)) { $nouveaux += , @([string]$comp[0], $fait[$g], [string]$comp[2]) }
        else { $nouveaux += , @([string]$comp[0], $g, [string]$comp[2]); if ($g) { $manquantes++ } }
    }
    $c.components = $nouveaux
}

$sauvegarde = Join-Path (Split-Path $Fichier -Parent) 'cards.backup.json'
Copy-Item $Fichier $sauvegarde -Force
# Sans BOM : JSON.parse, cote navigateur, refuse un BOM en tete.
[IO.File]::WriteAllText($Fichier, (ConvertTo-Json $doc -Depth 12), $utf8)

Write-Host ("Applique dans " + $feuille + " : " + $cartes.Count + " fiche(s)") -ForegroundColor Green
if ($manquantes) { Write-Host ("Gloses restees en anglais : " + $manquantes) -ForegroundColor Yellow }
else { Write-Host "Aucune glose restee en anglais" -ForegroundColor Green }
