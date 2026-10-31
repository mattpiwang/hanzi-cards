# generer-composants.ps1 — fait extraire par Ziya les composants manquants.
#
# Pour chaque fiche SANS composants, on donne à Ziya : le caractère, son sens,
# et son étymologie française. On lui demande d'en tirer la décomposition, en
# s'appuyant SUR L'ÉTYMOLOGIE (qui nomme souvent les parties) et non sur son
# imagination. Sortie :  data\composants.json
#     { "年": [["干", "grain", "composant"], ["人", "homme", "composant"]], … }
#
# Relançable : le fichier de sortie est relu au démarrage, réécrit après chaque lot.

[CmdletBinding()]
param(
    [int]$Taille = 21
)

$ErrorActionPreference = 'Stop'
$root  = $PSScriptRoot
$utf8  = New-Object Text.UTF8Encoding($false)
$oc    = Join-Path $env:APPDATA 'npm\openclaw.cmd'
$sortie = Join-Path $root 'data\composants.json'
if (-not (Test-Path $oc)) { throw "OpenClaw introuvable : $oc" }

# ---- les fiches sans composants ------------------------------------------
$fiches = @()
foreach ($niv in @('hsk1', 'hsk2', 'hsk3')) {
    $d = Get-Content (Join-Path $root ("data\cards-" + $niv + ".json")) -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($c in $d.cards) {
        if (-not $c.components -or $c.components.Count -eq 0) {
            $ety = ''
            if ($c.etymology) { $ety = ($c.etymology -join ' ') }
            $fiches += [pscustomobject]@{ char = $c.char; sens = $c.meaning; ety = $ety }
        }
    }
}
Write-Output ("Fiches sans composants : " + $fiches.Count)

# ---- ce qui est déjà fait ------------------------------------------------
$deja = @{}
if (Test-Path $sortie) {
    $o = Get-Content $sortie -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $o.PSObject.Properties) { $deja[$p.Name] = $p.Value }
}
$reste = @($fiches | Where-Object { -not $deja.ContainsKey($_.char) })
Write-Output ("Déjà faits : " + $deja.Count + " · à faire : " + $reste.Count)
if ($reste.Count -eq 0) { Write-Output 'rien à faire.'; exit 0 }

$roles = 'pictogramme, indicateur, sens, son, composant'

for ($i = 0; $i -lt $reste.Count; $i += $Taille) {
    $lot = $reste[$i..([Math]::Min($i + $Taille - 1, $reste.Count - 1))]
    $lignes = ($lot | ForEach-Object { '  ' + $_.char + ' | ' + $_.sens + ' | ' + $_.ety }) -join "`n"
    $prompt = @"
Tu décomposes des caractères chinois en composants, POUR UNE FICHE PÉDAGOGIQUE.

Règle absolue : tu t'appuies sur l'étymologie fournie. Si elle nomme les parties
(par exemple « 母 donne la prononciation », « une bougie qui brûle »), tu les
reprends. Tu n'inventes pas une décomposition absente de l'étymologie ; si elle
n'en donne aucune, tu réponds une liste vide.

Chaque composant : [caractère, glose française courte (2 à 4 mots), rôle].
Rôles autorisés, à recopier exactement : $roles

Réponds UNIQUEMENT par un objet JSON, sans texte avant ni après :
{"年": [["干", "grain", "composant"], ["人", "homme", "composant"]]}

Caractères (caractère | sens | étymologie) :
$lignes
"@
    $chemin = Join-Path $env:TEMP 'dsh-prompt-composants.txt'
    [IO.File]::WriteAllText($chemin, $prompt, $utf8)
    $avant = Get-Date
    $reponse = & $oc agent --message-file $chemin 2>&1 | Out-String
    $debut = $reponse.IndexOf('{')
    $fin   = $reponse.LastIndexOf('}')
    $n = 0
    if ($debut -ge 0 -and $fin -gt $debut) {
        try {
            $o = $reponse.Substring($debut, $fin - $debut + 1) | ConvertFrom-Json
            foreach ($p in $o.PSObject.Properties) {
                $liste = @()
                foreach ($comp in $p.Value) {
                    if ($comp -is [array] -and $comp.Count -ge 2 -and $comp[0]) {
                        $role = if ($comp.Count -ge 3 -and $comp[2]) { [string]$comp[2] } else { 'composant' }
                        if ($roles -notlike ('*' + $role + '*')) { $role = 'composant' }
                        $liste += , @([string]$comp[0], [string]$comp[1], $role)
                    }
                }
                $deja[$p.Name] = $liste
                $n++
            }
        } catch { Write-Output ('  lot ' + ($i / $Taille + 1) + ' : réponse illisible') }
    }
    $obj = [ordered]@{}
    foreach ($k in $deja.Keys) { $obj[$k] = $deja[$k] }
    [IO.File]::WriteAllText($sortie, ($obj | ConvertTo-Json -Depth 6), $utf8)
    $sec = [math]::Round(((Get-Date) - $avant).TotalSeconds, 1)
    Write-Output ("[" + ([math]::Floor($i / $Taille) + 1) + "] " + $lot.Count + " fiches -> " + $n + " décompositions en " + $sec + " s")
}

Write-Output ""
Write-Output ("Composants enregistrés : " + $deja.Count + " -> " + $sortie)
Write-Output "Étape suivante : python apply-composants.py"
