# generer-composants-strict.ps1 — deuxième passe, consigne stricte.
#
# La première passe a produit des erreurs franches (composant répété, glose
# fausse, rôle inversé). Ici on ne demande que des décompositions SÛRES :
#   - 1 ou 2 composants, jamais le même deux fois ;
#   - la glose est le SENS du composant (pas une paraphrase) ;
#   - le rôle se lit dans l'étymologie : « X donne la prononciation » → son,
#     « X donne le sens » → sens, sinon composition ;
#   - dans le doute : liste vide.
#
# On ne traite que les fiches dont l'étymologie est DOCUMENTÉE (les 18 autres
# n'ont rien à décomposer).
#
# Sortie : data\composants-strict.json   { "长": [["长", "long", "composant"]], … }

[CmdletBinding()]
param(
    [int]$Taille = 15
)

$ErrorActionPreference = 'Stop'
$root   = $PSScriptRoot
$utf8   = New-Object Text.UTF8Encoding($false)
$oc     = Join-Path $env:APPDATA 'npm\openclaw.cmd'
$sortie = Join-Path $root 'data\composants-strict.json'
if (-not (Test-Path $oc)) { throw "OpenClaw introuvable : $oc" }

$fiches = @()
foreach ($niv in @('hsk1', 'hsk2', 'hsk3')) {
    $d = Get-Content (Join-Path $root ("data\cards-" + $niv + ".json")) -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($c in $d.cards) {
        if ($c.components -and $c.components.Count -gt 0) { continue }
        $ety = ''
        if ($c.etymology) { $ety = ($c.etymology -join ' ') }
        if ($ety -match 'non document') { continue }
        $fiches += [pscustomobject]@{ char = $c.char; sens = $c.meaning; ety = $ety }
    }
}
Write-Output ("Fiches à traiter (étymologie documentée) : " + $fiches.Count)

$deja = @{}
if (Test-Path $sortie) {
    $o = Get-Content $sortie -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $o.PSObject.Properties) { $deja[$p.Name] = $p.Value }
}
$reste = @($fiches | Where-Object { -not $deja.ContainsKey($_.char) })
Write-Output ("Déjà faits : " + $deja.Count + " · à faire : " + $reste.Count)
if ($reste.Count -eq 0) { Write-Output 'rien à faire.'; exit 0 }

for ($i = 0; $i -lt $reste.Count; $i += $Taille) {
    $lot = $reste[$i..([Math]::Min($i + $Taille - 1, $reste.Count - 1))]
    $lignes = ($lot | ForEach-Object { '  ' + $_.char + ' | ' + $_.sens + ' | ' + $_.ety }) -join "`n"
    $prompt = @"
Tu donnes la DÉCOMPOSITION d'un caractère chinois pour une fiche de vocabulaire.

Consignes, dans l'ordre :
1. Tu t'appuies UNIQUEMENT sur l'étymologie fournie. Si elle ne nomme pas les
   parties, tu réponds [] (liste vide) : on préfère un vide à une invention.
2. Un ou deux composants au maximum, JAMAIS le même deux fois.
3. La glose est le SENS PROPRE du composant, en 1 à 4 mots (口 = bouche, pas
   « jambe » ; 尸 = cadavre, pas « marché »).
4. Le rôle se lit dans l'étymologie, et seulement ainsi :
   - « X donne la prononciation »  → X a le rôle « son » ;
   - « X donne le sens »           → X a le rôle « sens » ;
   - sinon                          → rôle « composant ».
5. Dans le doute, liste vide.

Réponds UNIQUEMENT par un objet JSON, sans texte avant ni après :
{"经": [["纟", "fil", "sens"], ["工", "ouvrage", "son"]]}

Caractères (caractère | sens | étymologie) :
$lignes
"@
    $chemin = Join-Path $env:TEMP 'dsh-prompt-composants-strict.txt'
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
                        if (@('sens', 'son', 'composant') -notcontains $role) { $role = 'composant' }
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
    Write-Output ("[" + ([math]::Floor($i / $Taille) + 1) + "] " + $lot.Count + " fiches -> " + $n + " réponses en " + $sec + " s")
}

Write-Output ""
Write-Output ("Enregistrés : " + $deja.Count + " -> " + $sortie)
Write-Output "Étape suivante : python apply-composants-strict.py"
