package net.crimsys.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Claymorphism "inflated plasticine" look:
 *  - large border radius,
 *  - a soft outer drop shadow offset *downwards* (light from above),
 *  - an inner top-left highlight (the glossy "pinch" of clay),
 *  - slightly raised surface color over the background.
 */
fun Modifier.claySurface(
    elevation: Dp = 8.dp,
    shape: Shape = RoundedCornerShape(24.dp),
    shadowColor: Color = Color(0x33A08CB8),
): Modifier =
    this
        .shadow(elevation = elevation, shape = shape, ambientColor = shadowColor, spotColor = shadowColor)
        .clip(shape)
        .background(
            Brush.verticalGradient(
                colors = listOf(
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                    MaterialTheme.colorScheme.surface,
                ),
            ),
        )

/** Outlined clay chip surface (no elevation) for secondary elements. */
fun Modifier.clayInset(shape: Shape = RoundedCornerShape(18.dp)): Modifier =
    this
        .clip(shape)
        .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.72f))

/** Standard clay card container used across all screens. */
@Composable
fun ClayCard(
    modifier: Modifier = Modifier,
    elevation: Dp = 10.dp,
    shape: Shape = MaterialTheme.shapes.large,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier.claySurface(elevation, shape),
            shape = shape,
            colors =
                CardDefaults.cardColors(
                    containerColor = Color.Transparent,
                ),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            content = content,
        )
    } else {
        Card(
            modifier = modifier.claySurface(elevation, shape),
            shape = shape,
            colors = CardDefaults.cardColors(containerColor = Color.Transparent),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            content = content,
        )
    }
}

/** Rounded urgency pill (critical/high/normal) used in lists and dashboards. */
@Composable
fun UrgencyPill(
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clayInset(RoundedCornerShape(50))
                .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Box(
            Modifier
                .background(color.copy(alpha = 0.18f), RoundedCornerShape(50))
                .padding(horizontal = 10.dp, vertical = 3.dp),
        ) {
            androidx.compose.material3.Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = color,
            )
        }
    }
}
