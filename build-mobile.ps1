<#
    ==========================================================================
    build-mobile.ps1 — construit une version « un seul fichier » des cartes
    ==========================================================================

    Produit cartes-mobile.html : la page, le style, la logique ET les 41 fiches
    reunis dans un unique fichier HTML. Aucun serveur, aucun reseau : tu peux le
    copier sur un telephone et l'ouvrir directement.

    A QUOI CA SERT
    --------------
    Le site normal a besoin d'un serveur (un fichier ouvert en file:// ne peut
    pas lire data/cards.json). Cette version contourne la limite en integrant
    les donnees dans la page, sous forme de window.__CARDS__ : app.js les
    detecte et ne fait aucun appel reseau.

    CE QU'ON PERD
    -------------
    La progression (localStorage) n'est pas garantie en file:// : Chrome
    l'interdit, Firefox l'autorise. L'application reste utilisable, mais la
    progression peut repartir de zero a chaque ouverture. Pour la conserver
    a coup sur, il faut une origine http(s) : serveur local, ou hebergement.

    Les liens du menu disparaissent : ils renvoient vers la page « Themes »,
    qui n'existe pas dans un fichier unique. Le bouton burger et
    l'interrupteur clair/sombre, eux, restent — ils marchent hors ligne.

    USAGE
    -----
        .\build-mobile.ps1
        .\build-mobile.ps1 -Output C:\chemin\cartes.html
#>
[CmdletBinding()]
param([string]$Output = 'cartes-mobile.html')

$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)   # UTF-8 sans BOM

$root = $PSScriptRoot
$read = { param($p) [IO.File]::ReadAllText((Join-Path $root $p), [Text.Encoding]::UTF8) }

$html = & $read 'index.html'
$css  = & $read 'assets\style.css'
$js   = & $read 'assets\app.js'
$json = & $read 'data\cards-hsk1.json'

# On utilise .Replace() et non -replace : le CSS, le JS et le JSON contiennent
# des caracteres $, que -replace interpreterait comme des references de regex.
$html = $html.Replace('<link rel="stylesheet" href="assets/style.css">',
                      "<style>`r`n$css`r`n</style>")

$html = $html.Replace('<script src="assets/app.js"></script>',
                      "<script>window.__CARDS__ = $json;</script>`r`n<script>`r`n$js`r`n</script>")

# Le manifeste et le service worker n'ont aucun sens dans un fichier local.
$html = $html.Replace('<link rel="manifest" href="manifest.json">', '')

# Dans un fichier unique, les liens du menu (vers theme.html) ne menent nulle
# part : on retire les <a>. Le bouton burger et l'interrupteur clair/sombre,
# eux, restent : ils fonctionnent tres bien hors ligne.
$html = $html -replace '(?s)\s*<a href="(?:theme|index)\.html[^"]*"[^>]*>.*?</a>', ''
# Le niveau n'a pas de sens dans un fichier unique : il n'y en a qu'un.
$html = $html -replace '\s*<p class="menu-titre">Niveau</p>', ''

$html = $html.Replace('<title>Cartes — 汉字</title>',
                      '<title>Cartes 汉字 — hors ligne</title>')

$out = Join-Path $root $Output
[IO.File]::WriteAllText($out, $html, $utf8)

Write-Host "Fichier ecrit : $out" -ForegroundColor Green
Write-Host ("Taille : {0} Ko" -f [math]::Round((Get-Item $out).Length / 1KB, 1)) -ForegroundColor Green
Write-Host "Contient bien les donnees : $($html.Contains('window.__CARDS__'))" -ForegroundColor DarkGray
