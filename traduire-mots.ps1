<#
    ==========================================================================
    traduire-mots.ps1 — traduit les définitions des mots d'exemple d'un niveau
    ==========================================================================

    À QUOI ÇA SERT
    --------------
    build-exemples.js choisit, pour chaque fiche, deux mots du programme HSK,
    avec leur pinyin et leur définition tirée de CC-CEDICT — donc EN ANGLAIS.
    L'application ne devant jamais afficher d'anglais, ce script les traduit.

    Troisième frère de la même famille (traduire.ps1 pour les sens et les
    étymologies, traduire-composants.ps1 pour les radicaux) : même méthode,
    mêmes garanties — relançable, il reprend où il s'est arrêté.

    ENTRÉES / SORTIE
    ----------------
        data\mots-choisis[-niveau].json     mots choisis (produit par build-exemples.js)
        data\traductions-mots[-niveau].json définitions traduites

    USAGE
    -----
        .\traduire-mots.ps1 -Fichier data\cards-hsk2.json
#>
[CmdletBinding()]
param(
    [string]$Fichier,          # fiches du niveau (défaut : data\cards-hsk1.json)
    [int]$Taille = 30,         # définitions par lot envoyé à Ziya
    [switch]$SansEcrire
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding($false)
$utf8Bom = New-Object Text.UTF8Encoding($true)

$oc = Join-Path $env:APPDATA 'npm\openclaw.cmd'
if (-not (Test-Path $oc)) { throw "OpenClaw introuvable : $oc" }

# ---- le niveau, et les fichiers qui en découlent ---------------------------
if (-not $Fichier) { $Fichier = Join-Path $root 'data\cards-hsk1.json' }
elseif (-not [IO.Path]::IsPathRooted($Fichier)) { $Fichier = Join-Path $root $Fichier }
$feuille = Split-Path $Fichier -Leaf
$suffixe = ''
if ($feuille -ne 'cards.json') { $suffixe = '-' + ($feuille -replace '^cards-', '' -replace '\.json$', '') }

$choisis = Join-Path $root ("data\mots-choisis$suffixe.json")
$sortie = Join-Path $root ("data\traductions-mots$suffixe.json")
$promptPath = Join-Path $env:TEMP "dsh-prompt-mots$suffixe.txt"

if (-not (Test-Path $choisis)) { throw "Fichier de mots introuvable : $choisis (lancer build-exemples.js)" }

# ---- les définitions déjà traduites (on reprend) ---------------------------
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

# ---- les définitions à traduire --------------------------------------------
$doc = Get-Content $choisis -Raw -Encoding UTF8 | ConvertFrom-Json
$aFaire = [ordered]@{}
foreach ($p in $doc.PSObject.Properties) {
    if ($p.Name -in 'Count','Keys','Values','IsReadOnly','IsFixedSize','IsSynchronized','SyncRoot','Length') { continue }
    foreach ($m in @($p.Value)) {
        $d = [string]$m.def
        if (-not $d -or $d.Trim() -eq '') { continue }
        if (-not $aFaire.Contains($d)) { $aFaire[$d] = $true }
    }
}
$liste = @($aFaire.Keys | Where-Object { -not $fait.ContainsKey($_) })
Write-Host ("Définitions distinctes : " + $aFaire.Count + "  (déjà traduites : " + (@($aFaire.Keys | Where-Object { $fait.ContainsKey($_) }).Count) + ")") -ForegroundColor Cyan
Write-Host ("À traduire : " + $liste.Count) -ForegroundColor Cyan

# ---- traduction par lots ---------------------------------------------------
$lots = [Math]::Ceiling($liste.Count / $Taille)
for ($i = 0; $i -lt $liste.Count; $i += $Taille) {
    $fin = [Math]::Min($i + $Taille - 1, $liste.Count - 1)
    $lot = @($liste[$i..$fin])
    $n = [int]($i / $Taille) + 1
    $entete = @"
Tu es traducteur. Traduis en francais ces definitions de mots chinois (elles viennent d'un dictionnaire anglais).
Regles :
- deux a six mots, registre courant et concret
- ignore les renvois de classificateur (CL:...) et les crochets
- reponds UNIQUEMENT par un objet JSON valide sur UNE SEULE LIGNE : {"definition anglaise":"definition francaise", ...}
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
            Write-Host ("[$n/$lots] " + $lot.Count + " definitions -> " + $ajout + " traductions en " + [math]::Round($chrono.Elapsed.TotalSeconds,1) + " s")
        } catch { Write-Host ("[$n/$lots] ECHEC d'analyse : " + $_.Exception.Message) -ForegroundColor Red }
    } else {
        Write-Host ("[$n/$lots] ECHEC : pas de JSON dans la reponse") -ForegroundColor Red
    }

    if (-not $SansEcrire) {
        $paires = @()
        foreach ($e in $fait.GetEnumerator()) {
            $paires += ('  ' + (ConvertTo-Json $e.Key) + ': ' + (ConvertTo-Json $e.Value))
        }
        [IO.File]::WriteAllText($sortie, ('{' + [Environment]::NewLine + ($paires -join (',' + [Environment]::NewLine)) + [Environment]::NewLine + '}'), $utf8)
    }
}

Write-Host ""
Write-Host ("Traductions enregistrees : " + $fait.Count + "  -> " + $sortie) -ForegroundColor Green
Write-Host "Etape suivante : node apply-exemples.js $feuille" -ForegroundColor DarkGray
