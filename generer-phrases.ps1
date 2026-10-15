<#
    ==========================================================================
    generer-phrases.ps1 — une phrase d'exemple par fiche (drôle ou chéngyǔ)
    ==========================================================================

    À QUOI ÇA SERT
    --------------
    Chaque fiche a ses mots d'exemple ; il manque une PHRASE qui met le
    caractère en situation. Ce script demande à Ziya, pour chaque fiche :

      - soit une phrase drôle, absurde ou inattendue, mais simple ;
      - soit un chéngyǔ (expression de quatre caractères) contenant le
        caractère, accompagné de son explication en français.

    La phrase doit contenir le caractère de la fiche : c'est vérifié ensuite
    par verifier-phrases.py.

    ENTRÉES / SORTIE
    ----------------
        data\cards-hsk1.json        les fiches (on y lit char, pinyin, meaning, words)
        data\phrases-hsk1.json      { "爱": ["句子", "pīnyīn", "français", "explication"], … }

    Relançable : il reprend où il s'est arrêté (le fichier de sortie est
    relu au démarrage et réécrit après chaque lot).

    USAGE
    -----
        .\generer-phrases.ps1                          (défaut : cards-hsk1.json)
        .\generer-phrases.ps1 -Fichier data\cards-hsk2.json
        .\generer-phrases.ps1 -Taille 8                (lots plus petits)
#>
[CmdletBinding()]
param(
    [string]$Fichier,          # fiches à traiter (défaut : data\cards-hsk1.json)
    [int]$Taille = 12,         # fiches par lot envoyé à Ziya
    [switch]$SansEcrire
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding($false)

# L'analyseur JSON, confie a Node : JSON.parse est strict et previsible, la ou
# ConvertFrom-Json de Windows PowerShell rejette parfois un tableau valide.
$scriptAnalyse = @'
const fs = require("fs");
const o = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = {};
for (const k of Object.keys(o)) {
    const v = o[k];
    if (Array.isArray(v) && v.length >= 3 && String(v[0]).trim()) out[k] = v;
}
process.stdout.write(JSON.stringify(out));
'@

$oc = Join-Path $env:APPDATA 'npm\openclaw.cmd'
if (-not (Test-Path $oc)) { throw "OpenClaw introuvable : $oc" }

# ---- le niveau, et les fichiers qui en découlent ---------------------------
if (-not $Fichier) { $Fichier = Join-Path $root 'data\cards-hsk1.json' }
elseif (-not [IO.Path]::IsPathRooted($Fichier)) { $Fichier = Join-Path $root $Fichier }
$feuille = Split-Path $Fichier -Leaf
$suffixe = '-' + ($feuille -replace '^cards-', '' -replace '\.json$', '')
$sortie = Join-Path $root ("data\phrases$suffixe.json")
$promptPath = Join-Path $env:TEMP "dsh-prompt-phrases$suffixe.txt"

if (-not (Test-Path $Fichier)) { throw "Fichier de fiches introuvable : $Fichier" }

# ---- ce qui est déjà fait --------------------------------------------------
$fait = [ordered]@{}
if (Test-Path $sortie) {
    try {
        $ancien = Get-Content $sortie -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($p in $ancien.PSObject.Properties) {
            if ($p.Name -in 'Count','Keys','Values','IsReadOnly','IsFixedSize','IsSynchronized','SyncRoot','Length') { continue }
            $v = @($p.Value)
            if ($v.Count -ge 3 -and ([string]$v[0]).Trim()) { $fait[$p.Name] = $v }
        }
    } catch { Write-Host "  (fichier de phrases illisible, on repart)" -ForegroundColor DarkYellow }
}

# ---- les fiches à traiter --------------------------------------------------
$doc = Get-Content $Fichier -Raw -Encoding UTF8 | ConvertFrom-Json
$aFaire = New-Object System.Collections.ArrayList
foreach ($c in $doc.cards) {
    $ch = [string]$c.char
    if (-not $ch) { continue }
    if ($fait.Contains($ch)) { continue }
    if ($c.phrase -and @($c.phrase).Count -ge 3) { continue }   # déjà dans les fiches
    [void]$aFaire.Add($c)
}

Write-Host ("Fiches du fichier      : " + @($doc.cards).Count) -ForegroundColor Cyan
Write-Host ("Phrases deja obtenues  : " + $fait.Count) -ForegroundColor Cyan
Write-Host ("A generer              : " + $aFaire.Count) -ForegroundColor Cyan

# ---- écriture du fichier de phrases (reprise possible) ---------------------
function Ecrire-Phrases {
    if ($SansEcrire) { return }
    $paires = @()
    foreach ($e in $fait.GetEnumerator()) {
        $paires += ('  ' + (ConvertTo-Json $e.Key) + ': ' + (ConvertTo-Json @($e.Value) -Compress -Depth 4))
    }
    [IO.File]::WriteAllText($sortie, ('{' + [Environment]::NewLine + ($paires -join (',' + [Environment]::NewLine)) + [Environment]::NewLine + '}'), $utf8)
}

# ---- génération par lots ---------------------------------------------------
$lots = [Math]::Ceiling($aFaire.Count / $Taille)
for ($i = 0; $i -lt $aFaire.Count; $i += $Taille) {
    $fin = [Math]::Min($i + $Taille - 1, $aFaire.Count - 1)
    $lot = @($aFaire[$i..$fin])
    $n = [int]($i / $Taille) + 1

    $entete = @'
Tu ecris des phrases d'exemple en chinois pour un apprenant debutant (niveau HSK 1).
Pour chaque caractere de la liste, ecris UNE phrase courte qui CONTIENT ce caractere.
Choisis, en alternant :
  - soit une phrase drole, absurde ou inattendue, mais tres simple ;
  - soit un chengyu (expression de quatre caracteres) qui contient le caractere,
    accompagne de son explication.
Regles :
- la phrase fait 6 a 16 caracteres, vocabulaire simple (HSK 1-2) ;
- le pinyin est accentue (ni hao), jamais numerote (ni3 hao3) ;
- la traduction francaise est naturelle et concise ;
- pour un chengyu, ajoute une explication francaise courte (sinon laisse une chaine vide) ;
- reponds UNIQUEMENT par un objet JSON valide sur UNE SEULE LIGNE :
  {"caractere": ["phrase", "pinyin", "traduction francaise", "explication ou chaine vide"], ...}
- aucune phrase avant ou apres, aucune balise de code.

'@
    $corps = ($lot | ForEach-Object {
        $mots = (@($_.words) | ForEach-Object { @($_)[0] } | Select-Object -First 3) -join ', '
        "- " + $_.char + "  (" + $_.pinyin + " — " + (@($_.meaning) -join '') + ")" + $(if ($mots) { "   mots : " + $mots } else { "" })
    }) -join "`n"
    [IO.File]::WriteAllText($promptPath, ($entete + $corps), $utf8)

    $chrono = [Diagnostics.Stopwatch]::StartNew()
    $rep = & $oc agent --message-file $promptPath 2>&1 | Out-String
    $chrono.Stop()
    $d = $rep.IndexOf('{'); $f = $rep.LastIndexOf('}')
    if ($d -ge 0 -and $f -gt $d) {
        try {
            # L'analyse est confiee a Node : JSON.parse est strict et previsible,
            # la ou ConvertFrom-Json de Windows PowerShell rejette parfois un
            # tableau parfaitement valide (erreur « Tableau non valide »).
            $brut = Join-Path $env:TEMP ("dsh-phrases-brut$suffixe.json")
            [IO.File]::WriteAllText($brut, $rep.Substring($d, $f - $d + 1), $utf8)
            $parseur = Join-Path $env:TEMP 'dsh-parse-json.js'
            [IO.File]::WriteAllText($parseur, $scriptAnalyse, $utf8)
            $o = (& node $parseur $brut) | ConvertFrom-Json
            $ajout = 0
            foreach ($p in $o.PSObject.Properties) {
                if ($p.Name -in 'Count','Keys','Values','IsReadOnly','IsFixedSize','IsSynchronized','SyncRoot','Length') { continue }
                $v = @($p.Value)
                if ($v.Count -ge 3 -and ([string]$v[0]).Trim()) { $fait[$p.Name] = $v; $ajout++ }
            }
            Write-Host ("[$n/$lots] " + $lot.Count + " fiches -> " + $ajout + " phrase(s) en " + [math]::Round($chrono.Elapsed.TotalSeconds,1) + " s")
        } catch { Write-Host ("[$n/$lots] ECHEC d'analyse : " + $_.Exception.Message) -ForegroundColor Red }
    } else {
        Write-Host ("[$n/$lots] ECHEC : pas de JSON dans la reponse") -ForegroundColor Red
    }

    Ecrire-Phrases
}

Write-Host ""
Write-Host ("Phrases enregistrees : " + $fait.Count + "  -> " + $sortie) -ForegroundColor Green
Write-Host "Etape suivante : node apply-phrases.js" -ForegroundColor DarkGray
