package net.crimsys.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ---------------------------------------------------------------------------
// Claymorphism palette — matches the web app (Tailwind config tokens).
// ---------------------------------------------------------------------------

// Warm clay neutrals
val ClayBackground = Color(0xFFF3EDE4)
val ClaySurface = Color(0xFFFCF8F2)
val ClaySurfaceHigh = Color(0xFFFFFFFF)
val ClayOutline = Color(0xFFD8CFC2)
val ClayTextPrimary = Color(0xFF2A2438)
val ClayTextSecondary = Color(0xFF6E6478)

// Brand purple
val ClayPrimary = Color(0xFF6B4FA0)
val ClayOnPrimary = Color(0xFFFFFFFF)
val ClayPrimaryContainer = Color(0xFFE7DBFF)
val ClayOnPrimaryContainer = Color(0xFF3B2A5C)

// Dark theme
val ClayDarkBackground = Color(0xFF1A1625)
val ClayDarkSurface = Color(0xFF241E33)
val ClayDarkOutline = Color(0xFF3C3450)
val ClayDarkTextPrimary = Color(0xFFEDE8F5)
val ClayDarkTextSecondary = Color(0xFFB0A8C0)
val ClayDarkPrimary = Color(0xFFB79CF0)
val ClayDarkPrimaryContainer = Color(0xFF4A3A6E)

// Global urgency tokens (identical hex values to the web Tailwind config)
val UrgencyCritical = Color(0xFFC0392B) // deadlines <= 3 days
val UrgencyHigh = Color(0xFFF1C40F) // deadlines <= 7 days
val UrgencyNormal = Color(0xFF27AE60) // deadlines > 14 days

/** Extended scheme so any screen can read urgency colors from theme. */
data class UrgencyColors(
    val critical: Color,
    val high: Color,
    val normal: Color,
)

val LocalUrgencyColors = staticCompositionLocalOf {
    UrgencyColors(UrgencyCritical, UrgencyHigh, UrgencyNormal)
}

// ---------------------------------------------------------------------------
// Typography — Cairo is bundled for Arabic-first rendering.
// ---------------------------------------------------------------------------

/**
 * Cairo (SIL OFL) — the variable font ships as a single resource; each family
 * face pins the `wght` axis to its FontWeight via [FontVariation.Settings].
 */
private fun cairoFace(weight: FontWeight) =
    androidx.compose.ui.text.font.Font(
        resId = R.font.cairo_variable,
        weight = weight,
        variationSettings =
            androidx.compose.ui.text.font.FontVariation.Settings(
                androidx.compose.ui.text.font.FontVariation.weight(weight.weight),
            ),
    )

private val Cairo =
    androidx.compose.ui.text.font.FontFamily(
        cairoFace(FontWeight.Normal),
        cairoFace(FontWeight.Medium),
        cairoFace(FontWeight.SemiBold),
        cairoFace(FontWeight.Bold),
    )

private val CrimSysTypography =
    Typography(
        headlineLarge =
            TextStyle(
                fontFamily = Cairo,
                fontWeight = FontWeight.Bold,
                fontSize = 30.sp,
            ),
        headlineMedium =
            TextStyle(
                fontFamily = Cairo,
                fontWeight = FontWeight.Bold,
                fontSize = 26.sp,
            ),
        headlineSmall =
            TextStyle(
                fontFamily = Cairo,
                fontWeight = FontWeight.SemiBold,
                fontSize = 22.sp,
            ),
        titleLarge =
            TextStyle(
                fontFamily = Cairo,
                fontWeight = FontWeight.SemiBold,
                fontSize = 20.sp,
            ),
        titleMedium =
            TextStyle(
                fontFamily = Cairo,
                fontWeight = FontWeight.SemiBold,
                fontSize = 17.sp,
            ),
        titleSmall =
            TextStyle(
                fontFamily = Cairo,
                fontWeight = FontWeight.Medium,
                fontSize = 15.sp,
            ),
        bodyLarge = TextStyle(fontFamily = Cairo, fontSize = 16.sp),
        bodyMedium = TextStyle(fontFamily = Cairo, fontSize = 14.sp),
        bodySmall = TextStyle(fontFamily = Cairo, fontSize = 12.sp),
        labelLarge =
            TextStyle(
                fontFamily = Cairo,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            ),
        labelMedium = TextStyle(fontFamily = Cairo, fontSize = 12.sp),
        labelSmall = TextStyle(fontFamily = Cairo, fontSize = 11.sp),
    )

// Claymorphism shapes: plush, heavily rounded.
private val CrimSysShapes =
    Shapes(
        extraSmall = RoundedCornerShape(10.dp),
        small = RoundedCornerShape(14.dp),
        medium = RoundedCornerShape(20.dp),
        large = RoundedCornerShape(26.dp),
        extraLarge = RoundedCornerShape(34.dp),
    )

// ---------------------------------------------------------------------------
// Color schemes
// ---------------------------------------------------------------------------

private val LightClayColors =
    lightColorScheme(
        primary = ClayPrimary,
        onPrimary = ClayOnPrimary,
        primaryContainer = ClayPrimaryContainer,
        onPrimaryContainer = ClayOnPrimaryContainer,
        background = ClayBackground,
        onBackground = ClayTextPrimary,
        surface = ClaySurface,
        onSurface = ClayTextPrimary,
        surfaceVariant = ClaySurfaceHigh,
        onSurfaceVariant = ClayTextSecondary,
        outline = ClayOutline,
        secondary = Color(0xFF4A7A5C),
        secondaryContainer = Color(0xFFD9EDE1),
        onSecondaryContainer = Color(0xFF1F3D2B),
        error = UrgencyCritical,
        errorContainer = Color(0xFFF6D9D5),
        onErrorContainer = Color(0xFF5C1A12),
    )

private val DarkClayColors =
    darkColorScheme(
        primary = ClayDarkPrimary,
        onPrimary = Color(0xFF241A38),
        primaryContainer = ClayDarkPrimaryContainer,
        onPrimaryContainer = Color(0xFFE0D4FF),
        background = ClayDarkBackground,
        onBackground = ClayDarkTextPrimary,
        surface = ClayDarkSurface,
        onSurface = ClayDarkTextPrimary,
        surfaceVariant = Color(0xFF2E2742),
        onSurfaceVariant = ClayDarkTextSecondary,
        outline = ClayDarkOutline,
        secondary = Color(0xFF7FC49B),
        secondaryContainer = Color(0xFF284536),
        onSecondaryContainer = Color(0xFFCDEBDA),
        error = Color(0xFFE8837A),
        errorContainer = Color(0xFF5C2A24),
        onErrorContainer = Color(0xFFF6D9D5),
    )

// ---------------------------------------------------------------------------
// Theme entry
// ---------------------------------------------------------------------------

@Composable
fun CrimSysTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkClayColors else LightClayColors,
        typography = CrimSysTypography,
        shapes = CrimSysShapes,
        content = content,
    )
}

/** Convenience accessor: `MaterialTheme.urgency`. */
val MaterialTheme.urgency: UrgencyColors
    @Composable get() = LocalUrgencyColors.current
