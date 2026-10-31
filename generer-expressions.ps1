# generer-expressions.ps1 — 歇后语 et argot, proposés par Ziya, vérifiés ensuite.
#
#   .\generer-expressions.ps1 -Quoi xiehouyu      (devinettes populaires)
#   .\generer-expressions.ps1 -Quoi argot         (expressions récentes)
#
# Sortie : data\expressions-<quoi>.json
#   xiehouyu : [{ "q": "哑巴吃黄连", "a": "有苦说不出", "pinyin": "yǎ ba chī huánglián",
#                 "fr": "…", "note": "…" }, …]
#   argot    : [{ "mot": "躺平", "pinyin": "tǎng píng", "fr": "…", "note": "…",
#                 "annee": "2021" }, …]
#
# Les 歇后语 seront VÉRIFIÉS contre data\..\hanzi-db\xiehouyu.json : ceux qui n'y
# figurent pas sont rejetés (la base sert de garde-fou, pas de source).
# L'argot n'a pas de base : il est marqué par son année, et rien d'autre.

[CmdletBinding()]
param(
    [ValidateSet('xiehouyu', 'argot')] [string]$Quoi = 'xiehouyu',
    [int]$Taille = 20,
    [int]$Total = 40
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding($false)
$oc   = Join-Path $env:APPDATA 'npm\openclaw.cmd'
if (-not (Test-Path $oc)) { throw "OpenClaw introuvable : $oc" }
$sortie = Join-Path $root ("data\expressions-" + $Quoi + ".json")

# ce qui est déjà obtenu
$deja = @()
if (Test-Path $sortie) {
    $lu = Get-Content $sortie -Raw -Encoding UTF8 | ConvertFrom-Json
    $deja = @($lu)
}
Write-Host ("Déjà obtenus : " + $deja.Count + " / " + $Total) -ForegroundColor Cyan

if ($Quoi -eq 'xiehouyu') {
    $entete = @'
Tu connais le patrimoine oral chinois. Donne des 歇后语 (devinettes en deux
parties) TRÈS courantes en Chine, celles qu'un adulte reconnaît tout de suite.

Pour chacune :
- "q" : la première partie (l'image), en caractères chinois, 3 à 8 caractères ;
- "a" : la seconde partie (la chute), en caractères chinois, 2 à 10 caractères ;
- "pinyin" : la prononciation des DEUX parties, tons écrits (ā á ǎ à) ;
- "fr" : la chute traduite en français, 2 à 6 mots ;
- "note" : une phrase courte (moins de 20 mots) qui explique l'image.

Réponds UNIQUEMENT par un tableau JSON, sans texte autour :
[{"q":"哑巴吃黄连","a":"有苦说不出","pinyin":"yǎ ba chī huánglián, yǒu kǔ shuō bù chū","fr":"amer mais impossible à dire","note":"Un muet qui mange de l'amer : il souffre en silence."}]
'@
} else {
    $entete = @'
Tu connais la langue chinoise d'aujourd'hui. Donne des expressions d'ARGOT
chinois réellement employées entre 2018 et 2025 (réseaux sociaux, jeunesse).

Pour chacune :
- "mot" : l'expression en caractères chinois ;
- "pinyin" : sa prononciation, tons écrits (ā á ǎ à) ;
- "fr" : son sens en français, 2 à 6 mots ;
- "note" : une phrase courte (moins de 20 mots) sur l'usage et le registre ;
- "annee" : l'année approximative où elle est apparue (4 chiffres).

Réponds UNIQUEMENT par un tableau JSON, sans texte autour :
[{"mot":"躺平","pinyin":"tǎng píng","fr":"laisser tomber, ne plus lutter","note":"Refus de la course au succès ; très usité chez les jeunes.","annee":"2021"}]
'@
}

$manquant = $Total - $deja.Count
$lots = [Math]::Ceiling($manquant / $Taille)
for ($i = 0; $i -lt $lots; $i++) {
    $combien = [Math]::Min($Taille, $Total - $deja.Count)
    $prompt = $entete + "`n`nDonne $combien entrées, différentes de celles-ci :`n" +
              (($deja | ForEach-Object { if ($_.mot) { "- " + $_.mot } else { "- " + $_.q + " — " + $_.a } }) -join "`n")
    $chemin = Join-Path $env:TEMP ("dsh-prompt-" + $Quoi + ".txt")
    [IO.File]::WriteAllText($chemin, $prompt, $utf8)
    $avant = Get-Date
    $rep = & $oc agent --message-file $chemin 2>&1 | Out-String
    $d = $rep.IndexOf('[')
    $f = $rep.LastIndexOf(']')
    $n = 0
    if ($d -ge 0 -and $f -gt $d) {
        try {
            $liste = $rep.Substring($d, $f - $d + 1) | ConvertFrom-Json
            foreach ($e in @($liste)) {
                if ($Quoi -eq 'xiehouyu' -and $e.q -and $e.a -and $e.fr) {
                    $deja += $e; $n++
                } elseif ($Quoi -eq 'argot' -and $e.mot -and $e.fr) {
                    $deja += $e; $n++
                }
            }
        } catch { Write-Host "  lot illisible" -ForegroundColor DarkYellow }
    }
    $sec = [math]::Round(((Get-Date) - $avant).TotalSeconds, 1)
    Write-Host ("[" + ($i + 1) + "/" + $lots + "] +" + $n + " en " + $sec + " s · total " + $deja.Count)
    [IO.File]::WriteAllText($sortie, ($deja | ConvertTo-Json -Depth 5), $utf8)
}

Write-Host ""
Write-Host ("Enregistrés : " + $deja.Count + " -> " + $sortie) -ForegroundColor Green
