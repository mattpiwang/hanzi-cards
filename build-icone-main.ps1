<#
    ==========================================================================
    build-icone-main.ps1 — dessine l'icône « main, index levé » du carré 田字格
    ==========================================================================

    POURQUOI UN DESSIN PLUTÔT QU'UN EMOJI
    -------------------------------------
    Le rendu d'un emoji change d'un système à l'autre : teinte de peau, ombres,
    orientation, taille optique. Un PNG dessiné donne le même résultat partout,
    et peut se décliner par thème.

    PRODUIT
    -------
        icons\main-index-sombre.png   gris clair  (thème sombre)
        icons\main-index-clair.png    gris chaud  (thème clair)

    Le dessin est fait quatre fois plus grand puis réduit : c'est la réduction
    qui donne des bords nets. Aucune dépendance — System.Drawing, comme les
    icônes de l'application.

    USAGE
    -----
        .\build-icone-main.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$TAILLE = 64
$SUR = 4
$n = $TAILLE * $SUR
$dossier = Join-Path $PSScriptRoot 'icons'
if (-not (Test-Path $dossier)) { New-Item -ItemType Directory -Path $dossier | Out-Null }

function New-PathArrondi([single]$x, [single]$y, [single]$l, [single]$h, [single]$r) {
    $chemin = New-Object Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $chemin.AddArc($x, $y, $d, $d, 180, 90)
    $chemin.AddArc($x + $l - $d, $y, $d, $d, 270, 90)
    $chemin.AddArc($x + $l - $d, $y + $h - $d, $d, $d, 0, 90)
    $chemin.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $chemin.CloseFigure()
    return $chemin
}

function New-IconeMain([Drawing.Color]$couleur, [string]$fichier) {
    $grand = New-Object Drawing.Bitmap($n, $n, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [Drawing.Graphics]::FromImage($grand)
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([Drawing.Color]::Transparent)
    $pinceau = New-Object Drawing.SolidBrush($couleur)

    # Les cotes sont pensées dans un carré de 64 : d'où la multiplication.
    $formes = @(
        @(17, 31, 34, 25, 11),    # le poing
        @(24, 7, 12, 31, 6),      # l'index levé
        @(11, 35, 9, 15, 4)       # le pouce, écarté du poing
    )
    foreach ($f in $formes) {
        $p = New-PathArrondi ($f[0] * $SUR) ($f[1] * $SUR) ($f[2] * $SUR) ($f[3] * $SUR) ($f[4] * $SUR)
        $g.FillPath($pinceau, $p)
        $p.Dispose()
    }

    # Les doigts repliés : deux fentes effacées dans le poing. SourceCopy écrit
    # l'alpha tel quel, donc on efface réellement au lieu de peindre par-dessus.
    $g.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
    $gomme = New-Object Drawing.SolidBrush([Drawing.Color]::Transparent)
    foreach ($x in 37.5, 44.5) {
        $g.FillRectangle($gomme, [single]($x * $SUR), [single](33 * $SUR), [single](1.8 * $SUR), [single](22 * $SUR))
    }

    # La réduction finale : c'est elle qui anticrénèle les bords.
    $fin = New-Object Drawing.Bitmap($TAILLE, $TAILLE, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g2 = [Drawing.Graphics]::FromImage($fin)
    $g2.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g2.Clear([Drawing.Color]::Transparent)
    $g2.DrawImage($grand, 0, 0, $TAILLE, $TAILLE)

    $fin.Save($fichier, [Drawing.Imaging.ImageFormat]::Png)

    $g2.Dispose(); $fin.Dispose(); $gomme.Dispose(); $pinceau.Dispose()
    $g.Dispose(); $grand.Dispose()
}

$couleurs = [ordered]@{
    'main-index-sombre.png' = [Drawing.Color]::FromArgb(255, 154, 167, 180)
    'main-index-clair.png'  = [Drawing.Color]::FromArgb(255, 107, 98, 80)
}

foreach ($nom in $couleurs.Keys) {
    $fichier = Join-Path $dossier $nom
    New-IconeMain $couleurs[$nom] $fichier
    Write-Host ("  ecrit : icons\{0}  ({1} o)" -f $nom, (Get-Item $fichier).Length) -ForegroundColor Green
}
