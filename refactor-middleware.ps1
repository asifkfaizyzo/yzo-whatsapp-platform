# refactor-middleware.ps1
# Phase 3-5: Consolidate middlewares/ → middleware/, update all imports, chains, and req properties

$root = "Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform\backend\src"
$files = Get-ChildItem -Path $root -Recurse -Filter *.js |
    Where-Object { $_.FullName -notmatch '\\middlewares\\' }

$count = 0

foreach ($file in $files) {
    $c = Get-Content $file.FullName -Raw
    $o = $c

    # ═══════════════════════════════════════════════════════════
    # 1. NON-AUTH IMPORT PATH FIXES (relocated files)
    # ═══════════════════════════════════════════════════════════
    $c = $c -replace 'middlewares/validate\.middleware\.js', 'middleware/validate.js'
    $c = $c -replace 'middlewares/subscription\.access\.js', 'middleware/subscriptionAccess.js'
    $c = $c -replace 'middlewares/upload\.middleware\.js', 'middleware/upload.js'
    $c = $c -replace 'middlewares/upload\.template\.js', 'middleware/uploadTemplate.js'
    $c = $c -replace 'middlewares/auth\.bullBoard\.js', 'middleware/bullBoardAuth.js'

    # ═══════════════════════════════════════════════════════════
    # 2. AUTH IMPORT LINE REPLACEMENTS
    #    Old single import → authenticate + role guard
    # ═══════════════════════════════════════════════════════════

    # --- verifySuperAdmin (2 levels deep) ---
    $c = $c -replace 'import \{ verifySuperAdmin \} from "\.\./\.\./middlewares/auth\.superAdmin\.js";',
        "import { authenticate } from `"../../middleware/authenticate.js`";`r`nimport { requireSRAdmin } from `"../../middleware/requireSRAdmin.js`";"

    # --- verifyTenantOrUser (2 levels) ---
    $c = $c -replace 'import \{ verifyTenantOrUser \} from "\.\./\.\./middlewares/auth\.verifyTenantOrUser\.js";',
        "import { authenticate } from `"../../middleware/authenticate.js`";`r`nimport { requireTenantOrUser } from `"../../middleware/requireTenantOrUser.js`";"

    # --- verifyUser (2 levels) ---
    $c = $c -replace 'import \{ verifyUser \} from "\.\./\.\./middlewares/auth\.user\.js";',
        "import { authenticate } from `"../../middleware/authenticate.js`";`r`nimport { requireUser } from `"../../middleware/requireUser.js`";"

    # --- verifyTenant (2 levels) ---
    $c = $c -replace 'import \{ verifyTenant \} from "\.\./\.\./middlewares/auth\.tenant\.js";',
        "import { authenticate } from `"../../middleware/authenticate.js`";`r`nimport { requireTenant } from `"../../middleware/requireTenant.js`";"

    # --- verifyTenant (3 levels — tenant subfolders) ---
    $c = $c -replace 'import \{ verifyTenant \} from "\.\./\.\./\.\./middlewares/auth\.tenant\.js";',
        "import { authenticate } from `"../../../middleware/authenticate.js`";`r`nimport { requireTenant } from `"../../../middleware/requireTenant.js`";"

    # --- verifyOnboarding (2 levels) ---
    $c = $c -replace 'import \{ verifyOnboarding \} from "\.\./\.\./middlewares/auth\.tenant\.js";',
        "import { authenticate } from `"../../middleware/authenticate.js`";`r`nimport { requireOnboarding } from `"../../middleware/requireOnboarding.js`";"

    # ═══════════════════════════════════════════════════════════
    # 3. MIDDLEWARE CHAIN REPLACEMENTS
    #    Longer names FIRST to prevent partial matches
    # ═══════════════════════════════════════════════════════════
    $c = $c -replace '\bverifyTenantOrUser\b', 'authenticate, requireTenantOrUser'
    $c = $c -replace '\bverifySuperAdmin\b', 'authenticate, requireSRAdmin'
    $c = $c -replace '\bverifyOnboarding\b', 'authenticate, requireOnboarding'
    $c = $c -replace '\bverifyTenant\b', 'authenticate, requireTenant'
    $c = $c -replace '\bverifyUser\b', 'authenticate, requireUser'

    # ═══════════════════════════════════════════════════════════
    # 4. REQ PROPERTY RENAMES
    #    superAdminId before superAdmin to prevent partial match
    # ═══════════════════════════════════════════════════════════
    $c = $c -replace 'req\.superAdminId', 'req.srAdminId'
    $c = $c -replace 'req\.superAdmin', 'req.srAdmin'
    $c = $c -replace 'req\.userType', 'req.actorType'

    if ($c -ne $o) {
        [System.IO.File]::WriteAllText($file.FullName, $c)
        $count++
        Write-Host "✅ $($file.FullName.Replace($root, 'src'))"
    }
}

Write-Host "`n📊 Updated $count files."
Write-Host ""
Write-Host "⚠️  MANUAL FIX NEEDED — 3 files have multi-line imports the script can't handle:"
Write-Host "   1. src/modules/whatsapp/whatsapp.routes.js"
Write-Host "   2. src/modules/zoho/zoho.routes.js"
Write-Host "   3. src/modules/tenant/users/tenant.users.routes.js"
Write-Host ""
Write-Host "   For each: replace the multi-line import block with authenticate + guard imports."