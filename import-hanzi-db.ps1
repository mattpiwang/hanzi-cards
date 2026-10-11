<#
    ==========================================================================
    import-hanzi-db.ps1 — convertit la base Make Me a Hanzi en jeu de cartes
    ==========================================================================

    À QUOI ÇA SERT
    --------------
    La base « Make Me a Hanzi » (9 574 caractères, libre et gratuite) contient
    exactement les mêmes champs que nos fiches : pinyin, décomposition en
    radicaux, étymologie classée (象形 / 会意 / 形声) et radical principal.
    Ce script la convertit au format data/cards.json de l'application.

    LIMITE À CONNAÎTRE
    ------------------
    Les définitions et les étymologies de cette base sont EN ANGLAIS. Le script
    les range dans le champ « meaningEn » : l'application affiche « meaning »
    (français) quand il existe, et retombe sur l'anglais sinon — avec la
    mention (en). Les 41 fiches françaises déjà écrites à la main sont
    conservées telles quelles.

    USAGE
    -----
      # 1. tout importer (attention : ~9 500 fiches, lourd pour un téléphone)
      .\import-hanzi-db.ps1 -Category 'Tout'

      # 2. par étapes : HSK 1, HSK 2... avec un fichier de filtre
      .\import-hanzi-db.ps1 -FilterFile .\hsk1.txt -Category 'HSK 1'

      # 3. un simple échantillon, pour voir le rendu
      .\import-hanzi-db.ps1 -Limit 30 -Category 'Essai' -Output .\data\cards.test.json

    OPTIONS
    -------
      -Source <fichier>     dictionary.txt de Make Me a Hanzi (téléchargé si absent)
      -Output <fichier>     fichier de sortie (défaut : data\cards.json)
      -Category <libellé>   nom du filtre affiché dans l'application
      -FilterFile <fichier> fichier texte listant les caractères à importer
                            (espaces, virgules et retours à la ligne acceptés)
      -Limit <n>            ne garder que les n premiers caractères
      -Replace              repartir de zéro au lieu de compléter l'existant

    L'ANCIEN FICHIER EST SAUVEGARDÉ avant toute écriture (cards.backup.json).
#>
[CmdletBinding()]
param(
    [string]$Source,
    [string]$Output,
    [string]$Category = 'Importé',
    [string]$FilterFile,
    [int]$Limit = 0,
    [switch]$Replace
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = New-Object Text.UTF8Encoding($false)

# $PSScriptRoot n'est pas encore défini dans les valeurs par défaut des
# paramètres en PowerShell 5.1 : on calcule donc les chemins ici.
if (-not $Source) { $Source = Join-Path (Split-Path $PSScriptRoot -Parent) 'hanzi-db\dictionary.txt' }
if (-not $Output) { $Output = Join-Path $PSScriptRoot 'data\cards.json' }

# --------------------------------------------------------------------------
#  Outils
# --------------------------------------------------------------------------

<#
    Un caractère est-il un « composant » utilisable ?
    On accepte les idéogrammes (toutes extensions) ET les radicaux sous leur
    forme combinatoire : ⺍, ⺮, 亻, 氵… qui vivent dans des blocs Unicode
    séparés (CJK Radicals Supplement, Kangxi Radicals). On rejette les
    opérateurs de décomposition (⿰ ⿱ ⿻…) et les « ? » d'inconnu.
#>
function Test-Composant([char]$ch) {
    $cp = [int]$ch
    if ($cp -ge 0x2FF0 -and $cp -le 0x2FFB) { return $false }   # opérateurs IDS
    if ($ch -eq [char]0xFF1F -or $ch -eq '?') { return $false } # inconnu
    if ($cp -ge 0x2E80 -and $cp -le 0x2EFF) { return $true }    # radicaux supplement
    if ($cp -ge 0x2F00 -and $cp -le 0x2FDF) { return $true }    # radicaux Kangxi
    if ($cp -ge 0x3400 -and $cp -le 0x4DBF) { return $true }    # extension A
    if ($cp -ge 0x4E00 -and $cp -le 0x9FFF) { return $true }    # bloc principal
    if ($cp -ge 0xF900 -and $cp -le 0xFAFF) { return $true }    # compatibilite
    if ($cp -ge 0x20000) { return $true }                       # extensions B+
    return $false
}

<#
    Sens des formes combinatoires les plus courantes. Ces radicaux ne figurent
    pas comme entrées du dictionnaire, donc leur glose serait vide sans cette
    petite table. Le reste du temps, la glose vient du dictionnaire lui-même.
#>
$script:GlosesRadicaux = @{
    '亻' = 'personne';   '讠' = 'parole';    '氵' = 'eau';      '扌' = 'main'
    '忄' = 'coeur';      '宀' = 'toit';      '辶' = 'marcher';  '刂' = 'couteau'
    '艹' = 'herbe';      '⺮' = 'bambou';     '纟' = 'soie';     '钅' = 'metal'
    '饣' = 'nourriture'; '犭' = 'chien';     '礻' = 'rite';     '衤' = 'vetement'
    '疒' = 'maladie';    '灬' = 'feu';       '罒' = 'filet';    '皿' = 'recipient'
    '⺍' = 'petit (variante)'; '冖' = 'couvercle'; '广' = 'abri'; '尸' = 'corps'
    '攵' = 'main qui frappe'; '彳' = 'pas';   '亠' = 'couvercle'; '冫' = 'glace'
    '卩' = 'sceau';      '兀' = 'jambes';    '囗' = 'enceinte';  '夂' = 'pied'
}

function Get-Glose([string]$ch, $glossaire) {
    if ($script:GlosesRadicaux.ContainsKey($ch)) { return $script:GlosesRadicaux[$ch] }
    if ($glossaire.ContainsKey($ch)) { return $glossaire[$ch] }
    return '?'
}

<#
    Nettoie une définition anglaise : on coupe les indications de classificateur
    (CL:…), on remplace les points-virgules par des virgules, et on tronque.
#>
function Get-DefinitionCourte([string]$def, [int]$max = 90) {
    if (-not $def) { return $null }
    $d = $def -replace '\s*CL:.*$', ''      # retire « CL:個|个[ge4] »
    $d = $d -replace '\s*;\s*', ', '
    $d = $d -replace '\s+', ' '
    $d = $d.Trim(' ', ',')
    if ($d.Length -gt $max) { $d = $d.Substring(0, $max).TrimEnd(' ', ',') + '…' }
    return $d
}

<#
    Extrait les composants d'une décomposition IDS.
    Exemple : '⿱⿱⺍冖子' -> ⺍, 冖, 子
#>
function Get-Composants([string]$ids, [string]$caractere) {
    $res = New-Object System.Collections.ArrayList
    if (-not $ids) { return $res }
    foreach ($ch in $ids.ToCharArray()) {
        if (-not (Test-Composant $ch)) { continue }
        if ($ch -eq $caractere) { continue }              # pas de « 一 = 一 »
        if (-not $res.Contains($ch)) { [void]$res.Add($ch) }
        if ($res.Count -ge 4) { break }                   # 4 composants suffisent
    }
    return $res
}

# --------------------------------------------------------------------------
#  1. Source : téléchargement si nécessaire
# --------------------------------------------------------------------------

$url = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt'
if (-not (Test-Path $Source)) {
    Write-Host "Base absente, téléchargement depuis GitHub…" -ForegroundColor Cyan
    $dossier = Split-Path $Source -Parent
    if (-not (Test-Path $dossier)) { New-Item -ItemType Directory -Force -Path $dossier | Out-Null }
    Invoke-WebRequest -Uri $url -OutFile $Source -UseBasicParsing
    Write-Host "  téléchargé : $([math]::Round((Get-Item $Source).Length/1MB,2)) Mo" -ForegroundColor Green
}

Write-Host "Lecture de la base…" -ForegroundColor Cyan
$lignes = Get-Content -LiteralPath $Source -Encoding UTF8
Write-Host "  $($lignes.Count) entrées" -ForegroundColor DarkGray

# Index : caractère -> entrée, et caractère -> glose courte (pour les composants)
$entrees = @{}
$glossaire = @{}
foreach ($l in $lignes) {
    if (-not $l.Trim()) { continue }
    try { $o = $l | ConvertFrom-Json } catch { continue }
    if (-not $o.character) { continue }
    $entrees[$o.character] = $o
    $g = Get-DefinitionCourte $o.definition 30
    if ($g) { $glossaire[$o.character] = $g }
}
Write-Host "  index : $($entrees.Count) caractères" -ForegroundColor DarkGray

# --------------------------------------------------------------------------
#  2. Sélection des caractères à importer
# --------------------------------------------------------------------------

$existantes = @()
if ((Test-Path $Output) -and -not $Replace) {
    try {
        $ancien = Get-Content -LiteralPath $Output -Raw -Encoding UTF8 | ConvertFrom-Json
        $existantes = @($ancien.cards)
        Write-Host "Fiches existantes conservées : $($existantes.Count)" -ForegroundColor DarkGray
    } catch { Write-Warning "Ancien fichier illisible, il sera remplacé." }
}
$dejaLa = @{}
foreach ($c in $existantes) { $dejaLa[$c.char] = $true }

if ($FilterFile) {
    if (-not (Test-Path $FilterFile)) { throw "Fichier de filtre introuvable : $FilterFile" }
    $texte = Get-Content -LiteralPath $FilterFile -Raw -Encoding UTF8
    $voulus = New-Object System.Collections.ArrayList
    foreach ($ch in $texte.ToCharArray()) {
        if (-not (Test-Composant $ch)) { continue }
        # On stocke des CHAÎNES : les clés de l'index sont des chaînes, et
        # [char]'好' n'est pas égal à [string]'好' pour une table de hachage.
        $s = [string]$ch
        if (-not $voulus.Contains($s)) { [void]$voulus.Add($s) }
    }
    Write-Host "Filtre : $($voulus.Count) caractères trouvés dans le fichier" -ForegroundColor Cyan
    $selection = @($voulus | Where-Object { $entrees.ContainsKey($_) -and -not $dejaLa.ContainsKey($_) })
} else {
    $selection = @($entrees.Keys | Where-Object { -not $dejaLa.ContainsKey($_) })
}
if ($Limit -gt 0 -and $selection.Count -gt $Limit) { $selection = $selection[0..($Limit - 1)] }
if (-not $FilterFile -and $Limit -gt 0) {
    Write-Warning "Sans -FilterFile, l'ordre suivi est celui du fichier source (ordre Unicode) : les caractères les plus rares arrivent en premier. Fournis un fichier de filtre (HSK, fréquence…) pour un résultat utile."
}

Write-Host "À importer : $($selection.Count) caractère(s)" -ForegroundColor Cyan
if ($selection.Count -eq 0) { Write-Host "Rien à faire." -ForegroundColor Yellow; return }

# --------------------------------------------------------------------------
#  3. Conversion
# --------------------------------------------------------------------------

$libelleType = @{
    'pictographic'  = '象形 — pictogramme'
    'ideographic'   = '会意 — idéogramme composé'
    'pictophonetic' = '形声 — composé phonétique-sémantique'
}

$nouvelles = New-Object System.Collections.ArrayList
$i = 0
foreach ($ch in $selection) {
    $i++
    $o = $entrees[$ch]

    # --- composants, avec leur rôle déduit de l'étymologie
    $ids = [string]$o.decomposition
    # Une décomposition contenant « ？ » est incomplète : mieux vaut ne rien
    # afficher qu'un composant trompeur (cas de 水, décomposé en ⿻亅？).
    $incomplete = $ids.Contains([char]0xFF1F) -or $ids.Contains('?')
    $comps = if ($incomplete) { @() } else { Get-Composants $ids $ch }
    $sem = ''; $phon = ''
    $type = ''; $hint = ''
    if ($o.etymology) {
        $type = [string]$o.etymology.type
        $hint = [string]$o.etymology.hint
        if ($type -eq 'pictophonetic') {
            $sem = [string]$o.etymology.semantic
            $phon = [string]$o.etymology.phonetic
        }
    }
    # Tableau simple de tableaux : une ArrayList traversée par le pipeline se
    # sérialise en {"value":…,"Count":…} au lieu d'un tableau imbriqué.
    $listeComps = @()
    foreach ($cp in $comps) {
        $role = 'composant'
        if ($sem -and $sem.Contains($cp)) { $role = 'sens' }
        elseif ($phon -and $phon.Contains($cp)) { $role = 'son' }
        $listeComps += , @([string]$cp, [string](Get-Glose $cp $glossaire), [string]$role)
    }

    # --- étymologie : libellé français + texte (anglais, tel quel)
    if ($type -and $libelleType.ContainsKey($type)) {
        # Les entrées rares n'ont parfois qu'un fragment (« metal ») comme
        # indice : on ne l'affiche tel quel que s'il ressemble à une phrase.
        $texte = if ($hint -and $hint.Length -gt 25) { $hint }
                 elseif ($hint) { "(indice : $hint)" }
                 else { '(pas de détail)' }
        if ($type -eq 'pictophonetic') {
            $morceaux = @()
            if ($sem)  { $morceaux += "$sem donne le sens" }
            if ($phon) { $morceaux += "$phon donne la prononciation" }
            if ($morceaux.Count) { $texte = (($morceaux -join ' ; ') + ". $texte") }
        }
        $etymo = @($libelleType[$type], $texte)
    } else {
        $etymo = @('—', 'Étymologie non documentée dans cette base.')
    }

    # --- construction de la fiche
    $fiche = [ordered]@{}
    $fiche['char']    = [string]$o.character
    $fiche['pinyin']  = if ($o.pinyin -and @($o.pinyin).Count -gt 0) { [string]$o.pinyin[0] } else { '' }
    $fiche['meaningEn'] = (Get-DefinitionCourte $o.definition 90)
    $fiche['category']  = $Category
    $fiche['radical']   = [string]$o.radical
    $fiche['components'] = [object[]]$listeComps
    $fiche['etymology']  = $etymo
    $fiche['source']     = 'Make Me a Hanzi'

    [void]$nouvelles.Add([pscustomobject]$fiche)

    if ($i % 100 -eq 0) { Write-Host "  ... $i / $($selection.Count)" -ForegroundColor DarkGray }
}

# --------------------------------------------------------------------------
#  4. Écriture (avec sauvegarde)
# --------------------------------------------------------------------------

$toutes = @()
if (-not $Replace) { $toutes += $existantes }
$toutes += $nouvelles

$doc = [ordered]@{
    deck    = 'Hanzi — caractères chinois'
    note    = "Fiches françaises écrites à la main, complétées par la base libre Make Me a Hanzi (définitions et étymologies en anglais)."
    schema  = @{
        components = '[caractère, glose, rôle] — rôle = sens | son | composant'
        words      = '[mot, pinyin, traduction]'
        etymology  = '[type, explication]'
        meaningEn  = "définition anglaise, utilisée si aucune traduction française n'est fournie"
    }
    cards = $toutes
}

if (Test-Path $Output) {
    $sauvegarde = Join-Path (Split-Path $Output -Parent) 'cards.backup.json'
    Copy-Item $Output $sauvegarde -Force
    Write-Host "Sauvegarde : $sauvegarde" -ForegroundColor DarkGray
}
$json = $doc | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($Output, $json, $utf8NoBom)

Write-Host ""
Write-Host "Terminé." -ForegroundColor Green
Write-Host ("  fiches ajoutées : {0}" -f $nouvelles.Count) -ForegroundColor Green
Write-Host ("  total           : {0}" -f $toutes.Count)   -ForegroundColor Green
Write-Host ("  fichier         : {0} ({1} Ko)" -f $Output, [math]::Round((Get-Item $Output).Length/1KB,1)) -ForegroundColor Green
Write-Host "  Pense à relancer build-mobile.ps1 pour la version hors ligne." -ForegroundColor DarkGray
